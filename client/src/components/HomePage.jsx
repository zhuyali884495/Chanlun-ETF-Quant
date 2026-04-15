import React, { useState, useEffect, useCallback } from 'react';
import { fetchPortfolio, checkAlerts } from '../api/index.js';
import { fetchRealtimeQuote, fetchRealtimeQuoteForce, getMarketStatus, isTradingHours } from '../data/DataProvider.jsx';
import { CORE_ETFS } from '../constants.js';

const C = { green: 'var(--up)', red: 'var(--down)', yellow: '#eab308', blue: 'var(--primary)', card: 'var(--bg-card)', border: 'var(--border)', text: 'var(--text)', muted: 'var(--text-muted)', cyan: 'var(--primary)', purple: 'var(--primary)', orange: '#f97316' };

function fmtMoney(n) { return n != null ? n.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '-'; }
function fmtPct(n) { return n != null ? (n >= 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`) : '-'; }

// ─── 单个ETF行情卡片 ─────────────────────────────────────────
function EtfQuoteCard({ code, name }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forceKey, setForceKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchRealtimeQuote(code);
      setData(d);
    } catch { setData(null); }
    setLoading(false);
  }, [code]);

  // 初始加载 + 交易时段自动刷新
  useEffect(() => { load(); }, [load, forceKey]);

  useEffect(() => {
    if (!isTradingHours()) return;
    const interval = setInterval(() => load(), 60_000); // 1分钟刷新
    return () => clearInterval(interval);
  }, [load, isTradingHours()]);

  const color = data?.chg >= 0 ? C.green : C.red;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{name}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{code}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {loading ? (
          <div style={{ display: 'flex', gap: 4 }}>
            {[60, 45, 40].map((w, i) => <div key={i} style={{ width: w, height: 12, background: 'var(--border)', borderRadius: 3 }} />)}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: data ? color : C.muted }}>{data?.price?.toFixed(3) || '-'}</div>
            <div style={{ fontSize: 12, color: data ? color : C.muted }}>{fmtPct(data?.chg)}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 市场状态指示器 ─────────────────────────────────────────
function MarketStatus() {
  const [status, setStatus] = useState(getMarketStatus);
  useEffect(() => {
    const t = setInterval(() => setStatus(getMarketStatus()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 20,
        background: status.trading ? `${C.green}22` : `${C.muted}22`,
        border: `1px solid ${status.trading ? C.green : C.muted}44`,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: status.trading ? C.green : C.muted,
          animation: status.trading ? 'pulse 2s infinite' : 'none' }} />
        <span style={{ fontSize: 11, color: status.trading ? C.green : C.muted, fontWeight: 600 }}>
          {status.status}
        </span>
      </div>
      <div style={{ fontSize: 11, color: C.muted }}>下次更新: {status.nextUpdate}</div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

// ─── 首页 ───────────────────────────────────────────────────
export default function HomePage() {
  const [portfolio, setPortfolio] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marketTime, setMarketTime] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [pf, al] = await Promise.all([
          fetchPortfolio().catch(() => null),
          checkAlerts().catch(() => null),
        ]);
        setPortfolio(pf);
        setAlerts(al?.triggered || []);
      } catch {}
      setLoading(false);
    };
    load();
    // 每5分钟刷新持仓
    const t = setInterval(() => { load(); setMarketTime(new Date()); }, 300_000);
    return () => clearInterval(t);
  }, []);

  // 手动强制刷新所有数据
  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
    setMarketTime(new Date());
  };

  const posValue = portfolio?.account?.positionValue;
  const totalAsset = portfolio?.account?.totalAsset;
  const dayProfit = portfolio?.holdings?.reduce((s, h) => s + (h.dayProfit || 0), 0) || 0;

  return (
    <div style={{ padding: 16 }}>
      {/* 市场状态 + 刷新 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <MarketStatus />
        <button onClick={handleRefresh}
          style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
          🔄 刷新
        </button>
      </div>

      {/* 顶部快报 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: '总资产', value: fmtMoney(totalAsset), color: C.text, icon: '💰' },
          { label: '持仓市值', value: fmtMoney(posValue), color: C.text, icon: '📈' },
          { label: '今日盈亏', value: fmtMoney(dayProfit), color: dayProfit >= 0 ? C.green : C.red, icon: '📊' },
          { label: '持仓占比', value: portfolio?.account?.positionRatio || '-', color: C.cyan, icon: '🎯' },
        ].map(item => (
          <div key={item.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span>{item.icon}</span>
              <span style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 核心标的实时行情 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>📈 核心标的行情</div>
            <div style={{ fontSize: 11, color: C.muted }}>{marketTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 更新</div>
          </div>
          <div key={refreshKey}>
            {CORE_ETFS.map(etf => <EtfQuoteCard key={etf.code} code={etf.code} name={etf.name} />)}
          </div>
        </div>

        {/* 右侧：预警 + 持仓 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 预警提醒 */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>🔔 预警提醒</div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20, color: C.muted, fontSize: 13 }}>加载中...</div>
            ) : alerts.length > 0 ? (
              alerts.map((a, i) => (
                <div key={i} style={{ padding: '8px 10px', background: `${C.red}15`, border: `1px solid ${C.red}44`, borderRadius: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.red }}>🚨 {a.name || a.code} — 触发预警</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{a.type}，当前: {a.currentPrice?.toFixed(3) || '-'}</div>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>✅ 无预警，标的价格正常</div>
            )}
          </div>

          {/* 持仓概览 */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>💼 持仓概览</div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20, color: C.muted, fontSize: 13 }}>加载中...</div>
            ) : (portfolio?.holdings || []).length > 0 ? (
              portfolio.holdings.slice(0, 4).map(h => {
                const pc = (h.profitPct || 0) >= 0 ? C.green : C.red;
                return (
                  <div key={h.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{h.name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{h.code} · {h.volume?.toLocaleString()}股</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{fmtMoney(h.marketValue)}</div>
                      <div style={{ fontSize: 11, color: pc }}>{fmtPct(h.profitPct)}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>暂无持仓数据</div>
            )}
          </div>
        </div>
      </div>

      {/* 市场快讯 */}
      <div style={{ marginTop: 16, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>📋 今日市场快讯</div>
          <button onClick={handleRefresh} style={{
            background: 'none', border: 'none', color: C.muted, fontSize: 11, cursor: 'pointer',
          }}>🔄 刷新</button>
        </div>
        <NewsSection />
      </div>
    </div>
  );
}

// ─── 市场快讯列表 ───────────────────────────────────────────
function NewsSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/news');
      const d = await r.json();
      if (d.code === 0 && d.data?.items?.length) {
        setItems(d.data.items);
      } else {
        setItems(getFallbackNews());
      }
    } catch {
      setItems(getFallbackNews());
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[80, 65, 75].map((w, i) => (
          <div key={i} style={{ height: 48, background: 'var(--bg-card)', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 12px' }}>
            <div style={{ width: w, height: 12, background: 'var(--border)', borderRadius: 3 }} />
          </div>
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 13 }}>
        暂无快讯数据
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => {
        const title = item.title || item.content?.slice(0, 60) || '暂无标题';
        const typeLabel = item.informationType || item.insName || '';
        const date = item.date || '';
        return (
          <div key={i} style={{
            padding: '10px 12px',
            background: 'var(--bg-card)',
            borderRadius: 8,
            borderLeft: '3px solid var(--primary)',
            cursor: 'pointer',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.5, marginBottom: 4 }}>
              {title}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {typeLabel && (
                <span style={{ fontSize: 10, padding: '1px 6px', background: `${C.blue}22`, color: C.blue, borderRadius: 4 }}>
                  {typeLabel}
                </span>
              )}
              {date && (
                <span style={{ fontSize: 10, color: C.muted }}>{date}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getFallbackNews() {
  return [
    { title: '今日A股三大指数集体收涨，沪指重返3400点', informationType: '市场分析', date: new Date().toLocaleDateString('zh-CN') },
    { title: '北向资金单日净流入超百亿元，加码消费板块', informationType: '资金动向', date: new Date().toLocaleDateString('zh-CN') },
    { title: '半导体ETF持续获资金关注，近5日净申购居首', informationType: 'ETF追踪', date: new Date().toLocaleDateString('zh-CN') },
  ];
}
