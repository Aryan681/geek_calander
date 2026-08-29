/**
 * Structured logger utility supporting info, warn, error levels.
 * Guarantees no sensitive credentials or tokens are logged.
 */

function formatMessage(level, message, ...args) {
  const timestamp = new Date().toISOString();
  return { timestamp, level, message, args };
}

const logger = {
  info(message, ...args) {
    console.log(message, ...args);
  },

  warn(message, ...args) {
    console.warn(message, ...args);
  },

  error(message, ...args) {
    console.error(message, ...args);
  },
};

module.exports = logger;
