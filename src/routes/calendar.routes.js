const { Router } = require('express');
const { getCalendarFeed } = require('../controllers/calendar.controller');

const router = Router();

router.get('/calendar.ics', getCalendarFeed);

module.exports = router;
