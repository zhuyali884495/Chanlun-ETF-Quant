import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import Layout from './components/Layout.jsx';
import HomePage from './components/HomePage.jsx';
import Portfolio from './components/Portfolio.jsx';
import Alerts from './components/Alerts.jsx';
import { SentimentPage, GridPage, CapitalPage, RiskPage, SelectPage, SettingsPage } from './components/Page.jsx';
import StockAnalysis from './components/StockAnalysis.jsx';
import StockSelect from './components/StockSelect.jsx';
import { CORE_ETFS } from './constants.js';
import { fetchChanAnalysis } from './api/index.js';

const C = {
  bg: 'var(--bg)', card: 'var(--bg-card)', border: 'var(--border)',
  green: 'var(--up)', red: 'var(--down)', yellow: '#eab308',
  blue: 'var(--primary)', purple: 'var(--primary)', cyan: 'var(--primary)',
  gray: 'var(--text-muted)', text: 'var(--text)', muted: 'var(--text-muted)',
};
const UP_HEX = '#22c55e', DOWN_HEX = '#ef4444', PURPLE_HEX = '#a855f7', CYAN_HEX = '#06b6d4', MACD_HEX = '#3b82f6';

// ─── 星级组件 ────────────────────────────────────────────────
function StarRating({ level }) {
  return <span style={{ color: C.yellow, letterSpacing: 1 }}>{'\u2605'.repeat(level)}{'\u2606'.repeat(Math.max(0, 5 - level))}</span>;
}

// ─── 技术指标计算 ─────────────────────────────────────────────
function calcEMA(data, period) {
  const k = 2 / (period + 1);
  const result = [];
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period - 1; i++) result.push(null);
  result.push(ema);
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcMACD(closes) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const dif = ema12.map((v, i) => (v != null && ema26[i] != null ? v - ema26[i] : null));
  const dea = calcEMA(dif.filter(v => v != null), 9);
  // 对齐dea到dif的长度
  const deaAligned = [];
  let deaIdx = 0;
  for (let i = 0; i < dif.length; i++) {
    if (dif[i] === null) { deaAligned.push(null); }
    else { deaAligned.push(dea[deaIdx++] ?? null); }
  }
  return { dif, dea: deaAligned, macd: dif.map((v, i) => v != null && deaAligned[i] != null ? (v - deaAligned[i]) * 2 : null) };
}

