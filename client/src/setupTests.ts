import { vi } from 'vitest'

// Shared login spy for tests
;(globalThis as any).loginSpy = vi.fn()

// Mock the auth hook implementation project-wide for client tests
vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    login: (globalThis as any).loginSpy,
    user: null,
  }),
}))
