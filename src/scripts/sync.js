const { closePool } = require('../db/db');
const { runSync } = require('../services/sync.service');
const logger = require('../utils/logger');

async function main() {
  try {
    const outcome = await runSync();
    if (!outcome.success) {
      logger.error(`[SYNC CLI] Ingestion failed for: ${outcome.failedProviders.join(', ')}`);
      process.exitCode = 1;
    }
  } catch (fatalError) {
    logger.error('[SYNC CLI] Fatal unhandled error during sync:', fatalError.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
