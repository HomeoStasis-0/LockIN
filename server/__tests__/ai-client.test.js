jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
}));

describe('AI Client', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('generateFromPdf spawns Python subprocess', async () => {
    const { spawn } = require('child_process');
    
    const process = {
      stdout: {
        on: jest.fn((event, cb) => {
          if (event === 'data') {
            setTimeout(() => cb(JSON.stringify({
              flashcards: [{ front: 'Q', back: 'A' }],
              quiz: []
            })), 0);
          }
        }),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn((event, cb) => {
        if (event === 'close') {
          setTimeout(() => cb(0), 0);
        }
      }),
    };

    spawn.mockReturnValue(process);

    const aiClient = require('../utils/ai_client');
    const result = await aiClient.generateFromPdf('/path/to/file.pdf');

    expect(spawn).toHaveBeenCalled();
    const callArgs = spawn.mock.calls[0];
    expect(callArgs[1]).toContain('/path/to/file.pdf');
    expect(callArgs[1][0]).toContain('pdf_to_quiz.py');
    expect(result).toHaveProperty('flashcards');
    expect(result).toHaveProperty('quiz');
  });

  test('generateFromPdf handles JSON parsing errors', async () => {
    const { spawn } = require('child_process');
    
    const process = {
      stdout: {
        on: jest.fn((event, cb) => {
          if (event === 'data') {
            setTimeout(() => cb('invalid json {'), 0);
          }
        }),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn((event, cb) => {
        if (event === 'close') {
          setTimeout(() => cb(0), 0);
        }
      }),
    };

    spawn.mockReturnValue(process);

    const aiClient = require('../utils/ai_client');
    try {
      await aiClient.generateFromPdf('/path/to/file.pdf');
      fail('Should have thrown');
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  test('generateFromPdf handles Python errors', async () => {
    const { spawn } = require('child_process');

    const process = {
      stdout: {
        on: jest.fn(),
      },
      stderr: {
        on: jest.fn((event, cb) => {
          if (event === 'data') {
            setTimeout(() => cb('Error: PDF parsing failed'), 0);
          }
        }),
      },
      on: jest.fn((event, cb) => {
        if (event === 'close') {
          setTimeout(() => cb(1), 0);
        }
      }),
    };

    spawn.mockReturnValue(process);

    const aiClient = require('../utils/ai_client');
    try {
      await aiClient.generateFromPdf('/path/to/file.pdf');
      fail('Should have thrown');
    } catch (e) {
      expect(e.message).toContain('exited');
    }
  });

  test('generateFromPdf handles process exit errors', async () => {
    const { spawn } = require('child_process');

    const process = {
      stdout: {
        on: jest.fn(),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn((event, cb) => {
        if (event === 'error') {
          setTimeout(() => cb(new Error('Process spawn failed')), 0);
        }
      }),
    };

    spawn.mockReturnValue(process);

    const aiClient = require('../utils/ai_client');
    try {
      await aiClient.generateFromPdf('/path/to/file.pdf');
      fail('Should have thrown');
    } catch (e) {
      expect(e.message).toContain('spawn');
    }
  });

  test('generateFromPdf passes file path to Python script', async () => {
    const { spawn } = require('child_process');

    const process = {
      stdout: {
        on: jest.fn((event, cb) => {
          if (event === 'data') {
            setTimeout(() => cb(JSON.stringify({
              flashcards: [],
              quiz: []
            })), 0);
          }
        }),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn((event, cb) => {
        if (event === 'close') {
          setTimeout(() => cb(0), 0);
        }
      }),
    };

    spawn.mockReturnValue(process);

    const aiClient = require('../utils/ai_client');
    await aiClient.generateFromPdf('/absolute/path/file.pdf');

    const spawnArgs = spawn.mock.calls[0][1];
    expect(spawnArgs).toContain('/absolute/path/file.pdf');
  });

  test('generateFromPdf handles empty Python response', async () => {
    const { spawn } = require('child_process');
    
    const process = {
      stdout: {
        on: jest.fn((event, cb) => {
          if (event === 'data') {
            setTimeout(() => cb(JSON.stringify({
              flashcards: [],
              quiz: []
            })), 0);
          }
        }),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn((event, cb) => {
        if (event === 'close') {
          setTimeout(() => cb(0), 0);
        }
      }),
    };

    spawn.mockReturnValue(process);

    const aiClient = require('../utils/ai_client');
    const result = await aiClient.generateFromPdf('/path/to/file.pdf');

    expect(result.flashcards).toHaveLength(0);
    expect(result.quiz).toHaveLength(0);
  });

  test('generateFromPdf aggregates large responses', async () => {
    const { spawn } = require('child_process');
    
    const process = {
      stdout: {
        on: jest.fn((event, cb) => {
          if (event === 'data') {
            const largeFcData = Array(100)
              .fill(0)
              .map((_, i) => ({ front: `Q${i}`, back: `A${i}` }));
            
            setTimeout(() => cb(JSON.stringify({
              flashcards: largeFcData,
              quiz: Array(50).fill({ question: 'Q', answers: ['A', 'B', 'C', 'D'] })
            })), 0);
          }
        }),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn((event, cb) => {
        if (event === 'close') {
          setTimeout(() => cb(0), 0);
        }
      }),
    };

    spawn.mockReturnValue(process);

    const aiClient = require('../utils/ai_client');
    const result = await aiClient.generateFromPdf('/path/to/file.pdf');

    expect(result.flashcards).toHaveLength(100);
    expect(result.quiz).toHaveLength(50);
  });

  test('generateFromPdf returns data in expected format', async () => {
    const { spawn } = require('child_process');
    
    const mockData = {
      flashcards: [
        { front: 'What is 2+2?', back: '4' },
        { front: 'What is the capital of France?', back: 'Paris' }
      ],
      quiz: [
        {
          question: 'Multiple choice question',
          answers: ['A', 'B', 'C', 'D']
        }
      ]
    };

    const process = {
      stdout: {
        on: jest.fn((event, cb) => {
          if (event === 'data') {
            setTimeout(() => cb(JSON.stringify(mockData)), 0);
          }
        }),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn((event, cb) => {
        if (event === 'close') {
          setTimeout(() => cb(0), 0);
        }
      }),
    };

    spawn.mockReturnValue(process);

    const aiClient = require('../utils/ai_client');
    const result = await aiClient.generateFromPdf('/path/to/file.pdf');

    expect(result.flashcards[0]).toHaveProperty('front');
    expect(result.flashcards[0]).toHaveProperty('back');
    expect(result.quiz[0]).toHaveProperty('question');
    expect(result.quiz[0]).toHaveProperty('answers');
  });
});
