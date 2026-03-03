/**
 * Mount all API routes.
 */
const express = require('express');
const decksRouter = require('./decks');

const router = express.Router();

router.use('/decks', decksRouter);

module.exports = router;
