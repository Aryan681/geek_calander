const { NotFoundError } = require('../utils/errors');

/**
 * 404 handler for any unmapped route
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({ error: 'Not Found' });
}

module.exports = notFoundHandler;
