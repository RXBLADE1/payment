const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Puppeteer cache Render ke build cache me store karo
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};