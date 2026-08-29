const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Centralized Express error-handling middleware.
 * Sanitizes errors and ensures no sensitive database credentials or internal stack traces are leaked.
 */
function errorHandler(err, req, res, next) {
  logger.error('[SERVER] Error:', err.message);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.statusCode === 500 ? 'Internal Server Error' : err.message,
    });
  }

  return res.status(500).json({
    error: 'Internal Server Error',
  });
}

module.exports = errorHandler;
