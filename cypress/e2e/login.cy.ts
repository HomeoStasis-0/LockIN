describe('Login e2e', () => {
  it('shows an error for invalid credentials', () => {
    cy.intercept('GET', '/auth/me', { statusCode: 401, body: {} }).as('authMe');
    cy.intercept('POST', '/auth/login', {
      statusCode: 401,
      body: { error: 'Invalid credentials' },
    }).as('loginFail');

    cy.visit('/login');
    cy.wait('@authMe');
    cy.get('input[placeholder="Username or Email"]').type('123');
    cy.get('input[placeholder="Password"]').type('wrong-password');
    cy.contains('button', 'Log In').click();

    cy.wait('@loginFail');
    cy.contains('Invalid credentials').should('exist');
    cy.url().should('include', '/login');
  });

  it('logs in and reaches dashboard', () => {
    cy.intercept('GET', '/auth/me', { statusCode: 401, body: {} }).as('authMe');
    cy.intercept('POST', '/auth/login', {
      statusCode: 200,
      body: { user_id: 67, username: '123', email: '123@gmail.com' },
    }).as('loginOk');
    cy.intercept('GET', '/api/decks', { statusCode: 200, body: [] }).as('getDecks');

    cy.visit('/login');
    cy.wait('@authMe');
    cy.get('input[placeholder="Username or Email"]').type('123');
    cy.get('input[placeholder="Password"]').type('123');
    cy.contains('button', 'Log In').click();

    cy.wait('@loginOk');
    cy.wait('@getDecks');
    cy.url().should('include', '/dashboard');
    cy.contains('Welcome,');
  });
});
