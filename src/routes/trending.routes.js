const { Router } = require('express');
const { getTrending } = require('../controllers/trending.controller');

const router = Router();

router.get('/trending', getTrending);

module.exports = router;
