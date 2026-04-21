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
  jest.clearAllMocks();
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

  test('PATCH /auth/username updates username and refreshes auth cookie', async () => {
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ user_id: 67, username: 'new_name', email: '123@gmail.com' }],
    });

    const { Pool } = require('pg');
    const jwt = require('jsonwebtoken');
    Pool.mockImplementation(() => ({ query: poolQuery }));

    app = require('../server');

    const res = await request(app)
      .patch('/auth/username')
      .set('Cookie', ['token=signed-token'])
      .send({ username: 'new_name' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user_id: 67, username: 'new_name', email: '123@gmail.com', auth_provider: 'local' });
    expect(jwt.sign).toHaveBeenCalled();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('PATCH /auth/password/set-initial sets a password for a Google-authenticated session', async () => {
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ user_id: 67, username: '123', email: '123@gmail.com' }],
    });
    poolQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ user_id: 67, username: '123', email: '123@gmail.com' }],
    });

    const { Pool } = require('pg');
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    Pool.mockImplementation(() => ({ query: poolQuery }));
    jwt.verify.mockImplementationOnce(() => ({ user_id: 67, username: '123', auth_provider: 'google' }));
    bcrypt.hash.mockResolvedValueOnce('new-google-hash');

    app = require('../server');

    const res = await request(app)
      .patch('/auth/password/set-initial')
      .set('Cookie', ['token=signed-token'])
      .send({ newPassword: 'new-password-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user_id: 67, username: '123', email: '123@gmail.com', auth_provider: 'local' });
    expect(bcrypt.hash).toHaveBeenCalledWith('new-password-1', 10);
    expect(jwt.sign).toHaveBeenCalled();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('PATCH /auth/password/set-initial rejects non-Google sessions', async () => {
    const poolQuery = jest.fn();
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: poolQuery }));

    app = require('../server');

    const res = await request(app)
      .patch('/auth/password/set-initial')
      .set('Cookie', ['token=signed-token'])
      .send({ newPassword: 'new-password-1' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Initial password setup is only available for Google-authenticated sessions' });
    expect(poolQuery).not.toHaveBeenCalled();
  });

  test('PATCH /auth/username validates username length before hitting database', async () => {
    const poolQuery = jest.fn();
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: poolQuery }));

    app = require('../server');

    const res = await request(app)
      .patch('/auth/username')
      .set('Cookie', ['token=signed-token'])
      .send({ username: 'ab' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Username must be between 3 and 30 characters' });
    expect(poolQuery).not.toHaveBeenCalled();
  });

  test('PATCH /auth/username handles duplicate username constraint', async () => {
    const poolQuery = jest.fn();
    const duplicateErr = new Error('duplicate key value violates unique constraint');
    duplicateErr.code = '23505';
    poolQuery.mockRejectedValueOnce(duplicateErr);

    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: poolQuery }));

    app = require('../server');

    const res = await request(app)
      .patch('/auth/username')
      .set('Cookie', ['token=signed-token'])
      .send({ username: 'existing_user' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Username already exists' });
  });

  test('PATCH /auth/password updates the password when the current password is valid', async () => {
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ user_id: 67, password_hash: 'old-hash' }],
    });
    poolQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ user_id: 67 }],
    });

    const { Pool } = require('pg');
    const bcrypt = require('bcryptjs');
    Pool.mockImplementation(() => ({ query: poolQuery }));
    bcrypt.compare.mockResolvedValueOnce(true);
    bcrypt.hash.mockResolvedValueOnce('new-hash');

    app = require('../server');

    const res = await request(app)
      .patch('/auth/password')
      .set('Cookie', ['token=signed-token'])
      .send({ currentPassword: 'old-password', newPassword: 'new-password-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Password updated successfully' });
    expect(bcrypt.compare).toHaveBeenCalledWith('old-password', 'old-hash');
    expect(bcrypt.hash).toHaveBeenCalledWith('new-password-1', 10);
    expect(poolQuery).toHaveBeenCalledTimes(2);
  });

  test('PATCH /auth/password rejects short new passwords before hitting the database', async () => {
    const poolQuery = jest.fn();
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: poolQuery }));

    app = require('../server');

    const res = await request(app)
      .patch('/auth/password')
      .set('Cookie', ['token=signed-token'])
      .send({ currentPassword: 'old-password', newPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'newPassword must be at least 8 characters long' });
    expect(poolQuery).not.toHaveBeenCalled();
  });

  test('PATCH /auth/password rejects an incorrect current password', async () => {
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ user_id: 67, password_hash: 'old-hash' }],
    });

    const { Pool } = require('pg');
    const bcrypt = require('bcryptjs');
    Pool.mockImplementation(() => ({ query: poolQuery }));
    bcrypt.compare.mockResolvedValueOnce(false);

    app = require('../server');

    const res = await request(app)
      .patch('/auth/password')
      .set('Cookie', ['token=signed-token'])
      .send({ currentPassword: 'wrong-password', newPassword: 'new-password-1' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Current password is incorrect' });
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  test('PATCH /auth/password returns 404 when the account row is missing', async () => {
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: poolQuery }));

    app = require('../server');

    const res = await request(app)
      .patch('/auth/password')
      .set('Cookie', ['token=signed-token'])
      .send({ currentPassword: 'old-password', newPassword: 'new-password-1' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Account not found' });
  });

  test('DELETE /auth/account deletes the account and clears the cookie', async () => {
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ user_id: 67 }],
    });

    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: poolQuery }));

    app = require('../server');

    const res = await request(app)
      .delete('/auth/account')
      .set('Cookie', ['token=signed-token'])
      .send({ confirmation: '123' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Account deleted successfully' });
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('DELETE /auth/account rejects mismatched confirmation text', async () => {
    const poolQuery = jest.fn();
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: poolQuery }));

    app = require('../server');

    const res = await request(app)
      .delete('/auth/account')
      .set('Cookie', ['token=signed-token'])
      .send({ confirmation: 'wrong-name' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Confirmation does not match username' });
    expect(poolQuery).not.toHaveBeenCalled();
  });
});
