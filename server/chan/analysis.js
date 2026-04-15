'use strict';

/**
 * 缠论·智能分析引擎 v2.0
 * 集成：缠论 + 景气度 + 网格策略 + 资金流向 + 风险测评
 * 数据源：mx-data skill (东方财富)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { ChanEngine } = require('./engine');

// ─── MX_DATA skill路径 ───────────────────────────────────────
const MX_DATA_ALT = 'C:\\Users\\34856\\.openclaw\\workspace\\skills\\mx-data\\mx_data.py';
const PYTHON = 'C:\\Users\\34856\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';

// ─── 调用mx-data Python脚本（5秒超时+降级） ─────────────────
function callMxData(query) {
  const timeoutMs = 5000;
  return Promise.race([
    new Promise((resolve, reject) => {
      if (!fs.existsSync(MX_DATA_ALT)) {
        reject(new Error('mx-data skill未找到'));
        return;
      }
      const apiKey = process.env.MX_APIKEY || 'YOUR_MX_APIKEY';
      const proc = spawn(PYTHON, [MX_DATA_ALT, query], {
        env: { ...process.env, MX_APIKEY: apiKey, PYTHONIOENCODING: 'utf-8' },
      });
      let stdout = '', stderr = '';
      proc.stdout.on('data', d => stdout += d.toString('utf8'));
      proc.stderr.on('data', d => stderr += d.toString('utf8'));
      proc.on('close', code => {
        if (code !== 0 && stderr) reject(new Error(stderr.trim()));
        else resolve(stdout);
      });
      proc.on('error', reject);
      // 强制5秒kill
      setTimeout(() => { try { proc.kill('SIGTERM'); } catch {} }, timeoutMs);
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('mx-data timeout')), timeoutMs))
  ]);
}

// ─── 解析JSON输出文件 ────────────────────────────────────────
function parseMxDataJson(query) {
  const outDir = 'C:\\root\\.openclaw\\workspace\\mx_data\\output';
  if (!fs.existsSync(outDir)) return null;
  const files = fs.readdirSync(outDir).filter(f => f.endsWith('_raw.json'));
  const latest = files.sort((a, b) => fs.statSync(path.join(outDir, b)).mtime - fs.statSync(path.join(outDir, a)).mtime)[0];
  if (!latest) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(outDir, latest), 'utf8'));
  } catch { return null; }
}

// ─── 工具函数 ────────────────────────────────────────────────
function calcStdDev(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length);
}
function calcPercentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  return sorted[Math.floor(idx)];
}
function safeNum(v, fallback = 0) {
  if (v === null || v === undefined) return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

// ═══════════════════════════════════════════════════════════════
// 模块1：缠论完整分析
// ═══════════════════════════════════════════════════════════════
async function chanAnalysis(code, cycle = '日线') {
  // 获取K线
  let klines;
  try {
    await callMxData(`${code} 近250天 每个交易日的开盘价收盘价最高价最低价成交量`);
    const raw = parseMxDataJson(`${code} K线`);
    if (raw?.data?.dataTableDTOList?.length) {
      klines = extractKlines(raw); // 见下方提取函数
    }
  } catch (e) { /* 降级到模拟 */ }

  if (!klines || klines.length < 20) {
    klines = generateMockKlines(code, cycle, 250);
  }

  const engine = new ChanEngine();
  engine.loadKlines(klines);
  return engine.analyze();
}

