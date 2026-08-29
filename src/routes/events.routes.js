const { Router } = require('express');
const { getEvents } = require('../controllers/events.controller');

const router = Router();

router.get('/events', getEvents);

module.exports = router;
