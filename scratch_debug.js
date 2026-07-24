const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  try {
    await page.goto('http://localhost:5173/where-it-went-react.html', { waitUntil: 'networkidle0' });
    console.log('Page loaded successfully');
    
    // Check if #root is empty
    const rootHtml = await page.$eval('#root', el => el.innerHTML);
    if (!rootHtml || rootHtml.trim() === '') {
      console.log('Root element is empty!');
    } else {
      console.log('Root element has content.');
    }
  } catch (e) {
    console.error('Error navigating:', e);
  }

  await browser.close();
})();
