const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/render', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('URL required');
  try {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let current = 0;
        const step = setInterval(() => {
          window.scrollTo(0, current);
          current += 500;
          if (current >= document.body.scrollHeight) {
            window.scrollTo(0, 0);
            clearInterval(step);
            resolve();
          }
        }, 200);
      });
    });
    await new Promise(r => setTimeout(r, 2000));
    const html = await page.content();
    await browser.close();
    const base = new URL(url);
    const finalHtml = html.replace('<head>', `<head><base href="${base.origin}">`);
    res.setHeader('Content-Type', 'text/html');
    res.send(finalHtml);
  } catch(e) {
    res.status(500).send('Error: ' + e.message);
  }
});

app.listen(3001, () => console.log('Render service on port 3001'));
