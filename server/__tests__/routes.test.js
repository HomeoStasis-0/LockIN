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

jest.mock('../utils/spaced_repetition', () => ({
  updateCardDb: jest.fn(() => Promise.resolve({})),
}));

describe('Additional API routes', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('GET /api/decks/:id returns 400 for invalid id', async () => {
    const poolQuery = jest.fn();
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: poolQuery, connect: jest.fn() }));

    const app = require('../server');
    const res = await request(app).get('/api/decks/not-a-number');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid deck id' });
    expect(poolQuery).not.toHaveBeenCalled();
  });

  test('GET /api/decks/:id returns 404 when deck does not exist', async () => {
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: poolQuery, connect: jest.fn() }));

    const app = require('../server');
    const res = await request(app).get('/api/decks/1234');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Deck not found' });
  });

  test('POST /api/cards validates required fields', async () => {
    const poolQuery = jest.fn();
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: poolQuery, connect: jest.fn() }));

    const app = require('../server');
    const res = await request(app).post('/api/cards').send({ deck_id: 1, card_front: 'Q only' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'deck_id, card_front, card_back required' });
    expect(poolQuery).not.toHaveBeenCalled();
  });

  test('POST /api/cards creates card and returns 201', async () => {
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 5,
          deck_id: 1,
          card_front: 'Question',
          card_back: 'Answer',
          created_at: '2026-03-24T00:00:00.000Z',
          ease_factor: 2.5,
          interval_days: 0,
          repetitions: 0,
          due_date: '2026-03-24T00:00:00.000Z',
          last_reviewed: null,
        },
      ],
    });

    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: poolQuery, connect: jest.fn() }));

    const app = require('../server');
    const res = await request(app)
      .post('/api/cards')
      .send({ deck_id: 1, card_front: 'Question', card_back: 'Answer' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 5);
    expect(res.body).toHaveProperty('card_front', 'Question');
  });

  test('POST /api/cards/:id/rate validates rating', async () => {
    const { updateCardDb } = require('../utils/spaced_repetition');

    const poolQuery = jest.fn();
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: poolQuery, connect: jest.fn() }));

    const app = require('../server');
    const res = await request(app)
      .post('/api/cards/9/rate')
      .send({ rating: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid card id or rating' });
    expect(updateCardDb).not.toHaveBeenCalled();
  });

  test('POST /api/cards/:id/rate updates schedule and returns updated card', async () => {
    const { updateCardDb } = require('../utils/spaced_repetition');

    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 9,
          deck_id: 1,
          card_front: 'Question',
          card_back: 'Answer',
          created_at: '2026-03-24T00:00:00.000Z',
          ease_factor: 2.36,
          interval_days: 6,
          repetitions: 2,
          due_date: '2026-03-30T00:00:00.000Z',
          last_reviewed: '2026-03-24T00:00:00.000Z',
        },
      ],
    });

    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: poolQuery, connect: jest.fn() }));

    const app = require('../server');
    const res = await request(app)
      .post('/api/cards/9/rate')
      .send({ rating: 'good' });

    expect(res.status).toBe(200);
    expect(updateCardDb).toHaveBeenCalledWith(expect.any(Object), 9, 4);
    expect(res.body).toHaveProperty('id', 9);
  });

  test('GET /api/decks requires auth and returns 401 without cookie', async () => {
    const poolQuery = jest.fn();
    const { Pool } = require('pg');
    Pool.mockImplementation(() => ({ query: poolQuery, connect: jest.fn() }));

    const app = require('../server');
    const res = await request(app).get('/api/decks');

    expect(res.status).toBe(401);
  });

  test('GET /api/decks returns deck list for authenticated user', async () => {
    const poolQuery = jest.fn();
    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
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
    Pool.mockImplementation(() => ({ query: poolQuery, connect: jest.fn() }));

    const app = require('../server');
    const res = await request(app)
      .get('/api/decks')
      .set('Cookie', ['token=signed-token']);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toHaveProperty('deck_name', 'Algorithms');
  });
});
