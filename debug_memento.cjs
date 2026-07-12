/* eslint-disable */
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to Daily Stoic React app
  await page.goto('http://localhost:5173/daily-stoic-react.html');
  await page.evaluate(() => {
    localStorage.setItem('daily-stoic:birth-date', '1975-01-01');
    localStorage.setItem('daily-stoic:reflection-1', JSON.stringify({ quoteId: 1, text: 'Test' }));
  });
  
  await page.reload();
  await page.waitForTimeout(1000);
  
  // Check Stats modal
  await page.click('button[title="Stats & Progress"]');
  await page.waitForTimeout(1000);
  
  const statsHtml = await page.content();
  fs.writeFileSync('stats_dump.html', statsHtml);
  
  // Close stats
  await page.click('button[title="Close Stats"]');
  await page.waitForTimeout(500);
  
  // Go to Memento
  await page.goto('http://localhost:5173/daily-stoic-react.html#/memento');
  await page.waitForTimeout(1000);
  
  const mementoHtml = await page.content();
  fs.writeFileSync('memento_dump.html', mementoHtml);
  
  await browser.close();
})();
