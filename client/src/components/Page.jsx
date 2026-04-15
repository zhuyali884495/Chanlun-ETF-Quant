import React, { useState, useEffect } from 'react';
import { CORE_ETFS } from '../constants.js';
import { fetchSentimentData, fetchGridData, fetchCapitalData, fetchRiskData, fetchEtfScreen } from '../api/index.js';

const C = { green: 'var(--up)', red: 'var(--down)', yellow: '#eab308', blue: 'var(--primary)', purple: 'var(--primary)', cyan: 'var(--primary)', orange: '#f97316', card: 'var(--bg-card)', border: 'var(--border)', text: 'var(--text)', muted: 'var(--text-muted)' };

// ─── SVG雷达图 ──────────────────────────────────────────────
function RadarChart({ dimensions }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 88;
  const keys = ['供需', '政策', '业绩', '估值', '资金'];
  const colors = { 供需: '#06b6d4', 政策: '#a855f7', 业绩: 'var(--primary)', 估值: '#eab308', 资金: '#f97316' };

  function toXY(i, value) {
    const angle = (i / keys.length) * 2 * Math.PI - Math.PI / 2;
    const r = (value / 100) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  const values = keys.map((k, i) => {
    const d = dimensions?.[k];
    return d ? d.score : 50;
  });

  const points = values.map((v, i) => toXY(i, v));
  const polyPath = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ') + 'Z';

  // 背景网格
  const grids = [20, 40, 60, 80, 100].map(pct => {
    const pts = keys.map((_, i) => toXY(i, pct));
    return pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ') + 'Z';
  });

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>五维度雷达图</div>
      <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
        {grids.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={C.border} strokeWidth={i === grids.length - 1 ? 1.5 : 0.5} strokeDasharray={i < grids.length - 1 ? '3,3' : 'none'} />
        ))}
        {keys.map((_, i) => {
          const end = toXY(i, 100);
          return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke={C.border} strokeWidth={0.5} />;
        })}
        <path d={polyPath} fill={colors.供需 + '33'} stroke={C.cyan} strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill={colors[keys[i]]} stroke="#0a0e17" strokeWidth={1.5} />
        ))}
        {keys.map((k, i) => {
          const outer = toXY(i, 118);
          return (
            <text key={k} x={outer.x} y={outer.y + 4} textAnchor="middle" fontSize={10} fill={C.muted}>
              {k}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── 趋势柱状图 ──────────────────────────────────────────────
function TrendChart({ history }) {
  if (!history?.length) return null;
  const max = Math.max(...history.map(h => h.score));
  const min = Math.min(...history.map(h => h.score));
  const range = max - min || 1;
  const avg = history.reduce((s, h) => s + h.score, 0) / history.length;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>景气度趋势（近12期）</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, paddingBottom: 4 }}>
        {history.map((h, i) => {
          const heightPct = ((h.score - min) / range) * 70 + 10;
          const isRising = i < history.length - 1 && h.score < history[i + 1].score;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ fontSize: 8, color: C.muted, marginBottom: 2 }}>{h.score}</div>
              <div title={h.period + ' ' + h.score + '分'} style={{ width: '100%', height: `${heightPct}%`, background: i === history.length - 1 ? C.cyan : isRising ? C.green + '88' : C.red + '66', borderRadius: '2px 2px 0 0', transition: 'height 0.3s ease', minHeight: 4 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: C.muted }}>12期前</span>
        <span style={{ fontSize: 10, color: C.yellow }}>均值 {Math.round(avg)}分</span>
        <span style={{ fontSize: 10, color: C.muted }}>当前</span>
      </div>
    </div>
  );
}

// ─── 景气度详情卡 ────────────────────────────────────────────
function SentimentCard({ label, value, unit, color, desc }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{desc}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: color || C.text }}>{value}<span style={{ fontSize: 11, color: C.muted, marginLeft: 2 }}>{unit || ''}</span></div>
      </div>
    </div>
  );
}

function Page({ title, icon, children, onRefresh, refreshing }) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{icon} {title}</div>
        {onRefresh && (
          <button onClick={onRefresh} disabled={refreshing}
            style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: refreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            🔄 {refreshing ? '刷新中...' : '刷新'}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── 共用控制栏 ──────────────────────────────────────────────
function ControlBar({ selected, setSelected, onLoad, loading, extraInputs }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>选择ETF</div>
          <select value={selected?.code || ''} onChange={e => setSelected(CORE_ETFS.find(x => x.code === e.target.value) || selected)}
            style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg-input)', color: C.text, fontSize: 13, minWidth: 160 }}>
            {CORE_ETFS.map(e => <option key={e.code} value={e.code}>{e.name} ({e.code})</option>)}
          </select>
        </div>
        {extraInputs}
        <button onClick={onLoad} disabled={loading}
          style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: C.blue, color: '#fff', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {loading ? '分析中...' : '▶ 开始分析'}
        </button>
      </div>
    </div>
  );
}

