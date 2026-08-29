const { Router } = require('express');
const healthRoutes = require('./health.routes');
const calendarRoutes = require('./calendar.routes');
const eventsRoutes = require('./events.routes');
const rouletteRoutes = require('./roulette.routes');
const trendingRoutes = require('./trending.routes');

const router = Router();

router.use(healthRoutes);
router.use(calendarRoutes);
router.use(eventsRoutes);
router.use(rouletteRoutes);
router.use(trendingRoutes);

module.exports = router;
