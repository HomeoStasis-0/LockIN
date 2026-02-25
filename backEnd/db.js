/**
 * Database connection for LockIN backend.
 * Uses knex with pg.
 */
const knex = require('knex');
const config = require('../knexfile');

const env = process.env.NODE_ENV || 'development';
const db = knex(config[env]);

module.exports = db;
