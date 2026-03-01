const request = require('supertest');

// Mock pg Pool, bcrypt, and jsonwebtoken before importing the app
jest.mock('pg', () => {
  const mQuery = jest.fn();
  const mPool = jest.fn(() => ({ query: mQuery }));
  return { Pool: mPool };
});

jest.mock('bcryptjs', () => ({
  compare: jest.fn(() => true),
  hash: jest.fn(() => 'hashed'),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'signed-token'),
  verify: jest.fn((token, secret) => ({ user_id: 67, username: '123' })),
}));

let app;

beforeEach(() => {
  // reset module registry so server re-creates Pool with current mock when required
  jest.resetModules();
});

describe('Auth routes', () => {
  test('POST /auth/login - success', async () => {
    const poolQuery = jest.fn();
    // the login route performs a SELECT ... WHERE username=$1 OR email=$1
    poolQuery.mockResolvedValueOnce({ rows: [{ user_id: 67, username: '123', email: '123@gmail.com', password_hash: 'hashedpwd' }] });
    const { Pool } = require('pg');
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');

    Pool.mockImplementation(() => ({ query: poolQuery }));

    // require app after setting up mocks
    app = require('../server');

    const res = await request(app)
      .post('/auth/login')
      .send({ login: '123', password: '123' })
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user_id');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(jwt.sign).toHaveBeenCalled();
  });

  test('GET /auth/me - returns user when authenticated', async () => {
    const poolQuery = jest.fn();
    // the /auth/me route queries user by id
    poolQuery.mockResolvedValueOnce({ rows: [{ user_id: 67, username: '123', email: '123@gmail.com' }] });
    const { Pool } = require('pg');
    const jwt = require('jsonwebtoken');

    Pool.mockImplementation(() => ({ query: poolQuery }));

    app = require('../server');

    const res = await request(app)
      .get('/auth/me')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user_id', 67);
    expect(jwt.verify).toHaveBeenCalled();
  });

  test('POST /auth/logout clears cookie', async () => {
    app = require('../server');

    const res = await request(app)
      .post('/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Logged out');
  });
});
