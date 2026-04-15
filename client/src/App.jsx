import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import Layout from './components/Layout.jsx';
import HomePage from './components/HomePage.jsx';
import Portfolio from './components/Portfolio.jsx';
import Alerts from './components/Alerts.jsx';
import { SentimentPage, GridPage, CapitalPage, RiskPage, SelectPage, SettingsPage } from './components/Page.jsx';
import { CORE_ETFS } from './constants.js';
import { fetchChanAnalysis } from './api/index.js';

// CSS 变量主题色（UI用）；K线图画布用硬编码深色
// C用于JSX文字/边框颜色（支持CSS变量）；CHART_系用于canvas/拼色场景
const C = {
  bg: 'var(--bg)', card: 'var(--bg-card)', border: 'var(--border)',
  green: 'var(--up)', red: 'var(--down)', yellow: '#eab308',
  blue: 'var(--primary)', purple: 'var(--primary)', cyan: 'var(--primary)',
  gray: 'var(--text-muted)', text: 'var(--text)', muted: 'var(--text-muted)',
};
// 涨跌色（带透明度的拼色用，CSS变量无法与hex直接拼接）
const UP_HEX = '#22c55e', DOWN_HEX = '#ef4444', GREEN_HEX = '#22c55e', RED_HEX = '#ef4444', PURPLE_HEX = '#a855f7', CYAN_HEX = '#06b6d4';

// ─── 星级组件 ────────────────────────────────────────────────
function StarRating({ level }) {
  return <span style={{ color: C.yellow, letterSpacing: 1 }}>{'★'.repeat(level)}{'☆'.repeat(Math.max(0, 5 - level))}</span>;
}

// ─── K线图表 ────────────────────────────────────────────────
function KLineChart({ data, buypoints, sellpoints, support, resistance }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !data?.length) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#0a0e17' }, textColor: '#9ca3af', fontSize: 11 },
      grid: { vertLines: { color: '#1a2035' }, horzLines: { color: '#1a2035' } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#6b7280', width: 1, style: 2, labelBackground: '#374151' }, horzLine: { color: '#6b7280', width: 1, style: 2, labelBackground: '#374151' } },
      rightPriceScale: { borderColor: '#1f2937', scaleMargins: { top: 0.1, bottom: 0.25 } },
      timeScale: { borderColor: '#1f2937', timeVisible: true, secondsVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    });
    chartRef.current = chart;

    // K线颜色用硬编码（canvas无法解析CSS变量）
    const UP = '#22c55e', DOWN = '#ef4444', PURPLE = '#a855f7', CYAN = '#06b6d4';
    const cs = chart.addCandlestickSeries({
      upColor: UP, downColor: DOWN, borderUpColor: UP, borderDownColor: DOWN, wickUpColor: UP, wickDownColor: DOWN,
    });
    cs.setData(data.map(d => ({ time: d.date, open: d.open, high: d.high, low: d.low, close: d.close })));

    const vol = chart.addHistogramSeries({ color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: '' });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    vol.setData(data.map(d => ({ time: d.date, color: d.close >= d.open ? `${UP}66` : `${DOWN}66`, value: d.vol })));

    support?.forEach(s => cs.createPriceLine({ price: s.price, color: `${CYAN}66`, lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: ` 支撑 ${s.price.toFixed(2)}` }));
    resistance?.forEach(r => cs.createPriceLine({ price: r.price, color: `${PURPLE}66`, lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: ` 压力 ${r.price.toFixed(2)}` }));
    buypoints?.forEach(p => { const k = data.find(x => x.index === p.index); if (k) cs.createPriceLine({ price: k.low * 0.995, color: UP, lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: ` ${p.label}★${p.level}` }); });
    sellpoints?.forEach(p => { const k = data.find(x => x.index === p.index); if (k) cs.createPriceLine({ price: k.high * 1.005, color: DOWN, lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: ` ${p.label}★${p.level}` }); });

    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => { if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight }); });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, [data, buypoints, sellpoints, support, resistance]);

  return <div ref={containerRef} style={{ width: '100%', height: 360 }} />;
}

