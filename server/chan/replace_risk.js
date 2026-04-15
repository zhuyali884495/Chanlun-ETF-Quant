'use strict';
const fs = require('fs');
const path = 'C:/Users/34856/chan-theory-h5/server/chan/analysis.js';
const content = fs.readFileSync(path, 'utf8');

// Find and replace riskAssessment function
const startMarker = '// 模块5：风险测评 + 安全仓位';
const endMarker = '// ─── 模拟K线生成 ──────────────────────────────────────────────';
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

const before = content.substring(0, startIdx);
const after = content.substring(endIdx);

const newFunc = `// ═══════════════════════════════════════════════════════════════
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
        suggestions.push(\`\${positions[i].code}与\${positions[j].code}相关性偏高(\${(corr*100).toFixed(0)}%)，建议保留其中一只\`);
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
`;

const newContent = before + newFunc + '\n' + after;
fs.writeFileSync(path, newContent, 'utf8');
console.log('done, new size:', newContent.length);
