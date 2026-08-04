const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWithMocks } = require('./testUtils');

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

test('createNote rejects invalid periode', async () => {
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

test('createNote rejects trimestre for lycee', async () => {
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

test('createNote auto-loads coefficient from classe_matieres', async () => {
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

test('getBulletin forbids enseignant role', async () => {
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
