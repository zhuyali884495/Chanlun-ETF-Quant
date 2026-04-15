import React, { useState, useEffect } from 'react';
import { fetchPortfolio } from '../api/index.js';
import { CORE_ETFS } from '../constants.js';

const C = { green: 'var(--up)', red: 'var(--down)', blue: 'var(--primary)', card: 'var(--bg-card)', border: 'var(--border)', text: 'var(--text)', muted: 'var(--text-muted)', yellow: '#eab308', cyan: 'var(--primary)', purple: 'var(--primary)', orange: '#f97316' };

function fmtMoney(n) { return n != null ? n.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '-'; }
function fmtPct(n) { return n != null ? (parseFloat(n).toFixed(2) + '%') : '-'; }

// 默认目标仓位配置
const DEFAULT_TARGET_ALLOCATION = {
  '159326': { name: '电网设备ETF', targetPct: 15, riskLevel: 2 },
  '515880': { name: '通信ETF', targetPct: 18, riskLevel: 1 },
  '512480': { name: '半导体ETF', targetPct: 18, riskLevel: 3 },
  '510300': { name: '沪深300ETF', targetPct: 20, riskLevel: 1 },
  '588000': { name: '科创50ETF', targetPct: 12, riskLevel: 3 },
};

// 跳转函数（由父组件App处理）
export default function Portfolio({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const d = await fetchPortfolio();
      setData(d);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const jump = (code, targetTab) => { if (onNavigate) onNavigate(code, targetTab); };

  const TARGET = DEFAULT_TARGET_ALLOCATION;

  // 计算目标仓位 vs 当前仓位
  const calcAllocation = (holding) => {
    if (!data?.account?.totalAsset) return null;
    const cfg = TARGET[holding.code] || { targetPct: 10, riskLevel: 1 };
    const currentPct = (holding.marketValue / data.account.totalAsset) * 100;
    const diff = cfg.targetPct - currentPct;
    const diffAmt = Math.abs(diff / 100 * data.account.totalAsset);
    return {
      targetPct: cfg.targetPct,
      currentPct: currentPct.toFixed(1),
      diff: diff.toFixed(1),
      diffAmt: Math.round(diffAmt),
      action: diff > 2 ? '加仓' : diff < -2 ? '减仓' : '持有',
      actionColor: diff > 2 ? C.green : diff < -2 ? C.red : C.muted,
    };
  };

  return (
    <div style={{ padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>💼 我的持仓</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab(tab === 'overview' ? 'allocation' : 'overview')}
            style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
            {tab === 'overview' ? '📊 仓位核算' : '📋 持仓概览'}
          </button>
          <button onClick={load} disabled={loading}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: C.blue, color: '#fff', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? '加载中...' : '🔄 刷新'}
          </button>
        </div>
      </div>

      {error && <div style={{ padding: 10, background: `${C.red}22`, border: `1px solid ${C.red}55`, borderRadius: 8, color: C.red, marginBottom: 12, fontSize: 13 }}>⚠ {error}</div>}

      {!data && !loading && <div style={{ textAlign: 'center', padding: 40, color: C.muted }}><div style={{ fontSize: 32, marginBottom: 8 }}>💼</div><div>点击刷新获取持仓数据</div></div>}

      {data && (
        <>
          {/* Tab: 持仓概览 */}
          {tab === 'overview' && (
            <>
              {/* 账户概览 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                {[
                  { label: '总资产', value: fmtMoney(data.account?.totalAsset), color: C.text },
                  { label: '可用资金', value: fmtMoney(data.account?.cash), color: C.cyan },
                  { label: '持仓市值', value: fmtMoney(data.account?.positionValue), color: C.yellow },
                  { label: '持仓占比', value: fmtPct(data.account?.positionRatio), color: C.blue },
                  { label: '标的数量', value: data.account?.stockCount, color: C.muted },
                  { label: '账户健康', value: data.accountHealth, color: data.accountHealth === '健康' ? C.green : data.accountHealth === '中等' ? C.yellow : C.red },
                ].map(item => (
                  <div key={item.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* 操作建议 */}
              <div style={{ padding: '10px 12px', background: `${C.blue}11`, border: `1px solid ${C.blue}33`, borderRadius: 10, marginBottom: 14, fontSize: 13, color: C.text }}>
                💡 {data.summary}
              </div>

              {/* 持仓明细 */}
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>持仓明细</div>
              {(data.holdings || []).map(h => {
                const sugg = (data.suggestions || []).find(s => s.code === h.code) || {};
                const alloc = calcAllocation(h);
                const actionColor = sugg.action === '加仓' ? C.green : sugg.action === '减仓' ? C.red : C.muted;
                return (
                  <div key={h.code} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    {/* 头部：名称+市值 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{h.name}</span>
                        <span style={{ fontSize: 12, color: C.cyan, marginLeft: 8, fontFamily: 'monospace' }}>{h.code}</span>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{fmtMoney(h.marketValue)}</div>
                    </div>
                    {/* 8个核心指标 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
                      {[
                        { label: '持仓量', value: (h.volume || 0).toLocaleString() + '份' },
                        { label: '成本价', value: (h.cost || 0).toFixed(3) + '元' },
                        { label: '现价', value: (h.currentPrice || 0).toFixed(3) + '元' },
                        { label: '持仓占比', value: fmtPct(h.posPct) },
                        { label: '浮动盈亏', value: (h.profit || 0) >= 0 ? '+' + fmtMoney(h.profit) : fmtMoney(h.profit), color: (h.profit || 0) >= 0 ? C.green : C.red },
                        { label: '盈亏比例', value: fmtPct(h.profitPct), color: (h.profitPct || 0) >= 0 ? C.green : C.red },
                        { label: '今日盈亏', value: (h.dayProfit || 0) >= 0 ? '+' + fmtMoney(h.dayProfit) : fmtMoney(h.dayProfit), color: (h.dayProfit || 0) >= 0 ? C.green : C.red },
                        { label: '风险等级', value: h.risk?.riskLevelLabel || '-', color: h.risk?.riskLevelLabel === '低风险' ? C.green : h.risk?.riskLevelLabel === '高风险' ? C.red : C.yellow },
                      ].map(item => (
                        <div key={item.label} style={{ textAlign: 'center', padding: '5px 4px', background: 'var(--bg-card)', borderRadius: 6 }}>
                          <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>{item.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: item.color || C.text }}>{item.value || '-'}</div>
                        </div>
                      ))}
                    </div>
                    {/* 调仓建议 */}
                    {alloc && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                        <span style={{ padding: '3px 10px', borderRadius: 6, background: alloc.actionColor + '22', color: alloc.actionColor, fontSize: 12, fontWeight: 700 }}>
                          {alloc.action} {alloc.diffAmt > 0 ? alloc.diffAmt.toLocaleString() + '元' : ''}
                        </span>
                        <span style={{ fontSize: 11, color: C.muted }}>当前{alloc.currentPct}% → 目标{alloc.targetPct}%</span>
                      </div>
                    )}
                    {/* 模块跳转按钮 */}
                    <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
                      {[
                        { label: '📈 缠论', tab: 'chan', color: C.blue },
                        { label: '🌡️ 景气度', tab: 'sentiment', color: C.cyan },
                        { label: '📊 网格', tab: 'grid', color: C.orange },
                        { label: '💰 资金', tab: 'capital', color: C.yellow },
                        { label: '🛡️ 风险', tab: 'risk', color: C.purple },
                      ].map(btn => (
                        <button key={btn.tab}
                          onClick={() => jump(h.code, btn.tab)}
                          style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${btn.color}44`, background: btn.color + '15', color: btn.color, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Tab: 仓位核算 */}
          {tab === 'allocation' && (
            <>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
                当前总资产：<span style={{ color: C.text, fontWeight: 700 }}>{fmtMoney(data.account?.totalAsset)}</span>
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>📊 目标仓位 vs 当前仓位</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {['标的', '代码', '目标仓位', '当前仓位', '差额', '建议', '操作金额'].map(h => (
                          <th key={h} style={{ padding: '6px 8px', color: C.muted, fontSize: 10, textAlign: 'center' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(data.holdings || []).map(h => {
                        const alloc = calcAllocation(h);
                        if (!alloc) return null;
                        const cfg = TARGET[h.code] || { name: h.name, targetPct: 10 };
                        return (
                          <tr key={h.code} style={{ borderBottom: `1px solid ${C.border}22` }}>
                            <td style={{ padding: '8px', color: C.text, fontWeight: 600 }}>{cfg.name}</td>
                            <td style={{ padding: '8px', color: C.cyan, fontFamily: 'monospace', textAlign: 'center' }}>{h.code}</td>
                            <td style={{ padding: '8px', textAlign: 'center', color: C.blue, fontWeight: 700 }}>{alloc.targetPct}%</td>
                            <td style={{ padding: '8px', textAlign: 'center', color: C.text }}>{alloc.currentPct}%</td>
                            <td style={{ padding: '8px', textAlign: 'center', color: alloc.action === '持有' ? C.muted : alloc.action === '加仓' ? C.green : C.red, fontWeight: 700 }}>
                              {alloc.action === '持有' ? '-' : alloc.action === '加仓' ? '+' + alloc.diff + '%' : alloc.diff + '%'}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 6, background: alloc.actionColor + '22', color: alloc.actionColor, fontSize: 11, fontWeight: 700 }}>
                                {alloc.action}
                              </span>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', color: alloc.diffAmt > 0 ? (alloc.action === '加仓' ? C.green : C.red) : C.muted, fontWeight: 600 }}>
                              {alloc.diffAmt > 0 ? (alloc.action === '加仓' ? '+' : '-') + alloc.diffAmt.toLocaleString() + '元' : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 总览摘要 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                {(data.suggestions || []).filter(s => s.action !== '持有').length > 0 ? (
                  <>
                    <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}44`, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: C.green }}>{(data.suggestions || []).filter(s => s.action === '加仓').length}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>只需加仓</div>
                    </div>
                    <div style={{ background: `${C.red}11`, border: `1px solid ${C.red}44`, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: C.red }}>{(data.suggestions || []).filter(s => s.action === '减仓').length}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>只需减仓</div>
                    </div>
                    <div style={{ background: `${C.cyan}11`, border: `1px solid ${C.cyan}44`, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: C.cyan }}>{(data.suggestions || []).filter(s => s.action === '持有').length}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>只无需操作</div>
                    </div>
                  </>
                ) : (
                  <div style={{ gridColumn: '1/-1', background: `${C.green}11`, border: `1px solid ${C.green}44`, borderRadius: 10, padding: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 15, color: C.green, fontWeight: 700 }}>✅ 所有持仓在目标仓位范围内，无需调整</div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
