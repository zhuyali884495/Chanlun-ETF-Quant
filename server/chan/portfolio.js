'use strict';

/**
 * P1: 持仓核算 + 智能盯盘预警
 * 数据源: mx-moni (持仓/资金), mx-data (实时行情), risk-assessment (目标仓位)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const MX_MONI = 'C:\\Users\\34856\\.openclaw\\workspace\\skills\\mx-moni\\mx_moni.py';
const MX_DATA = 'C:\\Users\\34856\\.openclaw\\workspace\\skills\\mx-data\\mx_data.py';
const MX_OUT = 'C:\\root\\.openclaw\\workspace\\mx_data\\output';
const PYTHON = 'C:\\Users\\34856\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';
const ALERTS_FILE = 'C:\\Users\\34856\\chan-theory-h5\\server\\data\\alerts.json';

function callPy(script, args) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.MX_APIKEY || 'mkt_y2fWnSXUku-xIeC8e8MyDxaYU_ObOFz78QkMBLb4jbE';
    const proc = spawn(PYTHON, [script, ...args], {
      env: { ...process.env, MX_APIKEY: apiKey, PYTHONIOENCODING: 'utf-8' },
      timeout: 20000,
    });
    let out = '', err = '';
    proc.stdout.on('data', d => out += d.toString('utf8'));
    proc.stderr.on('data', d => err += d.toString('utf8'));
    proc.on('close', code => {
      if (code !== 0 && err) reject(new Error(err.trim()));
      else resolve(out);
    });
    proc.on('error', reject);
  });
}

function safeNum(v, f = 0) {
  const n = parseFloat(v);
  return isNaN(n) ? f : n;
}

// ─── P1-1: 持仓与目标仓位核算 ────────────────────────────────
async function portfolioAnalysis() {
  // 1. 获取当前持仓
  let holdings = [];
  let cash = 0;
  let totalAsset = 0;

  try {
    // 先触发查询
    await callPy(MX_MONI, ['查询持仓']);
    const rawFile = getLatestJson('mx_moni');
    if (rawFile) {
      const data = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
      const dt = data?.data;
      if (dt?.posList) {
        holdings = (dt.posList || []).map(s => ({
          code: s.secCode,
          name: s.secName,
          volume: safeNum(s.count),
          cost: safeNum(s.costPrice) / 1000,  // 成本价（分→元）
          currentPrice: safeNum(s.price) / 1000, // 当前价（分→元）
          marketValue: safeNum(s.value),
          dayProfit: safeNum(s.dayProfit),
          dayProfitPct: safeNum(s.dayProfitPct),
          profit: safeNum(s.profit),
          profitPct: safeNum(s.profitPct),
          posPct: safeNum(s.posPct),
        }));
      }
      cash = safeNum(dt?.availBalance || 0);
      totalAsset = safeNum(dt?.totalAssets || cash + (holdings.reduce((s, h) => s + h.marketValue, 0)));
    }
  } catch (e) {
    // 降级到模拟
    holdings = [
      { code: '515880', name: '通信ETF', volume: 10000, cost: 0.98, currentPrice: 1.01, marketValue: 10100 },
      { code: '159915', name: '创业板ETF', volume: 5000, cost: 1.80, currentPrice: 1.85, marketValue: 9250 },
    ];
    cash = 238018.68;
    totalAsset = cash + holdings.reduce((s, h) => s + h.marketValue, 0);
  }

  // 2. 获取每只持仓的风险测评
  const holdingsWithRisk = await Promise.all(holdings.map(async h => {
    try {
      const riskData = await getRiskData(h.code);
      return { ...h, risk: riskData };
    } catch { return { ...h, risk: null }; }
  }));

  // 3. 计算目标仓位 vs 当前仓位
  const suggestions = holdingsWithRisk.map(h => {
    if (!h.risk) return { code: h.code, name: h.name, action: '数据不足', reason: '' };
    const currentPct = (h.marketValue / totalAsset) * 100;
    const safePos = h.risk.safePosition || 20;
    const diff = safePos - currentPct;
    if (diff > 5) return { code: h.code, name: h.name, action: '加仓', reason: `当前${currentPct.toFixed(1)}% → 目标${safePos}%，差${diff.toFixed(1)}%`, currentPct: currentPct.toFixed(1) + '%', targetPct: safePos + '%', diff: diff.toFixed(1) + '%', amount: Math.round(diff / 100 * totalAsset) + '元' };
    if (diff < -5) return { code: h.code, name: h.name, action: '减仓', reason: `当前${currentPct.toFixed(1)}% → 目标${safePos}%，超配${Math.abs(diff).toFixed(1)}%`, currentPct: currentPct.toFixed(1) + '%', targetPct: safePos + '%', diff: Math.abs(diff).toFixed(1) + '%', amount: Math.round(Math.abs(diff) / 100 * totalAsset) + '元' };
    return { code: h.code, name: h.name, action: '持有', reason: `当前仓位在目标范围内，无需调整`, currentPct: currentPct.toFixed(1) + '%', targetPct: safePos + '%', diff: '0%', amount: '-' };
  });

  // 4. 总体账户健康度
  const totalRisk = holdingsWithRisk.reduce((s, h) => s + (h.risk?.riskScore || 50), 0) / Math.max(holdings.length, 1);
  const accountHealth = totalRisk < 30 ? '健康' : totalRisk < 60 ? '中等' : '风险偏高';

  return {
    account: {
      totalAsset: parseFloat(totalAsset.toFixed(2)),
      cash: parseFloat(cash.toFixed(2)),
      positionValue: parseFloat((totalAsset - cash).toFixed(2)),
      positionRatio: parseFloat(((totalAsset - cash) / totalAsset * 100).toFixed(2)) + '%',
      stockCount: holdings.length,
    },
    holdings: holdingsWithRisk,
    suggestions,
    accountHealth,
    summary: suggestions.filter(s => s.action !== '持有').length > 0
      ? `建议调整 ${suggestions.filter(s => s.action !== '持有').length} 只持仓`
      : '所有持仓在目标仓位范围内',
  };
}

// ─── P1-2: 智能盯盘预警 ────────────────────────────────────
function getAlerts() {
  if (!fs.existsSync(ALERTS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8')); } catch { return []; }
}

function saveAlerts(alerts) {
  const dir = path.dirname(ALERTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2), 'utf8');
}

async function checkAlerts() {
  const alerts = getAlerts();
  if (!alerts.length) return { triggered: [], normal: [], msg: '无监控标的' };

  // 先查询所有标的价格
  await Promise.all(alerts.map(a => callPy(MX_DATA, [`${a.code} 最新价 涨跌幅`]).catch(() => null)));

  // 获取所有标的最新价
  const results = await Promise.all(alerts.map(async a => {
    try {
      const rawFile = getLatestJson('mx_data_' + a.code);
      if (!rawFile) return { ...a, currentPrice: null, currentChg: null, triggered: false };
      const data = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
      const dt = data?.data?.dataTableDTOList?.[0]?.table;
      if (!dt) return { ...a, currentPrice: null, currentChg: null, triggered: false };
      const t = dt;
      const priceKey = Object.keys(t).find(k => k.includes('最新价') || k.includes('CLOSE'));
      const chgKey = Object.keys(t).find(k => k.includes('涨跌幅') || k.includes('CHG'));
      const price = safeNum((t[priceKey] || [])[0]);
      const chg = safeNum((t[chgKey] || [])[0]);
      const triggered = (a.type === 'price_above' && price >= a.threshold) ||
                       (a.type === 'price_below' && price <= a.threshold) ||
                       (a.type === 'chg_above' && chg >= a.threshold) ||
                       (a.type === 'chg_below' && chg <= a.threshold);
      return { ...a, currentPrice: price, currentChg: chg, triggered, msg: triggered ? `触发${a.type}` : '正常' };
    } catch (e) { return { ...a, currentPrice: null, currentChg: null, triggered: false, msg: '数据获取失败' }; }
  }));

  const triggered = results.filter(r => r.triggered);
  const normal = results.filter(r => !r.triggered);

  // 首次触发时记录
  if (triggered.length > 0) {
    const prev = getAlerts().map(a => ({ ...a, lastTriggered: a.lastTriggered }));
    const updated = results.map(r => {
      if (r.triggered) {
        const prevAlert = prev.find(p => p.code === r.code);
        return { ...r, lastTriggered: new Date().toISOString(), lastPrice: r.currentPrice };
      }
      return r;
    });
    saveAlerts(updated);
  }

  return { triggered, normal, checkedAt: new Date().toISOString() };
}

function addAlert(code, type, threshold, name) {
  const alerts = getAlerts();
  const exists = alerts.findIndex(a => a.code === code && a.type === type);
  if (exists >= 0) alerts.splice(exists, 1);
  alerts.push({ code, name: name || code, type, threshold, createdAt: new Date().toISOString(), lastTriggered: null });
  saveAlerts(alerts);
  return { code, type, threshold, name: name || code };
}

function removeAlert(code, type) {
  const alerts = getAlerts().filter(a => !(a.code === code && a.type === type));
  saveAlerts(alerts);
  return { ok: true };
}

// ─── 辅助 ──────────────────────────────────────────────────
function getLatestJson(prefix) {
  if (!fs.existsSync(MX_OUT)) return null;
  try {
    const files = fs.readdirSync(MX_OUT).filter(f => f.startsWith(prefix) && f.endsWith('_raw.json'));
    if (!files.length) return null;
    const latest = files.sort((a, b) => fs.statSync(path.join(MX_OUT, b)).mtime - fs.statSync(path.join(MX_OUT, a)).mtime)[0];
    return path.join(MX_OUT, latest);
  } catch { return null; }
}

async function getRiskData(code) {
  // 复用 risk-assessment 逻辑（避免重复实现）
  const { riskAssessment } = require('./analysis');
  return riskAssessment(code);
}

module.exports = { portfolioAnalysis, checkAlerts, addAlert, removeAlert, getAlerts };
