const config = require('../config/env');

const DEVELOPMENT_ORIGIN = 'http://localhost:5173';

function getAllowedOrigins() {
  return new Set([DEVELOPMENT_ORIGIN, config.frontendOrigin].filter(Boolean));
}

function corsMiddleware(req, res, next) {
  const origin = req.get('Origin');
  if (origin && getAllowedOrigins().has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(origin && getAllowedOrigins().has(origin) ? 204 : 403);
  }

  return next();
}

module.exports = corsMiddleware;