export function SentimentPage({ navTarget, onNavTargetUsed }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(CORE_ETFS[0]);

  const load = async () => {
    setLoading(true);
    try { const d = await fetchSentimentData(selected.code); setData(d); } catch { setData(null); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [selected]);
  // 联动跳转
  useEffect(() => {
    if (navTarget && navTarget.tab === 'sentiment') {
      const etf = CORE_ETFS.find(e => e.code === navTarget.code);
      if (etf) setSelected(etf);
      if (onNavTargetUsed) onNavTargetUsed();
    }
  }, [navTarget]);

  const dimColors = { 供需: C.cyan, 政策: C.purple, 业绩: C.blue, 估值: C.yellow, 资金: C.orange };
  const dimKeys = ['供需', '政策', '业绩', '估值', '资金'];

  return (
    <Page title="景气度打分" icon="🌡️" onRefresh={load} refreshing={loading}>
      <ControlBar selected={selected} setSelected={setSelected} onLoad={load} loading={loading} />

      {data && (
        <>
          {/* 顶部综合评分 + 关键指标 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: '综合评分', value: data.total, color: data.total >= 75 ? C.green : data.total >= 62 ? C.yellow : C.red, unit: '分' },
              { label: '景气等级', value: data.level, color: data.level === '高景气' ? C.green : data.level === '温和扩张' ? C.yellow : C.red, unit: '' },
              { label: '周期定位', value: data.cyclePosition || data.cycle || '-', color: C.cyan, unit: '' },
              { label: '趋势', value: (data.trend >= 0 ? '+' : '') + (data.trend?.toFixed(1) || 0), color: data.trend >= 0 ? C.green : C.red, unit: '' },
            ].map(item => (
              <div key={item.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{item.value}<span style={{ fontSize: 10, color: C.muted }}>{item.unit}</span></div>
              </div>
            ))}
          </div>

          {/* 五维度评分条 */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 12 }}>五维度量化评分</div>
            {dimKeys.map(k => {
              const dim = data.dimensions?.[k];
              if (!dim) return null;
              const pct = dim.score;
              const barColor = dimColors[k];
              return (
                <div key={k} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{k}</span>
                    <span style={{ fontSize: 12, color: barColor, fontWeight: 700 }}>{dim.score}<span style={{ fontSize: 10, color: C.muted }}> /100　{dim.weight}权重</span></span>
                  </div>
                  <div style={{ background: '#1a2035', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{dim.desc}</div>
                </div>
              );
            })}
          </div>

          {/* 雷达图 + 趋势图并排 */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, marginBottom: 14 }}>
            <RadarChart dimensions={data.dimensions} />
            <TrendChart history={data.history} />
          </div>

          {/* 行业信息 */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 10px', borderRadius: 20, background: `${C.blue}22`, color: C.blue, fontSize: 12, fontWeight: 600 }}>🏭 {data.industry || selected?.name}</span>
              <span style={{ padding: '3px 10px', borderRadius: 20, background: `${C.purple}22`, color: C.purple, fontSize: 12 }}>📋 {data.policyTag || '-'}</span>
              <span style={{ padding: '3px 10px', borderRadius: 20, background: `${C.yellow}22`, color: C.yellow, fontSize: 12 }}>📊 PE分位 {data.pePercentile || '-'}%</span>
              <span style={{ padding: '3px 10px', borderRadius: 20, background: `${C.cyan}22`, color: C.cyan, fontSize: 12 }}>🏆 排名 {data.ranking?.rank || '-'}/{data.ranking?.total || 5}</span>
              <span style={{ padding: '3px 10px', borderRadius: 20, background: `${C.orange}22`, color: C.orange, fontSize: 12 }}>⏱️ {data.持续性评级 || '-'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 4 }}>▲ 核心驱动</div>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{data.drivers || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 4 }}>▼ 风险点</div>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{data.risks || '-'}</div>
              </div>
            </div>
          </div>

          {/* 拐点预判 + 操作建议 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div style={{ background: `${C.yellow}11`, border: `1px solid ${C.yellow}44`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, color: C.yellow, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>拐点预判</div>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{data.拐点预判 || '等待数据'}</div>
            </div>
            <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}44`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>操作配置建议</div>
              <div style={{ fontSize: 15, color: C.text, lineHeight: 1.7, fontWeight: 600 }}>{data.操作建议 || data.suggestion || '-'}</div>
            </div>
          </div>
        </>
      )}
    </Page>
  );
}

export function GridPage({ navTarget, onNavTargetUsed }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(CORE_ETFS[0]);
  const [capital, setCapital] = useState('100000');
  const [riskLevel, setRiskLevel] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customVol, setCustomVol] = useState('');
  const [customBand, setCustomBand] = useState('');

  const RISK_OPTIONS = [
    { value: 0, label: '保守', desc: '低风险，窄网格，多档位' },
    { value: 1, label: '稳健', desc: '标准参数，平衡型' },
    { value: 2, label: '平衡', desc: '中等风险，适中网格' },
    { value: 3, label: '进取', desc: '较高风险，宽区间' },
    { value: 4, label: '激进', desc: '高风险，极限参数' },
  ];

  const load = async () => {
    setLoading(true);
    try {
      const d = await fetchGridData(selected.code, {
        capital: parseFloat(capital) || 100000,
        riskLevel,
        customVol: customVol || null,
        customBand: customBand || null,
      });
      setData(d);
    } catch { setData(null); }
    setLoading(false);
  };

  // 默认加载第一只ETF + 联动跳转
  useEffect(() => { load(); }, [selected, riskLevel, capital, customVol, customBand]);
  useEffect(() => {
    if (navTarget && navTarget.tab === 'grid') {
      const etf = CORE_ETFS.find(e => e.code === navTarget.code);
      if (etf) { setSelected(etf); setRiskLevel(1); setCapital('100000'); }
      if (onNavTargetUsed) onNavTargetUsed();
    }
  }, [navTarget]);

  const dimColors = [C.cyan, C.green, C.yellow, C.orange, C.red];
  const riskLabels = ['保守', '稳健', '平衡', '进取', '激进'];

  return (
    <Page title="网格策略" icon="📊" onRefresh={load} refreshing={loading}>

      {/* 控制面板 */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 10 }}>
          {/* ETF选择 */}
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>选择ETF</div>
            <select value={selected?.code || ''} onChange={e => setSelected(CORE_ETFS.find(x => x.code === e.target.value) || selected)}
              style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg-input)', color: C.text, fontSize: 13, minWidth: 150 }}>
              {CORE_ETFS.map(e => <option key={e.code} value={e.code}>{e.name}</option>)}
            </select>
          </div>
          {/* 资金规模 */}
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>资金规模（元）</div>
            <input type="number" value={capital} onChange={e => setCapital(e.target.value)} placeholder="100000"
              style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg-input)', color: C.text, fontSize: 13, width: 120 }} />
          </div>
          {/* 风险偏好 */}
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>风险偏好</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {RISK_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setRiskLevel(opt.value)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${riskLevel === opt.value ? dimColors[opt.value] : C.border}`, background: riskLevel === opt.value ? dimColors[opt.value] + '22' : 'transparent', color: riskLevel === opt.value ? dimColors[opt.value] : C.muted, fontSize: 12, cursor: 'pointer', fontWeight: riskLevel === opt.value ? 700 : 400 }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {/* 高级参数切换 */}
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${showAdvanced ? C.blue : C.border}`, background: showAdvanced ? `${C.blue}22` : 'transparent', color: showAdvanced ? C.blue : C.muted, fontSize: 12, cursor: 'pointer' }}>
            ⚙️ {showAdvanced ? '收起高级' : '高级参数'}
          </button>
          {/* 开始分析 */}
          <button onClick={load} disabled={loading}
            style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: C.blue, color: '#fff', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            {loading ? '分析中...' : '▶ 生成方案'}
          </button>
        </div>

        {/* 高级参数 */}
        {showAdvanced && (
          <div style={{ display: 'flex', gap: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>自定义波动率（%，留空自动）</div>
              <input type="number" value={customVol} onChange={e => setCustomVol(e.target.value)} placeholder="如 2.5"
                style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg-input)', color: C.text, fontSize: 12, width: 100 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>自定义区间（%，留空自动）</div>
              <input type="number" value={customBand} onChange={e => setCustomBand(e.target.value)} placeholder="如 6.0"
                style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg-input)', color: C.text, fontSize: 12, width: 100 }} />
            </div>
          </div>
        )}
      </div>

      {data && (
        <>
          {/* 核心指标 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: '当前价', value: data.currentPrice, color: C.text, unit: '元' },
              { label: '波动率', value: data.volatility, color: C.yellow },
              { label: '网格数量', value: data.gridCount + '格', color: C.blue },
              { label: '震荡区间', value: data.bandWidth, color: C.orange },
              { label: '预期年化', value: data.backtest?.expectedAnnualReturn || data.backtest?.annualizedReturn, color: C.green },
            ].map(item => (
              <div key={item.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}{item.unit ? <span style={{ fontSize: 10, color: C.muted }}>{item.unit}</span> : null}</div>
              </div>
            ))}
          </div>

          {/* 风险 + 仓位概览 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>仓位计划</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: '总资金', value: (data.capitalPlan?.totalCapital || 0).toLocaleString(), unit: '元', color: C.text },
                  { label: '每格资金', value: (data.capitalPlan?.perGridCapital || 0).toLocaleString(), unit: '元', color: C.cyan },
                  { label: '每格股数', value: data.capitalPlan?.sharesPerGrid, unit: '股', color: C.yellow },
                  { label: '最大仓位', value: data.capitalPlan?.maxOccupancy, color: data.capitalPlan?.maxOccupancy > '80%' ? C.orange : C.green },
                  { label: '底仓资金', value: (data.capitalPlan?.baseLoadCapital || 0).toLocaleString(), unit: '元', color: C.purple },
                  { label: '底仓比例', value: data.capitalPlan?.baseLoadRatio, color: C.purple },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.value}{item.unit ? <span style={{ fontSize: 10, color: C.muted }}>{item.unit}</span> : null}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 回测报告 */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>📈 历史回测（蒙特卡洛模拟）</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                {[
                  { label: '年化收益', value: data.backtest?.annualizedReturn, color: C.green },
                  { label: '最大回撤', value: data.backtest?.maxDrawdown, color: C.red },
                  { label: '策略胜率', value: data.backtest?.winRate, color: C.blue },
                  { label: '盈亏比', value: data.backtest?.profitLossRatio, color: C.yellow },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{item.value || '-'}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.muted, padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 6 }}>
                <span style={{ color: C.yellow }}>📌 优化建议：</span>{data.backtest?.optimization || '参数合理'}
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>{data.backtest?.note}</div>
            </div>
          </div>

          {/* 熔断风控 */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>🛡️ 风控熔断机制</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
              {[
                { label: '止损价', value: data.circuitBreaker?.stopLoss, color: C.red, unit: '元', tip: data.circuitBreaker?.stopLossPct },
                { label: '止盈价', value: data.circuitBreaker?.takeProfit, color: C.green, unit: '元', tip: data.circuitBreaker?.takeProfitPct },
                { label: '熔断上轨', value: data.circuitBreaker?.upper, color: C.orange, unit: '元' },
                { label: '熔断下轨', value: data.circuitBreaker?.lower, color: C.red, unit: '元' },
              ].map(item => (
                <div key={item.label} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: `1px solid ${item.color}33` }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{item.label}{item.tip ? ` (${item.tip})` : ''}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}{item.unit ? <span style={{ fontSize: 10 }}>{item.unit}</span> : null}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ fontSize: 12, color: C.muted, padding: '6px 10px', background: `${C.red}11`, borderRadius: 6, border: `1px solid ${C.red}33` }}>
                <span style={{ color: C.red }}>⛔ 止损规则：</span>{data.rules?.stopLossRule}
              </div>
              <div style={{ fontSize: 12, color: C.muted, padding: '6px 10px', background: `${C.orange}11`, borderRadius: 6, border: `1px solid ${C.orange}33` }}>
                <span style={{ color: C.orange }}>⚡ 熔断规则：</span>{data.rules?.circuitBreakRule}
              </div>
              <div style={{ fontSize: 12, color: C.muted, padding: '6px 10px', background: `${C.green}11`, borderRadius: 6, border: `1px solid ${C.green}33` }}>
                <span style={{ color: C.green }}>📈 加仓规则：</span>{data.rules?.addRule?.substring(0, 40)}...
              </div>
              <div style={{ fontSize: 12, color: C.muted, padding: '6px 10px', background: `${C.yellow}11`, borderRadius: 6, border: `1px solid ${C.yellow}33` }}>
                <span style={{ color: C.yellow }}>📤 减仓规则：</span>{data.rules?.reduceRule?.substring(0, 40)}...
              </div>
            </div>
          </div>

          {/* 完整网格表 */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>📋 完整网格参数表（区间：{data.lowerBoundary} ~ {data.upperBoundary}）</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['格序', '价格', '距现价', '操作', '股数/格', '状态'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'center', color: C.muted, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.grids || []).map(g => {
                    const isBuy = g.action?.includes('买入');
                    const isSell = g.action?.includes('卖出');
                    const isCurrent = g.action?.includes('当前');
                    const rowColor = isCurrent ? C.blue + '33' : isBuy ? C.green + '22' : isSell ? C.red + '22' : 'transparent';
                    const rowBorder = isCurrent ? `${C.blue}66` : isBuy ? `${C.green}44` : isSell ? `${C.red}44` : C.border;
                    return (
                      <tr key={g.level} style={{ borderBottom: `1px solid ${C.border}22`, background: rowColor }}>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: C.muted }}>格{g.level}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: C.text }}>{g.price}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: parseFloat(g.distPct) < 0 ? C.green : parseFloat(g.distPct) > 0 ? C.red : C.muted }}>{g.distPct}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: isBuy ? C.green : isSell ? C.red : isCurrent ? C.blue : C.muted, fontWeight: 600 }}>{g.action}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: C.text }}>{g.position}股</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: 10, color: g.stopTrigger ? C.red : C.muted }}>{g.stopTrigger || (g.occupied ? '✅ 已占位' : '○ 待触发')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 券商条件单 */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>🏦 券商条件单设置指引</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>适用券商：{data.brokerGuide?.app}</div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
              {(data.brokerGuide?.steps || []).map((s, i) => (
                <div key={i} style={{ fontSize: 12, color: C.text, lineHeight: 1.8, fontFamily: 'monospace' }}>{s}</div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              <span style={{ color: C.cyan }}>💾 策略模板：</span>
              <code style={{ background: 'var(--bg-card)', padding: '2px 8px', borderRadius: 4, color: C.yellow, fontSize: 11 }}>{data.brokerGuide?.template}</code>
            </div>
          </div>
        </>
      )}
    </Page>
  );
}

