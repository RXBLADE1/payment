const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS allow karo (kisi bhi APK se access ho sake)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Latest payout store karne ke liye
let latestPayout = null;
let lastUpdate = null;
let allPayouts = [];

// Payout extractor function
async function scrapePayouts() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // User agent set karo
    await page.setUserAgent(
      'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    );

    // Wrapper URL load karo (dmfirst0)
    const WRAPPER_URL = 'https://www.dmfirst0.com/#/home/game?url=aHR0cHM6Ly9nYW1lLnRiZ2FtZWxvYWRlci5jb20vODAwL3YzNy9pbmRleC5odG1sP2FwcGlkPTgwMCZ0b2tlbj0xLUZLWjZDU01WUEFUMU5OWi1DNkY4ODE0Q0JBMUY1OERBJmN1cnJlbmN5PTMwNyZjdXJyZW5jeV9zaWduYWw9U1U1UyZnZXA9ZXlKbmJDSTZXeUozYzNNNkx5OXhjR0Z3YVM1MFltZGhiV1ZzYjJGa1pYSXVZMjl0SWwxOSZsYW5nPWVu&vendorCode=TB_Chess';

    await page.goto(WRAPPER_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // iframe dhoondho jisme tbgameloader hai
    let gameFrame = null;
    const maxWait = 30000;
    const startTime = Date.now();

    while (!gameFrame && Date.now() - startTime < maxWait) {
      const frames = page.frames();
      for (const frame of frames) {
        const frameUrl = frame.url();
        if (frameUrl.includes('tbgameloader')) {
          gameFrame = frame;
          break;
        }
      }
      if (!gameFrame) await new Promise(r => setTimeout(r, 1000));
    }

    if (!gameFrame) {
      throw new Error('Game iframe not found');
    }

    // Frame ke andar payouts dhoondho
    await gameFrame.waitForSelector('.payouts-block', { timeout: 30000 });

    const result = await gameFrame.evaluate(() => {
      const block = document.querySelector('.payouts-block');
      if (!block) return null;

      const items = block.querySelectorAll('.payouts, [class*="bubble-multiplier"]');
      const payouts = [];

      items.forEach(item => {
        const text = item.innerText.trim();
        if (text && /\\d+(\\.\\d+)?x/.test(text)) {
          payouts.push(text);
        }
      });

      return payouts;
    });

    return result;

  } finally {
    await browser.close();
  }
}

// API Endpoint: GET /payouts
app.get('/payouts', async (req, res) => {
  try {
    const payouts = await scrapePayouts();
    
    if (payouts && payouts.length > 0) {
      latestPayout = payouts[0];
      allPayouts = payouts;
      lastUpdate = new Date().toISOString();
    }

    res.json({
      success: true,
      latest: latestPayout,
      all: allPayouts,
      total: allPayouts.length,
      timestamp: lastUpdate
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      latest: latestPayout,
      all: allPayouts,
      timestamp: lastUpdate
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API running on port ${PORT}`);
});