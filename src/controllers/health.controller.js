/**
 * Health check controller
 * GET /health
 */
function getHealth(req, res) {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  getHealth,
};
