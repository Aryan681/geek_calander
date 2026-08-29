const express = require('express');
const routes = require('./routes');
const notFoundHandler = require('./middleware/not-found.middleware');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// Disable x-powered-by header
app.disable('x-powered-by');

// Mount routes
app.use(routes);

// Mount 404 handler
app.use(notFoundHandler);

// Mount centralized error handler
app.use(errorHandler);

module.exports = app;
