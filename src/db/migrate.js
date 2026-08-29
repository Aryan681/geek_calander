const fs = require('fs');
const path = require('path');
const { pool, closePool } = require('./db');
const logger = require('../utils/logger');

async function runMigration() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  logger.info('Running database migration...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(schemaSql);
    await client.query('COMMIT');
    logger.info('Migration completed successfully: "events" table and indexes are ready.');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Migration failed:', error.message);
    process.exitCode = 1;
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

if (require.main === module) {
  runMigration().catch(() => {});
}

module.exports = runMigration;