// ─── SVG饼图（资金属性） ───────────────────────────────────
function PieChart({ data }) {
  if (!data) return null;
  const items = [
    { label: '机构', value: data.institution, color: C.blue },
    { label: '量化', value: data.quant, color: C.purple },
    { label: '游资', value: data.youzi, color: C.orange },
    { label: '散户', value: data.retail, color: C.muted },
  ];
  const size = 120;
  const cx = size / 2, cy = size / 2, r = 46;
  let startAngle = -90;
  const total = items.reduce((s, i) => s + i.value, 0);
  const paths = items.map((item, idx) => {
    const angle = (item.value / total) * 360;
    const endAngle = startAngle + angle;
    const toRad = a => a * Math.PI / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));
    const large = angle > 180 ? 1 : 0;
    const d = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`;
    startAngle = endAngle;
    return { ...item, path: d, pct: item.value.toFixed(1) };
  });

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>资金属性拆解</div>
      <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
        {paths.map((p, i) => (
          <path key={i} d={p.path} fill={p.color} stroke="#0a0e17" strokeWidth={1.5} />
        ))}
        <circle cx={cx} cy={cy} r={22} fill={C.card} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fill={C.muted}>属性</text>
      </svg>
      <div style={{ marginTop: 8 }}>
        {paths.map((p, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: C.text, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
              <span>{p.label}</span>
            </div>
            <span style={{ fontWeight: 700, color: p.color }}>{p.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 资金流柱状图 ─────────────────────────────────────────
function FlowBarChart({ history }) {
  if (!history?.length) return null;
  const maxAbs = Math.max(...history.map(h => Math.abs(h.netFlow)));
  const maxVal = maxAbs || 1;
  const heights = history.map(h => ({ ...h, barH: Math.abs(h.netFlow) / maxVal * 60 + 4 }));
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>资金流向趋势</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, paddingBottom: 4 }}>
        {heights.map((h, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ fontSize: 7, color: C.muted }}>{Math.abs(h.netFlow / 100000000).toFixed(1)}亿</div>
            <div style={{ width: '100%', height: h.barH, background: h.netFlow >= 0 ? C.green + '99' : C.red + '99', borderRadius: '2px 2px 0 0', minHeight: 4 }} />
            <div style={{ fontSize: 7, color: C.muted, textAlign: 'center', marginTop: 2 }}>{h.day}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: C.green }}>▲ 净流入</span>
        <span style={{ fontSize: 9, color: C.red }}>▼ 净流出</span>
      </div>
    </div>
  );
}

// ─── 概率条 ───────────────────────────────────────────────
function ProbBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: C.text }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>{value}%</span>
      </div>
      <div style={{ background: '#1a2035', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

export function CapitalPage({ navTarget, onNavTargetUsed }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(CORE_ETFS[0]);
  const [period, setPeriod] = useState(1);

  const load = async () => {
    setLoading(true);
    try { const d = await fetchCapitalData(selected.code, period); setData(d); } catch { setData(null); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [selected, period]);
  useEffect(() => {
    if (navTarget && navTarget.tab === 'capital') {
      const etf = CORE_ETFS.find(e => e.code === navTarget.code);
      if (etf) { setSelected(etf); setPeriod(1); }
      if (onNavTargetUsed) onNavTargetUsed();
    }
  }, [navTarget]);

  const PERIOD_OPTIONS = [
    { value: 1, label: '1日' },
    { value: 3, label: '3日' },
    { value: 5, label: '5日' },
    { value: 10, label: '10日' },
  ];

  const probColors = { up: C.green, mid: C.yellow, dn: C.red };
  const probLabels = { up: '上涨', mid: '震荡', dn: '下跌' };

  return (
    <Page title="资金研判" icon="💰" onRefresh={load} refreshing={loading}>
      {/* 控制面板 */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>选择ETF</div>
            <select value={selected?.code || ''} onChange={e => setSelected(CORE_ETFS.find(x => x.code === e.target.value) || selected)}
              style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg-input)', color: C.text, fontSize: 13, minWidth: 150 }}>
              {CORE_ETFS.map(e => <option key={e.code} value={e.code}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>统计周期</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {PERIOD_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setPeriod(opt.value)}
                  style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${period === opt.value ? C.blue : C.border}`, background: period === opt.value ? `${C.blue}22` : 'transparent', color: period === opt.value ? C.blue : C.muted, fontSize: 12, cursor: 'pointer', fontWeight: period === opt.value ? 700 : 400 }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={load} disabled={loading}
            style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: C.blue, color: '#fff', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            {loading ? '分析中...' : '▶ 开始分析'}
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* 顶部关键指标 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: '资金流向', value: data.netFlowSummary?.totalFormatted, color: data.netFlowSummary?.total > 0 ? C.green : C.red },
              { label: '资金属性', value: data.netFlowSummary?.fund定性, color: data.netFlowSummary?.capitalScore >= 0 ? C.blue : C.orange },
              { label: '持续性', value: data.netFlowSummary?.sustainability, color: data.netFlowSummary?.sustainability?.includes('强') ? C.green : data.netFlowSummary?.sustainability?.includes('中') ? C.yellow : C.red },
              { label: '数据周期', value: data.periodLabel, color: C.cyan },
            ].map(item => (
              <div key={item.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: item.color }}>{item.value || '-'}</div>
              </div>
            ))}
          </div>

          {/* 背离警告 */}
          {data.netFlowSummary?.divergence && (
            <div style={{ padding: '8px 14px', background: `${C.red}15`, border: `1px solid ${C.red}44`, borderRadius: 10, marginBottom: 14, fontSize: 13, color: C.red, fontWeight: 600 }}>
              ⚠️ {data.netFlowSummary.divergence}
            </div>
          )}

          {/* 图表区：饼图 + 柱状图 */}
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, marginBottom: 14 }}>
            <PieChart data={data.fundAttribution} />
            <FlowBarChart history={data.history} />
          </div>

          {/* 北向 + 融资融券 + 申赎 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>🌊 北向资金</div>
              {[
                { label: '今日', value: data.northBound?.today, color: data.northBound?.today >= 0 ? C.green : C.red },
                { label: '近3日', value: data.northBound?.last3Days, color: data.northBound?.last3Days >= 0 ? C.green : C.red },
                { label: '近5日', value: data.northBound?.last5Days, color: data.northBound?.last5Days >= 0 ? C.green : C.red },
                { label: '近10日', value: data.northBound?.last10Days, color: data.northBound?.last10Days >= 0 ? C.green : C.red },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.text, marginBottom: 3 }}>
                  <span style={{ color: C.muted }}>{item.label}</span>
                  <span style={{ fontWeight: 700, color: item.color }}>
                    {item.value > 0 ? '+' : ''}{(item.value / 100000000).toFixed(2)}亿
                  </span>
                </div>
              ))}
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>📊 融资融券</div>
              {[
                { label: '融资余额', value: data.marginData?.marginBalance, color: C.text, unit: '元' },
                { label: '融资余额变化', value: data.marginData?.marginBalanceChg, color: data.marginData?.marginBalanceChg >= 0 ? C.green : C.red, unit: '%' },
                { label: '融券余额', value: data.marginData?.shortBalance, color: C.text, unit: '元' },
                { label: '融券变化', value: data.marginData?.shortBalanceChg, color: data.marginData?.shortBalanceChg >= 0 ? C.green : C.red, unit: '%' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.text, marginBottom: 3 }}>
                  <span style={{ color: C.muted }}>{item.label}</span>
                  <span style={{ fontWeight: 700, color: item.color }}>
                    {item.unit === '%' ? (item.value > 0 ? '+' : '') + item.value + '%' : (item.value / 100000000).toFixed(2) + '亿'}
                  </span>
                </div>
              ))}
              {data.marginData?.marginBalanceChg > 2 && (
                <div style={{ fontSize: 10, color: C.orange, marginTop: 4 }}>⚠️ 融资余额大增，杠杆情绪升温</div>
              )}
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>💱 ETF申赎</div>
              <div style={{ fontSize: 11, color: C.text, marginBottom: 6 }}>
                申赎比：<span style={{ fontWeight: 800, color: parseFloat(data.subscribe?.redemptionRate) > 10 ? C.red : C.green }}>{data.subscribe?.redemptionRate}%</span>
              </div>
              <div style={{ fontSize: 11, color: C.text, marginBottom: 6 }}>
                净流入：<span style={{ fontWeight: 800, color: data.subscribe?.netInflow >= 0 ? C.green : C.red }}>
                  {data.subscribe?.netInflow > 0 ? '+' : ''}{(data.subscribe?.netInflow / 100000000).toFixed(2)}亿
                </span>
              </div>
              <div style={{ fontSize: 11, color: data.subscribe?.inflowLevel === '净申购' ? C.green : C.red, fontWeight: 700 }}>{data.subscribe?.inflowLevel}</div>
              {data.subscribe?.alert && (
                <div style={{ fontSize: 10, color: C.red, marginTop: 4 }}>⚠️ {data.subscribe.alert}</div>
              )}
            </div>
          </div>

          {/* 龙虎榜（3日+才显示） */}
          {data.longHuBang && data.longHuBang.appears && (
            <div style={{ background: `${C.purple}11`, border: `1px solid ${C.purple}44`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.purple, marginBottom: 8 }}>🐯 龙虎榜（{data.periodLabel}）</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ fontSize: 12, color: C.text }}>
                  <span style={{ color: C.muted }}>原因：</span>{data.longHuBang.reason}
                </div>
                <div style={{ fontSize: 12, color: data.longHuBang.netBuy >= 0 ? C.green : C.red }}>
                  <span style={{ color: C.muted }}>龙虎榜净额：</span>{data.longHuBang.netBuy > 0 ? '+' : ''}{(data.longHuBang.netBuy / 100000000).toFixed(2)}亿
                </div>
                <div style={{ fontSize: 12, color: C.text, gridColumn: '1/-1' }}>
                  <span style={{ color: C.muted }}>机构点评：</span>{data.longHuBang.institutionalNotes}
                </div>
              </div>
            </div>
          )}

          {/* 走势预判 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {/* 概率预判 */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>📈 未来走势预判（{data.periodLabel}）</div>
              {[
                { key: 'next1Day', label: 'T+1日', prob: data.prediction?.next1Day?.prob },
                { key: 'next2Day', label: 'T+2日', prob: data.prediction?.next2Day?.prob },
                { key: 'next3Day', label: 'T+3日', prob: data.prediction?.next3Day?.prob },
              ].map(item => (
                <div key={item.key} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}44` }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{item.label}　<span style={{ color: C.cyan, fontSize: 10 }}>置信度{data.prediction?.confidence}%</span></div>
                  <ProbBar label="▲ 上涨" value={item.prob?.up || 0} color={C.green} />
                  <ProbBar label="→ 震荡" value={item.prob?.mid || 0} color={C.yellow} />
                  <ProbBar label="▼ 下跌" value={item.prob?.dn || 0} color={C.red} />
                </div>
              ))}
            </div>

            {/* 触发条件 */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>📋 走势触发条件</div>
              {data.prediction?.next1Day?.trigger && (
                <div>
                  <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 6 }}>▲ 上涨触发</div>
                  {(data.prediction.next1Day.trigger.up || []).map((t, i) => (
                    <div key={i} style={{ fontSize: 11, color: C.text, marginBottom: 3, paddingLeft: 10 }}>· {t}</div>
                  ))}
                  <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginTop: 10, marginBottom: 6 }}>▼ 下跌触发</div>
                  {(data.prediction.next1Day.trigger.dn || []).map((t, i) => (
                    <div key={i} style={{ fontSize: 11, color: C.text, marginBottom: 3, paddingLeft: 10 }}>· {t}</div>
                  ))}
                  <div style={{ fontSize: 11, color: C.yellow, fontWeight: 700, marginTop: 10, marginBottom: 6 }}>→ 震荡条件</div>
                  {(data.prediction.next1Day.trigger.mid || []).map((t, i) => (
                    <div key={i} style={{ fontSize: 11, color: C.text, marginBottom: 3, paddingLeft: 10 }}>· {t}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 操作建议 */}
          <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}44`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 8 }}>💡 操作建议</div>
            <div style={{ fontSize: 15, color: C.text, fontWeight: 600, lineHeight: 1.7 }}>{data.suggestion}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>{data.dataNote}</div>
          </div>
        </>
      )}
    </Page>
  );
}

