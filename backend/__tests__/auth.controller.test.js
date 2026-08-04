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

test('auth.login returns 400 when credentials are missing', async () => {
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

test('auth.login returns 401 when user is unknown', async () => {
  const queue = [
    { rows: [] },
    { rows: [] },
    { rows: [{ failed_attempts: 1, locked_until: null }] }
  ];

  const dbMock = {
    query: async () => {
      if (queue.length === 0) {
        throw new Error('Unexpected query call');
      }
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

test('auth.login returns token when login is successful', async () => {
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
      if (queue.length === 0) {
        throw new Error('Unexpected query call');
      }
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
