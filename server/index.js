'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { ChanEngine } = require('./chan/engine');
const { chanAnalysis, sentimentScore, gridStrategy, capitalFlowAnalysis, riskAssessment } = require('./chan/analysis');
const { portfolioAnalysis, checkAlerts, addAlert, removeAlert, getAlerts } = require('./chan/portfolio');

const app = express();
const PORT = 3099;
app.use(cors());
app.use(express.json());

const ETF_LIST = [
  { code: '159915', name: '创业板ETF' },
  { code: '510300', name: '沪深300ETF' },
  { code: '510500', name: '中证500ETF' },
  { code: '512880', name: '证券ETF' },
  { code: '515880', name: '通信ETF' },
  { code: '512760', name: '芯片ETF' },
  { code: '515050', name: '5GETF' },
  { code: '518880', name: '黄金ETF' },
];

// ─── 静态文件 + 模拟K线 ─────────────────────────────────────
function generateMockKlines(code, cycle = '日线', count = 250) {
  const data = [];
  const now = Date.now();
  const cycleMs = { '日线': 86400000, '60分钟': 3600000, '30分钟': 1800000, '周线': 604800000 }[cycle] || 86400000;
  let price = 1.0;
  const startTime = now - count * cycleMs;
  for (let i = 0; i < count; i++) {
    const date = new Date(startTime + i * cycleMs);
    const change = (Math.random() - 0.48) * 0.025;
    const open = price; const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    data.push({ index: i, date: date.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(4)), high: parseFloat(high.toFixed(4)),
      low: parseFloat(low.toFixed(4)), close: parseFloat(close.toFixed(4)),
      vol: Math.floor(Math.random() * 10000000 + 1000000) });
    price = close;
  }
  return data;
}

// ─── API路由 ────────────────────────────────────────────────

// 1. ETF列表
app.get('/api/etf/list', (req, res) => {
  res.json({ code: 0, data: ETF_LIST });
});

// 2. 周期列表
app.get('/api/cycle/list', (req, res) => {
  res.json({ code: 0, data: ['日线', '60分钟', '30分钟', '周线'].map(n => ({ name: n, value: n })) });
});

