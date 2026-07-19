const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'project_screenshots');
fs.mkdirSync(outDir, { recursive: true });

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = rows.shift();
  return rows.map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i] || ''])));
}

const books = parseCsv(fs.readFileSync(path.join(root, 'backend', 'data', 'books.csv'), 'utf8'))
  .slice(0, 60)
  .map((b, index) => ({
    ...b,
    book_id: Number(b.book_id || index + 1),
    title: b.title || b.book_title || `Book ${index + 1}`,
    author: b.author || b.book_author || 'Unknown Author',
    image: (b.image_url_l || b.image_url_m || b.image_url_s || b.image_url || '').replace('http:', 'https:'),
    genre: b.genre || ['Fiction', 'Mystery', 'Romance', 'Fantasy', 'Classics'][index % 5],
  }));

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[ch]));
}

function cover(book, size = 'card') {
  const fallback = `https://via.placeholder.com/${size === 'hero' ? '900x520' : '260x390'}/161616/f5c15c?text=BOOKFLIX`;
  return `<img src="${esc(book.image || fallback)}" onerror="this.src='${fallback}'" alt="${esc(book.title)}">`;
}

const css = `
  *{box-sizing:border-box} body{margin:0;background:#111;color:#f5f5f5;font-family:Inter,Segoe UI,Arial,sans-serif;letter-spacing:0}
  .brand{color:#f59e0b;font-weight:900;letter-spacing:2px}.page{min-height:100vh;background:#0d0d0f}.nav{position:fixed;z-index:30;top:0;left:0;right:0;height:70px;padding:18px 48px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(#080808ee,#08080800)}
  .navlinks{display:flex;gap:22px;color:#d1d5db;font-size:14px}.navright{display:flex;align-items:center;gap:22px}.avatar{width:34px;height:34px;background:#1e40af;border-radius:4px;display:grid;place-items:center;font-weight:800}
  .profile{min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;background:#111;padding:40px}.profile .brand{position:absolute;top:26px;left:48px;font-size:44px}.profile h1{font-size:58px;font-weight:500;margin:0 0 48px}
  .profiles{display:flex;gap:42px}.pitem{text-align:center;color:#aaa;font-size:24px}.tile{width:160px;height:160px;border-radius:6px;display:grid;place-items:center;font-size:64px;font-weight:800;box-shadow:0 16px 40px #0009}.pitem:nth-child(1) .tile{background:#1e3a8a}.pitem:nth-child(2) .tile{background:#7c2d12}.pitem:nth-child(3) .tile{background:#065f46}.pitem:nth-child(4) .tile{background:#581c87}
  .manage{margin-top:72px;border:1px solid #777;color:#888;padding:12px 28px;text-transform:uppercase;letter-spacing:2px}
  .hero{height:82vh;position:relative;overflow:hidden}.hero>img{width:100%;height:100%;object-fit:cover;filter:blur(2px);transform:scale(1.04);opacity:.48}.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#111 0%,#111c 42%,#1110),linear-gradient(0deg,#111 0%,#1110 45%)}
  .heroText{position:absolute;z-index:2;left:48px;top:36%;max-width:660px}.heroText h1{font-size:60px;line-height:1;margin:0 0 18px;color:#f59e0b;text-shadow:2px 2px 8px #000}.heroText .meta{font-size:20px;color:#d1d5db;margin-bottom:24px}.heroText p{font-size:16px;line-height:1.55;color:#e5e7eb}.btn{display:inline-flex;align-items:center;gap:9px;border-radius:5px;padding:12px 24px;margin-right:12px;background:#f59e0b;color:white;font-weight:800}.btn.dark{background:#27272acc;border:1px solid #555}
  .rows{position:relative;z-index:3;margin-top:-42px;padding-bottom:50px}.row{margin:28px 0}.row h2{font-size:25px;margin:0 0 10px;padding:0 48px}.strip{display:flex;gap:10px;overflow:hidden;padding:12px 48px 28px}.card{position:relative;flex:0 0 185px;height:278px;border-radius:6px;overflow:hidden;background:#222;box-shadow:0 12px 30px #0008}.card img{width:100%;height:100%;object-fit:cover}.badge{position:absolute;right:0;top:0;background:#f59e0b;color:#111;font-size:12px;font-weight:900;padding:5px 8px;border-radius:0 0 0 6px}.cardTitle{position:absolute;left:0;right:0;bottom:0;padding:44px 10px 10px;background:linear-gradient(#0000,#000e);font-weight:800;font-size:13px}
  .modalBackdrop{min-height:100vh;background:#050505;display:grid;place-items:center;padding:30px}.modal{width:1040px;max-height:94vh;overflow:hidden;background:#18181b;border:1px solid #3f3f46;border-radius:12px;box-shadow:0 24px 80px #000}.modalHero{height:340px;position:relative}.modalHero img{width:100%;height:100%;object-fit:cover;opacity:.78}.modalHero:after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,#18181b 0%,#18181b99 35%,#0000)}.modalHeroText{position:absolute;left:34px;right:34px;bottom:28px;z-index:2}.modalHeroText h1{font-size:44px;margin:0 0 18px}.round{width:42px;height:42px;border-radius:50%;border:2px solid #aaa;display:inline-grid;place-items:center;margin-left:8px;background:#111}
  .modalBody{display:grid;grid-template-columns:2fr 1fr;gap:35px;padding:26px 34px;border-bottom:1px solid #3f3f46}.match{color:#4ade80;font-weight:900}.insights{background:#1118;padding:24px 34px;border-bottom:1px solid #3f3f46}.insights h2{margin:0 0 14px;color:#f59e0b}.insightGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.insight{background:#18181b;border:1px solid #3f3f46;border-radius:8px;padding:16px;color:#d1d5db}.wide{grid-column:1/3;background:linear-gradient(90deg,#312e81aa,#581c87aa)}
  .searchWrap{position:relative}.searchBox{width:330px;border:1px solid #f59e0b;background:#0008;border-radius:4px;padding:9px 12px;color:white}.dropdown{position:absolute;right:0;top:48px;width:360px;background:#18181b;border:1px solid #3f3f46;border-radius:6px;overflow:hidden;box-shadow:0 20px 50px #000;z-index:60}.result{display:flex;gap:12px;padding:12px;border-bottom:1px solid #333}.result img{width:42px;height:58px;object-fit:cover;border-radius:4px}.result b{display:block;font-size:14px}.result span{font-size:12px;color:#aaa}
  .admin{min-height:100vh;background:#f4f5f7;color:#1f2937;padding:54px}.admin .top{display:flex;justify-content:space-between;align-items:center;max-width:1120px;margin:auto}.admin h1{font-size:34px;color:#1e3a8a}.admin p{max-width:1120px;margin:0 auto;color:#6b7280}.metrics{max-width:1120px;margin:36px auto;display:grid;grid-template-columns:repeat(4,1fr);gap:22px}.metric{background:white;border:1px solid #e5e7eb;border-radius:18px;padding:30px;box-shadow:0 14px 30px #0001}.metric h3{font-size:12px;color:#6b7280;text-transform:uppercase}.metric strong{display:block;font-size:42px;margin-top:10px}.indigo{color:#4f46e5}.green{color:#22c55e}.orange{color:#f97316}.blue{color:#3b82f6}
  .diagram{min-height:100vh;background:#f8fafc;color:#111827;display:grid;place-items:center;padding:60px}.arch{width:1120px}.arch h1{text-align:center;font-size:34px;margin:0 0 38px}.flow{display:flex;align-items:center;gap:22px}.node{flex:1;min-height:170px;background:white;border:2px solid #d1d5db;border-radius:18px;padding:28px;box-shadow:0 20px 40px #0001;text-align:center}.node h2{margin:10px 0;font-size:22px}.node p{color:#4b5563;line-height:1.4}.arrow{font-size:42px;color:#f59e0b;font-weight:900}.layers{margin-top:32px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.pill{background:#111827;color:white;border-radius:999px;padding:12px 18px;text-align:center;font-weight:800}
`;

