const path = require('path');
const assert = require('assert/strict');

const createRes = () => {
  const state = { statusCode: 200, body: null };
  return {
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(payload) {
      state.body = payload;
      return this;
    },
    state
  };
};

const loadWithMocks = (modulePath, mocks = {}) => {
  const resolvedModule = require.resolve(modulePath);
  const injectedDeps = [];

  for (const [request, mockExports] of Object.entries(mocks)) {
    const resolvedDep = require.resolve(request, {
      paths: [path.dirname(resolvedModule)]
    });

    injectedDeps.push({ resolvedDep, previous: require.cache[resolvedDep] });
    require.cache[resolvedDep] = {
      id: resolvedDep,
      filename: resolvedDep,
      loaded: true,
      exports: mockExports
    };
  }

  const previousModule = require.cache[resolvedModule];
  delete require.cache[resolvedModule];
  const loaded = require(resolvedModule);

  return {
    loaded,
    restore() {
      delete require.cache[resolvedModule];
      if (previousModule) {
        require.cache[resolvedModule] = previousModule;
      }

      injectedDeps.forEach(({ resolvedDep, previous }) => {
        if (previous) {
          require.cache[resolvedDep] = previous;
        } else {
          delete require.cache[resolvedDep];
        }
      });
    }
  };
};

const tests = [];
const addTest = (name, fn) => tests.push({ name, fn });

addTest('auth.login -> 400 when credentials missing', async () => {
  const dbMock = { query: async () => ({ rows: [] }) };
  const { loaded: authController, restore } = loadWithMocks(
    path.resolve(__dirname, '../src/controllers/auth.controller.js'),
    {
      '../lib/db': dbMock,
      '../lib/audit': { logAuditEvent: async () => {} },
      bcryptjs: { compare: async () => false, genSalt: async () => '', hash: async () => '' },
      jsonwebtoken: { sign: () => 'token-test' }
    }
  );

  try {
    const req = { body: { email: '', motDePasse: '' }, headers: {} };
    const res = createRes();

    await authController.login(req, res);

    assert.equal(res.state.statusCode, 400);
    assert.deepEqual(res.state.body, { message: 'Email et mot de passe requis' });
  } finally {
    restore();
  }
});

addTest('auth.login -> 401 when user not found', async () => {
  const queue = [
    { rows: [] },
    { rows: [] },
    { rows: [{ failed_attempts: 1, locked_until: null }] }
  ];

  const dbMock = {
    query: async () => {
      if (queue.length === 0) throw new Error('Unexpected query call');
      return queue.shift();
    }
  };

  const { loaded: authController, restore } = loadWithMocks(
    path.resolve(__dirname, '../src/controllers/auth.controller.js'),
    {
      '../lib/db': dbMock,
      '../lib/audit': { logAuditEvent: async () => {} },
      bcryptjs: { compare: async () => false, genSalt: async () => '', hash: async () => '' },
      jsonwebtoken: { sign: () => 'token-test' }
    }
  );

  try {
    const req = { body: { email: 'no.user@ecole.tg', motDePasse: 'x' }, headers: {} };
    const res = createRes();

    await authController.login(req, res);

    assert.equal(res.state.statusCode, 401);
    assert.deepEqual(res.state.body, { message: 'Email ou mot de passe incorrect' });
  } finally {
    restore();
  }
});

addTest('auth.login -> 200 and token on success', async () => {
  const queue = [
    { rows: [] },
    {
      rows: [
        {
          id: 'u1',
          nom: 'Admin',
          prenom: 'Root',
          email: 'admin@ecole.tg',
          mot_de_passe: 'hashed',
          role: 'ADMIN',
          actif: true,
          enseignant_id: null
        }
      ]
    },
    { rows: [] }
  ];

  const dbMock = {
    query: async () => {
      if (queue.length === 0) throw new Error('Unexpected query call');
      return queue.shift();
    }
  };

  const { loaded: authController, restore } = loadWithMocks(
    path.resolve(__dirname, '../src/controllers/auth.controller.js'),
    {
      '../lib/db': dbMock,
      '../lib/audit': { logAuditEvent: async () => {} },
      bcryptjs: { compare: async () => true, genSalt: async () => '', hash: async () => '' },
      jsonwebtoken: { sign: () => 'token-test' }
    }
  );

  try {
    process.env.JWT_SECRET = 'test-secret-jwt';
    process.env.JWT_EXPIRES_IN = '8h';

    const req = { body: { email: 'admin@ecole.tg', motDePasse: 'Password123!' }, headers: {} };
    const res = createRes();

    await authController.login(req, res);

    assert.equal(res.state.statusCode, 200);
    assert.equal(res.state.body.token, 'token-test');
    assert.equal(res.state.body.role, 'ADMIN');
  } finally {
    restore();
  }
});

addTest('authorize -> allows configured role', async () => {
  const { loaded: authMiddleware, restore } = loadWithMocks(
    path.resolve(__dirname, '../src/middleware/auth.js'),
    {
      '../lib/db': { query: async () => ({ rows: [] }) },
      jsonwebtoken: { verify: () => ({ id: 'u1' }) }
    }
  );

  try {
    const req = { user: { role: 'ADMIN' } };
    const res = createRes();
    let nextCalled = false;

    authMiddleware.authorize('admin', 'directeur')(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.state.statusCode, 200);
  } finally {
    restore();
  }
});

