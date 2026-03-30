describe('Dashboard courses', () => {
  it('creates and deletes a course from dashboard', () => {
    const user = { user_id: 67, username: 'testuser', email: 'test@example.com' };
    let decks = [
      {
        id: 1,
        user_id: 67,
        deck_name: 'Starter Course',
        subject: 'CSCE',
        course_number: 120,
        instructor: null,
        created_at: '2026-03-24T00:00:00.000Z',
      },
    ];

    cy.intercept('GET', '/auth/me', {
      statusCode: 200,
      body: user,
    }).as('authMe');

    cy.intercept('GET', '/api/decks', (req) => {
      req.reply({ statusCode: 200, body: decks });
    }).as('getDecks');

    cy.intercept('POST', '/api/decks', (req) => {
      const created = {
        id: 2,
        user_id: 67,
        deck_name: req.body.deck_name,
        subject: req.body.subject,
        course_number: req.body.course_number,
        instructor: req.body.instructor ?? null,
        created_at: '2026-03-24T00:00:00.000Z',
      };
      decks = [created, ...decks];
      req.reply({ statusCode: 201, body: created });
    }).as('createDeck');

    cy.intercept('DELETE', '/api/decks/*', (req) => {
      const id = Number(req.url.split('/').pop());
      decks = decks.filter((d) => d.id !== id);
      req.reply({ statusCode: 200, body: { ok: true, deletedDeckId: id } });
    }).as('deleteDeck');

    cy.on('window:confirm', () => true);

    cy.visit('/dashboard');
    cy.wait('@authMe');
    cy.wait('@getDecks');

    cy.contains('Starter Course').should('exist');

    cy.contains('button', 'Add Course').click();
    cy.get('input[placeholder="Course ID (e.g. CSCE120)"]').type('MATH151');
    cy.get('input[placeholder="Course Title"]').type('Calculus I');
    cy.contains('button', 'Create').click();

    cy.wait('@createDeck');
    cy.contains('Calculus I').should('exist');

    cy.contains('Calculus I')
      .parents('div')
      .first()
      .within(() => {
        cy.contains('button', 'Delete').click();
      });

    cy.wait('@deleteDeck');
    cy.contains('Calculus I').should('not.exist');
    cy.contains('Starter Course').should('exist');
  });
});