function calcRSI(closes, period = 14) {
  const gains = [], losses = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  const result = [null];
  let avgGain = null, avgLoss = null;
  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    if (i === period - 1) {
      avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }
    const rs = avgLoss === 0 ? 999 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

// ─── K线图表（主图 + MACD副图 + RSI副图）──────────────────────
function KLineChart({ data, buypoints, sellpoints, support, resistance }) {
  const containerRef = useRef(null);
  const macdRef = useRef(null);
  const rsiRef = useRef(null);
  const chartRef = useRef(null);
  const macdChartRef = useRef(null);
  const rsiChartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !data?.length) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    if (macdChartRef.current) { macdChartRef.current.remove(); macdChartRef.current = null; }
    if (rsiChartRef.current) { rsiChartRef.current.remove(); rsiChartRef.current = null; }

    const chartOptions = {
      layout: { background: { color: '#0a0e17' }, textColor: '#9ca3af', fontSize: 11 },
      grid: { vertLines: { color: '#1a2035' }, horzLines: { color: '#1a2035' } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#6b7280', width: 1, style: 2, labelBackground: '#374151' }, horzLine: { color: '#6b7280', width: 1, style: 2, labelBackground: '#374151' } },
      rightPriceScale: { borderColor: '#1f2937', scaleMargins: { top: 0.1, bottom: 0.25 } },
      timeScale: { borderColor: '#1f2937', timeVisible: true, secondsVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    };

    // 主图：K线（降低高度给副图留空间）
    const chart = createChart(containerRef.current, { ...chartOptions, width: containerRef.current.clientWidth, height: 260 });
    chartRef.current = chart;
    const UP = UP_HEX, DOWN = DOWN_HEX;
    const cs = chart.addCandlestickSeries({ upColor: UP, downColor: DOWN, borderUpColor: UP, borderDownColor: DOWN, wickUpColor: UP, wickDownColor: DOWN });
    cs.setData(data.map(d => ({ time: d.date, open: d.open, high: d.high, low: d.low, close: d.close })));
    const vol = chart.addHistogramSeries({ color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: '' });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    vol.setData(data.map(d => ({ time: d.date, color: d.close >= d.open ? `${UP}66` : `${DOWN}66`, value: d.vol })));
    support?.forEach(s => cs.createPriceLine({ price: s.price, color: `${CYAN_HEX}66`, lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: ` 支撑 ${s.price.toFixed(2)}` }));
    resistance?.forEach(r => cs.createPriceLine({ price: r.price, color: `${PURPLE_HEX}66`, lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: ` 压力 ${r.price.toFixed(2)}` }));
    buypoints?.forEach(p => { const k = data.find(x => x.index === p.index); if (k) cs.createPriceLine({ price: k.low * 0.995, color: UP, lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: ` ${p.label}\u2605${p.level}` }); });
    sellpoints?.forEach(p => { const k = data.find(x => x.index === p.index); if (k) cs.createPriceLine({ price: k.high * 1.005, color: DOWN, lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: ` ${p.label}\u2605${p.level}` }); });
    chart.timeScale().fitContent();

    // MACD 副图
    const closes = data.map(d => d.close);
    const { dif, dea, macd } = calcMACD(closes);
    const macdData = data.map((d, i) => ({ time: d.date, value: macd[i] ?? 0, color: (macd[i] ?? 0) >= 0 ? `${UP_HEX}99` : `${DOWN_HEX}99` }));
    const difData = data.map((d, i) => ({ time: d.date, value: dif[i] ?? 0 })).filter(d => d.value !== null);
    const deaData = data.map((d, i) => ({ time: d.date, value: dea[i] ?? 0 })).filter(d => d.value !== null);

    const macdChart = createChart(macdRef.current, {
      layout: { background: { color: '#0a0e17' }, textColor: '#9ca3af', fontSize: 10 },
      grid: { vertLines: { color: '#1a2035' }, horzLines: { color: '#1a2035' } },
      rightPriceScale: { borderColor: '#1f2937' },
      timeScale: { borderColor: '#1f2937', timeVisible: true, secondsVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
      width: macdRef.current.clientWidth, height: 90,
    });
    macdChartRef.current = macdChart;
    const macdSeries = macdChart.addHistogramSeries({ priceFormat: { type: 'price', precision: 4, minMove: 0.0001 } });
    macdSeries.setData(macdData);
    const difSeries = macdChart.addLineSeries({ color: MACD_HEX, lineWidth: 1, priceLineVisible: false });
    difSeries.setData(difData);
    const deaSeries = macdChart.addLineSeries({ color: '#eab308', lineWidth: 1, priceLineVisible: false });
    deaSeries.setData(deaData);
    macdChart.timeScale().fitContent();
    // 同步时间轴
    chart.timeScale().subscribeVisibleLogicalRangeChange(range => { if (range) { macdChart.timeScale().setVisibleLogicalRange(range); rsiChart.timeScale().setVisibleLogicalRange(range); } });
    macdChart.timeScale().subscribeVisibleLogicalRangeChange(range => { if (range) chart.timeScale().setVisibleLogicalRange(range); });

    // RSI 副图
    const rsiData = calcRSI(closes);
    const rsiSeriesData = data.map((d, i) => ({ time: d.date, value: rsiData[i] ?? 50 })).filter(d => d.value !== null);
    const rsiChart = createChart(rsiRef.current, {
      layout: { background: { color: '#0a0e17' }, textColor: '#9ca3af', fontSize: 10 },
      grid: { vertLines: { color: '#1a2035' }, horzLines: { color: '#1a2035' } },
      rightPriceScale: { borderColor: '#1f2937', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: '#1f2937', timeVisible: true, secondsVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
      width: rsiRef.current.clientWidth, height: 70,
    });
    rsiChartRef.current = rsiChart;
    const rsiLine = rsiChart.addLineSeries({ color: PURPLE_HEX, lineWidth: 1, priceLineVisible: false });
    rsiLine.setData(rsiSeriesData);
    // 添加RSI超买超卖线
    [70, 50, 30].forEach(level => {
      rsiChart.addLineSeries({ color: level === 50 ? '#4b5563' : (level === 70 ? DOWN_HEX : UP_HEX), lineWidth: 1, lineStyle: 2, priceLineVisible: false })
        .setData(rsiSeriesData.map(d => ({ time: d.time, value: level })));
    });
    rsiChart.timeScale().fitContent();

    // 共用 ResizeObserver
    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
      if (macdRef.current) macdChart.applyOptions({ width: macdRef.current.clientWidth });
      if (rsiRef.current) rsiChart.applyOptions({ width: rsiRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove(); macdChart.remove(); rsiChart.remove();
      chartRef.current = null; macdChartRef.current = null; rsiChartRef.current = null;
    };
  }, [data, buypoints, sellpoints, support, resistance]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 8px', background: '#0d1117', borderTop: '1px solid #1a2035' }}>
        <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace' }}>MACD(12,26,9)</span>
        <span style={{ fontSize: 9, color: MACD_HEX }}>— DIF</span>
        <span style={{ fontSize: 9, color: '#eab308' }}>— DEA</span>
        <span style={{ marginLeft: 8, fontSize: 10, color: '#6b7280', fontFamily: 'monospace' }}>RSI(14)</span>
        <span style={{ fontSize: 9, color: PURPLE_HEX }}>— RSI</span>
        <span style={{ fontSize: 9, color: DOWN_HEX }}>— 超买 70</span>
        <span style={{ fontSize: 9, color: UP_HEX }}>— 超卖 30</span>
      </div>
      <div ref={macdRef} style={{ height: 90, borderTop: '1px solid #1a2035' }} />
      <div ref={rsiRef} style={{ height: 70, borderTop: '1px solid #1a2035' }} />
    </div>
  );
}

// ─── 报告导出 ──────────────────────────────────────────────
function exportReport(data, code, cycle) {
  if (!data) return;
  const now = new Date().toLocaleString('zh-CN');
  const buyPoints = (data.buypoints || []).map(p => `  ${p.label}：${p.price?.toFixed(3)} 元（\u2605${p.level}）`).join('\n');
  const sellPoints = (data.sellpoints || []).map(p => `  ${p.label}：${p.price?.toFixed(3)} 元（\u2605${p.level}）`).join('\n');
  const support = (data.support || []).map(s => `  ${s.label}`).join('\n');
  const resistance = (data.resistance || []).map(r => `  ${r.label}`).join('\n');
  const forecasts = (data.forecasts || []).map(f => `  【${f.type}】概率${f.prob}：${f.desc}\n    操作：${f.action}`).join('\n');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>\u7f69\u8bba\u5206\u6790\u62a5\u544a-${code}</title>
<style>
  body{font-family:'PingFang SC',sans-serif;background:#0a0e17;color:#e8e8e8;padding:32px;max-width:800px;margin:0 auto}
  h1{color:#3b82f6;font-size:22px;border-bottom:1px solid #1f2937;padding-bottom:12px}
  h2{color:#22c55e;font-size:15px;margin-top:24px}
  .label{color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:12px 0 6px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:8px 0}
  .card{background:#111827;border:1px solid #1f2937;border-radius:10px;padding:14px}
  .green{color:#22c55e}.red{color:#ef4444}.yellow{color:#eab308}.blue{color:#3b82f6}
  .mono{font-family:monospace;font-size:13px;color:#9ca3af}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  td,th{padding:8px 12px;border:1px solid #1f2937;text-align:left;font-size:13px}
  th{background:#1f2937;color:#9ca3af;text-transform:uppercase;font-size:11px}
  @media print{body{background:#fff;color:#000} .card{background:#f9f9f9;border-color:#ccc} }
</style></head><body>
<h1>\ud83d\udcc8 \u7f69\u8bba\u7ed3\u6784\u5206\u6790\u62a5\u544a</h1>
<div class="mono">\u6807\u7684\uff1a${code} | \u5468\u671f\uff1a${cycle} | \u751f\u6210\u65f6\u95f4\uff1a${now}</div>

<h2>\u4e00\u3001\u8d8b\u52bf\u7ed3\u6784\u5b9a\u6027</h2>
<div class="grid">
  <div class="card"><div class="label">\u5f53\u524d\u8d8b\u52bf</div><div class="blue" style="font-size:15px;font-weight:700">${data.structure?.定性 || '\u5206\u6790\u4e2d'}</div></div>
  <div class="card"><div class="label">\u64cd\u4f5c\u5efa\u8bae</div><div style="font-size:14px">${data.advice?.操作建议 || '-'}</div></div>
</div>
${data.structure?.最新中枢 ? `<div class="card" style="margin-top:8px"><div class="label">\u4e2d\u67f1\u533a\u95f4</div><div class="mono">\u4e0a\u65eb\uff1a${data.structure.最新中枢.high?.toFixed(3)} | \u4e0b\u65eb\uff1a${data.structure.最新中枢.low?.toFixed(3)}</div></div>` : ''}

<h2>\u4e8c\u3001\u4e70\u5356\u70b9</h2>
<div class="grid">
  <div class="card"><div class="label green">\u2705 \u4e70\u70b9</div>${buyPoints || '<div style="color:#6b7280">\u6682\u65e0</div>'}</div>
  <div class="card"><div class="label red">\u274c \u5356\u70b9</div>${sellPoints || '<div style="color:#6b7280">\u6682\u65e0</div>'}</div>
</div>

<h2>\u4e09\u3001\u652f\u6491\u538b\u529b\u4f4d</h2>
<div class="grid">
  <div class="card"><div class="label">\u652f\u6491\u4f4d\uff08cyan\uff09</div>${support || '<div style="color:#6b7280">\u6682\u65e0</div>'}</div>
  <div class="card"><div class="label">\u538b\u529b\u4f4d\uff08purple\uff09</div>${resistance || '<div style="color:#6b7280">\u6682\u65e0</div>'}</div>
</div>

<h2>\u56db\u3001\u8d8b\u52bf\u5206\u7c7b\u4e0e\u5e94\u5bf9</h2>
<div style="font-size:13px;line-height:1.8">${forecasts || '\u6682\u65e0\u6570\u636e'}</div>

<h2>\u4e94\u3001\u7f69\u8bba\u7edf\u8ba1</h2>
<div class="mono">\u539f\u59cbK\u7ebf ${data.meta?.totalKlines} \u6839 \u2192 \u5904\u7406\u5305\u542b\u540e ${data.meta?.mergedKlines} \u6839 \u2192 ${data.meta?.biCount}\u7b14 / ${data.meta?.xianduanCount}\u7ebf\u6bb5 / ${data.meta?.zhongshuCount}\u4e2d\u67f1</div>
<div style="margin-top:24px;font-size:11px;color:#6b7280;text-align:center">\u7531 \ud83e\udde1 \u91d1\u878d\u5185\u7f51 H5 \u81ea\u52a8\u751f\u6210 | \u4e1c\u65b9\u8d22\u5bcc\u6570\u636e\u9a71\u52a8</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.print(); w.close(); }, 500);
}

// ─── 缠论分析页 ─────────────────────────────────────────────
function ChanTab({ searchTarget, onSearchUsed }) {
  const [cycles] = useState(['\u65e5\u7ebf', '60\u5206\u949f', '30\u5206\u949f', '\u5468\u7ebf']);
  const [selected, setSelected] = useState(CORE_ETFS.find(e => e.code === '515880') || CORE_ETFS[0]);
  const [cycle, setCycle] = useState('\u65e5\u7ebf');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);

  const analyze = useCallback(async (code, cy) => {
    setLoading(true);
    try { const d = await fetchChanAnalysis(code, cy); setData(d); } catch { setData(null); }
    setLoading(false);
  }, [cycle]);

  useEffect(() => { analyze(selected.code, cycle); }, []);

  useEffect(() => {
    if (searchTarget) {
      const etf = CORE_ETFS.find(e => e.code === searchTarget);
      if (etf) { setSelected(etf); analyze(etf.code, cycle); }
      else { const code = searchTarget.toUpperCase(); setSelected({ code, name: code }); analyze(code, cycle); }
      onSearchUsed?.();
    }
  }, [searchTarget]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>\ud83d\udcc8 \u7f69\u8bba\u5206\u6790</div>
        <button onClick={() => analyze(selected.code, cycle)} disabled={loading}
          style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          \ud83d\udd04 {loading ? '\u5206\u6790\u4e2d...' : '\u5237\u65b0'}
        </button>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>\u9009\u62e9ETF\u6807\u7684</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CORE_ETFS.map(e => (
              <button key={e.code} onClick={() => setSelected(e)}
                style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${selected.code === e.code ? 'var(--primary)' : 'var(--border)'}`, background: selected.code === e.code ? 'var(--primary-bg)' : 'transparent', color: selected.code === e.code ? 'var(--primary)' : 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                {e.name}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>\u5206\u6790\u5468\u671f</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {cycles.map(c => (
              <button key={c} onClick={() => setCycle(c)}
                style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${cycle === c ? 'var(--primary)' : 'var(--border)'}`, background: cycle === c ? 'var(--primary-bg)' : 'transparent', color: cycle === c ? 'var(--primary)' : 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => analyze(selected.code, cycle)} disabled={loading}
          style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'var(--up)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? '\u5206\u6790\u4e2d...' : `\u5206\u6790 ${selected.name}\uff08${selected.code}\uff09`}
        </button>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={() => exportReport(data, selected.code, cycle)}
            style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            \ud83d\udce5 \u5bfc\u51fa\u62a5\u544a
          </button>
          <button onClick={() => { setShowAlertModal(true); }}
            style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            \ud83d\udd14 \u9884\u8b66\u8bbe\u7f6e
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* K线+MACD+RSI总容器 */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', height: 440, marginBottom: 10 }}>
            <KLineChart data={data.klineData} buypoints={data.buypoints} sellpoints={data.sellpoints} support={data.support} resistance={data.resistance} />
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>\u7ed3\u6784\u5b9a\u6027</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{data.structure?.定性}</div>
              {data.structure?.最新中枢 && <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 3 }}>\u4e2d\u67f1 [{data.structure.最新中枢.low.toFixed(3)}, {data.structure.最新中枢.high.toFixed(3)}]</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ padding: 8, background: 'rgba(34,197,94,0.08)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.25)' }}>
                <div style={{ fontSize: 11, color: 'var(--up)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>\u4e70\u70b9</div>
                {data.buypoints?.length ? data.buypoints.map((p, i) => <div key={i} style={{ fontSize: 13, color: 'var(--up)' }}>{p.label} {p.price?.toFixed(3)} <StarRating level={p.level} /></div>) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>\u6682\u65e0</div>}
              </div>
              <div style={{ padding: 8, background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)' }}>
                <div style={{ fontSize: 11, color: 'var(--down)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>\u5356\u70b9</div>
                {data.sellpoints?.length ? data.sellpoints.map((p, i) => <div key={i} style={{ fontSize: 13, color: 'var(--down)' }}>{p.label} {p.price?.toFixed(3)} <StarRating level={p.level} /></div>) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>\u6682\u65e0</div>}
              </div>
            </div>
            <div style={{ padding: '8px 10px', background: 'var(--primary-bg)', borderRadius: 8, border: '1px solid var(--primary)', marginBottom: 12, opacity: 0.85 }}>
              <div style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>\u64cd\u4f5c\u5efa\u8bae</div>
              <div style={{ fontSize: 13, color: C.text }}>{data.advice?.操作建议}</div>
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>
              {data.support?.slice(0, 2).map(s => s.label).join(' \u00b7 ') || '\u65e0\u652f\u6491'} | {data.resistance?.slice(0, 2).map(r => r.label).join(' \u00b7 ') || '\u65e0\u538b\u529b'} | K\u7ebf{data.meta?.totalKlines}\u6839\u2192{data.meta?.mergedKlines}\u5904\u7406\u2192{data.meta?.biCount}\u7b14/{data.meta?.zhongshuCount}\u4e2d\u67f1
            </div>
          </div>

          {data.forecasts?.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>\u8d8b\u52bf\u5206\u7c7b\u4e0e\u5e94\u5bf9\u9884\u6848</div>
              {data.forecasts.map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < data.forecasts.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginRight: 8 }}>{f.type}</span>
                    <span style={{ fontSize: 11, color: f.prob === '\u9ad8' ? 'var(--up)' : f.prob === '\u4f4e' ? 'var(--down)' : '#eab308' }}>\u6982\u7387{f.prob}</span>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{f.desc}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--primary)', whiteSpace: 'nowrap', marginLeft: 12 }}>{f.action}</div>
                </div>
              ))}
            </div>
          )}

          {showAlertModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowAlertModal(false)}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>\ud83d\udd14 \u4e70\u5356\u70b9\u9884\u8b66\u8bbe\u7f6e</div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>\u6807\u7684</div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{selected.name} ({selected.code})</div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>\u9884\u8b66\u7c7b\u578b</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { key: 'yi_buy', label: '\u4e00\u4e70\u63d0\u9192', isUp: true, price: data.buypoints?.find(p => p.type === 'yi_buy')?.price },
                      { key: 'er_buy', label: '\u4e8c\u4e70\u63d0\u9192', isUp: true, price: data.buypoints?.find(p => p.type === 'er_buy')?.price },
                      { key: 'san_buy', label: '\u4e09\u4e70\u63d0\u9192', isUp: true, price: data.buypoints?.find(p => p.type === 'san_buy')?.price },
                      { key: 'yi_sell', label: '\u4e00\u5356\u63d0\u9192', isUp: false, price: data.sellpoints?.find(p => p.type === 'yi_sell')?.price },
                    ].map(item => (
                      <button key={item.key}
                        onClick={() => { window.open(`/alerts?code=${selected.code}&type=${item.key}&price=${item.price || ''}`, '_self'); setShowAlertModal(false); }}
                        disabled={!item.price}
                        style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${item.isUp ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`, background: `${item.isUp ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'}`, color: item.price ? (item.isUp ? 'var(--up)' : 'var(--down)') : 'var(--text-muted)', fontSize: 13, cursor: item.price ? 'pointer' : 'not-allowed', textAlign: 'left', display: 'flex', justifyContent: 'space-between', opacity: item.price ? 1 : 0.5 }}>
                        <span>{item.label}</span>
                        <span>{item.price ? `\u4ef7\u683c\u2248${item.price.toFixed(3)}` : '\u6682\u65e0\u6b64\u4e70\u70b9'}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => setShowAlertModal(false)} style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
                  \u5173\u95ed
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── 主应用 ────────────────────────────────────────────────
export default function App() {
  const getInitialTab = () => {
    try {
      const s = window.location.search;
      if (!s) return 'home';
      const params = new URLSearchParams(s);
      return params.get('tab') || 'home';
    } catch { return 'home'; }
  };

  const [tab, setTab] = useState(getInitialTab);
  const [searchTarget, setSearchTarget] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t) setTab(t);
    const code = params.get('code');
    if (code) setSearchTarget(code);
  }, []);

  const handleSearch = useCallback((code) => {
    setSearchTarget(code);
    setTab('chan');
  }, []);

  const handleSearchUsed = useCallback(() => { setSearchTarget(null); }, []);

  const switchTab = (t) => {
    setTab(t);
    const url = new URL(window.location);
    url.searchParams.set('tab', t);
    window.history.replaceState({}, '', url);
  };

  const NAV = [
    { key: 'home', label: '\u9996\u9875', icon: '\ud83c\udfe0' },
    { key: 'chan', label: '\u7f69\u8bba', icon: '\ud83d\udcc8' },
    { key: 'select', label: '\u9009\u80a1', icon: '\ud83c\udfaf' },
    { key: 'portfolio', label: '\u6301\u4ed3', icon: '\ud83d\udcb0' },
    { key: 'alerts', label: '\u9884\u8b66', icon: '\ud83d\udd14' },
    { key: 'settings', label: '\u8bbe\u7f6e', icon: '\u2699\ufe0f' },
  ];

  const CONTENT = {
    home: <HomePage onSearch={handleSearch} />,
    chan: <ChanTab searchTarget={searchTarget} onSearchUsed={handleSearchUsed} />,
    select: <StockSelect onSelectETF={code => { setSearchTarget(code); switchTab('chan'); }} />,
    portfolio: <Portfolio />,
    alerts: <Alerts />,
    settings: <SettingsPage />,
  };

  return (
    <Layout>
      {CONTENT[tab]}
    </Layout>
  );
}
