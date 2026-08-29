const { Router } = require('express');
const healthRoutes = require('./health.routes');
const calendarRoutes = require('./calendar.routes');

const router = Router();

router.use(healthRoutes);
router.use(calendarRoutes);

module.exports = router;