// ─── 报告导出 ──────────────────────────────────────────────
function exportReport(data, code, cycle) {
  if (!data) return;
  const now = new Date().toLocaleString('zh-CN');
  const buyPoints = (data.buypoints || []).map(p => `  ${p.label}：${p.price?.toFixed(3)} 元（★${p.level}）`).join('\n');
  const sellPoints = (data.sellpoints || []).map(p => `  ${p.label}：${p.price?.toFixed(3)} 元（★${p.level}）`).join('\n');
  const support = (data.support || []).map(s => `  ${s.label}`).join('\n');
  const resistance = (data.resistance || []).map(r => `  ${r.label}`).join('\n');
  const forecasts = (data.forecasts || []).map(f => `  【${f.type}】概率${f.prob}：${f.desc}\n    操作：${f.action}`).join('\n');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>缠论分析报告-${code}</title>
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
<h1>📈 缠论结构分析报告</h1>
<div class="mono">标的：${code} | 周期：${cycle} | 生成时间：${now}</div>

<h2>一、走势结构定性</h2>
<div class="grid">
  <div class="card"><div class="label">当前走势</div><div class="blue" style="font-size:15px;font-weight:700">${data.structure?.定性 || '分析中'}</div></div>
  <div class="card"><div class="label">操作建议</div><div style="font-size:14px">${data.advice?.操作建议 || '-'}</div></div>
</div>
${data.structure?.最新中枢 ? `<div class="card" style="margin-top:8px"><div class="label">中枢区间</div><div class="mono">上沿：${data.structure.最新中枢.high?.toFixed(3)} | 下沿：${data.structure.最新中枢.low?.toFixed(3)}</div></div>` : ''}

<h2>二、买卖点</h2>
<div class="grid">
  <div class="card"><div class="label green">✅ 买点</div>${buyPoints || '<div style="color:#6b7280">暂无</div>'}</div>
  <div class="card"><div class="label red">❌ 卖点</div>${sellPoints || '<div style="color:#6b7280">暂无</div>'}</div>
</div>

<h2>三、支撑压力位</h2>
<div class="grid">
  <div class="card"><div class="label">支撑位（cyan）</div>${support || '<div style="color:#6b7280">暂无</div>'}</div>
  <div class="card"><div class="label">压力位（purple）</div>${resistance || '<div style="color:#6b7280">暂无</div>'}</div>
</div>

<h2>四、走势分类与应对</h2>
<div style="font-size:13px;line-height:1.8">${forecasts || '暂无数据'}</div>

<h2>五、缠论统计</h2>
<div class="mono">原始K线 ${data.meta?.totalKlines} 根 → 处理包含后 ${data.meta?.mergedKlines} 根 → ${data.meta?.biCount} 笔 / ${data.meta?.xianduanCount} 线段 / ${data.meta?.zhongshuCount} 中枢</div>
<div style="margin-top:24px;font-size:11px;color:#6b7280;text-align:center">由 🦞 金融内网 H5 自动生成 | 东方财富数据驱动</div>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.print(); w.close(); }, 500);
}