addTest('authorize -> denies non configured role', async () => {
  const { loaded: authMiddleware, restore } = loadWithMocks(
    path.resolve(__dirname, '../src/middleware/auth.js'),
    {
      '../lib/db': { query: async () => ({ rows: [] }) },
      jsonwebtoken: { verify: () => ({ id: 'u1' }) }
    }
  );

  try {
    const req = { user: { role: 'ENSEIGNANT' } };
    const res = createRes();
    let nextCalled = false;

    authMiddleware.authorize('admin', 'directeur')(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.state.statusCode, 403);
    assert.match(String(res.state.body.message), /ENSEIGNANT/);
  } finally {
    restore();
  }
});

addTest('createNote -> rejects invalid periode', async () => {
  const queryCalls = [];
  const dbMock = {
    query: async (...args) => {
      queryCalls.push(args);
      return { rows: [] };
    }
  };

  const { loaded: noteController, restore } = loadWithMocks(
    path.resolve(__dirname, '../src/controllers/note.controller.js'),
    {
      '../lib/db': dbMock,
      '../lib/audit': { logAuditEvent: async () => {} }
    }
  );

  try {
    const req = {
      user: { id: 'u1', role: 'ADMIN' },
      body: {
        eleveId: 'e1',
        classeId: 'c1',
        matiereId: 'm1',
        typeEvaluation: 'DEVOIR',
        periode: 'invalid-period',
        anneeScolaire: '2025-2026',
        note: 12
      }
    };
    const res = createRes();

    await noteController.createNote(req, res);

    assert.equal(res.state.statusCode, 400);
    assert.deepEqual(res.state.body, { message: 'Periode invalide' });
    assert.equal(queryCalls.length, 0);
  } finally {
    restore();
  }
});

addTest('createNote -> rejects trimestre for lycee', async () => {
  const queue = [{ rows: [{ cycle: 'LYCEE' }] }];
  const dbMock = {
    query: async () => {
      if (queue.length === 0) throw new Error('Unexpected query call');
      return queue.shift();
    }
  };

  const { loaded: noteController, restore } = loadWithMocks(
    path.resolve(__dirname, '../src/controllers/note.controller.js'),
    {
      '../lib/db': dbMock,
      '../lib/audit': { logAuditEvent: async () => {} }
    }
  );

  try {
    const req = {
      user: { id: 'u1', role: 'ADMIN' },
      body: {
        eleveId: 'e1',
        classeId: 'c1',
        matiereId: 'm1',
        typeEvaluation: 'DEVOIR',
        periode: '1er Trimestre',
        anneeScolaire: '2025-2026',
        note: 14
      }
    };
    const res = createRes();

    await noteController.createNote(req, res);

    assert.equal(res.state.statusCode, 400);
    assert.equal(res.state.body.message, 'Periode incompatible avec le cycle de la classe');
  } finally {
    restore();
  }
});

addTest('createNote -> auto-loads coefficient from classe_matieres', async () => {
  const queryCalls = [];
  const queue = [
    { rows: [{ cycle: 'LYCEE' }] },
    { rows: [{ classe_coefficient: 3, matiere_coefficient: 2 }] },
    {
      rows: [
        {
          id: 'n1',
          eleve_id: 'e1',
          matiere_id: 'm1',
          classe_id: 'c1',
          annee_scolaire: '2025-2026'
        }
      ]
    }
  ];

  const dbMock = {
    query: async (...args) => {
      queryCalls.push(args);
      if (queue.length === 0) throw new Error('Unexpected query call');
      return queue.shift();
    }
  };

  const { loaded: noteController, restore } = loadWithMocks(
    path.resolve(__dirname, '../src/controllers/note.controller.js'),
    {
      '../lib/db': dbMock,
      '../lib/audit': { logAuditEvent: async () => {} }
    }
  );

  try {
    const req = {
      user: { id: 'u1', role: 'ADMIN' },
      body: {
        eleveId: 'e1',
        classeId: 'c1',
        matiereId: 'm1',
        typeEvaluation: 'DEVOIR',
        periode: '1er Semestre',
        anneeScolaire: '2025-2026',
        note: 15,
        noteMax: 20
      }
    };
    const res = createRes();

    await noteController.createNote(req, res);

    assert.equal(res.state.statusCode, 201);
    const insertCall = queryCalls[2];
    assert.equal(insertCall[1][9], 3);
  } finally {
    restore();
  }
});

addTest('getBulletin -> forbids enseignant role', async () => {
  const queryCalls = [];
  const dbMock = {
    query: async (...args) => {
      queryCalls.push(args);
      return { rows: [] };
    }
  };

  const { loaded: noteController, restore } = loadWithMocks(
    path.resolve(__dirname, '../src/controllers/note.controller.js'),
    {
      '../lib/db': dbMock,
      '../lib/audit': { logAuditEvent: async () => {} }
    }
  );

  try {
    const req = {
      user: { id: 'u1', role: 'ENSEIGNANT', enseignant_id: 't1' },
      params: { eleveId: 'e1' },
      query: { periode: '1er Semestre', anneeScolaire: '2025-2026' }
    };
    const res = createRes();

    await noteController.getBulletin(req, res);

    assert.equal(res.state.statusCode, 403);
    assert.equal(queryCalls.length, 0);
  } finally {
    restore();
  }
});

(async () => {
  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${name}`);
      console.error(error);
    }
  }

  console.log(`\nResultat: ${passed} passe(s), ${failed} echec(s)`);

  if (failed > 0) {
    process.exit(1);
  }
})();