// ─── 风险雷达图（SVG） ────────────────────────────────────
function RiskRadarChart({ metrics }) {
  if (!metrics) return null;
  const size = 220;
  const cx = size / 2, cy = size / 2;
  const maxR = 85;
  const keys = Object.keys(metrics);
  const colors = { '波动风险': C.yellow, '回撤风险': C.red, '流动性风险': C.cyan, '估值风险': C.orange, '趋势风险': C.purple };

  function toXY(i, value) {
    const angle = (i / keys.length) * 2 * Math.PI - Math.PI / 2;
    const r = (value / 100) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  const values = keys.map((k, i) => ({ key: k, ...toXY(i, metrics[k].score) }));
  const polyPath = values.map((v, i) => (i === 0 ? `M${v.x},${v.y}` : `L${v.x},${v.y}`)).join(' ') + 'Z';

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>五维风险雷达</div>
      <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
        {[20, 40, 60, 80, 100].map(pct => {
          const pts = keys.map((_, i) => toXY(i, pct));
          return <path key={pct} d={pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ') + 'Z'} fill="none" stroke={C.border} strokeWidth={0.5} strokeDasharray="3,3" />;
        })}
        {keys.map((_, i) => {
          const end = toXY(i, 100);
          return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke={C.border} strokeWidth={0.5} />;
        })}
        <path d={polyPath} fill="#ef444422" stroke={C.red} strokeWidth={2} />
        {values.map((v, i) => (
          <circle key={i} cx={v.x} cy={v.y} r={4} fill={colors[v.key] || C.red} stroke="#0a0e17" strokeWidth={1.5} />
        ))}
        {keys.map((k, i) => {
          const outer = toXY(i, 115);
          return (
            <text key={k} x={outer.x} y={outer.y + 4} textAnchor="middle" fontSize={9} fill={C.muted}>
              {k}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── 压力测试柱 ─────────────────────────────────────────
function StressBar({ label, value, color, maxVal }) {
  const pct = Math.abs(value) / maxVal * 100;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: C.text }}>{label}</span>
        <span style={{ fontSize: 11, color, fontWeight: 700 }}>{value > 0 ? '+' : ''}{value.toFixed(4)}</span>
      </div>
      <div style={{ background: '#1a2035', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

export function RiskPage({ navTarget, onNavTargetUsed }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(CORE_ETFS[0]);
  const [riskLevel, setRiskLevel] = useState(1);

  const load = async () => {
    setLoading(true);
    try { const d = await fetchRiskData(selected.code, { riskLevel }); setData(d); } catch { setData(null); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [selected, riskLevel]);
  // 联动跳转
  useEffect(() => {
    if (navTarget && navTarget.tab === 'risk') {
      const etf = CORE_ETFS.find(e => e.code === navTarget.code);
      if (etf) { setSelected(etf); setRiskLevel(1); }
      if (onNavTargetUsed) onNavTargetUsed();
    }
  }, [navTarget]);

  const RISK_OPTIONS = [
    { value: 0, label: '保守', color: C.green },
    { value: 1, label: '稳健', color: C.cyan },
    { value: 2, label: '平衡', color: C.yellow },
    { value: 3, label: '进取', color: C.orange },
    { value: 4, label: '激进', color: C.red },
  ];

  return (
    <Page title="风险测评" icon="🛡️" onRefresh={load} refreshing={loading}>
      {/* 控制面板 */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>选择ETF</div>
            <select value={selected?.code || ''} onChange={e => setSelected(CORE_ETFS.find(x => x.code === e.target.value) || selected)}
              style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg-input)', color: C.text, fontSize: 13, minWidth: 150 }}>
              {CORE_ETFS.map(e => <option key={e.code} value={e.code}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>风险承受等级</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {RISK_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setRiskLevel(opt.value)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${riskLevel === opt.value ? opt.color : C.border}`, background: riskLevel === opt.value ? opt.color + '22' : 'transparent', color: riskLevel === opt.value ? opt.color : C.muted, fontSize: 12, cursor: 'pointer', fontWeight: riskLevel === opt.value ? 700 : 400 }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={load} disabled={loading}
            style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: C.blue, color: '#fff', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            {loading ? '分析中...' : '▶ 开始分析'}
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* 顶部关键指标 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: '风险等级', value: data.riskLevelLabel, color: data.riskLevelLabel === '低风险' ? C.green : data.riskLevelLabel === '中等风险' ? C.yellow : C.red },
              { label: '年化波动', value: data.riskMetrics?.annualVol, color: C.yellow },
              { label: '最大回撤', value: data.riskMetrics?.maxDrawdown, color: C.red },
              { label: '夏普比率', value: data.riskMetrics?.sharpeRatio, color: C.blue },
              { label: '安全仓位', value: data.positionAdvice?.recommended + '%', color: C.green },
            ].map(item => (
              <div key={item.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* 雷达图 + 风险指标 */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, marginBottom: 14 }}>
            <RiskRadarChart metrics={data.radarMetrics} />
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>核心风险指标</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: '日波动率', value: data.riskMetrics?.dailyVol, color: C.yellow },
                  { label: '波动等级', value: data.riskMetrics?.volLevel, color: C.yellow },
                  { label: '最大回撤', value: data.riskMetrics?.maxDrawdown, color: C.red },
                  { label: '回撤等级', value: data.riskMetrics?.maxDrawdownLevel, color: C.red },
                  { label: 'VaR (95%)', value: data.riskMetrics?.var95, color: C.orange },
                  { label: 'CVaR', value: data.riskMetrics?.cvar95, color: C.orange },
                  { label: '夏普比率', value: data.riskMetrics?.sharpeRatio, color: data.riskMetrics?.sharpeRatio > 0.5 ? C.green : C.red },
                  { label: '夏普等级', value: data.riskMetrics?.sharpeLevel, color: data.riskMetrics?.sharpeRatio > 0.5 ? C.green : C.red },
                  { label: 'Beta', value: data.riskMetrics?.beta, color: C.cyan },
                  { label: '沪深300相关', value: data.riskMetrics?.correlation300, color: C.cyan },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value || '-'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 仓位管理 */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>🛡️ 安全仓位管理</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
              {[
                { label: '建议仓位', value: data.positionAdvice?.recommended + '%', color: C.green },
                { label: '保守仓位', value: data.positionAdvice?.conservative + '%', color: C.cyan },
                { label: '进取仓位', value: data.positionAdvice?.aggressive + '%', color: C.orange },
                { label: '仓位上限', value: data.positionAdvice?.maxAllowed + '%', color: C.yellow },
              ].map(item => (
                <div key={item.label} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: `1px solid ${item.color}44` }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ fontSize: 12, color: C.text, padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 8 }}>
                <span style={{ color: C.red }}>⛔ 止损价：</span>{data.positionAdvice?.stopLossPrice}元
                <span style={{ color: C.muted, marginLeft: 8 }}>({data.positionAdvice?.stopLossPct}%)</span>
              </div>
              <div style={{ fontSize: 12, color: C.text, padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 8 }}>
                <span style={{ color: C.yellow }}>📌 移动止损：</span>{data.positionAdvice?.trailingStop}元
                <span style={{ color: C.muted, marginLeft: 8 }}>(回撤{data.positionAdvice?.trailingStopPct}%)</span>
              </div>
            </div>
          </div>

          {/* 动态仓位调整规则 */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>📋 动态仓位调整规则</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(data.positionRules || []).map((rule, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 8, borderLeft: `3px solid ${rule.color}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: C.text, fontWeight: 600, marginBottom: 2 }}>{rule.condition}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{rule.action}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 压力测试 */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>🧪 压力测试（黑天鹅）</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>情景模拟</div>
                {(data.stressTest?.results || []).map((s, i) => (
                  <StressBar key={i} label={s.name}
                    value={s.impact}
                    color={s.shockPct > 0 ? C.green : C.red}
                    maxVal={data.latestPrice * 0.3} />
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>历史极端行情回测</div>
                {(data.stressTest?.histResults || []).map((s, i) => (
                  <StressBar key={i} label={s.name}
                    value={-(data.latestPrice || 1) * s.shockPct / 100}
                    color={s.shockPct < -15 ? C.red : C.orange}
                    maxVal={data.latestPrice * 0.3} />
                ))}
              </div>
            </div>
          </div>

          {/* 极端应对预案 */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>🚨 极端行情应对预案</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { key: 'blackSwan', icon: '💥', title: '单日暴跌', color: C.red },
                { key: 'continuousDrop', icon: '📉', title: '连续阴跌', color: C.orange },
                { key: 'sharpRise', icon: '🚀', title: '突发放量涨', color: C.green },
              ].map(item => {
                const plan = data.emergencyPlans?.[item.key];
                return (
                  <div key={item.key} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 12, border: `1px solid ${item.color}44` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: item.color, marginBottom: 8 }}>{item.icon} {item.title}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>触发条件</div>
                    <div style={{ fontSize: 12, color: C.text, marginBottom: 6 }}>{plan?.scenario}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>应对策略</div>
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{plan?.action}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 操作建议 */}
          <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}44`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 8 }}>💡 风险评估结论</div>
            <div style={{ fontSize: 15, color: C.text, fontWeight: 600, lineHeight: 1.7 }}>{data.suggestion}</div>
          </div>
        </>
      )}
    </Page>
  );
}

export function SelectPage({ navTarget, onNavTargetUsed }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTemplate, setActiveTemplate] = useState('lowValHighDiv');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customFilters, setCustomFilters] = useState({});

  const TEMPLATES = [
    { id: 'lowValHighDiv', name: '低估高股息', icon: '🏆', color: C.green, desc: '低PE+高分红，安全边际' },
    { id: 'highGrowth', name: '高景气成长', icon: '🚀', color: C.purple, desc: '高增速赛道，进攻性强' },
    { id: 'broadEnhanced', name: '宽基增强', icon: '🛡️', color: C.blue, desc: '宽基为核心，均衡配置' },
    { id: 'lowVolStable', name: '低波动稳健', icon: '⚖️', color: C.cyan, desc: '低波动，低回撤' },
  ];

  const ADVANCED_FILTERS = [
    { key: 'peMax', label: 'PE上限', min: 5, max: 100, step: 5, default: 50, unit: '' },
    { key: 'roeMin', label: 'ROE下限', min: 1, max: 30, step: 1, default: 8, unit: '%' },
    { key: 'dividendYieldMin', label: '股息率下限', min: 0, max: 6, step: 0.5, default: 1.0, unit: '%' },
    { key: 'pbMax', label: 'PB上限', min: 0.5, max: 10, step: 0.5, default: 6, unit: '' },
    { key: 'yoyGrowthMin', label: '净利润增速下限', min: -30, max: 50, step: 5, default: -20, unit: '%' },
    { key: 'volMax', label: '波动率上限', min: 0.005, max: 0.06, step: 0.005, default: 0.05, unit: '' },
    { key: 'debtRatioMax', label: '资产负债率上限', min: 30, max: 95, step: 5, default: 90, unit: '%' },
  ];

  const run = async (templateId) => {
    setLoading(true);
    setError(null);
    try {
      const template = templateId || activeTemplate;
      const filters = Object.keys(customFilters).length > 0 ? customFilters : undefined;
      const data = await fetchEtfScreen({ template, filters });
      setResult(data);
      if (templateId) setActiveTemplate(templateId);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  // 默认加载
  useEffect(() => { run('lowValHighDiv'); }, []);

  const fmt = (v, decimals = 2) => v != null ? (typeof v === 'number' ? v.toFixed(decimals) : v) : '-';
  const colorVal = (v, posGood = true) => v != null ? (parseFloat(v) >= 0 === posGood ? C.green : C.red) : C.muted;

  return (
    <Page title="标的筛选" icon="🔍" onRefresh={() => run()} refreshing={loading}>

      {/* 策略模板选择 */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>🎯 策略模板</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
          {TEMPLATES.map(t => (
            <button key={t.id}
              onClick={() => run(t.id)}
              style={{ padding: '10px 8px', borderRadius: 10, border: `2px solid ${activeTemplate === t.id ? t.color : C.border}`, background: activeTemplate === t.id ? t.color + '22' : 'transparent', color: activeTemplate === t.id ? t.color : C.muted, fontSize: 12, cursor: 'pointer', textAlign: 'center', fontWeight: activeTemplate === t.id ? 700 : 400 }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>{t.name}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>{t.desc}</div>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${showAdvanced ? C.blue : C.border}`, background: showAdvanced ? `${C.blue}22` : 'transparent', color: showAdvanced ? C.blue : C.muted, fontSize: 12, cursor: 'pointer' }}>
            ⚙️ {showAdvanced ? '收起自定义' : '自定义筛选'}
          </button>
          <button onClick={() => { setCustomFilters({}); run(); }}
            style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
            🔄 重置
          </button>
          <button onClick={() => window.print()}
            style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
            📥 导出报告
          </button>
        </div>
      </div>

      {/* 自定义筛选面板 */}
      {showAdvanced && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>⚙️ 自定义筛选因子</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
            {ADVANCED_FILTERS.map(f => {
              const val = customFilters[f.key] !== undefined ? customFilters[f.key] : f.default;
              return (
                <div key={f.key}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{f.label}{f.unit ? ` (${f.unit})` : ''}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <input type="range" min={f.min} max={f.max} step={f.step} value={val}
                      onChange={e => setCustomFilters({ ...customFilters, [f.key]: parseFloat(e.target.value) })}
                      style={{ flex: 1, accentColor: C.blue }} />
                    <span style={{ fontSize: 12, color: C.blue, fontWeight: 700, minWidth: 36, textAlign: 'right' }}>
                      {f.step < 1 ? parseFloat(val).toFixed(2) : val}{f.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={() => run(activeTemplate)} disabled={loading}
            style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: C.blue, color: '#fff', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
            {loading ? '筛选中...' : '▶ 按自定义条件筛选'}
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div style={{ padding: 12, background: `${C.red}15`, border: `1px solid ${C.red}44`, borderRadius: 10, color: C.red, fontSize: 13, marginBottom: 14 }}>
          ⚠ {error}
        </div>
      )}

      {result && (
        <>
          {/* 结果概览 */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                  ✅ <span style={{ color: C.green, fontSize: 16 }}>{result.total}</span> 只ETF符合
                </span>
                <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 8px', borderRadius: 10, background: `${result.template?.color || C.blue}22`, color: result.template?.color || C.blue, fontWeight: 600 }}>
                  {result.template?.icon} {result.template?.name}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>{result.note}</div>
            </div>
            <div style={{ fontSize: 12, color: C.muted, padding: '6px 10px', background: 'var(--bg-card)', borderRadius: 6, marginBottom: 0 }}>
              条件：{result.conditions || result.query || '-'}
            </div>
          </div>

          {/* 完整结果表 */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    {['优先级', '代码', '名称', '综合评分', 'PE', 'PB', 'ROE', '股息率', '净利润增速', '波动率', '1月', '3月', '6月', '1年'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', background: 'var(--border)', color: C.muted, fontSize: 10, textAlign: 'center', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.items.map(item => (
                    <tr key={item.code} style={{ borderBottom: `1px solid ${C.border}33` }}>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        {item.priority <= 3
                          ? <span style={{ padding: '2px 6px', borderRadius: 10, background: item.priority === 1 ? `${C.yellow}` + '33' : item.priority === 2 ? `${C.muted}` + '22' : `${C.orange}` + '22', color: item.priority === 1 ? C.yellow : item.priority === 2 ? C.muted : C.orange, fontWeight: 900, fontSize: 11 }}>第{item.priority}</span>
                          : <span style={{ color: C.muted, fontSize: 11 }}>#{item.priority}</span>}
                      </td>
                      <td style={{ padding: '6px 8px', color: C.cyan, fontFamily: 'monospace', fontSize: 11 }}>{item.code}</td>
                      <td style={{ padding: '6px 8px', color: C.text, fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 900, color: item.score >= 60 ? C.green : item.score >= 40 ? C.yellow : C.red, fontSize: 13 }}>{fmt(item.score, 1)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: item.pe < 0 ? C.red : item.pe > 50 ? C.orange : C.text }}>{fmt(item.pe)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: item.pb > 5 ? C.orange : C.text }}>{fmt(item.pb)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: item.roe >= 15 ? C.green : item.roe >= 8 ? C.text : C.red }}>{fmt(item.roe)}%</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: item.dividendYield >= 3 ? C.green : item.dividendYield >= 1.5 ? C.yellow : C.muted, fontWeight: item.dividendYield >= 3 ? 700 : 400 }}>{fmt(item.dividendYield)}%</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: item.yoyGrowth >= 20 ? C.green : item.yoyGrowth >= 0 ? C.text : C.red }}>{fmt(item.yoyGrowth)}%</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: item.vol < 0.02 ? C.green : item.vol < 0.03 ? C.yellow : C.red }}>{(item.vol * 100).toFixed(1)}%</td>
                      {[item.histPerf?.['1月'], item.histPerf?.['3月'], item.histPerf?.['6月'], item.histPerf?.['1年']].map((p, i) => (
                        <td key={i} style={{ padding: '6px 4px', textAlign: 'center', fontSize: 10, color: p >= 0 ? C.green : C.red, fontWeight: 600 }}>
                          {p != null ? (p >= 0 ? '+' : '') + p.toFixed(1) + '%' : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 组合构建建议 */}
          {result.suggestion && (
            <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}44`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 10 }}>💼 组合构建建议</div>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.8 }}>{result.suggestion}</div>
            </div>
          )}

          {/* 操作区 */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(result.items || []).slice(0, 5).map(item => (
              <button key={item.code}
                onClick={() => window.location.href = `/?code=${item.code}&tab=chan`}
                style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.blue}44`, background: `${C.blue}15`, color: C.blue, fontSize: 12, cursor: 'pointer' }}>
                📈 {item.name} → 缠论分析
              </button>
            ))}
          </div>
        </>
      )}

      {!result && !loading && !error && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center', color: C.muted }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 14, marginBottom: 6 }}>选择策略模板开始筛选ETF</div>
          <div style={{ fontSize: 12 }}>支持自定义筛选因子 + 四大策略模板</div>
        </div>
      )}
    </Page>
  );
}

export function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState(null);
  const [cfg, setCfg] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fin-h5-cfg')) || {}; } catch { return {}; }
  });

  const save = () => {
    localStorage.setItem('fin-h5-cfg', JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(d => setHealth(d.data)).catch(() => setHealth(null));
  }, []);

  const cardStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 14 };
  const labelStyle = { fontSize: 12, color: C.muted, marginBottom: 6, display: 'block' };
  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg-input)', color: C.text, fontSize: 13, boxSizing: 'border-box' };
  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}33` };

  return (
    <Page title="系统设置" icon="⚙️">
      {/* API 状态 */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.text }}>🔌 API 服务状态</div>
        <div style={row}>
          <span style={{ color: C.muted, fontSize: 12 }}>后端服务</span>
          <span style={{ color: C.green, fontSize: 12 }}>{health ? '✅ 运行中' : '❌ 未连接'}</span>
        </div>
        <div style={row}>
          <span style={{ color: C.muted, fontSize: 12 }}>MX_APIKEY</span>
          <span style={{ color: health?.mxApiKeySet ? C.green : C.red, fontSize: 12 }}>{health?.mxApiKeySet ? '✅ 已配置' : '❌ 未配置'}</span>
        </div>
        <div style={row}>
          <span style={{ color: C.muted, fontSize: 12 }}>mx-data 技能</span>
          <span style={{ color: health?.mxDataSkill === 'found' ? C.green : C.red, fontSize: 12 }}>
            {health?.mxDataSkill === 'found' ? '✅ 已安装' : health?.mxDataSkill === 'missing' ? '❌ 未找到' : '⏳ 检查中'}
          </span>
        </div>
        <div style={{ ...row, borderBottom: 'none' }}>
          <span style={{ color: C.muted, fontSize: 12 }}>系统时间</span>
          <span style={{ color: C.muted, fontSize: 12, fontFamily: 'monospace' }}>{health?.timestamp ? new Date(health.timestamp).toLocaleString('zh-CN') : '-'}</span>
        </div>
      </div>

      {/* 基础设置 */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.text }}>⚙️ 基础设置</div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>默认 ETF 标的</label>
          <select value={cfg.defaultEtf || '515880'} onChange={e => setCfg({ ...cfg, defaultEtf: e.target.value })} style={inputStyle}>
            {CORE_ETFS.map(e => <option key={e.code} value={e.code}>{e.name} ({e.code})</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>默认分析周期</label>
          <select value={cfg.defaultCycle || '日线'} onChange={e => setCfg({ ...cfg, defaultCycle: e.target.value })} style={inputStyle}>
            {['日线', '60分钟', '30分钟', '周线'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>风险偏好等级</label>
          <select value={cfg.riskLevel || 1} onChange={e => setCfg({ ...cfg, riskLevel: parseInt(e.target.value) })} style={inputStyle}>
            <option value={0}>保守（低波动）</option>
            <option value={1}>稳健（平衡）</option>
            <option value={2}>进取（高波动）</option>
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>行情刷新间隔（交易时段，秒）</label>
          <input type="number" value={cfg.refreshInterval || 60} min={10} max={300}
            onChange={e => setCfg({ ...cfg, refreshInterval: parseInt(e.target.value) })} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>预警检查间隔（分钟）</label>
          <input type="number" value={cfg.alertInterval || 30} min={5} max={1440}
            onChange={e => setCfg({ ...cfg, alertInterval: parseInt(e.target.value) })} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: C.text, fontSize: 13 }}>自动刷新行情</span>
          <button onClick={() => setCfg({ ...cfg, autoRefresh: !cfg.autoRefresh })}
            style={{ padding: '5px 14px', borderRadius: 20, border: 'none', background: cfg.autoRefresh ? C.green : C.gray, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
            {cfg.autoRefresh ? '✅ 开' : '❌ 关'}
          </button>
        </div>
      </div>

      {/* 通知设置 */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.text }}>🔔 预警通知</div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>PushPlus 推送令牌（可选）</label>
          <input type="text" placeholder="填写 PushPlus 令牌用于微信推送" value={cfg.pushPlusToken || ''}
            onChange={e => setCfg({ ...cfg, pushPlusToken: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: C.text, fontSize: 13 }}>短信预警通知</span>
          <button onClick={() => setCfg({ ...cfg, smsAlert: !cfg.smsAlert })}
            style={{ padding: '5px 14px', borderRadius: 20, border: 'none', background: cfg.smsAlert ? C.green : C.gray, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
            {cfg.smsAlert ? '✅ 开' : '❌ 关'}
          </button>
        </div>
      </div>

      {/* 缓存管理 */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.text }}>💾 缓存管理</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { localStorage.removeItem('fin-h5-cache'); alert('行情缓存已清理'); }}
            style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.yellow}44`, background: `${C.yellow}15`, color: C.yellow, fontSize: 12, cursor: 'pointer' }}>
            🗑 清理行情缓存
          </button>
          <button onClick={() => { localStorage.removeItem('fin-h5-cfg'); setCfg({}); alert('设置已重置'); }}
            style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.red}44`, background: `${C.red}15`, color: C.red, fontSize: 12, cursor: 'pointer' }}>
            🔄 重置所有设置
          </button>
        </div>
      </div>

      {/* 关于 */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: C.text }}>🦞 ETF分析网站</div>
        <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.8 }}>
          版本 1.0 · 缠论 + 景气度 + 网格策略<br />
          数据来源：东方财富 · 仅供投资辅助参考
        </div>
      </div>

      <button onClick={save} style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: C.blue, color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>
        {saved ? '✅ 设置已保存' : '💾 保存全部设置'}
      </button>
    </Page>
  );
}