// ─── 缠论分析页 ─────────────────────────────────────────────
function ChanTab({ searchTarget, onSearchUsed, onAlertSetup }) {
  const [cycles] = useState(['日线', '60分钟', '30分钟', '周线']);
  const [selected, setSelected] = useState(CORE_ETFS.find(e => e.code === '515880') || CORE_ETFS[0]);
  const [cycle, setCycle] = useState('日线');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);

  const analyze = useCallback(async (code, cy) => {
    setLoading(true);
    try { const d = await fetchChanAnalysis(code, cy); setData(d); } catch { setData(null); }
    setLoading(false);
  }, [cycle]);

  // 页面默认加载 515880 日线
  useEffect(() => { analyze(selected.code, cycle); }, []);

  // 搜索跳转
  useEffect(() => {
    if (searchTarget) {
      const etf = CORE_ETFS.find(e => e.code === searchTarget) || CORE_ETFS.find(e => e.code === '515880') || CORE_ETFS[0];
      setSelected(etf);
      analyze(etf.code, cycle);
      onSearchUsed?.();
    }
  }, [searchTarget]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>📈 缠论分析</div>
        <button onClick={() => analyze(selected.code, cycle)} disabled={loading}
          style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          🔄 {loading ? '分析中...' : '刷新'}
        </button>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>选择ETF标的</div>
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
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>分析周期</div>
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
          style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: loading ? 'var(--up)' : 'var(--up)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? '分析中...' : `分析 ${selected.name}（${selected.code}）`}
        </button>
        {/* 拓展按钮 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={() => exportReport(data, selected.code, cycle)}
            style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            📥 导出报告
          </button>
          <button onClick={() => { setShowAlertModal(true); }}
            style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            🔔 预警设置
          </button>
        </div>
      </div>

      {data && (
        <>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', height: 360, marginBottom: 10 }}>
            <KLineChart data={data.klineData} buypoints={data.buypoints} sellpoints={data.sellpoints} support={data.support} resistance={data.resistance} />
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>结构定性</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{data.structure?.定性}</div>
              {data.structure?.最新中枢 && <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 3 }}>中枢 [{data.structure.最新中枢.low.toFixed(3)}, {data.structure.最新中枢.high.toFixed(3)}]</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ padding: 8, background: 'rgba(34,197,94,0.08)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.25)' }}>
                <div style={{ fontSize: 11, color: 'var(--up)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>买点</div>
                {data.buypoints?.length ? data.buypoints.map((p, i) => <div key={i} style={{ fontSize: 13, color: 'var(--up)' }}>{p.label} {p.price?.toFixed(3)} <StarRating level={p.level} /></div>) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无</div>}
              </div>
              <div style={{ padding: 8, background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)' }}>
                <div style={{ fontSize: 11, color: 'var(--down)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>卖点</div>
                {data.sellpoints?.length ? data.sellpoints.map((p, i) => <div key={i} style={{ fontSize: 13, color: 'var(--down)' }}>{p.label} {p.price?.toFixed(3)} <StarRating level={p.level} /></div>) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无</div>}
              </div>
            </div>
            <div style={{ padding: '8px 10px', background: 'var(--primary-bg)', borderRadius: 8, border: '1px solid var(--primary)', marginBottom: 12, opacity: 0.85 }}>
              <div style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>操作建议</div>
              <div style={{ fontSize: 13, color: C.text }}>{data.advice?.操作建议}</div>
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>
              {data.support?.slice(0, 2).map(s => s.label).join(' · ') || '无支撑'} | {data.resistance?.slice(0, 2).map(r => r.label).join(' · ') || '无压力'} | K线{data.meta?.totalKlines}根→{data.meta?.mergedKlines}处理→{data.meta?.biCount}笔/{data.meta?.zhongshuCount}中枢
            </div>
          </div>

          {/* 走势分类 */}
          {data.forecasts?.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>走势分类与应对预案</div>
              {data.forecasts.map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < data.forecasts.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginRight: 8 }}>{f.type}</span>
                    <span style={{ fontSize: 11, color: f.prob === '高' ? 'var(--up)' : f.prob === '低' ? 'var(--down)' : '#eab308' }}>概率{f.prob}</span>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{f.desc}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--primary)', whiteSpace: 'nowrap', marginLeft: 12 }}>{f.action}</div>
                </div>
              ))}
            </div>
          )}

          {/* 预警弹窗 */}
          {showAlertModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowAlertModal(false)}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, boxShadow: 'var(--shadow)' }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>🔔 买卖点预警设置</div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>标的</div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{selected.name} ({selected.code})</div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>预警类型</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { key: 'yi_buy', label: '一买提醒', isUp: true, price: data.buypoints?.find(p => p.type === 'yi_buy')?.price },
                      { key: 'er_buy', label: '二买提醒', isUp: true, price: data.buypoints?.find(p => p.type === 'er_buy')?.price },
                      { key: 'san_buy', label: '三买提醒', isUp: true, price: data.buypoints?.find(p => p.type === 'san_buy')?.price },
                      { key: 'yi_sell', label: '一卖提醒', isUp: false, price: data.sellpoints?.find(p => p.type === 'yi_sell')?.price },
                    ].map(item => (
                      <button key={item.key}
                        onClick={() => { window.open(`/alerts?code=${selected.code}&type=${item.key}&price=${item.price || ''}`, '_self'); setShowAlertModal(false); }}
                        disabled={!item.price}
                        style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${item.isUp ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`, background: `${item.isUp ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'}`, color: item.price ? (item.isUp ? 'var(--up)' : 'var(--down)') : 'var(--text-muted)', fontSize: 13, cursor: item.price ? 'pointer' : 'not-allowed', textAlign: 'left', display: 'flex', justifyContent: 'space-between', opacity: item.price ? 1 : 0.5 }}>
                        <span>{item.label}</span>
                        <span>{item.price ? `价格≈${item.price.toFixed(3)}` : '暂无此买点'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => setShowAlertModal(false)} style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
                  关闭
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
  // 从 URL 读取初始 tab（支持书签/直接链接）
  const getInitialTab = () => {
    try {
      const s = window.location.search;
      if (!s) return 'home';
      const m = s.match(/[?&]tab=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : 'home';
    } catch { return 'home'; }
  };
  const [tab, setTab] = useState(getInitialTab);
  const [alertCount, setAlertCount] = useState(0);
  const [searchTarget, setSearchTarget] = useState(null); // { code }
  const [navTarget, setNavTarget] = useState(null); // { code, tab } - 模块联动跳转

  const handleSearch = (code) => {
    setSearchTarget(code);
    setTab('chan');
  };

  // 持仓模块 → 跳转其他分析页面
  const handleNavigate = (code, targetTab) => {
    setSearchTarget(code);
    setNavTarget({ code, tab: targetTab });
    setTab(targetTab);
  };

  return (
    <Layout activeTab={tab} onTabChange={setTab} alertCount={alertCount} onSearch={handleSearch}>
      {tab === 'home' && <HomePage />}
      {tab === 'chan' && <ChanTab searchTarget={searchTarget} onSearchUsed={() => setSearchTarget(null)} />}
      {tab === 'sentiment' && <SentimentPage navTarget={navTarget} onNavTargetUsed={() => setNavTarget(null)} />}
      {tab === 'grid' && <GridPage navTarget={navTarget} onNavTargetUsed={() => setNavTarget(null)} />}
      {tab === 'capital' && <CapitalPage navTarget={navTarget} onNavTargetUsed={() => setNavTarget(null)} />}
      {tab === 'risk' && <RiskPage navTarget={navTarget} onNavTargetUsed={() => setNavTarget(null)} />}
      {tab === 'select' && <SelectPage />}
      {tab === 'portfolio' && <Portfolio onNavigate={handleNavigate} />}
      {tab === 'alerts' && <Alerts />}
      {tab === 'settings' && <SettingsPage />}
    </Layout>
  );
}
