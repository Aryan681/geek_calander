const { listTrending } = require('../services/trending.service');
const logger = require('../utils/logger');

async function getTrending(req, res, next) {
  try {
    const result = await listTrending(req.query);
    res.set({
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/json; charset=utf-8',
    });
    return res.status(200).json(result);
  } catch (error) {
    logger.error('[TRENDING] Failed to retrieve fresh releases:', error.message);
    return next(error);
  }
}

module.exports = { getTrending };