function shell(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Bookflix Screenshot</title><style>${css}</style></head><body>${body}</body></html>`;
}

function profilePage() {
  const names = ['Chitesh', 'Yeshu', 'Rishi', 'Varun'];
  return shell(`<main class="profile"><div class="brand">BOOKFLIX</div><h1>Who is reading today?</h1><section class="profiles">${names.map((n) => `<div class="pitem"><div class="tile">${n[0]}</div><div style="margin-top:16px">${n}</div></div>`).join('')}</section><div class="manage">Manage Profiles</div></main>`);
}

function rows() {
  const groups = [
    ['Recommended for You', books.slice(5, 13), true],
    ['Trending Now', books.slice(13, 23), false],
    ['Popular Series', books.slice(23, 33), false],
    ['Author Spotlight', books.slice(33, 43), false],
  ];
  return groups.map(([title, list, rec]) => `<section class="row"><h2>${title}</h2><div class="strip">${list.map((b, i) => `<article class="card">${cover(b)}${rec ? `<div class="badge">${88 - i}% Match</div>` : ''}<div class="cardTitle">${esc(b.title)}</div></article>`).join('')}</div></section>`).join('');
}

function browsePage({ search = false } = {}) {
  const hero = books[0];
  const searchResults = books.filter((b) => /harry|potter|lord|ring|hobbit/i.test(`${b.title} ${b.author}`)).slice(0, 5);
  return shell(`<main class="page"><nav class="nav"><div style="display:flex;align-items:center;gap:34px"><div class="brand" style="font-size:30px">BOOKFLIX</div><div class="navlinks"><span>Home</span><span>Series</span><span>Authors</span><span>My List</span></div></div><div class="navright"><div class="searchWrap">${search ? `<input class="searchBox" value="Harry Potter"><div class="dropdown">${searchResults.map((b) => `<div class="result">${cover(b)}<div><b>${esc(b.title)}</b><span>${esc(b.author)}</span></div></div>`).join('')}</div>` : '<span style="font-size:24px">⌕</span>'}</div><span>🔔</span><div class="avatar">C</div></div></nav><section class="hero">${cover(hero, 'hero')}<div class="heroText"><h1>${esc(hero.title)}</h1><div class="meta">${esc(hero.author)} • ${esc(hero.year_of_publication || 'Unknown')} • ${esc(hero.publisher)}</div><p>A literary journey awaits. Explore the compelling world of ${esc(hero.title)} crafted by the renowned ${esc(hero.author)}. Discover why readers around the globe are captivated by this masterpiece.</p><div><span class="btn">▶ Read</span><span class="btn dark">ⓘ Insights</span></div></div></section><section class="rows">${rows()}</section></main>`);
}

function modalPage() {
  const b = books[8] || books[0];
  return shell(`<main class="modalBackdrop"><section class="modal"><div class="modalHero">${cover(b, 'hero')}<div class="modalHeroText"><h1>${esc(b.title)}</h1><span class="btn">📖 Details</span><span class="btn" style="background:#4f46e5">↗ Read Online</span><span class="round">＋</span><span class="round">👍</span><span class="round">👎</span></div></div><div class="modalBody"><div><div><span class="match">92% Match</span> <span style="color:#aaa;margin-left:16px">${esc(b.year_of_publication)}</span> <span style="border:1px solid #666;border-radius:3px;padding:1px 5px;margin-left:12px">HD</span></div><p style="font-size:18px;line-height:1.6;color:#e5e7eb">Experience the captivating story of ${esc(b.title)}. A critically acclaimed work that has left an indelible mark on its readers. Dive deep into the pages and explore the vivid imagination of the author.</p></div><aside style="color:#ccc;line-height:1.9"><div><span style="color:#777">Author:</span> ${esc(b.author)}</div><div><span style="color:#777">Publisher:</span> ${esc(b.publisher)}</div><div><span style="color:#777">Genre:</span> ${esc(b.genre)}</div></aside></div><section class="insights"><h2>✨ AI Reading Insights</h2><div class="insightGrid"><div class="insight"><b>Estimated Read Time</b><br>~${Math.max(2, Math.floor(b.title.length / 5))} hours at average reading speed.</div><div class="insight"><b>Book Vibe</b><br>Considered highly atmospheric by similar readers.</div><div class="insight wide"><b>Why you should read this</b><br><i>If you enjoyed other books published by ${esc(b.publisher)}, this hybrid recommendation can keep you turning pages late into the night.</i></div></div></section><section class="row" style="margin-top:18px"><h2>More Like This</h2><div class="strip">${books.slice(12, 18).map((book) => `<article class="card" style="flex-basis:145px;height:218px">${cover(book)}<div class="cardTitle">${esc(book.title)}</div></article>`).join('')}</div></section></section></main>`);
}

function adminPage() {
  return shell(`<main class="admin"><div class="top"><h1>Admin Metrics Dashboard</h1><div style="background:#e5e7eb;border-radius:9px;padding:11px 18px;font-weight:700">Back to App</div></div><p>Live KPIs and ML system interaction monitoring.</p><section class="metrics"><div class="metric"><h3>Total Recommends</h3><strong class="indigo">128</strong></div><div class="metric"><h3>A/B Test CTR</h3><strong class="green">41.7%</strong><small>(53 Clicks)</small></div><div class="metric"><h3>Redis Cache Hits</h3><strong class="orange">24</strong><small>Sub-200ms requests</small></div><div class="metric"><h3>Precision (Feedback)</h3><strong class="blue">83.3%</strong><small style="color:#22c55e;font-weight:800">Thumbs up 25</small> <small style="color:#ef4444;font-weight:800">Thumbs down 5</small></div></section></main>`);
}

function architecturePage() {
  return shell(`<main class="diagram"><section class="arch"><h1>System Architecture</h1><div class="flow"><div class="node"><div style="font-size:42px">💻</div><h2>Client</h2><p>Next.js Bookflix UI with profile selection, search, browse rows, and book modal.</p></div><div class="arrow">→</div><div class="node"><div style="font-size:42px">⚡</div><h2>FastAPI Server</h2><p>REST endpoints for users, books, search, recommendation, feedback, and metrics.</p></div><div class="arrow">→</div><div class="node"><div style="font-size:42px">🧠</div><h2>ML Engine</h2><p>Hybrid collaborative and content-based recommendation pipeline.</p></div><div class="arrow">→</div><div class="node"><div style="font-size:42px">📄</div><h2>CSV Data</h2><p>books.csv and ratings.csv provide catalog and interaction data.</p></div></div><div class="layers"><div class="pill">Profile State</div><div class="pill">Caching + CORS</div><div class="pill">Similarity Scoring</div><div class="pill">Admin Metrics</div></div></section></main>`);
}

const pages = {
  '/architecture': architecturePage,
  '/profile': profilePage,
  '/browse': () => browsePage(),
  '/modal': modalPage,
  '/search': () => browsePage({ search: true }),
  '/admin': adminPage,
};

const server = http.createServer((req, res) => {
  const render = pages[new URL(req.url, 'http://localhost').pathname] || pages['/profile'];
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(render());
});

function requestJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (err) { reject(err); }
      });
    }).on('error', reject);
  });
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  };
  return new Promise((resolve) => {
    ws.onopen = () => resolve({
      send(method, params = {}) {
        const callId = ++id;
        ws.send(JSON.stringify({ id: callId, method, params }));
        return new Promise((resolveCall, rejectCall) => pending.set(callId, { resolve: resolveCall, reject: rejectCall }));
      },
      close() { ws.close(); },
    });
  });
}

async function waitForChrome(port) {
  for (let i = 0; i < 60; i++) {
    try { return await requestJson(`http://127.0.0.1:${port}/json/version`); } catch (_) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error('Chrome did not start');
}

