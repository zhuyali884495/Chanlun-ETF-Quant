/**
 * 统一数据层 — DataProvider
 * 所有模块通过此层获取数据，保证一致性
 * 规则：
 * - 实时行情：交易时段1分钟更新，非交易时段读缓存
 * - 日线数据：日线收盘后更新，支持手动刷新
 * - 缓存策略：localStorage + 内存二级缓存
 */

// ─── 交易时段判断 ────────────────────────────────────────────
const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MIN = 30;
const MARKET_CLOSE_HOUR = 15;
const MARKET_CLOSE_MIN = 0;
const LUNCH_START = 11.5;  // 11:30
const LUNCH_END = 13;       // 13:00

export function isTradingHours() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const mins = h * 60 + m;
  const marketStart = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MIN; // 570
  const marketEnd = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MIN;  // 900
  const lunchStart = LUNCH_START * 60;
  const lunchEnd = LUNCH_END * 60;
  if (mins < marketStart || mins >= marketEnd) return false;
  if (mins >= lunchStart && mins < lunchEnd) return false;
  return true;
}

export function isWeekend() {
  const d = new Date().getDay();
  return d === 0 || d === 6;
}

export function getMarketStatus() {
  if (isWeekend()) return { status: '周末休市', trading: false, nextUpdate: '周一 09:30' };
  if (isTradingHours()) return { status: '交易中', trading: true, nextUpdate: '1分钟后' };
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const mins = h * 60 + m;
  if (mins < 9 * 60 + 30) {
    const waitMins = (9 * 60 + 30) - mins;
    return { status: '等待开盘', trading: false, nextUpdate: `${Math.floor(waitMins / 60)}小时${waitMins % 60}分钟后` };
  }
  if (mins >= 11 * 60 + 30 && mins < 13 * 60) {
    const waitMins = (13 * 60) - mins;
    return { status: '午间休市', trading: false, nextUpdate: `${waitMins}分钟后` };
  }
  return { status: '已收盘', trading: false, nextUpdate: '明日 09:30' };
}

// ─── 缓存键 ─────────────────────────────────────────────────
function cacheKey(type, code, extra) {
  return `fin_cache_${type}_${code}${extra ? '_' + extra : ''}`;
}

// ─── 缓存读写 ───────────────────────────────────────────────
const _memCache = {}; // 进程内存缓存

export function getCache(type, code, extra, maxAgeMs) {
  const key = cacheKey(type, code, extra);
  // 内存缓存优先
  if (_memCache[key] && Date.now() - _memCache[key].ts < maxAgeMs) {
    return _memCache[key].data;
  }
  // localStorage次之
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < maxAgeMs) {
        _memCache[key] = { data, ts };
        return data;
      }
    }
  } catch {}
  return null;
}

export function setCache(type, code, extra, data) {
  const key = cacheKey(type, code, extra);
  const entry = { data, ts: Date.now() };
  _memCache[key] = entry;
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {}
}

// ─── 清除过期缓存 ───────────────────────────────────────────
export function cleanExpiredCache(maxAgeMs) {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('fin_cache_')) continue;
      try {
        const { ts } = JSON.parse(localStorage.getItem(key));
        if (Date.now() - ts > maxAgeMs) keysToRemove.push(key);
      } catch {}
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
}

// ─── 统一数据获取 ─────────────────────────────────────────────
/**
 * 获取实时行情（统一入口）
 * 交易时段：实时请求
 * 非交易时段：读缓存
 */
export async function fetchRealtimeQuote(code) {
  const cacheAge = isTradingHours() ? 60_000 : 300_000; // 交易时段1min，非交易5min
  const cached = getCache('quote', code, null, cacheAge);
  if (cached) return cached;

  const r = await fetch(`/api/chan/${code}?cycle=日线`);
  const j = await r.json();
  if (j.code !== 0) return null;
  const klines = j.data?.klineData;
  if (!klines?.length) return null;
  const latest = klines[0];
  const prev = klines[1] || latest;
  const chg = prev.close ? (latest.close - prev.close) / prev.close * 100 : 0;
  const result = { code, date: latest.date, price: latest.close, chg, open: latest.open, high: latest.high, low: latest.low, vol: latest.vol, close: latest.close };
  setCache('quote', code, null, result);
  return result;
}

