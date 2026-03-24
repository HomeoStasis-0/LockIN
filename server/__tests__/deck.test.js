const request = require('supertest');

jest.mock('pg', () => {
  const mPool = jest.fn();
  return { Pool: mPool };
});

jest.mock('bcryptjs', () => ({
  compare: jest.fn(() => true),
  hash: jest.fn(() => 'hashed'),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'signed-token'),
  verify: jest.fn(() => ({ user_id: 67, username: 'tester' })),
}));

describe('Deck routes', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('DELETE /api/decks/:id requires auth', async () => {
    const poolQuery = jest.fn();
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app).delete('/api/decks/1');

    expect(res.status).toBe(401);
  });

  test('DELETE /api/decks/:id deletes owned deck and cards', async () => {
    const clientQuery = jest.fn();
    clientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 5 }] }) // owner check
      .mockResolvedValueOnce({ rowCount: 3 }) // delete cards
      .mockResolvedValueOnce({ rowCount: 1 }) // delete deck
      .mockResolvedValueOnce({}); // COMMIT

    const release = jest.fn();
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue({ query: clientQuery, release }),
    }));

    const app = require('../server');
    const res = await request(app)
      .delete('/api/decks/5')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, deletedDeckId: 5 });
    expect(clientQuery).toHaveBeenCalledWith('BEGIN');
    expect(clientQuery).toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalled();
  });

  test('DELETE /api/decks/:id returns 404 when deck not owned/found', async () => {
    const clientQuery = jest.fn();
    clientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // owner check fails
      .mockResolvedValueOnce({}); // ROLLBACK

    const release = jest.fn();
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue({ query: clientQuery, release }),
    }));

    const app = require('../server');
    const res = await request(app)
      .delete('/api/decks/999')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Deck not found' });
    expect(clientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalled();
  });

  test('POST /api/decks creates a deck for authenticated user', async () => {
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 77,
          user_id: 67,
          deck_name: 'Algorithms',
          subject: 'CSCE',
          course_number: 221,
          instructor: null,
          created_at: '2026-03-24T00:00:00.000Z',
        },
      ],
    });

    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({
      query: poolQuery,
      connect: jest.fn(),
    }));

    const app = require('../server');
    const res = await request(app)
      .post('/api/decks')
      .set('Cookie', ['token=signed-token'])
      .send({ deck_name: 'Algorithms', subject: 'CSCE', course_number: 221 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 77);
    expect(res.body).toHaveProperty('deck_name', 'Algorithms');
  });
});
