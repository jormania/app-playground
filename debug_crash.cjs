const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', error => {
    console.log(`[pageerror] ${error.message}`);
  });

  console.log('Navigating to app...');
  await page.goto('http://localhost:5173/daily-stoic-react.html');
  
  // Set onboarded to true
  await page.evaluate(() => {
    localStorage.setItem('daily-stoic:onboarded', 'true');
  });
  
  // Reload page
  await page.reload();
  
  await page.waitForTimeout(3000);
  
  const innerHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML);
  console.log(`Root HTML length: ${innerHtml ? innerHtml.length : 0}`);
  
  await browser.close();
})();