// 3. 缠论分析
app.get('/api/chan/:code', async (req, res) => {
  const { code } = req.params;
  const { cycle = '日线' } = req.query;
  try {
    const result = await chanAnalysis(code, cycle);
    res.json({ code: 0, data: { meta: { code, cycle, ...result.meta }, ...result } });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

// 4. 缠论刷新
app.post('/api/chan/:code/refresh', async (req, res) => {
  const { code } = req.params;
  const { cycle = '日线' } = req.body;
  try {
    const result = await chanAnalysis(code, cycle);
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

// 5. 景气度打分（路由层缓存，3分钟TTL）
const _sentimentCache = {};
app.get('/api/sentiment/:code?', async (req, res) => {
  const code = req.params.code || '515880';
  const now = Date.now();
  const cached = _sentimentCache[code];
  if (cached && (now - cached.ts) < 180000) {
    return res.json({ code: 0, data: cached.val });
  }
  try {
    const data = await sentimentScore(code);
    _sentimentCache[code] = { val: data, ts: now };
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

// 6. 网格策略
app.get('/api/grid/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const data = await gridStrategy(code);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.post('/api/grid/:code', async (req, res) => {
  const { code } = req.params;
  const { capital, riskLevel, customVol, customBand } = req.body || {};
  try {
    const data = await gridStrategy(code, { capital, riskLevel, customVol, customBand });
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

// 7. 资金流向
app.get('/api/capital/:code', async (req, res) => {
  const { code } = req.params;
  const { period } = req.query;
  try {
    const data = await capitalFlowAnalysis(code, period);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

// 8. 风险测评
app.get('/api/risk/:code', async (req, res) => {
  const { code } = req.params;
  const { riskLevel, positions } = req.query;
  try {
    const opts = {};
    if (riskLevel !== undefined) opts.riskLevel = parseInt(riskLevel);
    if (positions) {
      try { opts.positions = JSON.parse(decodeURIComponent(positions)); } catch {}
    }
    const data = await riskAssessment(code, opts);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.post('/api/risk/:code', async (req, res) => {
  const { code } = req.params;
  const { riskLevel, positions } = req.body || {};
  try {
    const data = await riskAssessment(code, { riskLevel, positions });
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

// ─── 工具：带超时的安全执行 ────────────────────────────────
function withTimeout(fn, ms, fallback = null) {
  const p = new Promise((resolve) => {
    Promise.resolve().then(fn).then(resolve).catch(() => resolve(fallback));
  });
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])
    .catch(() => fallback);
}

app.get('/api/analyze/:code', async (req, res) => {
  const { code } = req.params;
  const { cycle = '日线' } = req.query;

  try {
    // 快速接口并行（2分钟内任一返回即可）
    const [chan, risk] = await Promise.all([
      withTimeout(() => chanAnalysis(code, cycle), 30000).catch(() => null),
      withTimeout(() => riskAssessment(code), 15000).catch(() => null),
    ]);
    // 慢接口顺序执行
    const sentiment = await withTimeout(() => sentimentScore(code), 25000).catch(() => null);
    const capital   = await withTimeout(() => capitalFlowAnalysis(code, 1), 25000).catch(() => null);
    const grid      = await withTimeout(() => gridStrategy(code), 30000).catch(() => null);
    const alerts    = await withTimeout(() => Promise.resolve(getAlerts().filter(a => a.code === code)), 5000).catch(() => null);
    res.json({ code: 0, data: { chan, sentiment, grid, capital, risk, alerts } });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

// 10. 健康检查
app.get('/api/health', (req, res) => {
  const MX_SKILL = 'C:\\Users\\34856\\.openclaw\\workspace\\skills\\mx-data\\mx_data.py';
  res.json({
    code: 0,
    data: {
      status: 'ok',
      mxApiKeySet: !!(process.env.MX_APIKEY),
      mxDataSkill: fs.existsSync(MX_SKILL) ? 'found' : 'missing',
      timestamp: new Date().toISOString(),
    }
  });
});

// ─── P1: 持仓与目标仓位核算 ────────────────────────────────
app.get('/api/portfolio', async (req, res) => {
  try {
    const data = await portfolioAnalysis();
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

// ─── P1: 盯盘预警 ──────────────────────────────────────────
app.get('/api/alerts', (req, res) => {
  res.json({ code: 0, data: getAlerts() });
});

app.post('/api/alerts', (req, res) => {
  const { code, type, threshold, name } = req.body;
  if (!code || !type || threshold === undefined) {
    return res.status(400).json({ code: 1, msg: '缺少必要参数: code, type, threshold' });
  }
  const validTypes = ['price_above', 'price_below', 'chg_above', 'chg_below'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ code: 1, msg: `type必须为: ${validTypes.join(', ')}` });
  }
  try {
    const alert = addAlert(code, type, parseFloat(threshold), name);
    res.json({ code: 0, data: alert });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

// 11. 标的筛选（调用 mx-xuangu skill，支持策略模板）
app.get('/api/select/etf', async (req, res) => {
  const { template, dividend, pePercentile, roe, filters } = req.query;
  const { runXuanGu } = require('./chan/xuangu');
  const opts = {};
  if (template) opts.template = template;
  if (dividend !== undefined) opts.dividendYears = parseInt(dividend);
  if (pePercentile !== undefined) opts.pePercentileMax = parseFloat(pePercentile);
  if (roe !== undefined) opts.roeMin = parseFloat(roe);
  if (filters) {
    try { opts.filters = JSON.parse(decodeURIComponent(filters)); } catch {}
  }
  try {
    const result = await new Promise((resolve, reject) => {
      runXuanGu(opts, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.post('/api/select/etf', (req, res) => {
  const { template, filters } = req.body || {};
  const { runXuanGu } = require('./chan/xuangu');
  const opts = { template, filters };
  runXuanGu(opts, (err, data) => {
    if (err) return res.status(500).json({ code: 1, msg: err.message });
    res.json({ code: 0, data });
  });
});

app.delete('/api/alerts', (req, res) => {
  const { code, type } = req.body;
  if (!code || !type) return res.status(400).json({ code: 1, msg: '缺少参数: code, type' });
  try {
    removeAlert(code, type);
    res.json({ code: 0, data: { ok: true } });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

// 定时检查预警（由cron调用，返回触发预警列表）
app.post('/api/alerts/check', async (req, res) => {
  try {
    const result = await checkAlerts();
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

// ─── 市场快讯 ────────────────────────────────────────────────
const NEWS_CACHE_TTL = 10 * 60 * 1000; // 10分钟缓存
let _newsCache = { items: [], ts: 0 };

const MARKET_NEWS_QUERIES = [
  'A股今日大盘分析',
  '北向资金最新动向',
  'ETF市场今日异动',
];

app.get('/api/news', async (req, res) => {
  const now = Date.now();
  if (_newsCache.items.length && (now - _newsCache.ts) < NEWS_CACHE_TTL) {
    return res.json({ code: 0, data: { items: _newsCache.items, fromCache: true } });
  }
  const apiKey = process.env.MX_APIKEY;
  if (!apiKey) {
    return res.status(500).json({ code: 1, msg: 'MX_APIKEY未配置' });
  }
  try {
    const results = [];
    for (const query of MARKET_NEWS_QUERIES) {
      try {
        const resp = await fetch('https://mkapi2.dfcfs.com/finskillshub/api/claw/news-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
          body: JSON.stringify({ query }),
        });
        if (!resp.ok) continue;
        const json = await resp.json();
        const items = json?.data?.data?.llmSearchResponse?.data || [];
        results.push(...items.slice(0, 2));
      } catch { /* 单个查询失败不影响整体 */ }
    }
    // 去重
    const seen = new Set();
    const unique = results.filter(item => {
      const key = item.title || item.content?.slice(0, 50);
      if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 8);
    _newsCache = { items: unique, ts: now };
    res.json({ code: 0, data: { items: unique, fromCache: false } });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`🦞 缠论综合分析服务已启动: http://localhost:${PORT}`);
  console.log(`MX_APIKEY: ${process.env.MX_APIKEY ? '已配置 ✓' : '未配置（将使用模拟数据）'}`);
});
