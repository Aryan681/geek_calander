const { Pool } = require('pg');
const config = require('../config/env');
const logger = require('../utils/logger');

const poolConfig = config.database.connectionString
  ? {
      connectionString: config.database.connectionString,
      ssl: config.database.ssl,
    }
  : {
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      ssl: config.database.ssl,
    };

const pool = new Pool({
  ...poolConfig,
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: true,
});

pool.on('error', (err) => {
  logger.error('[DB] Unexpected error on idle PostgreSQL client:', err.message);
});

async function closePool() {
  try {
    await pool.end();
  } catch (err) {
    logger.error('[DB] Error while closing PostgreSQL pool:', err.message);
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  closePool,
};