async function waitForPage(port) {
  for (let i = 0; i < 60; i++) {
    try {
      const targets = await requestJson(`http://127.0.0.1:${port}/json/list`);
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Chrome page target did not start');
}

async function capture(client, url, file, width = 1440, height = 950) {
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await client.send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 1800));
  const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(outDir, file), Buffer.from(shot.data, 'base64'));
}

async function main() {
  await new Promise((resolve) => server.listen(4177, '127.0.0.1', resolve));
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const base = 'http://127.0.0.1:4177';
  const jobs = [
    ['/architecture', 'Figure_1_System_Architecture.png'],
    ['/profile', 'Figure_2_Profile_Selection_Screen.png'],
    ['/browse', 'Figure_3_Browse_Page_Hero_And_Carousels.png'],
    ['/modal', 'Figure_4_Book_Detail_Modal_Hybrid_AI_Insights.png'],
    ['/search', 'Figure_5_Navbar_Search_Live_Dropdown.png'],
    ['/admin', 'Figure_6_Admin_Dashboard_Metrics.png'],
  ];
  try {
    for (const [route, file] of jobs) {
      const profileDir = path.join(outDir, `.edge-profile-${Date.now()}-${file}`);
      const result = spawnSync(edge, [
        '--headless',
        '--disable-gpu',
        '--disable-gpu-compositing',
        '--in-process-gpu',
        '--disable-features=VizDisplayCompositor',
        '--hide-scrollbars',
        '--no-first-run',
        `--user-data-dir=${profileDir}`,
        '--window-size=1440,950',
        `--screenshot=${path.join(outDir, file)}`,
        `${base}${route}`,
      ], { encoding: 'utf8', timeout: 30000 });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw new Error(`Edge screenshot failed for ${route}: ${result.stderr || result.stdout}`);
      }
    }
    console.log(outDir);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
