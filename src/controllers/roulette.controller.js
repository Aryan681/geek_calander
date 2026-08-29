const { getRoulette } = require('../services/roulette.service');
const logger = require('../utils/logger');

async function getRouletteRecommendation(req, res, next) {
  try {
    const result = await getRoulette(req.query);
    res.set({
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    });
    return res.status(200).json(result);
  } catch (error) {
    logger.error('[ROULETTE] Failed to retrieve recommendation:', error.message);
    return next(error);
  }
}

module.exports = { getRouletteRecommendation };
