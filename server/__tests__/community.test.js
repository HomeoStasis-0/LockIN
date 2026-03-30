const request = require('supertest');

jest.mock('pg', () => {
  const mPool = jest.fn();
  return { Pool: mPool };
});

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(() => ({ user_id: 67, username: 'tester' })),
}));

describe('Community routes', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('GET /api/community/decks requires auth', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn();
    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app).get('/api/community/decks');

    expect(res.status).toBe(401);
  });

  test('GET /api/community/decks returns all public decks when no search', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          user_id: 10,
          deck_name: 'Biology 101',
          subject: 'BIO',
          course_number: 101,
          instructor: 'Dr. Smith',
          created_at: '2026-03-20T00:00:00.000Z',
        },
        {
          id: 2,
          user_id: 11,
          deck_name: 'Chemistry Basics',
          subject: 'CHEM',
          course_number: 110,
          instructor: 'Dr. Jones',
          created_at: '2026-03-21T00:00:00.000Z',
        },
      ],
    });

    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app)
      .get('/api/community/decks')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('deck_name', 'Biology 101');
    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      ['']
    );
  });

  test('GET /api/community/decks searches by deck name', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          user_id: 10,
          deck_name: 'Biology 101',
          subject: 'BIO',
          course_number: 101,
          instructor: 'Dr. Smith',
          created_at: '2026-03-20T00:00:00.000Z',
        },
      ],
    });

    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app)
      .get('/api/community/decks?search=Biology')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      ['Biology']
    );
  });

  test('GET /api/community/decks searches by subject', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          user_id: 10,
          deck_name: 'Biology 101',
          subject: 'BIO',
          course_number: 101,
          instructor: 'Dr. Smith',
          created_at: '2026-03-20T00:00:00.000Z',
        },
      ],
    });

    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app)
      .get('/api/community/decks?search=BIO')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('GET /api/community/decks searches by instructor', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          user_id: 10,
          deck_name: 'Biology 101',
          subject: 'BIO',
          course_number: 101,
          instructor: 'Dr. Smith',
          created_at: '2026-03-20T00:00:00.000Z',
        },
      ],
    });

    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app)
      .get('/api/community/decks?search=Smith')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('GET /api/community/decks searches by course number', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          user_id: 10,
          deck_name: 'Biology 101',
          subject: 'BIO',
          course_number: 101,
          instructor: 'Dr. Smith',
          created_at: '2026-03-20T00:00:00.000Z',
        },
      ],
    });

    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app)
      .get('/api/community/decks?search=101')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('GET /api/community/decks returns 500 on database error', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn().mockRejectedValueOnce(new Error('DB error'));

    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app)
      .get('/api/community/decks')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
  });

  test('GET /api/community/decks/:id requires auth', async () => {
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: jest.fn() }));

    const app = require('../server');
    const res = await request(app).get('/api/community/decks/1');

    expect(res.status).toBe(401);
  });

  test('GET /api/community/decks/:id returns 400 for invalid id', async () => {
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: jest.fn() }));

    const app = require('../server');
    const res = await request(app)
      .get('/api/community/decks/not-a-number')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid public deck id' });
  });

  test('GET /api/community/decks/:id returns 404 when deck not found', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app)
      .get('/api/community/decks/999')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Public deck not found' });
  });

  test('GET /api/community/decks/:id returns deck with cards', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn();
    poolQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 5,
            user_id: 10,
            deck_name: 'Biology 101',
            subject: 'BIO',
            course_number: 101,
            instructor: 'Dr. Smith',
            created_at: '2026-03-20T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 1, public_deck_id: 5, card_id: 100 },
          { id: 2, public_deck_id: 5, card_id: 101 },
        ],
      });

    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app)
      .get('/api/community/decks/5')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('deck_name', 'Biology 101');
    expect(res.body.cards).toHaveLength(2);
  });

  test('GET /api/community/decks/:id returns 500 on database error', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn().mockRejectedValueOnce(new Error('DB error'));

    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app)
      .get('/api/community/decks/1')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
  });

  test('POST /api/community/decks/:id/save requires auth', async () => {
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: jest.fn() }));

    const app = require('../server');
    const res = await request(app).post('/api/community/decks/1/save');

    expect(res.status).toBe(401);
  });

  test('POST /api/community/decks/:id/save returns 400 for invalid id', async () => {
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: jest.fn() }));

    const app = require('../server');
    const res = await request(app)
      .post('/api/community/decks/invalid/save')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid public deck id' });
  });

  test('POST /api/community/decks/:id/save returns 404 when deck not found', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app)
      .post('/api/community/decks/999/save')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Public deck not found' });
  });

  test('POST /api/community/decks/:id/save saves a public deck for user', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn();
    poolQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 5 }] })
      .mockResolvedValueOnce({});

    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app)
      .post('/api/community/decks/5/save')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ saved: true });
    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_public_deck'),
      [67, 5]
    );
  });

  test('POST /api/community/decks/:id/save returns 500 on database error', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn().mockRejectedValueOnce(new Error('DB error'));

    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app)
      .post('/api/community/decks/1/save')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
  });

  test('DELETE /api/community/decks/:id/save requires auth', async () => {
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: jest.fn() }));

    const app = require('../server');
    const res = await request(app).delete('/api/community/decks/1/save');

    expect(res.status).toBe(401);
  });

  test('DELETE /api/community/decks/:id/save returns 400 for invalid id', async () => {
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: jest.fn() }));

    const app = require('../server');
    const res = await request(app)
      .delete('/api/community/decks/invalid/save')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid public deck id' });
  });

  test('DELETE /api/community/decks/:id/save returns 404 when link not found', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app)
      .delete('/api/community/decks/999/save')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Saved public deck link not found' });
  });

  test('DELETE /api/community/decks/:id/save removes saved deck for user', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] });

    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app)
      .delete('/api/community/decks/5/save')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ saved: false });
    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM user_public_deck'),
      [67, 5]
    );
  });

  test('DELETE /api/community/decks/:id/save returns 500 on database error', async () => {
    const { Pool } = require('pg');
    const poolQuery = jest.fn().mockRejectedValueOnce(new Error('DB error'));

    Pool.mockImplementation(() => ({ query: poolQuery }));

    const app = require('../server');
    const res = await request(app)
      .delete('/api/community/decks/1/save')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
  });
});