/**
 * 获取所有核心ETF实时行情（批量）
 */
export async function fetchCoreQuotes(codes) {
  return Promise.all(codes.map(c => fetchRealtimeQuote(c)));
}

/**
 * 获取缠论分析（带日缓存）
 */
export async function fetchChanData(code, cycle = '日线') {
  const cacheAge = 5 * 60_000; // 5分钟缓存
  const cached = getCache('chan', code, cycle, cacheAge);
  if (cached) return cached;

  const r = await fetch(`/api/chan/${code}?cycle=${encodeURIComponent(cycle)}`);
  const j = await r.json();
  if (j.code !== 0) return null;
  setCache('chan', code, cycle, j.data);
  return j.data;
}

/**
 * 获取景气度（带6小时缓存）
 */
export async function fetchSentimentData(code) {
  const cacheAge = 6 * 3600_000;
  const cached = getCache('sentiment', code, null, cacheAge);
  if (cached) return cached;
  const r = await fetch(`/api/sentiment/${code}`);
  const j = await r.json();
  if (j.code !== 0) return null;
  setCache('sentiment', code, null, j.data);
  return j.data;
}

/**
 * 获取网格策略（带1小时缓存）
 */
export async function fetchGridData(code) {
  const cacheAge = 3600_000;
  const cached = getCache('grid', code, null, cacheAge);
  if (cached) return cached;
  const r = await fetch(`/api/grid/${code}`);
  const j = await r.json();
  if (j.code !== 0) return null;
  setCache('grid', code, null, j.data);
  return j.data;
}

/**
 * 获取资金流向（带30分钟缓存）
 */
export async function fetchCapitalData(code) {
  const cacheAge = isTradingHours() ? 60_000 : 1800_000;
  const cached = getCache('capital', code, null, cacheAge);
  if (cached) return cached;
  const r = await fetch(`/api/capital/${code}`);
  const j = await r.json();
  if (j.code !== 0) return null;
  setCache('capital', code, null, j.data);
  return j.data;
}

/**
 * 获取风险测评（带24小时缓存）
 */
export async function fetchRiskData(code) {
  const cacheAge = 24 * 3600_000;
  const cached = getCache('risk', code, null, cacheAge);
  if (cached) return cached;
  const r = await fetch(`/api/risk/${code}`);
  const j = await r.json();
  if (j.code !== 0) return null;
  setCache('risk', code, null, j.data);
  return j.data;
}

/**
 * 获取持仓（带5分钟缓存）
 */
export async function fetchPortfolioData() {
  const cacheAge = 300_000;
  const cached = getCache('portfolio', 'self', null, cacheAge);
  if (cached) return cached;
  const r = await fetch(`/api/portfolio`);
  const j = await r.json();
  if (j.code !== 0) return null;
  setCache('portfolio', 'self', null, j.data);
  return j.data;
}

/**
 * 强制刷新（忽略缓存）
 */
export async function fetchRealtimeQuoteForce(code) {
  const r = await fetch(`/api/chan/${code}?cycle=日线`);
  const j = await r.json();
  if (j.code !== 0) return null;
  const klines = j.data?.klineData;
  if (!klines?.length) return null;
  const latest = klines[0];
  const prev = klines[1] || latest;
  const chg = prev.close ? (latest.close - prev.close) / prev.close * 100 : 0;
  const result = { code, date: latest.date, price: latest.close, chg, open: latest.open, high: latest.high, low: latest.low, vol: latest.vol, close: latest.close };
  setCache('quote', code, null, result);
  return result;
}
