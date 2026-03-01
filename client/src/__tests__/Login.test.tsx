import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { test, expect } from 'vitest';

// `loginSpy` and the `useAuth` mock are provided globally via `client/src/setupTests.ts`

import Login from '../pages/Login';

test('calls login with entered credentials', async () => {
  const user = userEvent.setup();
  // `loginSpy` is shared via the global setup file
  const loginSpy = (globalThis as any).loginSpy

  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

  await user.type(screen.getByPlaceholderText(/Username or Email/i), '123');
  await user.type(screen.getByPlaceholderText(/Password/i), '123');
  await user.click(screen.getByRole('button', { name: /Log In/i }));

  expect(loginSpy).toHaveBeenCalledWith('123', '123');
});
