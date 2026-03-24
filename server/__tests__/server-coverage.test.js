const request = require('supertest');

jest.mock('pg', () => {
  const mPool = jest.fn();
  return { Pool: mPool };
});

jest.mock('bcryptjs', () => ({
  compare: jest.fn(() => true),
  hash: jest.fn(() => 'hashed-password'),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'signed-token'),
  verify: jest.fn(() => ({ user_id: 67, username: 'tester' })),
}));

jest.mock('../../backEnd/spaced_repetition', () => ({
  updateCardDb: jest.fn(() => Promise.resolve({})),
}));

jest.mock('../../backEnd/services/aiService', () => ({
  generateStudyMaterialsFromPdf: jest.fn(),
}));

function createApp({ query, connect } = {}) {
  const { Pool } = require('pg');
  const poolQuery = query || jest.fn();
  const poolConnect = connect || jest.fn();
  Pool.mockImplementation(() => ({ query: poolQuery, connect: poolConnect }));
  delete require.cache[require.resolve('../server')];
  return require('../server');
}

beforeEach(() => {
  jest.resetModules();

  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const { updateCardDb } = require('../../backEnd/spaced_repetition');
  const { generateStudyMaterialsFromPdf } = require('../../backEnd/services/aiService');

  bcrypt.compare.mockImplementation(() => true);
  bcrypt.hash.mockImplementation(() => 'hashed-password');
  jwt.sign.mockImplementation(() => 'signed-token');
  jwt.verify.mockImplementation(() => ({ user_id: 67, username: 'tester' }));

  updateCardDb.mockReset();
  updateCardDb.mockResolvedValue({});

  generateStudyMaterialsFromPdf.mockReset();

  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Server coverage branches', () => {
  test('GET /api success and DB error', async () => {
    let app = createApp({
      query: jest.fn().mockResolvedValueOnce({ rows: [{ now: 'ok' }] }),
    });

    let res = await request(app).get('/api');
    expect(res.status).toBe(200);

    app = createApp({
      query: jest.fn().mockRejectedValueOnce(new Error('db fail')),
    });

    res = await request(app).get('/api');
    expect(res.status).toBe(500);
  });

  test('POST /auth/register success and duplicate', async () => {
    let app = createApp({
      query: jest.fn().mockResolvedValueOnce({
        rows: [{ user_id: 1, username: 'u', email: 'u@example.com' }],
      }),
    });

    let res = await request(app)
      .post('/auth/register')
      .send({ username: 'u', email: 'u@example.com', password: 'pw' });
    expect(res.status).toBe(200);

    app = createApp({ query: jest.fn().mockRejectedValueOnce(new Error('duplicate')) });
    res = await request(app)
      .post('/auth/register')
      .send({ username: 'u', email: 'u@example.com', password: 'pw' });
    expect(res.status).toBe(400);
  });

  test('POST /auth/login invalid user', async () => {
    const app = createApp({ query: jest.fn().mockResolvedValueOnce({ rows: [] }) });
    const res = await request(app).post('/auth/login').send({ login: 'x', password: 'pw' });
    expect(res.status).toBe(401);
  });

  test('POST /auth/login invalid password', async () => {
    const bcrypt = require('bcryptjs');
    bcrypt.compare.mockReturnValueOnce(false);

    const app = createApp({
      query: jest.fn().mockResolvedValueOnce({
        rows: [{ user_id: 2, username: 'u', email: 'u@example.com', password_hash: 'hash' }],
      }),
    });
    const res = await request(app).post('/auth/login').send({ login: 'u', password: 'bad' });
    expect(res.status).toBe(401);
  });

  test('GET /api/decks/:id success and DB error', async () => {
    let app = createApp({
      query: jest
        .fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 7, user_id: 67, deck_name: 'D' }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 11, deck_id: 7, card_front: 'Q', card_back: 'A' }] }),
    });

    let res = await request(app).get('/api/decks/7');
    expect(res.status).toBe(200);

    app = createApp({ query: jest.fn().mockRejectedValueOnce(new Error('db fail')) });
    res = await request(app).get('/api/decks/7');
    expect(res.status).toBe(500);
  });

  test('PATCH /api/cards/:id not found and DB error', async () => {
    let app = createApp({ query: jest.fn().mockResolvedValueOnce({ rowCount: 0, rows: [] }) });
    let res = await request(app).patch('/api/cards/9').send({ card_front: 'Q', card_back: 'A' });
    expect(res.status).toBe(404);

    app = createApp({ query: jest.fn().mockRejectedValueOnce(new Error('update fail')) });
    res = await request(app).patch('/api/cards/9').send({ card_front: 'Q', card_back: 'A' });
    expect(res.status).toBe(500);
  });

  test('DELETE /api/cards/:id DB error', async () => {
    const app = createApp({ query: jest.fn().mockRejectedValueOnce(new Error('delete fail')) });
    const res = await request(app).delete('/api/cards/5');
    expect(res.status).toBe(500);
  });

  test('GET /api/decks 403 invalid token and DB error', async () => {
    const jwt = require('jsonwebtoken');
    jwt.verify.mockImplementationOnce(() => {
      throw new Error('bad token');
    });

    let app = createApp({ query: jest.fn() });
    let res = await request(app).get('/api/decks').set('Cookie', ['token=bad']);
    expect(res.status).toBe(403);

    app = createApp({ query: jest.fn().mockRejectedValueOnce(new Error('list fail')) });
    res = await request(app).get('/api/decks').set('Cookie', ['token=signed-token']);
    expect(res.status).toBe(500);
  });

  test('POST /api/decks validation and DB error', async () => {
    let app = createApp({ query: jest.fn() });
    let res = await request(app)
      .post('/api/decks')
      .set('Cookie', ['token=signed-token'])
      .send({ subject: 'CSCE' });
    expect(res.status).toBe(400);

    app = createApp({ query: jest.fn().mockRejectedValueOnce(new Error('insert fail')) });
    res = await request(app)
      .post('/api/decks')
      .set('Cookie', ['token=signed-token'])
      .send({ deck_name: 'x' });
    expect(res.status).toBe(500);
  });

  test('DELETE /api/decks/:id invalid id', async () => {
    const app = createApp({ query: jest.fn() });
    const res = await request(app)
      .delete('/api/decks/nope')
      .set('Cookie', ['token=signed-token']);
    expect(res.status).toBe(400);
  });

  test('DELETE /api/decks/:id catch rollback failure', async () => {
    const clientQuery = jest
      .fn()
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(new Error('owner query fail')) // owner query
      .mockRejectedValueOnce(new Error('rollback fail')); // rollback in catch

    const release = jest.fn();
    const app = createApp({
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue({ query: clientQuery, release }),
    });

    const res = await request(app)
      .delete('/api/decks/1')
      .set('Cookie', ['token=signed-token']);
    expect(res.status).toBe(500);
    expect(release).toHaveBeenCalled();
  });

  test('POST /api/decks/:id/import-pdf: invalid id and missing file', async () => {
    const app = createApp({ query: jest.fn() });

    let res = await request(app).post('/api/decks/abc/import-pdf');
    expect(res.status).toBe(400);

    res = await request(app).post('/api/decks/1/import-pdf');
    expect(res.status).toBe(400);
  });

  test('POST /api/decks/:id/import-pdf: deck not found', async () => {
    const app = createApp({ query: jest.fn().mockResolvedValueOnce({ rowCount: 0, rows: [] }) });

    const res = await request(app)
      .post('/api/decks/1/import-pdf')
      .attach('pdf', Buffer.from('%PDF-1.4 fake'), 'notes.pdf');

    expect(res.status).toBe(404);
  });

  test('POST /api/decks/:id/import-pdf: no flashcards and AI failure', async () => {
    const { generateStudyMaterialsFromPdf } = require('../../backEnd/services/aiService');

    generateStudyMaterialsFromPdf.mockResolvedValueOnce({ flashcards: [], quiz: [] });
    let app = createApp({ query: jest.fn().mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }) });

    let res = await request(app)
      .post('/api/decks/1/import-pdf')
      .attach('pdf', Buffer.from('%PDF-1.4 fake'), 'notes.pdf');
    expect(res.status).toBe(422);

    generateStudyMaterialsFromPdf.mockRejectedValueOnce(new Error('ai failed'));
    app = createApp({ query: jest.fn().mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }) });

    res = await request(app)
      .post('/api/decks/1/import-pdf')
      .attach('pdf', Buffer.from('%PDF-1.4 fake'), 'notes.pdf');
    expect(res.status).toBe(500);
  });

  test('POST /api/decks/:id/import-pdf success path with near-duplicate skipping', async () => {
    const { generateStudyMaterialsFromPdf } = require('../../backEnd/services/aiService');
    generateStudyMaterialsFromPdf.mockResolvedValueOnce({
      flashcards: [
        {
          front: 'What condition guarantees a non-identity automorphism exists for a group G?',
          back: 'If |G| > 2 then a non-identity automorphism exists.',
        },
        {
          front: 'What does it mean for a group to have a non-identical automorphism?',
          back: 'An automorphism not equal to identity; for |G| > 2 such a map exists.',
        },
        { front: 'How many groups of order 231 exist up to isomorphism?', back: 'Exactly two.' },
      ],
      quiz: [{ question: 'q?', options: ['a', 'b', 'c', 'd'], correct_answer: 'a' }],
    });

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            card_front:
              'State the theorem about existence of a non-identity automorphism for any group G with |G| > 2.',
            card_back:
              'Any group with more than two elements has a non-trivial automorphism.',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 22,
            deck_id: 1,
            card_front: 'How many groups of order 231 exist up to isomorphism?',
            card_back: 'Exactly two.',
            created_at: '2026-03-24T00:00:00.000Z',
            ease_factor: 2.5,
            interval_days: 0,
            repetitions: 0,
            due_date: '2026-03-24T00:00:00.000Z',
            last_reviewed: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            card_front:
              'State the theorem about existence of a non-identity automorphism for any group G with |G| > 2.',
            card_back:
              'Any group with more than two elements has a non-trivial automorphism.',
          },
          {
            id: 22,
            card_front: 'How many groups of order 231 exist up to isomorphism?',
            card_back: 'Exactly two.',
          },
        ],
      });

    const app = createApp({ query, connect: jest.fn() });

    const res = await request(app)
      .post('/api/decks/1/import-pdf')
      .attach('pdf', Buffer.from('%PDF-1.4 fake'), 'notes.pdf');

    expect(res.status).toBe(200);
    expect(res.body.flashcards).toEqual({ inserted: 1, skippedDuplicates: 1, removedDuplicates: 0 });
  });

  test('POST /api/decks/:id/import-pdf skips cross-upload paraphrase duplicates', async () => {
    const { generateStudyMaterialsFromPdf } = require('../../backEnd/services/aiService');
    generateStudyMaterialsFromPdf.mockResolvedValueOnce({
      flashcards: [
        {
          front: 'What does it mean for a group to have a non-identical automorphism?',
          back: 'An automorphism not equal to identity; for |G| > 2 such a map exists.',
        },
      ],
      quiz: [],
    });

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            card_front:
              'State the theorem about existence of a non-identity automorphism for a group G with |G|>2.',
            card_back:
              'Any group G with more than two elements has an automorphism that is not the identity map.',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 33,
            card_front:
              'State the theorem about existence of a non-identity automorphism for a group G with |G|>2.',
            card_back:
              'Any group G with more than two elements has an automorphism that is not the identity map.',
          },
        ],
      });

    const app = createApp({ query, connect: jest.fn() });

    const res = await request(app)
      .post('/api/decks/1/import-pdf')
      .attach('pdf', Buffer.from('%PDF-1.4 fake'), 'notes.pdf');

    expect(res.status).toBe(200);
    expect(res.body.flashcards).toEqual({ inserted: 0, skippedDuplicates: 1, removedDuplicates: 0 });
  });

  test('POST /api/decks/:id/import-pdf removes existing deck duplicates from older imports', async () => {
    const { generateStudyMaterialsFromPdf } = require('../../backEnd/services/aiService');
    generateStudyMaterialsFromPdf.mockResolvedValueOnce({
      flashcards: [
        { front: 'How many non-isomorphic groups of order 231 exist?', back: 'Exactly two.' },
      ],
      quiz: [],
    });

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            card_front: 'How many groups of order 231 exist up to isomorphism?',
            card_back: 'Exactly two: cyclic and one non-abelian semidirect product.',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 8,
            card_front: 'How many groups of order 231 exist up to isomorphism?',
            card_back: 'Exactly two: cyclic and one non-abelian semidirect product.',
          },
          {
            id: 9,
            card_front: 'How many non-isomorphic groups of order 231 exist?',
            card_back: 'Exactly two.',
          },
          {
            id: 99,
            card_front: 'How many (up to isomorphism) groups satisfy that structure?',
            card_back: 'Exactly two.',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const app = createApp({ query, connect: jest.fn() });

    const res = await request(app)
      .post('/api/decks/1/import-pdf')
      .attach('pdf', Buffer.from('%PDF-1.4 fake'), 'notes.pdf');

    expect(res.status).toBe(200);
    expect(res.body.flashcards).toEqual({ inserted: 0, skippedDuplicates: 1, removedDuplicates: 2 });
  });
});
