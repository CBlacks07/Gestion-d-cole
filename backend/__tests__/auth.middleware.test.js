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

test('authorize allows configured role', () => {
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
    let called = false;

    authMiddleware.authorize('admin', 'directeur')(req, res, () => {
      called = true;
    });

    assert.equal(called, true);
    assert.equal(res.state.statusCode, 200);
  } finally {
    restore();
  }
});

test('authorize denies non configured role', () => {
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
    let called = false;

    authMiddleware.authorize('admin', 'directeur')(req, res, () => {
      called = true;
    });

    assert.equal(called, false);
    assert.equal(res.state.statusCode, 403);
    assert.match(String(res.state.body.message), /ENSEIGNANT/);
  } finally {
    restore();
  }
});
