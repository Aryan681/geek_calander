const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const { closePool } = require('./db/db');

const PORT = config.port || 3000;

const server = app.listen(PORT, () => {
  logger.info(`[SERVER] Geek Calendar server listening on port ${PORT}`);
  logger.info(`[SERVER] Calendar feed available at: http://localhost:${PORT}/calendar.ics`);
});

// Bound idle/slow HTTP connections so a stalled feed cannot occupy a Render
// worker indefinitely. The feed itself is written incrementally below this
// timeout and should complete well within the limit under normal operation.
server.requestTimeout = 120000;
server.headersTimeout = 15000;

// Graceful shutdown handling
let isShuttingDown = false;

async function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`[SERVER] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('[SERVER] HTTP server closed.');
    await closePool();
    logger.info('[SERVER] Database pool closed. Exiting process.');
    process.exit(0);
  });

  // Force shutdown if connections do not close within 10s
  setTimeout(() => {
    logger.error('[SERVER] Graceful shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

module.exports = {
  app,
  server,
};
