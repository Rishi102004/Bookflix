const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

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
  const headers = rows.shift() || [];
  return rows.map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i] || ''])));
}

const books = parseCsv(fs.readFileSync(path.join(root, 'backend', 'data', 'books.csv'), 'utf8'))
  .map((book, index) => ({
    book_id: Number(book.book_id || index + 1),
    isbn: book.isbn,
    title: book.title || book.book_title || '',
    author: book.author || book.book_author || '',
    year_of_publication: book.year_of_publication || '',
    publisher: book.publisher || '',
    image_url_s: book.image_url_s || book.image_url || '',
    image_url_m: book.image_url_m || book.image_url || '',
    image_url_l: book.image_url_l || book.image_url || '',
    image_url: book.image_url_l || book.image_url_m || book.image_url_s || book.image_url || '',
    genre: book.genre || book.publisher || 'Fiction',
  }));

const stats = {
  total_recommendations_served: 128,
  total_clicks: 53,
  cache_hits: 24,
  feedback_positive: 25,
  feedback_negative: 5,
};

function json(res, value) {
  res.writeHead(200, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(value));
}

function recommendations(seed = 1, limit = 10) {
  return books.slice(seed, seed + limit).map((book, idx) => ({
    book_details: book,
    explanation: idx % 2 === 0 ? 'Because similar readers liked this title' : 'Hybrid match from author and publisher similarity',
    confidence_score: Math.max(0.66, 0.95 - idx * 0.025),
  }));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:8000');

  if (req.method === 'OPTIONS') return json(res, {});

  if (url.pathname === '/api/users') return json(res, [101, 204, 309, 412]);

  if (url.pathname === '/api/books') {
    const limit = Number(url.searchParams.get('limit') || 50);
    return json(res, books.slice(0, limit));
  }

  if (url.pathname.startsWith('/api/books/')) {
    const id = Number(url.pathname.split('/').pop());
    return json(res, books.find((book) => book.book_id === id) || books[0]);
  }

  if (url.pathname === '/api/search') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const found = books.filter((book) =>
      `${book.title} ${book.author} ${book.publisher} ${book.genre}`.toLowerCase().includes(q)
    ).slice(0, 8);
    return json(res, found.length ? found : books.slice(0, 5));
  }

  if (url.pathname === '/api/recommend') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      let payload = {};
      try { payload = JSON.parse(body || '{}'); } catch (_) {}
      stats.total_recommendations_served++;
      const seed = Number(payload.book_id || payload.user_id || 1) % Math.max(1, books.length - 12);
      json(res, { recommendations: recommendations(seed, Number(payload.limit || 10)) });
    });
    return;
  }

  if (url.pathname === '/api/interactions/click') {
    stats.total_clicks++;
    return json(res, { status: 'ok' });
  }

  if (url.pathname === '/api/feedback') {
    if (url.searchParams.get('type') === 'negative') stats.feedback_negative++;
    else stats.feedback_positive++;
    return json(res, { status: 'ok' });
  }

  if (url.pathname === '/api/admin/metrics') {
    const totalFeedback = stats.feedback_positive + stats.feedback_negative;
    return json(res, {
      ctr_percent: ((stats.total_clicks / Math.max(1, stats.total_recommendations_served)) * 100).toFixed(1),
      precision_percent: ((stats.feedback_positive / Math.max(1, totalFeedback)) * 100).toFixed(1),
      raw_stats: stats,
    });
  }

  res.writeHead(404, { 'access-control-allow-origin': '*' });
  res.end('not found');
});

server.listen(8000, '127.0.0.1', () => {
  console.log('Mock Bookflix API listening on http://127.0.0.1:8000');
});
