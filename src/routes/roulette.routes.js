const { Router } = require('express');
const { getRouletteRecommendation } = require('../controllers/roulette.controller');

const router = Router();

router.get('/roulette', getRouletteRecommendation);

module.exports = router;
