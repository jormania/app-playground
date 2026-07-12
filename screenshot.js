import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to the local app's Memento Mori route
  await page.goto('http://localhost:5173/#/memento');
  
  // Wait for the main elements to load (e.g. Daily Stoic header)
  await page.waitForTimeout(1000); 

  // Take a full page screenshot and save it to the artifacts directory
  const screenshotPath = 'C:\\Users\\Gabriel\\.gemini\\antigravity\\brain\\281ba2ea-c336-4383-98a3-84ad10a32a0b\\ui_screenshot.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });

  console.log(`Screenshot saved to ${screenshotPath}`);
  await browser.close();
})();
