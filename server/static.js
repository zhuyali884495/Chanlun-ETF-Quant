const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PORT = 5173;

const DIST = path.join(__dirname, '..', 'client', 'dist');
const PROXY = 'http://localhost:3099';

// ============================================================
// 访问凭证（个人用，可自行修改）
// 用户名: zhu
// 密码: 2026chan
// ============================================================
const AUTH_USER = 'zhu';
const AUTH_PASS = '2026chan';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function checkAuth(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Basic ')) return false;
  const received = Buffer.from(authHeader.slice(6), 'base64').toString();
  const [user, pass] = received.split(':');
  return user === AUTH_USER && pass === AUTH_PASS;
}

function sendAuthChallenge(res) {
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Chan Theory H5 - Access Required"',
    'Content-Type': 'text/html; charset=utf-8',
  });
  res.end('<html><body style="background:#0a0e17;color:#e8e8e8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#ef4444">Authentication Required</h2><p>Enter your credentials to access this system</p><p style="color:#6b7280;font-size:12px">Chan Theory Analysis | K-line Structure | Quant Signals</p></div></html>');
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // 所有请求都需要认证
  if (!checkAuth(req)) {
    return sendAuthChallenge(res);
  }

  // Proxy API calls to backend
  if (url.startsWith('/api/')) {
    const opts = {
      hostname: 'localhost',
      port: 3099,
      path: url,
      method: req.method,
      headers: req.headers,
    };
    const proxy = http.request(opts, (pr) => {
      res.writeHead(pr.statusCode, pr.headers);
      pr.pipe(res, { end: true });
    });
    req.pipe(proxy, { end: true });
    return;
  }

  // Static files
  let filePath = path.join(DIST, url === '/' ? 'index.html' : url);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\u{1F980} 缠论分析系统已启动: http://localhost:${PORT}`);
  console.log(`访问凭证: ${AUTH_USER} / ${AUTH_PASS}`);
  console.log(` Tunnel: https://chan-theory-h5.loca.lt`);
});
