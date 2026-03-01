describe('Login e2e', () => {
  it('logs in and reaches dashboard', () => {
    cy.visit('/login');
    cy.get('input[placeholder="Username or Email"]').type('123');
    cy.get('input[placeholder="Password"]').type('123');
    cy.contains('button', 'Log In').click();

    cy.url().should('include', '/dashboard');
    cy.contains('Welcome,');
  });
});
