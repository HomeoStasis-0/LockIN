/**
 * Express app for LockIN.
 */
require('dotenv').config();
const express = require('express');
const apiRoutes = require('./backEnd/routes');

const app = express();

app.use(express.json());
app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

module.exports = app;