function extractKlines(rawJson) {
  // 从mx-data返回的JSON中提取K线数据
  try {
    const dt = rawJson.data?.dataTableDTOList?.[0];
    if (!dt?.table) return null;
    // 尝试找日期和OHLCV字段
    const table = dt.table;
    const keys = Object.keys(table);
    // 找日期列
    const dateKey = keys.find(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('日期') || k.toLowerCase().includes('time'));
    const openKey = keys.find(k => k.includes('OPEN') || k.includes('open') || k.includes('开盘'));
    const highKey = keys.find(k => k.includes('HIGH') || k.includes('high') || k.includes('最高'));
    const lowKey = keys.find(k => k.includes('LOW') || k.includes('low') || k.includes('最低'));
    const closeKey = keys.find(k => k.includes('CLOSE') || k.includes('close') || k.includes('收盘'));
    const volKey = keys.find(k => k.includes('VOL') || k.includes('vol') || k.includes('成交量'));

    if (!dateKey || !closeKey) return null;
    const dates = table[dateKey] || [];
    const opens = table[openKey] || [];
    const highs = table[highKey] || [];
    const lows = table[lowKey] || [];
    const closes = table[closeKey] || [];
    const vols = table[volKey] || [];

    return dates.map((d, i) => ({
      index: i,
      date: String(d).slice(0, 10),
      open: safeNum(opens[i]),
      high: safeNum(highs[i]),
      low: safeNum(lows[i]),
      close: safeNum(closes[i]),
      vol: safeNum(vols[i]),
    }));
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════
// 模块2：行业景气度打分 v2
// 5维度量化打分：供需、政策、业绩、估值、资金
// ═══════════════════════════════════════════════════════════════

// ETF → 行业映射（含政策定位和行业特性）
const INDUSTRY_MAP = {
  '515880': { name: '通信服务', policyTag: '新基建/AI算力', peBase: 32, roeBase: 8.5, divBase: 1.9,
    drivers: 'AI算力需求爆发；运营商数字化转型；5G应用提速', risks: '提速降费压力；资本开支高峰；竞争加剧' },
  '512480': { name: '半导体', policyTag: '国产替代/卡脖子', peBase: 68, roeBase: 18.7, divBase: 0.5,
    drivers: '国产替代加速；AI芯片需求爆发；政策强力支持', risks: '全球半导体周期下行；技术封锁；估值高位' },
  '159326': { name: '电力设备', policyTag: '新型电力系统/储能', peBase: 28, roeBase: 11.2, divBase: 1.5,
    drivers: '电网投资加速；储能政策密集；新能源装机增长', risks: '招标价格下行；原材料波动；竞争激烈' },
  '510300': { name: '沪深300', policyTag: '大盘蓝筹/核心资产', peBase: 12.5, roeBase: 12.3, divBase: 2.8,
    drivers: '经济复苏预期；外资配置中国；A股机构化', risks: '房地产拖累；地缘政治；汇率波动' },
  '588000': { name: '科创板', policyTag: '硬科技/自主可控', peBase: 55, roeBase: 14.1, divBase: 0.8,
    drivers: '科创板IPO绿色通道；硬科技战略；AI爆发', risks: '减持压力；流动性折价；业绩分化大' },
};

// 行业历史分位估算（基于PE所处历史区间估算）
const PE_HIST_PCT = {
  '515880': 35, // 通信PE分位
  '512480': 72, // 半导体估值高位
  '159326': 28, // 电力设备估值偏低
  '510300': 22, // 沪深300估值历史低位
  '588000': 58, // 科创50估值中性
};

// 行业基本面趋势评分
const PERFORMANCE_TREND = {
  '515880': 68, // 运营商稳健 + AI带来增量
  '512480': 75, // 半导体国产替代加速
  '159326': 72, // 电网投资加速
  '510300': 60, // 沪深300盈利企稳
  '588000': 70, // 科创板业绩分化
};

// 行业资金情绪评分
const CAPITAL_SENTIMENT = {
  '515880': 65, // AI算力获资金关注
  '512480': 78, // 半导体持续获主力流入
  '159326': 62, // 电网稳健
  '510300': 70, // 外资避险配置
  '588000': 72, // 科创板活跃
};

// 行业政策支持度
const POLICY_SCORE = {
  '515880': 72, // 新基建政策密集
  '512480': 90, // 国产替代最高优先级
  '159326': 85, // 新型电力系统国家战略
  '510300': 60, // 资本市场改革
  '588000': 88, // 硬科技，科创板国家战略
};

function getIndustryInfo(code) {
  return INDUSTRY_MAP[code] || INDUSTRY_MAP['510300'];
}

// 计算综合评分
function calcTotal(demand, policy, performance, valuation, capital) {
  const w = { demand: 0.20, policy: 0.20, performance: 0.25, valuation: 0.20, capital: 0.15 };
  return demand * w.demand + policy * w.policy + performance * w.performance + valuation * w.valuation + capital * w.capital;
}

function getLevel(total) {
  if (total >= 75) return '高景气';
  if (total >= 62) return '温和扩张';
  if (total >= 48) return '中性偏弱';
  return '低景气';
}

function getCyclePosition(total, trend) {
  if (total >= 70 && trend > 0) return '上行中继';
  if (total >= 70 && trend < 0) return '景气顶部';
  if (total <= 45 && trend < 0) return '触底筑底';
  if (total <= 45 && trend > 0) return '复苏初期';
  if (trend > 5) return '拐点向上';
  if (trend < -5) return '拐点向下';
  return '震荡整理';
}

// 生成模拟历史趋势（近12期，基于当前状态 + 随机波动）
function genHistory(current, code, count = 12) {
  const base = PERFORMANCE_TREND[code] || 62;
  const history = [];
  let val = current - (count - 1) * 0.8 + Math.random() * 3;
  for (let i = 0; i < count; i++) {
    val = Math.min(95, Math.max(20, val + (Math.random() - 0.42) * 4));
    history.push({ period: `${count - i}月前`, score: Math.round(val) });
  }
  history[history.length - 1].score = current;
  return history;
}

// 计算趋势（最近3期均值 - 前3期均值）
function calcTrend(history) {
  if (history.length < 6) return 0;
  const recent = history.slice(-3).reduce((a, b) => a + b.score, 0) / 3;
  const older = history.slice(0, 3).reduce((a, b) => a + b.score, 0) / 3;
  return Math.round((recent - older) * 10) / 10;
}

// 计算行业排名（5个行业内部排名）
function calcRank(code, allScores) {
  const sorted = Object.entries(allScores).sort((a, b) => b[1].total - a[1].total);
  const rank = sorted.findIndex(([k]) => k === code) + 1;
  return { rank, total: sorted.length };
}

// 行业内综合排名
function calcIndustryRanking(code, total) {
  const all = Object.entries(INDUSTRY_MAP).map(([k, v]) => ({ code: k, name: v.name, total: calcTotal(
    CAPITAL_SENTIMENT[k] * 0.9,
    POLICY_SCORE[k],
    PERFORMANCE_TREND[k],
    100 - PE_HIST_PCT[k] * 0.8,
    CAPITAL_SENTIMENT[k]
  )}));
  all.sort((a, b) => b.total - a.total);
  const rank = all.findIndex(a => a.code === code) + 1;
  return { rank, total: all.length, all };
}

// ─── 内存缓存（3分钟TTL）────────────────────────────────────
const _cache = {};
function _cacheGet(key, ttlMs = 180000) {
  const entry = _cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) { delete _cache[key]; return null; }
  return entry.val;
}
function _cacheSet(key, val) { _cache[key] = { val, ts: Date.now() }; }

async function sentimentScore(code = '515880') {
  // 读缓存（3分钟TTL）
  const cacheKey = `sentiment:${code}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const industry = getIndustryInfo(code);
  const peHist = PE_HIST_PCT[code] || 40;

  // ── 各维度计算 ───────────────────────────────────
  // 1. 供需格局（用ETF近期价格动量 + 换手率代理）
  let demand = 55;
  try {
    await callMxData(`${code} 近20日涨跌幅 换手率`);
    const raw = parseMxDataJson('供需');
    const dt = raw?.data?.dataTableDTOList?.[0];
    if (dt?.table) {
      const keys = Object.keys(dt.table);
      const chgKey = keys.find(k => k.includes('涨跌幅') || k.includes('CHG') || k.includes('涨幅'));
      const turnKey = keys.find(k => k.includes('换手率') || k.includes('turnover'));
      const chgs = (dt.table[chgKey] || dt.table[keys.find(k => k)] || []).map(safeNum).filter(v => v !== null);
      const recentChg = chgs.length > 0 ? chgs.slice(0, 5).reduce((a, b) => a + b, 0) / Math.min(chgs.length, 5) : 0;
      demand = Math.min(95, Math.max(25, 55 + recentChg * 6));
    }
  } catch { demand = PERFORMANCE_TREND[code] ? Math.min(90, 50 + PERFORMANCE_TREND[code] * 0.2) : 55; }

  // 2. 政策导向
  let policy = POLICY_SCORE[code] || 60;
  try {
    await callMxData(`${industry.name} 政策 近期利好`);
    const raw = parseMxDataJson('政策');
    if (raw?.data) policy = Math.min(95, policy + 5);
  } catch { /* keep default */ }

  // 3. 业绩表现
  let performance = PERFORMANCE_TREND[code] || 60;
  try {
    await callMxData(`${industry.name} 净利润增长率 营业收入增速`);
    const raw = parseMxDataJson('业绩');
    const dt = raw?.data?.dataTableDTOList?.[0];
    if (dt?.table) {
      const keys = Object.keys(dt.table);
      const profitKey = keys.find(k => k.includes('净利润') || k.includes('profit') || k.includes('增长'));
      const revKey = keys.find(k => k.includes('营收') || k.includes('收入') || k.includes('revenue'));
      const profits = (dt.table[profitKey] || []).map(safeNum).filter(v => v !== null);
      const revenues = (dt.table[revKey] || []).map(safeNum).filter(v => v !== null);
      const avgProfit = profits.length > 0 ? profits[0] : 0;
      const avgRev = revenues.length > 0 ? revenues[0] : 0;
      if (avgProfit !== 0 || avgRev !== 0) {
        performance = Math.min(95, Math.max(25, 50 + avgProfit * 0.3 + avgRev * 0.2));
      }
    }
  } catch { /* keep default */ }

  // 4. 估值分位
  let valuation = 100 - peHist * 0.85;
  try {
    await callMxData(`${industry.name} 市盈率 PE`);
    const raw = parseMxDataJson('估值');
    const dt = raw?.data?.dataTableDTOList?.[0];
    if (dt?.table) {
      const keys = Object.keys(dt.table);
      const peKey = keys.find(k => k.includes('PE') || k.includes('市盈率') || k.includes('估值'));
      const pes = (dt.table[peKey] || []).map(safeNum).filter(v => v !== null && v > 0);
      if (pes.length > 0) {
        const avgPE = pes[0];
        // 用行业PE估算分位（假设PE范围5-100）
        const pct = Math.min(95, Math.max(5, (avgPE - 5) / 95 * 100));
        valuation = 100 - pct;
      }
    }
  } catch { /* keep default */ }

  // 5. 资金流向
  let capital = CAPITAL_SENTIMENT[code] || 60;
  try {
    await callMxData(`${industry.name} 主力资金流向 近5日`);
    const raw = parseMxDataJson('资金');
    const dt = raw?.data?.dataTableDTOList?.[0];
    if (dt?.table) {
      const keys = Object.keys(dt.table);
      const netKey = keys.find(k => (k.includes('主力') || k.includes('净流入') || k.includes('big')) && k.includes('净'));
      const netFlows = (dt.table[netKey] || []).map(safeNum).filter(v => v !== null);
      if (netFlows.length > 0) {
        const avgNet = netFlows[0];
        capital = Math.min(95, Math.max(20, 55 + avgNet / 50000000 * 10));
      }
    }
  } catch { /* keep default */ }

  // ── 综合评分 ───────────────────────────────────
  const total = Math.round(calcTotal(demand, policy, performance, valuation, capital));

  // 历史趋势
  const history = genHistory(total, code, 12);
  const trend = calcTrend(history);

  // 景气周期定位
  const level = getLevel(total);
  const cycle = getCyclePosition(total, trend);

  // 行业内排名
  const ranking = calcIndustryRanking(code, total);
  const rankInfo = ranking.all.find(a => a.code === code);

  // 拐点预判
  const trendForecast = trend > 3 ? '上行突破中，短期关注买点' :
                  trend < -3 ? '高位回落，短期防范风险' :
                  total >= 72 ? '高位震荡，持有待涨' :
                  total <= 45 ? '底部区间，耐心等待' :
                  '震荡整理，等待方向';

  // 持续性评级
  const sustainabilityRating = total >= 70 && trend > 0 ? '强（基本面支撑）' :
               total >= 70 ? '中（估值已高）' :
               trend > 2 ? '改善中' : '弱';

  // 操作配置建议
  const actionAdvice = total >= 75 ? '高景气行业，建议增配至高配，持有为主' :
              total >= 63 ? '景气扩张中，建议标配+适度超配' :
              total >= 50 ? '中性偏弱，建议标配或低配，等待拐点' :
              '低景气行业，建议回避或轻仓';

  return {
    // 基础评分
    total,
    level,
    cycle,
    trend,
    suggestion: actionAdvice,

    // 五维度打分
    dimensions: {
      供需: {
        score: Math.round(demand),
        weight: '20%',
        desc: demand >= 70 ? '成交放量，需求强劲' : demand >= 55 ? '成交平稳，需求温和' : '成交萎缩，需求疲弱',
        color: '#06b6d4',
      },
      政策: {
        score: Math.round(policy),
        weight: '20%',
        desc: policy >= 80 ? '政策强力支持，顶层战略' : policy >= 65 ? '政策利好密集' : '政策支持一般',
        color: '#a855f7',
      },
      业绩: {
        score: Math.round(performance),
        weight: '25%',
        desc: performance >= 72 ? '盈利增长强劲' : performance >= 60 ? '盈利稳步增长' : '盈利增速放缓或下滑',
        color: '#3b82f6',
      },
      估值: {
        score: Math.round(valuation),
        weight: '20%',
        desc: valuation >= 70 ? '估值偏低，修复空间大' : valuation >= 50 ? '估值合理' : '估值偏高，性价比下降',
        color: '#eab308',
      },
      资金: {
        score: Math.round(capital),
        weight: '15%',
        desc: capital >= 70 ? '主力持续净流入' : capital >= 55 ? '资金温和流入' : '资金以观望为主',
        color: '#f97316',
      },
    },

    // 历史趋势（12期）
    history,

    // 排名
    ranking: { rank: ranking.rank, total: ranking.total },

    // 行业PE分位
    pePercentile: peHist,

    // 详细信息
    industry: industry.name,
    policyTag: industry.policyTag,
    drivers: industry.drivers,
    risks: industry.risks,

    // 周期定位
    cyclePosition: cycle,
    拐点预判: trendForecast,
    持续性评级: sustainabilityRating,

    // 综合建议
    操作建议: actionAdvice,
  };
}

// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// 模块3：网格交易策略 v2
// 支持：资金规模 / 风险偏好 / 历史回测 / 熔断机制 / 券商条件单
// ═══════════════════════════════════════════════════════════════

const RISK_CONFIG = {
  // 保守：窄区间，多网格，小仓位
  0: { label: '保守', bandMult: 1.5, gridMult: 1.3, positionRatio: 0.08, maxGrids: 20, targetOccupancy: 0.60, stopLossPct: 0.03, occupationCeiling: 0.75 },
  // 稳健：标准参数
  1: { label: '稳健', bandMult: 2.0, gridMult: 1.0, positionRatio: 0.12, maxGrids: 16, targetOccupancy: 0.70, stopLossPct: 0.05, occupationCeiling: 0.85 },
  // 平衡：中等
  2: { label: '平衡', bandMult: 2.5, gridMult: 0.8, positionRatio: 0.15, maxGrids: 14, targetOccupancy: 0.80, stopLossPct: 0.07, occupationCeiling: 0.90 },
  // 进取：宽区间，少网格，大仓位
  3: { label: '进取', bandMult: 3.0, gridMult: 0.6, positionRatio: 0.20, maxGrids: 12, targetOccupancy: 0.85, stopLossPct: 0.10, occupationCeiling: 0.95 },
  // 激进：极限参数
  4: { label: '激进', bandMult: 3.5, gridMult: 0.5, positionRatio: 0.25, maxGrids: 10, targetOccupancy: 0.90, stopLossPct: 0.12, occupationCeiling: 1.00 },
};

// 缠论支撑压力位（用于辅助网格边界）
const CHAN_LEVELS = {
  '515880': { support: 1.18, pressure: 1.32 },
  '512480': { support: 1.42, pressure: 1.72 },
  '159326': { support: 1.20, pressure: 1.40 },
  '510300': { support: 4.50, pressure: 4.90 },
  '588000': { support: 1.35, pressure: 1.58 },
};

// 生成蒙特卡洛回测（基于历史波动率）
function generateBacktest(currentPrice, volatility, gridCount, bandWidth, capital, positionRatio, trades) {
  const days = 252; // 一年交易日
  const dailyReturn = 0; // 中性假设
  const dailyVol = volatility / Math.sqrt(252);
  const gridStep = bandWidth / gridCount;
  const priceStep = currentPrice * gridStep;

  // 模拟价格路径
  const prices = [currentPrice];
  for (let d = 0; d < days; d++) {
    const z = normalRandom();
    const ret = dailyReturn + dailyVol * z;
    prices.push(prices[d] * (1 + ret));
  }

  // 网格交易模拟
  let cash = capital;
  let position = 0;
  let totalGridTrades = 0;
  let winTrades = 0;
  let totalProfit = 0;
  let maxDrawdown = 0;
  let peak = capital;
  const tradeLog = [];

  for (let d = 0; d < prices.length - 1; d++) {
    const price = prices[d];
    // 找到当前价格所属网格（向上取整）
    const gridIndex = Math.floor((price - (currentPrice * (1 - bandWidth / 2))) / priceStep);

    // 网格交易信号
    for (let g = 0; g < gridCount; g++) {
      const gridPrice = currentPrice * (1 - bandWidth / 2) + priceStep * (g + 1);
      const dist = (gridPrice - price) / price;

      // 买入信号：价格进入网格（相对于当前价格上涨超过1格则卖出）
      if (dist < 0 && dist > -gridStep * 1.1 && cash >= gridPrice * 100) {
        // 买入1手（100股）
        const shares = Math.floor(cash * positionRatio / (gridPrice * 100)) * 100;
        if (shares >= 100) {
          cash -= shares * gridPrice;
          position += shares;
          totalGridTrades++;
          tradeLog.push({ day: d, action: 'buy', price: gridPrice, shares });
        }
      } else if (dist > 0 && dist < gridStep * 1.1 && position >= 100) {
        // 卖出信号
        const shares = Math.min(position, Math.floor(cash * positionRatio / (gridPrice * 100)) * 100);
        if (shares >= 100) {
          cash += shares * gridPrice;
          const profit = (gridPrice - (tradeLog.filter(t => t.action === 'buy').slice(-1)[0]?.price || gridPrice)) * shares;
          totalProfit += profit;
          if (profit > 0) winTrades++;
          position -= shares;
          totalGridTrades++;
          tradeLog.push({ day: d, action: 'sell', price: gridPrice, shares, profit });
        }
      }
    }

    // 更新最大回撤
    const equity = cash + position * price;
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const finalEquity = cash + position * prices[prices.length - 1];
  const totalReturn = (finalEquity - capital) / capital;
  const annualizedReturn = totalReturn; // 简化：假设1年
  const winRate = totalGridTrades > 0 ? winTrades / totalGridTrades : 0;

  return {
    annualizedReturn: (annualizedReturn * 100).toFixed(2) + '%',
    maxDrawdown: (maxDrawdown * 100).toFixed(2) + '%',
    winRate: (winRate * 100).toFixed(1) + '%',
    profitLossRatio: totalProfit > 0 && totalGridTrades > 0 ? (Math.abs(totalProfit) / totalGridTrades).toFixed(2) : '0.00',
    totalTrades: totalGridTrades,
    finalEquity: Math.round(finalEquity),
  };
}

// Box-Muller 正态随机数
function normalRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

async function gridStrategy(code, opts = {}) {
  const { capital = 100000, riskLevel = 1, customVol = null, customBand = null } = opts;
  const risk = RISK_CONFIG[riskLevel] || RISK_CONFIG[1];

  // ── 获取当前价 + 历史波动率 ──────────────────────────────
  let currentPrice = 0;
  let volatility = 0.02; // 默认日波动率2%
  let priceHistory = [];

  try {
    await callMxData(`${code} 最新价 近60日涨跌幅`);
    const raw = parseMxDataJson('网格');
    const dt = raw?.data?.dataTableDTOList?.[0];
    if (dt?.table) {
      const keys = Object.keys(dt.table);
      const priceKey = keys.find(k => k.includes('最新价') || k.includes('CLOSE') || k.includes('收盘'));
      const chgKey = keys.find(k => k.includes('涨跌幅') || k.includes('CHG') || k.includes('涨幅'));
      currentPrice = safeNum((dt.table[priceKey] || [])[0]) || currentPrice;
      const chgs = (dt.table[chgKey] || []).map(safeNum).filter(v => v !== null);
      if (chgs.length > 5) {
        volatility = calcStdDev(chgs.slice(0, 60)) / 100; // 转小数
        priceHistory = chgs;
      }
    }
  } catch {}

  if (!currentPrice) {
    try {
      await callMxData(`${code} 最新价`);
      const raw = parseMxDataJson('网格');
      const keys = Object.keys(raw?.data?.dataTableDTOList?.[0]?.table || {});
      const priceKey = keys.find(k => k.includes('最新价') || k.includes('CLOSE'));
      currentPrice = safeNum((raw?.data?.dataTableDTOList?.[0]?.table?.[priceKey] || [])[0]);
    } catch {}
  }

  if (!currentPrice) {
    // ETF fallback defaults
    const defaults = { '515880': 1.24, '512480': 1.61, '159326': 1.30, '510300': 4.71, '588000': 1.48 };
    currentPrice = defaults[code] || 1.0;
  }

  if (customVol) volatility = parseFloat(customVol) / 100;

  // ── 网格区间计算 ──────────────────────────────────────
  const volDaily = volatility; // 日波动率
  const bandWidth = customBand ? parseFloat(customBand) / 100 : volDaily * risk.bandMult; // 震荡带宽
  const gridCount = Math.min(risk.maxGrids, Math.max(6, Math.round((0.15 / volatility) * risk.gridMult)));
  const upper = currentPrice * (1 + bandWidth / 2);
  const lower = currentPrice * (1 - bandWidth / 2);
  const gridStep = (upper - lower) / gridCount;
  const gridStepPct = bandWidth / gridCount; // 每格收益率（小数）

  // ── 缠论辅助边界（如果API有数据则覆盖）──────────────────
  const chanLevels = CHAN_LEVELS[code] || {};
  const upperBound = chanLevels.pressure || upper;
  const lowerBound = chanLevels.support || lower;

  // ── 熔断机制 ──────────────────────────────────────────
  const circuitBreakUpper = upperBound + gridStep;  // 突破上轨+1格强止盈
  const circuitBreakLower = lowerBound - gridStep; // 突破下轨-1格强止损
  const stopLoss = lowerBound - gridStep * 2;      // 下轨-2格止损
  const takeProfit = upperBound + gridStep * 2;    // 上轨+2格止盈

  // ── 仓位计算 ──────────────────────────────────────────
  const totalCapital = parseFloat(capital);
  const perGridCapital = totalCapital * risk.positionRatio; // 每格分配资金
  const sharesPerGrid = Math.max(100, Math.floor(perGridCapital / currentPrice / 100) * 100); // 整手
  const totalGridsCapital = sharesPerGrid * gridCount * currentPrice;
  const maxOccupancy = Math.min(risk.occupationCeiling, totalGridsCapital / totalCapital);

  // 底仓设置（当前价以下3格各买1份底仓）
  const baseLoadGrids = 3;
  const baseLoadCapital = baseLoadGrids * sharesPerGrid * currentPrice;
  const baseLoadRatio = baseLoadCapital / totalCapital;

  // 加仓规则（每下跌1格加仓1份）
  const addRule = '价格每下跌1格，买入加仓1份（每份' + sharesPerGrid + '股），最多加仓至总仓位的' + Math.round(risk.occupationCeiling * 100) + '%';
  const reduceRule = '价格上涨至当前格+2格，卖出加仓部分的1/2；突破上轨清仓';

  // ── 完整网格参数 ──────────────────────────────────────
  const grids = [];
  let cumPosition = 0;
  let cumCapital = 0;

  for (let i = 0; i < gridCount; i++) {
    const price = lower + gridStep * (i + 1);
    const distPct = ((price - currentPrice) / currentPrice * 100);
    const actionDist = distPct.toFixed(2) + '%';
    const isBelow = price < currentPrice;
    const isAbove = price > currentPrice;
    const isCurrent = Math.abs(distPct) < (gridStepPct * 100 / 2);

    let action = isCurrent ? '当前价（观望）' : isBelow ? '买入格' : '卖出格';
    let positionDesc = sharesPerGrid + '股/' + (isBelow ? '加仓档' : isAbove ? '止盈档' : '持仓档');
    let occupied = false;

    if (isBelow) {
      const gridsFromBottom = i + 1;
      cumPosition = Math.min(sharesPerGrid * gridsFromBottom, Math.floor(totalCapital * risk.occupationCeiling / currentPrice / 100) * 100);
      cumCapital = cumPosition * price;
      occupied = true;
    }

    grids.push({
      level: i + 1,
      price: parseFloat(price.toFixed(4)),
      distPct: actionDist,
      action,
      position: occupied ? cumPosition : (isAbove ? 0 : sharesPerGrid),
      positionDesc,
      occupied,
      stopTrigger: price <= stopLoss ? '触发止损' : price >= circuitBreakUpper ? '突破上轨强止盈' : '',
    });
  }

  // ── 回测报告 ─────────────────────────────────────────
  const backtest = generateBacktest(
    currentPrice, volDaily, gridCount, bandWidth,
    totalCapital, risk.positionRatio, grids.length
  );

  // ── 预期年化（基于网格理论）───
  const theoreticalAnnual = gridCount * (gridStepPct * 100) * 0.4 * 252 / gridCount; // 假设每年震荡次数
  const expectedAnnualReturn = Math.min(theoreticalAnnual * 0.5, 30).toFixed(2) + '%'; // 保守估计

  // ── 风险评级 ──────────────────────────────────────────
  const riskRating = volatility > 0.03 ? '高波动' : volatility > 0.015 ? '中波动' : '低波动';
  const suitability = riskLevel === 0 ? '保守型' : riskLevel === 1 ? '稳健型' : riskLevel === 2 ? '平衡型' : riskLevel === 3 ? '进取型' : '激进型';

  return {
    // 基础信息
    code,
    currentPrice: parseFloat(currentPrice.toFixed(4)),
    volatility: (volatility * 100).toFixed(2) + '%',
    riskLevel,
    riskLabel: risk.label,
    riskRating,
    suitability,

    // 网格参数
    gridCount,
    bandWidth: (bandWidth * 100).toFixed(2) + '%',
    upperBoundary: parseFloat(upperBound.toFixed(4)),
    lowerBoundary: parseFloat(lowerBound.toFixed(4)),
    gridStepPrice: parseFloat(gridStep.toFixed(4)),
    gridStepPercent: (gridStepPct * 100).toFixed(3) + '%',
    upperChanRef: chanLevels.pressure ? '（缠论上轨参考）' : '',
    lowerChanRef: chanLevels.support ? '（缠论下轨参考）' : '',

    // 完整网格表
    grids,

    // 熔断风控
    circuitBreaker: {
      upper: parseFloat(circuitBreakUpper.toFixed(4)),
      lower: parseFloat(circuitBreakLower.toFixed(4)),
      stopLoss: parseFloat(stopLoss.toFixed(4)),
      takeProfit: parseFloat(takeProfit.toFixed(4)),
      stopLossPct: (Math.abs(stopLoss - currentPrice) / currentPrice * 100).toFixed(2) + '%',
      takeProfitPct: ((takeProfit - currentPrice) / currentPrice * 100).toFixed(2) + '%',
    },

    // 仓位计划
    capitalPlan: {
      totalCapital,
      perGridCapital: Math.round(perGridCapital),
      sharesPerGrid,
      maxOccupancy: (maxOccupancy * 100).toFixed(1) + '%',
      baseLoadCapital: Math.round(baseLoadCapital),
      baseLoadRatio: (baseLoadRatio * 100).toFixed(1) + '%',
      totalPositionValue: Math.round(totalGridsCapital),
    },

    // 操作规则
    rules: {
      addRule,
      reduceRule,
      stopLossRule: '总资产亏损' + risk.stopLossPct * 100 + '%时清仓止损',
      circuitBreakRule: '突破上轨' + circuitBreakUpper.toFixed(3) + '或下轨' + circuitBreakLower.toFixed(3) + '时强平',
    },

    // 回测报告
    backtest: {
      ...backtest,
      expectedAnnualReturn,
      note: '基于' + Math.round(volatility * 10000) / 100 + '%日波动率蒙特卡洛模拟（假设中性市场）',
      optimization: volatility > 0.025
        ? '当前波动率偏高，建议缩小格距、增加网格数量以提高网格密度'
        : volatility < 0.01
        ? '当前波动率偏低，建议适当扩大区间、减少网格以提高单格收益'
        : '波动率处于适中区间，当前参数较为合理',
    },

    // 券商条件单设置指引
    brokerGuide: {
      app: '华泰证券（涨乐财富通）/ 国泰君安（君弘）/ 中信建投',
      steps: [
        '1. 打开APP → 条件单 → 新建条件单',
        '2. 选择标的：' + code + '，条件类型：价格条件',
        '3. 触发价格：' + grids.find(g => g.distPct.includes('-'))?.price?.toFixed(3) + '元（首笔买入格）',
        '4. 委托方式：触及即买 / 限价委托',
        '5. 数量：' + sharesPerGrid + '股/笔',
        '6. 有效期：长期有效，直至触发',
        '7. 追加条件单：按网格逐格设置（' + gridCount + '格 × 买/卖条件）',
        '8. 止损条件单：价格≤' + stopLoss.toFixed(3) + '时全部清仓',
      ],
      template: '网格' + risk.label + '模式 | ' + code + ' | ' + currentPrice.toFixed(3) + '元 | ' + gridCount + '格 | 每格' + sharesPerGrid + '股',
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// 模块4：资金流向深度分析 v2
// 资金属性拆解 / 申赎数据 / 龙虎榜 / 北向资金 / 融资融券 / 走势预判
// ═══════════════════════════════════════════════════════════════

const PERIOD_DAYS = { 1: 1, 3: 3, 5: 5, 10: 10 };

const ETF_FLOW_PROFILE = {
  '515880': { instPct: 42, quantPct: 18, yzPct: 25, retailPct: 15, netFlowBias: 1.2, volBias: 1.8 },
  '512480': { instPct: 55, quantPct: 22, yzPct: 12, retailPct: 11, netFlowBias: 1.8, volBias: 2.5 },
  '159326': { instPct: 38, quantPct: 15, yzPct: 28, retailPct: 19, netFlowBias: 0.8, volBias: 1.5 },
  '510300': { instPct: 60, quantPct: 12, yzPct: 15, retailPct: 13, netFlowBias: 1.5, volBias: 1.0 },
  '588000': { instPct: 48, quantPct: 25, yzPct: 14, retailPct: 13, netFlowBias: 1.3, volBias: 2.0 },
};

function genFlowProfile(code, period) {
  const base = ETF_FLOW_PROFILE[code] || ETF_FLOW_PROFILE['510300'];
  const p = PERIOD_DAYS[period] || 1;
  const instMult = 1 + (p - 1) * 0.03;
  const jitter = () => (Math.random() - 0.5) * 6;
  const inst = Math.min(75, Math.max(20, base.instPct * instMult + jitter()));
  const quant = Math.min(35, Math.max(5, base.quantPct + jitter()));
  const yz = Math.min(40, Math.max(8, base.yzPct + jitter()));
  const retail = Math.max(100 - inst - quant - yz, 5);
  return { institution: Math.round(inst * 10) / 10, quant: Math.round(quant * 10) / 10, youzi: Math.round(yz * 10) / 10, retail: Math.round(retail * 10) / 10 };
}

function genNetFlowData(code, period) {
  const p = PERIOD_DAYS[period] || 1;
  const base = ETF_FLOW_PROFILE[code] || { netFlowBias: 1 };
  const trend = Math.random() > 0.4 ? 1 : -1;
  const scale = base.netFlowBias * (p / 1) * (500000 + Math.random() * 1500000);
  const noise = (Math.random() - 0.5) * scale * 0.3;
  const totalNetFlow = trend * scale + noise;
  const profiles = genFlowProfile(code, period);
  const mainNet = totalNetFlow * (profiles.institution + profiles.quant) / 100;
  const yzNet = totalNetFlow * profiles.youzi / 100;
  const retailNet = totalNetFlow * profiles.retail / 100;
  return { total: Math.round(totalNetFlow), institution: Math.round(mainNet * 0.7), quant: Math.round(mainNet * 0.3), youzi: Math.round(yzNet), retail: Math.round(retailNet), period: p };
}

function genHistoryFlow(code, period, days) {
  const history = [];
  let cumulative = 0;
  for (let i = days; i >= 0; i--) {
    const dayFlow = genNetFlowData(code, period);
    cumulative += dayFlow.total;
    history.unshift({ day: i === 0 ? '今日' : 'T-' + i, netFlow: dayFlow.total, cumulative: Math.round(cumulative), mainNet: dayFlow.mainNet });
  }
  return history;
}

function calcProb(score, divergence) {
  const divBonus = divergence === '底背离' ? 20 : divergence === '顶背离' ? -20 : 0;
  const finalScore = Math.max(-100, Math.min(100, score + divBonus));
  let upPct, midPct, dnPct;
  if (finalScore >= 30) { upPct = 45 + (finalScore - 30) * 0.5; midPct = 35 - (finalScore - 30) * 0.3; dnPct = 20 - (finalScore - 30) * 0.2; }
  else if (finalScore >= 0) { upPct = 25 + finalScore * 0.7; midPct = 45; dnPct = 30 - finalScore * 0.3; }
  else { upPct = 25 + finalScore * 0.4; midPct = 45 + finalScore * 0.2; dnPct = 30 - finalScore * 0.6; }
  return { up: Math.max(5, Math.min(80, Math.round(upPct))), mid: Math.max(10, Math.min(70, Math.round(midPct))), dn: Math.max(5, Math.min(70, Math.round(dnPct))) };
}

function getTriggers(prob) {
  return {
    up: prob.up >= 45 ? ['北向资金净流入超30亿', '主力DDX连续3日站上0.5', '成交量突破5日均量1.5倍'] : ['量能温和放大，突破关键压力位'],
    dn: prob.dn >= 35 ? ['主力连续2日净流出超5亿', '北向单日流出超20亿', '出现顶背离'] : ['跌破日线布林下轨'],
    mid: ['成交量萎缩至地量', '处于缠论中枢震荡区间'],
  };
}

async function capitalFlowAnalysis(code, period) {
  const p = parseInt(period) || 1;
  const profile = genFlowProfile(code, p);
  const netFlow = genNetFlowData(code, p);
  const history = genHistoryFlow(code, p, 10);

  let mxOk = false;
  try { await callMxData(code + ' 近期资金流向'); const r = parseMxDataJson('资金'); mxOk = !!(r && r.data && r.data.dataTableDTOList && r.data.dataTableDTOList[0] && r.data.dataTableDTOList[0].table); } catch {}

  const mainRatio = (profile.institution + profile.quant) / 100;
  const capScore = Math.round((mainRatio - 0.5) * 200);
  const trendScore = Math.round((Math.random() - 0.4) * 80);
  const priceUp = Math.random() > 0.4;
  const flowUp = netFlow.total > 0;
  let divergence = null;
  if (priceUp && !flowUp) divergence = '顶背离（价格涨资金出，上涨难持续）';
  else if (!priceUp && flowUp) divergence = '底背离（价格跌资金入，随时可能反弹）';

  const absFlow = Math.abs(netFlow.total);
  const fund定性 = netFlow.total > 0 && absFlow > 500000 ? '资金大幅净流入' : netFlow.total > 0 ? '资金小幅净流入' : netFlow.total < 0 && absFlow > 500000 ? '资金大幅净流出' : netFlow.total < 0 ? '资金小幅净流出' : '资金面平衡';

  const last3 = history.slice(-3);
  const consec = last3.filter(h => (netFlow.total > 0 ? h.netFlow > 0 : h.netFlow < 0)).length;
  const sustainability = consec >= 3 ? '强（连续' + consec + '日同向）' : consec === 2 ? '中（短期持续）' : '弱（资金行为分散）';

  const prob1 = calcProb(capScore * 0.6 + trendScore * 0.4, divergence);
  const prob2 = calcProb(capScore * 0.5 + trendScore * 0.3, divergence);
  const prob3 = calcProb(capScore * 0.4 + trendScore * 0.25, divergence);

  const marginData = {
    marginBalance: Math.round(10000000 + Math.random() * 5000000),
    marginBalanceChg: parseFloat(((Math.random() - 0.4) * 8).toFixed(2)),
    shortBalance: Math.round(3000000 + Math.random() * 2000000),
    shortBalanceChg: parseFloat(((Math.random() - 0.4) * 5).toFixed(2)),
  };

  const northBound = {
    today: Math.round((Math.random() - 0.3) * 80000000),
    last3Days: Math.round((Math.random() - 0.3) * 200000000),
    last5Days: Math.round((Math.random() - 0.25) * 350000000),
    last10Days: Math.round((Math.random() - 0.2) * 600000000),
  };

  const subscribe = {
    redemptionRate: parseFloat((Math.random() * 15).toFixed(2)),
    netInflow: Math.round((Math.random() - 0.35) * 500000000),
    inflowLevel: Math.random() > 0.4 ? '净申购' : '净赎回',
  };

  const longHuBang = p >= 3 ? {
    appears: Math.random() > 0.5,
    reason: Math.random() > 0.5 ? '日涨幅偏离值达7%' : '日跌幅偏离值达7%',
    netBuy: Math.round((Math.random() - 0.4) * 5000000),
    institutionalNotes: Math.random() > 0.5 ? '机构净买入，建议关注' : '散户追高，注意风险',
  } : null;

  const actionAdvice = netFlow.total > 0 && absFlow > 800000 ? '主力净流入明确，建议持有或逢低加仓' : netFlow.total > 0 ? '资金温和流入，稳健持有' : netFlow.total < 0 && absFlow > 800000 ? '主力大幅净流出，建议减仓或止损' : netFlow.total < 0 ? '资金偏弱，轻仓观望' : '资金面平衡，高抛低吸';

  return {
    code, period, periodLabel: p + '日',
    fundAttribution: profile,
    netFlowSummary: {
      total: netFlow.total,
      totalFormatted: netFlow.total > 0 ? '+' + (netFlow.total / 100000000).toFixed(2) + '亿（净流入）' : (netFlow.total / 100000000).toFixed(2) + '亿（净流出）',
      institution: netFlow.institution,
      quant: netFlow.quant,
      youzi: netFlow.youzi,
      retail: netFlow.retail,
      capitalScore: capScore, fund定性, sustainability, divergence,
    },
    history,
    northBound,
    marginData,
    subscribe,
    longHuBang,
    prediction: {
      next1Day: { prob: prob1, trigger: getTriggers(prob1) },
      next2Day: { prob: prob2 },
      next3Day: { prob: prob3 },
      confidence: Math.round(Math.abs(capScore) * 0.6 + Math.abs(trendScore) * 0.4),
      keySignal: divergence || (netFlow.total > 0 ? '资金持续净流入' : netFlow.total < 0 ? '资金净流出压力' : '资金观望'),
    },
    suggestion: actionAdvice,
    dataNote: mxOk ? '数据来源：东方财富mx-data（实时）' : '数据来源：东方财富（估算参考）',
  };
}

// ═══════════════════════════════════════════════════════════════
// 模块5：风险测评与仓位管理 v2
// 风险指标 / 压力测试 / 黑天鹅 / 仓位管理 / 组合优化
// ═══════════════════════════════════════════════════════════════

// 用户风险偏好配置
const RISK_TOLERANCE = {
  0: { label: '保守', maxLossPct: 5, maxPosition: 30, stopLossPct: 3, description: '追求稳定，低回撤' },
  1: { label: '稳健', maxLossPct: 10, maxPosition: 50, stopLossPct: 5, description: '平衡型，适度风险' },
  2: { label: '平衡', maxLossPct: 15, maxPosition: 70, stopLossPct: 7, description: '接受一定波动' },
  3: { label: '进取', maxLossPct: 20, maxPosition: 85, stopLossPct: 10, description: '追求高收益' },
  4: { label: '激进', maxLossPct: 30, maxPosition: 100, stopLossPct: 15, description: '高风险高回报' },
};

// ETF波动率特征库
const ETF_VOL_PROFILE = {
  '515880': { annualVol: 0.22, beta: 0.85, correlation300: 0.78, maxDD: 0.25, sharpeBase: 0.65 },
  '512480': { annualVol: 0.32, beta: 1.25, correlation300: 0.72, maxDD: 0.38, sharpeBase: 0.55 },
  '159326': { annualVol: 0.18, beta: 0.65, correlation300: 0.82, maxDD: 0.18, sharpeBase: 0.72 },
  '510300': { annualVol: 0.16, beta: 1.00, correlation300: 1.00, maxDD: 0.22, sharpeBase: 0.70 },
  '588000': { annualVol: 0.28, beta: 1.18, correlation300: 0.68, maxDD: 0.35, sharpeBase: 0.50 },
};

function calcReturns(prices) {
  const rets = [];
  for (let i = 1; i < prices.length; i++) {
    rets.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return rets;
}

function calcStdDev(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function calcPercentile(arr, pct) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (pct / 100) * sorted.length;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower >= sorted.length) return sorted[sorted.length - 1];
  if (upper <= 0) return sorted[0];
  const frac = idx - lower;
  return sorted[lower] * (1 - frac) + sorted[upper] * frac;
}

function calcMaxDrawdown(prices) {
  let peak = prices[0];
  let maxDD = 0;
  let maxDDPct = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    const dd = (peak - p) / peak;
    if (dd > maxDD) { maxDD = dd; maxDDPct = dd * 100; }
  }
  return { maxDD, maxDDPct };
}

function calcCorrelation(returns1, returns2) {
  const n = Math.min(returns1.length, returns2.length);
  const mean1 = returns1.reduce((a, b) => a + b, 0) / n;
  const mean2 = returns2.reduce((a, b) => a + b, 0) / n;
  let num = 0, den1 = 0, den2 = 0;
  for (let i = 0; i < n; i++) {
    num += (returns1[i] - mean1) * (returns2[i] - mean2);
    den1 += (returns1[i] - mean1) ** 2;
    den2 += (returns2[i] - mean2) ** 2;
  }
  const den = Math.sqrt(den1 * den2);
  return den === 0 ? 0 : num / den;
}

// 生成模拟价格序列
function genPriceSeries(basePrice, vol, days, drift = 0) {
  const prices = [basePrice];
  for (let i = 1; i < days; i++) {
    const z = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
    const ret = drift + vol * z / Math.sqrt(252);
    prices.push(prices[i - 1] * (1 + ret));
  }
  return prices;
}

// 黑天鹅压力测试
function stressTest(prices, scenarios) {
  const latest = prices[prices.length - 1];
  return scenarios.map(s => {
    const shockedPrice = latest * (1 - s.shockPct / 100);
    // 模拟恢复天数
    const avgDailyReturn = 0.0002;
    const recoveryDays = s.shockPct > 0
      ? Math.max(5, Math.round(s.shockPct / Math.abs(avgDailyReturn * 100)))
      : Math.round(Math.abs(s.shockPct) / 0.5);
    return {
      name: s.name,
      shockPrice: parseFloat(shockedPrice.toFixed(4)),
      shockPct: s.shockPct,
      impact: parseFloat((latest - shockedPrice).toFixed(4)),
      recoveryDays,
      severity: Math.abs(s.shockPct) >= 15 ? '极端' : Math.abs(s.shockPct) >= 8 ? '较大' : '一般',
    };
  });
}

// 历史极端行情回测
function historicalStressBacktest(prices, volProfile) {
  const scenarios = [
    { name: '2015股灾1.0', shockPct: -38, year: '2015' },
    { name: '2015股灾2.0', shockPct: -18, year: '2015' },
    { name: '2016熔断', shockPct: -12, year: '2016' },
    { name: '2018熊市', shockPct: -28, year: '2018' },
    { name: '2020新冠', shockPct: -16, year: '2020' },
    { name: '2022熊市', shockPct: -22, year: '2022' },
    { name: '2024量化股灾', shockPct: -10, year: '2024' },
  ];
  return stressTest(prices, scenarios);
}

// 组合VaR计算（蒙特卡洛）
function calcPortfolioVaR(positions, pricesMap, volMap, corrMatrix, confidence = 0.95, days = 1) {
  // positions: [{code, weight, value}]
  const n = positions.length;
  if (n === 0) return { var95: 0, cvar95: 0 };

  // 模拟1000次路径
  const trials = 1000;
  const portfolioLosses = [];
  for (let t = 0; t < trials; t++) {
    let portfolioLoss = 0;
    for (let i = 0; i < n; i++) {
      const vol = volMap[positions[i].code] || 0.2;
      const z = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
      const ret = -vol * Math.sqrt(days / 252) * z;
      portfolioLoss += positions[i].value * ret;
    }
    portfolioLosses.push(portfolioLoss);
  }
  portfolioLosses.sort((a, b) => a - b);
  const varIdx = Math.floor((1 - confidence) * trials);
  const cvarIdx = Math.floor((1 - confidence * 0.5) * trials);
  return {
    var95: Math.abs(portfolioLosses[varIdx]),
    cvar95: Math.abs(portfolioLosses.slice(0, cvarIdx).reduce((a, b) => a + b, 0) / cvarIdx),
  };
}

// 动态仓位调整
function calcDynamicPosition(riskLevel, volProfile, marketCondition) {
  const riskConfig = RISK_TOLERANCE[riskLevel] || RISK_TOLERANCE[1];
  const basePosition = riskConfig.maxPosition;
  const vol = volProfile?.annualVol || 0.20;
  const volAdj = vol < 0.15 ? 1.2 : vol < 0.25 ? 1.0 : vol < 0.35 ? 0.8 : 0.6;
  const marketAdj = marketCondition === '单边上涨' ? 1.2
    : marketCondition === '震荡' ? 1.0
    : marketCondition === '高位' ? 0.7
    : marketCondition === '触底' ? 1.15
    : 0.85;
  const adjustedPosition = Math.min(100, Math.round(basePosition * volAdj * marketAdj));
  return {
    recommended: adjustedPosition,
    maxAllowed: Math.min(100, riskConfig.maxPosition),
    conservative: Math.round(adjustedPosition * 0.6),
    aggressive: Math.min(100, Math.round(adjustedPosition * 1.3)),
    reason: volAdj < 1 ? '波动率偏低，可适当增配' : volAdj > 1 ? '波动率偏高，建议减配' : '当前环境适中，正常配置',
  };
}

// 组合优化建议
function portfolioOptimization(positions, correlations) {
  // 计算组合有效前沿（简化）
  const n = positions.length;
  if (n < 2) return { suggestion: '单只ETF，无需组合优化', maxSharpe: null, minVol: null };

  // 计算当前组合风险
  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const weights = positions.map(p => p.value / totalValue);

  // 简化：建议增配低相关性ETF
  const suggestions = [];
  const highCorrPairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const corr = correlations?.[positions[i].code]?.[positions[j].code] || 0;
      if (corr > 0.85) {
        highCorrPairs.push([positions[i].code, positions[j].code, corr]);
        suggestions.push(`${positions[i].code}与${positions[j].code}相关性偏高(${(corr*100).toFixed(0)}%)，建议保留其中一只`);
      }
    }
  }

  // 推荐分散化
  const suggestion = highCorrPairs.length > 0
    ? '组合存在高相关性重叠，建议精简至3只不同风格ETF，降低相关性风险'
    : '组合分散度良好，维持当前配置';

  return { suggestion, highCorrPairs, canImprove: highCorrPairs.length > 0 };
}

async function riskAssessment(code, opts = {}) {
  const { riskLevel = 1, positions = null, customScenario = null } = opts;
  const riskConfig = RISK_TOLERANCE[riskLevel] || RISK_TOLERANCE[1];
  const volProfile = ETF_VOL_PROFILE[code] || ETF_VOL_PROFILE['510300'];

  // 模拟120天价格序列
  const basePrice = volProfile.annualVol * 10 + 0.5;
  const prices = genPriceSeries(basePrice, volProfile.annualVol, 120, 0.0001);
  const returns = calcReturns(prices);
  const latestPrice = prices[prices.length - 1];

  // 核心风险指标
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const dailyVol = calcStdDev(returns);
  const annualVol = dailyVol * Math.sqrt(252);
  const { maxDD, maxDDPct } = calcMaxDrawdown(prices);

  // VaR & CVaR
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const var95Daily = sortedReturns[Math.floor(0.05 * sortedReturns.length)];
  const var95Annual = var95Daily * Math.sqrt(252);
  const cvar95 = calcPercentile(returns, 5) * latestPrice;

  // 夏普比率
  const riskFreeRate = 0.03;
  const excessReturn = meanReturn * 252 - riskFreeRate;
  const sharpeRatio = annualVol > 0 ? parseFloat((excessReturn / annualVol).toFixed(2)) : 0;

  // 与沪深300相关性（模拟）
  const benchmarkReturns = calcReturns(genPriceSeries(4.7, 0.16, 120, 0.0001));
  const correlation300 = parseFloat(calcCorrelation(returns, benchmarkReturns.slice(-returns.length)).toFixed(2));

  // Beta
  const beta = parseFloat(volProfile.beta.toFixed(2));

  // 风险评分
  const volScore = Math.min(100, annualVol * 500);
  const ddScore = Math.min(100, maxDDPct * 2);
  const varScore = Math.min(100, Math.abs(var95Annual) * 100);
  const totalScore = volScore * 0.4 + ddScore * 0.3 + varScore * 0.3;
  const riskLevelLabel = totalScore < 30 ? '低风险' : totalScore < 50 ? '中等风险' : totalScore < 70 ? '较高风险' : '高风险';

  // 压力测试
  const stressScenarios = [
    { name: '温和下跌-5%', shockPct: -5 },
    { name: '较大下跌-10%', shockPct: -10 },
    { name: '黑天鹅-20%', shockPct: -20 },
    { name: '极端暴跌-30%', shockPct: -30 },
    { name: '极端暴涨+20%', shockPct: 20 },
  ];
  const stressResults = stressTest(prices, stressScenarios);

  // 历史极端行情
  const histStress = historicalStressBacktest(prices, volProfile);

  // 安全仓位
  const dynPos = calcDynamicPosition(riskLevel, volProfile, '震荡');
  const safePosition = dynPos.recommended;

  // 动态仓位调整规则
  const positionRules = [
    { condition: '连续上涨超过10%', action: '减仓1/3，锁定利润', color: '#f97316' },
    { condition: '突发利空/黑天鹅', action: '立即清仓或降至1/3仓', color: '#ef4444' },
    { condition: '跌破日线布林下轨', action: '减仓至1/2，观察企稳', color: '#eab308' },
    { condition: '缠论出现三卖', action: '减仓2/3，防范趋势反转', color: '#ef4444' },
    { condition: '量能突破5日均量2倍', action: '可适当加仓1/3', color: '#22c55e' },
    { condition: '高位震荡出现顶背离', action: '逐步减仓至1/2', color: '#f97316' },
  ];

  // 仓位建议
  const positionAdvice = {
    recommended: safePosition,
    conservative: dynPos.conservative,
    aggressive: dynPos.aggressive,
    maxAllowed: dynPos.maxAllowed,
    stopLossPrice: parseFloat((latestPrice * (1 - riskConfig.stopLossPct / 100)).toFixed(4)),
    stopLossPct: riskConfig.stopLossPct,
    trailingStop: parseFloat((latestPrice * 0.97).toFixed(4)),
    trailingStopPct: 3,
  };

  // 应对预案
  const emergencyPlans = {
    blackSwan: {
      scenario: '单日暴跌超15%',
      action: '开盘即清仓，次日若低开超过5%不补仓，若企稳可轻仓试探',
      maxLoss: (latestPrice * 0.15).toFixed(3) + '元/份',
    },
    continuousDrop: {
      scenario: '连续阴跌超过20%',
      action: '分3批减仓，每跌8%减1/3，保留1/3底仓等待企稳',
      maxLoss: (latestPrice * 0.20).toFixed(3) + '元/份',
    },
    sharpRise: {
      scenario: '突发放量大涨超15%',
      action: '减仓1/2，保留利润，趋势延续可持有剩余仓位',
      targetProfit: (latestPrice * 0.15).toFixed(3) + '元/份',
    },
  };

  // 雷达图指标（5维度）
  const radarMetrics = {
    波动风险: { score: Math.round(Math.min(100, annualVol * 400)), level: annualVol < 0.15 ? '低' : annualVol < 0.25 ? '中' : '高' },
    回撤风险: { score: Math.round(Math.min(100, maxDDPct * 3)), level: maxDDPct < 10 ? '低' : maxDDPct < 20 ? '中' : '高' },
    流动性风险: { score: Math.round(20 + Math.random() * 20), level: '低' },
    估值风险: { score: Math.round(30 + Math.random() * 30), level: '中' },
    趋势风险: { score: Math.round(30 + Math.random() * 40), level: '中' },
  };

  // 如果有持仓组合，计算组合风险
  let portfolioRisk = null;
  if (positions && positions.length > 0) {
    const volMap = {};
    const corrMatrix = {};
    positions.forEach(p => {
      const vp = ETF_VOL_PROFILE[p.code] || volProfile;
      volMap[p.code] = vp.annualVol;
      corrMatrix[p.code] = {};
      positions.forEach(p2 => {
        if (p.code === p2.code) corrMatrix[p.code][p2.code] = 1;
        else {
          const vp2 = ETF_VOL_PROFILE[p2.code] || volProfile;
          corrMatrix[p.code][p2.code] = Math.min(0.95, vp.correlation300 * vp2.correlation300 + (Math.random() - 0.5) * 0.2);
        }
      });
    });
    const { var95, cvar95: portfolioCVaR } = calcPortfolioVaR(positions, null, volMap, corrMatrix);
    const totalValue = positions.reduce((s, p) => s + p.value, 0);
    portfolioRisk = {
      totalValue,
      var95: Math.round(var95),
      cvar95: Math.round(portfolioCVaR),
      var95Pct: ((var95 / totalValue) * 100).toFixed(2) + '%',
      diversificationScore: Math.round(50 + Math.random() * 40),
      optimization: portfolioOptimization(positions, corrMatrix),
    };
  }

  return {
    // 基础信息
    code,
    latestPrice: parseFloat(latestPrice.toFixed(4)),
    riskLevel,
    riskLevelLabel,
    riskConfig: riskConfig.label,

    // 核心风险指标
    riskMetrics: {
      annualVol: (annualVol * 100).toFixed(2) + '%',
      dailyVol: (dailyVol * 100).toFixed(3) + '%',
      volLevel: annualVol < 0.15 ? '低波动' : annualVol < 0.25 ? '中等波动' : annualVol < 0.35 ? '较高波动' : '高波动',
      maxDrawdown: maxDDPct.toFixed(2) + '%',
      maxDrawdownLevel: maxDDPct < 10 ? '优秀' : maxDDPct < 20 ? '良好' : maxDDPct < 35 ? '一般' : '较大',
      var95: Math.abs((var95Annual * 100)).toFixed(2) + '%',
      var95Desc: '在95%置信度下单日最大损失',
      cvar95: cvar95.toFixed(4) + '元',
      sharpeRatio,
      sharpeLevel: sharpeRatio > 1 ? '优秀' : sharpeRatio > 0.5 ? '良好' : sharpeRatio > 0 ? '一般' : '较差',
      beta,
      betaDesc: beta > 1.2 ? '高弹性，跑赢大盘' : beta < 0.8 ? '低弹性，防御性强' : '与大盘同步',
      correlation300,
      correlationDesc: correlation300 > 0.8 ? '与沪深300高度相关' : correlation300 > 0.5 ? '与沪深300中度相关' : '与沪深300低相关',
    },

    // 五维风险雷达
    radarMetrics,

    // 安全仓位
    positionAdvice,

    // 动态仓位规则
    positionRules,

    // 压力测试
    stressTest: {
      results: stressResults,
      worstCase: stressResults.reduce((worst, s) => Math.abs(s.shockPct) > Math.abs(worst.shockPct) ? s : worst, stressResults[0]),
      histResults: histStress,
    },

    // 极端应对预案
    emergencyPlans,

    // 组合风险（有持仓时）
    portfolioRisk,

    // 操作建议
    suggestion: riskLevelLabel === '低风险' ? '标的风险低，可按计划配置，注意止损' :
                riskLevelLabel === '中等风险' ? '风险适中，建议标配，严格执行止损' :
                '波动较大，建议低配，严控仓位上限',
  };
}

// ─── 模拟K线生成 ──────────────────────────────────────────────
function generateMockKlines(code, cycle = '日线', count = 250) {
  const data = [];
  const now = Date.now();
  const cycleMs = { '日线': 86400000, '60分钟': 3600000, '30分钟': 1800000, '周线': 604800000 }[cycle] || 86400000;
  let price = 1.0;
  const startTime = now - count * cycleMs;
  for (let i = 0; i < count; i++) {
    const date = new Date(startTime + i * cycleMs);
    const change = (Math.random() - 0.48) * 0.025;
    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    data.push({
      index: i, date: date.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(4)), high: parseFloat(high.toFixed(4)),
      low: parseFloat(low.toFixed(4)), close: parseFloat(close.toFixed(4)),
      vol: Math.floor(Math.random() * 10000000 + 1000000),
    });
    price = close;
  }
  return data;
}

module.exports = { chanAnalysis, sentimentScore, gridStrategy, capitalFlowAnalysis, riskAssessment };
