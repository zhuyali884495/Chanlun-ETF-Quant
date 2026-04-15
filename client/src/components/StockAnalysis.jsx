import React, { useState, useEffect, useCallback } from 'react';
import { fetchRealtimeQuote } from '../data/DataProvider.jsx';
import { fetchChanAnalysis, fetchSentimentData, fetchGridData, fetchCapitalData, fetchRiskData } from '../api/index.js';

const C = {
  green: 'var(--up)', red: 'var(--down)', yellow: '#eab308',
  blue: 'var(--primary)', purple: 'var(--primary)', cyan: 'var(--primary)',
  card: 'var(--bg-card)', border: 'var(--border)',
  text: 'var(--text)', muted: 'var(--text-muted)',
  orange: '#f97316',
};

function fmtPct(n) { return n != null ? (n >= 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`) : '-'; }
function fmtMoney(n) { return n != null ? n.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '-'; }

// ─── 模块1：基础行情 ─────────────────────────────────────────
function QuoteCard({ code, name }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchRealtimeQuote(code).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [code]);

  if (loading) return <ModuleCard title="📊 基础行情" loading />;
  if (!data) return <ModuleCard title="📊 基础行情" error="数据加载失败" />;

  const color = data.chg >= 0 ? C.green : C.red;
  return (
    <ModuleCard title="📊 基础行情">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>最新价</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: color }}>{data.price?.toFixed(3) || '-'}</div>
          <div style={{ fontSize: 13, color: color }}>{fmtPct(data.chg)}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>成交量</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{(data.volume / 10000).toFixed(1)}万</div>
          <div style={{ fontSize: 12, color: C.muted }}>手</div>
        </div>
        <div style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>成交额</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{(data.amount / 100000000).toFixed(2)}亿</div>
          <div style={{ fontSize: 12, color: C.muted }}>元</div>
        </div>
        <div style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>今开</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{data.open?.toFixed(3) || '-'}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>最高</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.green }}>{data.high?.toFixed(3) || '-'}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>最低</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.red }}>{data.low?.toFixed(3) || '-'}</div>
        </div>
      </div>
    </ModuleCard>
  );
}

// ─── 模块2：缠论分析 ─────────────────────────────────────────
function ChanCard({ code }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    setLoading(true);
    fetchChanAnalysis(code).then(d => { setData(d); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
  }, [code]);

  if (loading) return <ModuleCard title="📈 缠论分析" loading />;
  if (error) return <ModuleCard title="📈 缠论分析" error={error} />;
  if (!data?.structure) return <ModuleCard title="📈 缠论分析" error="暂无数据" />;

  const s = data.structure;
  const color = s.direction === '上涨' ? C.green : C.red;
  return (
    <ModuleCard title="📈 缠论分析">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted }}>走势结构</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: color }}>{s.description || s.structure || '-'}</div>
        </div>
        <div style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted }}>中枢区间</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.cyan }}>{s.keyLevel || '-'}</div>
        </div>
        <div style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted }}>笔数/中枢</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{data.klineCount || '-'}</div>
        </div>
        <div style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted }}>操作建议</div>
          <div style={{ fontSize: 12, color: C.text }}>{s.action || '-'}</div>
        </div>
      </div>
      {/* 买卖点 */}
      {data.buyPoints?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>买点信号</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {data.buyPoints.map((bp, i) => (
              <span key={i} style={{ padding: '3px 8px', background: `${C.green}22`, border: `1px solid ${C.green}66`, borderRadius: 20, fontSize: 11, color: C.green }}>
                {bp.signal} {bp.price}
              </span>
            ))}
          </div>
        </div>
      )}
      {data.sellPoints?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>卖点信号</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {data.sellPoints.map((sp, i) => (
              <span key={i} style={{ padding: '3px 8px', background: `${C.red}22`, border: `1px solid ${C.red}66`, borderRadius: 20, fontSize: 11, color: C.red }}>
                {sp.signal} {sp.price}
              </span>
            ))}
          </div>
        </div>
      )}
    </ModuleCard>
  );
}

// ─── 模块3：景气度打分 ────────────────────────────────────────
function SentimentCard({ code }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchSentimentData(code).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [code]);

  if (loading) return <ModuleCard title="🌡️ 景气度打分" loading />;
  if (!data) return <ModuleCard title="🌡️ 景气度打分" error="暂无数据" />;

  const score = data.score || data.overall || 50;
  const level = data.level || '中性';
  const levelColor = score >= 70 ? C.green : score >= 50 ? C.yellow : C.red;

  return (
    <ModuleCard title="🌡️ 景气度打分">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        <div style={{ position: 'relative', width: 80, height: 80 }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border)" strokeWidth="6" />
            <circle cx="40" cy="40" r="32" fill="none" stroke={levelColor} strokeWidth="6"
              strokeDasharray={`${(score / 100) * 201.06} 201.06`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: levelColor }}>{score}</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: levelColor, marginBottom: 4 }}>{level}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{data.trend || data.summary || '-'}</div>
        </div>
      </div>
      {/* 五维度 */}
      {data.dimensions && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {Object.entries(data.dimensions).slice(0, 6).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--bg)', borderRadius: 6, fontSize: 12 }}>
              <span style={{ color: C.muted }}>{k}</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{typeof v === 'object' ? v.score : v}</span>
            </div>
          ))}
        </div>
      )}
    </ModuleCard>
  );
}

// ─── 模块4：资金研判 ─────────────────────────────────────────
function CapitalCard({ code }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchCapitalData(code).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [code]);

  if (loading) return <ModuleCard title="💰 资金研判" loading />;
  if (!data) return <ModuleCard title="💰 资金研判" error="暂无数据" />;

  const netInflow = data.netInflow || data.mainNetInflow || 0;
  const color = netInflow >= 0 ? C.green : C.red;

  return (
    <ModuleCard title="💰 资金研判">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>主力净流入</div>
          <div style={{ fontSize: 15, fontWeight: 700, color }}>{netInflow >= 0 ? '+' : ''}{(netInflow / 100000000).toFixed(2)}亿</div>
        </div>
        <div style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>超大单净流入</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: data.bigNetInflow >= 0 ? C.green : C.red }}>{(data.bigNetInflow / 100000000).toFixed(2)}亿</div>
        </div>
        <div style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>大单净流入</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: data.largeNetInflow >= 0 ? C.green : C.red }}>{(data.largeNetInflow / 100000000).toFixed(2)}亿</div>
        </div>
      </div>
      {data.summary && <div style={{ fontSize: 12, color: C.muted, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6 }}>{data.summary}</div>}
    </ModuleCard>
  );
}

// ─── 模块5：网格策略 ─────────────────────────────────────────
function GridCard({ code }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchGridData(code).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [code]);

  if (loading) return <ModuleCard title="📊 网格策略" loading />;
  if (!data) return <ModuleCard title="📊 网格策略" error="暂无数据" />;

  const levels = data.levels || data.gridLevels || [];
  const price = data.currentPrice || data.referencePrice || 0;

  return (
    <ModuleCard title="📊 网格策略">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted }}>基准价</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{price.toFixed(3)}</div>
        </div>
        <div style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted }}>网格间距</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.cyan }}>{data.gridSpacing || data.spacing || '-'}%</div>
        </div>
        <div style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted }}>层数</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{levels.length || data.levelsCount || '-'}</div>
        </div>
        <div style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted }}>策略评级</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.yellow }}>{data.rating || data.assessment || '-'}</div>
        </div>
      </div>
      {levels.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>网格买卖点</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {levels.map((lv, i) => (
              <span key={i} style={{
                padding: '2px 7px', borderRadius: 4, fontSize: 11,
                background: lv.type === '买入' ? `${C.green}22` : `${C.red}22`,
                color: lv.type === '买入' ? C.green : C.red,
                border: `1px solid ${lv.type === '买入' ? C.green : C.red}44`
              }}>
                {lv.price} {lv.type}
              </span>
            ))}
          </div>
        </div>
      )}
    </ModuleCard>
  );
}

// ─── 模块6：风险测评 ─────────────────────────────────────────
function RiskCard({ code }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchRiskData(code).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [code]);

  if (loading) return <ModuleCard title="🛡️ 风险测评" loading />;
  if (!data) return <ModuleCard title="🛡️ 风险测评" error="暂无数据" />;

  const level = data.level || data.riskLevel || '中';
  const levelColor = level === '高' ? C.red : level === '中' ? C.yellow : C.green;
  const score = data.score || data.riskScore || 50;

  return (
    <ModuleCard title="🛡️ 风险测评">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>风险等级</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: levelColor }}>{level}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>波动率</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{(data.volatility || data.stdDev || 0).toFixed(2)}%</div>
        </div>
        <div style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>最大回撤</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.red }}>{(data.maxDrawdown || data.maxDD || 0).toFixed(2)}%</div>
        </div>
      </div>
      {data.assessment && <div style={{ fontSize: 12, color: C.muted, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6, marginBottom: 8 }}>{data.assessment}</div>}
      {data.beta !== undefined && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--bg)', borderRadius: 6, fontSize: 12 }}>
          <span style={{ color: C.muted }}>Beta（相对沪深300）</span>
          <span style={{ color: C.text, fontWeight: 600 }}>{(data.beta || 0).toFixed(3)}</span>
        </div>
      )}
    </ModuleCard>
  );
}

// ─── 模块卡片通用壳 ─────────────────────────────────────────
function ModuleCard({ title, loading, error, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: children ? 12 : 0 }}>
        {title}
        {loading && <span style={{ fontSize: 12, color: C.muted, fontWeight: 400, marginLeft: 8 }}>加载中...</span>}
        {error && <span style={{ fontSize: 12, color: C.red, fontWeight: 400, marginLeft: 8 }}>{error}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── ETF全分析单页 ──────────────────────────────────────────
export default function StockAnalysis({ code }) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <QuoteCard code={code} key={`quote-${code}`} />
        <ChanCard code={code} key={`chan-${code}`} />
        <SentimentCard code={code} key={`sentiment-${code}`} />
        <CapitalCard code={code} key={`capital-${code}`} />
        <GridCard code={code} key={`grid-${code}`} />
        <RiskCard code={code} key={`risk-${code}`} />
      </div>
    </div>
  );
}
