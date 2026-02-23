/**
 * Deck service: CRUD and import logic for decks and cards.
 */
const db = require('../db');

/**
 * Insert flashcards from AI output into a deck.
 *
 * @param {number} deckId - Deck ID
 * @param {Array<{ front: string, back: string }>} flashcards
 * @returns {Promise<{ inserted: number }>}
 */
async function importFlashcardsIntoDeck(deckId, flashcards) {
  if (!flashcards || !Array.isArray(flashcards) || flashcards.length === 0) {
    return { inserted: 0 };
  }

  const trx = await db.transaction();
  try {
    let inserted = 0;
    for (const card of flashcards) {
      const [row] = await trx('Card')
        .insert({
          deck_id: deckId,
          card_front: card.front || '',
          card_back: card.back || '',
        })
        .returning('id');
      if (row) {
        await trx('DeckCard').insert({
          deck_id: deckId,
          card_id: row.id,
        });
        inserted++;
      }
    }
    await trx.commit();
    return { inserted };
  } catch (e) {
    await trx.rollback();
    throw e;
  }
}

/**
 * Get deck by ID (basic check).
 */
async function getDeckById(deckId) {
  const [row] = await db('Deck').where('id', deckId).select('*');
  return row || null;
}

module.exports = {
  importFlashcardsIntoDeck,
  getDeckById,
};
