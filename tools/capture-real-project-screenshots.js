const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('../frontend/node_modules/playwright-core');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'project_screenshots');
fs.mkdirSync(outDir, { recursive: true });

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function waitForUrl(url, timeout = 90000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(url, (res) => {
        res.resume();
        resolve();
      }).on('error', () => {
        if (Date.now() - start > timeout) reject(new Error(`Timed out waiting for ${url}`));
        else setTimeout(tick, 700);
      });
    };
    tick();
  });
}

function startProcess(command, args, cwd, logName) {
  const out = fs.createWriteStream(path.join(outDir, `${logName}.log`));
  const err = fs.createWriteStream(path.join(outDir, `${logName}.err.log`));
  const child = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.pipe(out);
  child.stderr.pipe(err);
  return child;
}

async function architecture(page) {
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.setContent(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            width: 1440px;
            height: 950px;
            display: grid;
            place-items: center;
            background: #f8fafc;
            color: #111827;
            font-family: Inter, "Segoe UI", Arial, sans-serif;
          }
          .wrap { width: 1220px; }
          h1 { text-align: center; font-size: 42px; margin: 0 0 54px; }
          .flow { display: flex; align-items: center; gap: 22px; }
          .node {
            width: 260px;
            min-height: 210px;
            background: white;
            border: 2px solid #d1d5db;
            border-radius: 18px;
            padding: 28px;
            text-align: center;
            box-shadow: 0 24px 48px rgba(15,23,42,.10);
          }
          .icon { font-size: 46px; margin-bottom: 14px; }
          h2 { margin: 0 0 12px; font-size: 24px; }
          p { margin: 0; color: #4b5563; line-height: 1.45; font-size: 15px; }
          .arrow { color: #f59e0b; font-size: 44px; font-weight: 900; }
          .bands { margin-top: 42px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
          .band { background: #111827; color: white; border-radius: 999px; padding: 15px 20px; text-align: center; font-weight: 800; }
        </style>
      </head>
      <body>
        <main class="wrap">
          <h1>System Architecture</h1>
          <section class="flow">
            <article class="node"><div class="icon">💻</div><h2>Client</h2><p>Next.js Bookflix interface with profile selection, browse rows, search, and book modal.</p></article>
            <div class="arrow">→</div>
            <article class="node"><div class="icon">⚡</div><h2>FastAPI Server</h2><p>REST API layer for books, users, search, recommendations, feedback, and admin metrics.</p></article>
            <div class="arrow">→</div>
            <article class="node"><div class="icon">🧠</div><h2>ML Engine</h2><p>Hybrid recommender combining collaborative filtering and content similarity.</p></article>
            <div class="arrow">→</div>
            <article class="node"><div class="icon">📄</div><h2>CSV Data</h2><p>books.csv and ratings.csv provide catalog metadata and interaction history.</p></article>
          </section>
          <section class="bands">
            <div class="band">Profile State</div>
            <div class="band">CORS + Cache</div>
            <div class="band">Hybrid Scoring</div>
            <div class="band">Metrics Dashboard</div>
          </section>
        </main>
      </body>
    </html>`);
  await page.screenshot({ path: path.join(outDir, 'Figure_1_System_Architecture.png'), fullPage: false });
}

async function main() {
  const api = startProcess('node', [path.join(root, 'tools', 'mock-bookflix-api.js')], root, 'real-api');
  const frontend = startProcess('cmd.exe', ['/c', 'npm.cmd', 'run', 'dev'], path.join(root, 'frontend'), 'real-frontend');

  await waitForUrl('http://127.0.0.1:8000/api/users');
  await waitForUrl('http://127.0.0.1:3000/');

  const browser = await chromium.launch({
    executablePath: edgePath,
    headless: true,
    args: [
      '--disable-gpu',
      '--disable-gpu-compositing',
      '--disable-dev-shm-usage',
      '--no-first-run',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  await architecture(page);

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outDir, 'Figure_2_Profile_Selection_Screen.png'), fullPage: false });

  await page.getByText('Chitesh').click();
  await page.waitForURL('**/browse');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('text=Recommended for You');
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(outDir, 'Figure_3_Browse_Page_Hero_And_Carousels.png'), fullPage: false });

  await page.getByRole('button', { name: /Insights/i }).click();
  await page.waitForSelector('text=AI Reading Insights');
  await page.waitForSelector('text=More Like This');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(outDir, 'Figure_4_Book_Detail_Modal_Hybrid_AI_Insights.png'), fullPage: false });

  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('button.absolute.top-4.right-4').click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator('nav svg').first().click();
  await page.locator('#searchInput').fill('harry');
  await page.waitForSelector('text=/Harry|Potter|Sorcerer|Chamber|Rowling/i');
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, 'Figure_5_Navbar_Search_Live_Dropdown.png'), fullPage: false });

  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Admin Metrics Dashboard');
  await page.waitForSelector('text=A/B Test CTR');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'Figure_6_Admin_Dashboard_Metrics.png'), fullPage: false });

  await browser.close();
  frontend.kill();
  api.kill();
  console.log(outDir);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
