import React, { useState } from 'react';
import { fetchAlerts, addAlert, deleteAlert, checkAlerts } from '../api/index.js';

const C = { green: 'var(--up)', red: 'var(--down)', blue: 'var(--primary)', card: 'var(--bg-card)', border: 'var(--border)', text: 'var(--text)', muted: 'var(--text-muted)', yellow: '#eab308', cyan: 'var(--primary)', purple: 'var(--primary)' };

const TYPE_LABELS = {
  price_above: '价格突破上轨',
  price_below: '价格跌破下轨',
  chg_above: '涨幅突破',
  chg_below: '跌幅突破',
};

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [form, setForm] = useState({ code: '', type: 'price_above', threshold: '' });

  const load = async () => {
    setLoading(true); setError(null);
    try { const d = await fetchAlerts(); setAlerts(d || []); } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!form.code || !form.threshold) return;
    setError(null);
    try {
      await addAlert(form.code, form.type, parseFloat(form.threshold), form.code);
      await load();
      setForm({ ...form, threshold: '' });
    } catch (e) { setError(e.message); }
  };

  const handleDelete = async (code, type) => {
    try { await deleteAlert(code, type); await load(); } catch (e) { setError(e.message); }
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      const r = await checkAlerts();
      setCheckResult(r);
    } catch (e) { setError(e.message); }
    finally { setChecking(false); }
  };

  const typeColor = (type) => {
    if (type.includes('above') || type.includes('chg_above')) return C.red;
    return C.green;
  };

  return (
    <div style={{ padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>智能盯盘预警</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleCheck} disabled={checking} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: checking ? `${C.cyan}44` : C.cyan, color: '#fff', fontSize: 13, cursor: checking ? 'not-allowed' : 'pointer' }}>
            {checking ? '检查中...' : '🔍 检查预警'}
          </button>
          <button onClick={load} disabled={loading} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: C.blue, color: '#fff', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? '...' : '刷新列表'}
          </button>
        </div>
      </div>

      {error && <div style={{ padding: 10, background: `${C.red}22`, border: `1px solid ${C.red}55`, borderRadius: 8, color: C.red, marginBottom: 12, fontSize: 13 }}>⚠ {error}</div>}

      {/* 检查结果 */}
      {checkResult && (
        <div style={{ marginBottom: 16, padding: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>检查时间: {new Date(checkResult.checkedAt).toLocaleString('zh-CN')}</div>
          {checkResult.triggered?.length > 0 ? (
            <div>
              <div style={{ color: C.red, fontWeight: 700, marginBottom: 8 }}>🚨 触发预警 ({checkResult.triggered.length})</div>
              {checkResult.triggered.map(a => (
                <div key={a.code + a.type} style={{ padding: '6px 10px', background: `${C.red}15`, borderRadius: 6, marginBottom: 6, color: C.text, fontSize: 13 }}>
                  {a.name || a.code} — {TYPE_LABELS[a.type]} = {a.threshold}，当前{a.currentPrice ? `价格=${a.currentPrice}` : '数据获取失败'}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: C.green, fontSize: 13 }}>✅ 所有标的运行正常，未触发预警</div>
          )}
        </div>
      )}

      {/* 添加预警 */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>添加新预警</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>标的代码</div>
            <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="如 515880" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg-input)', color: C.text, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>预警类型</div>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg-input)', color: C.text, fontSize: 13 }}>
              <option value="price_above">价格突破上轨</option>
              <option value="price_below">价格跌破下轨</option>
              <option value="chg_above">涨幅突破(%)</option>
              <option value="chg_below">跌幅突破(%)</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>阈值</div>
            <input value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })} placeholder="1.30" type="number" step="0.001" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg-input)', color: C.text, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <button onClick={handleAdd} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: C.green, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            添加
          </button>
        </div>
      </div>

      {/* 预警列表 */}
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>监控列表 ({alerts.length})</div>
      {!alerts.length && !loading && <div style={{ textAlign: 'center', padding: 30, color: C.muted, fontSize: 13 }}>暂无监控标的，添加上方预警</div>}

      {(alerts || []).map(a => (
        <div key={a.code + a.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{a.name || a.code} <span style={{ fontSize: 12, color: C.muted }}>{a.code}</span></div>
            <div style={{ fontSize: 12, color: typeColor(a.type) }}>{TYPE_LABELS[a.type]} = {a.threshold}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>创建: {new Date(a.createdAt).toLocaleString('zh-CN')}</div>
          </div>
          <button onClick={() => handleDelete(a.code, a.type)} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.red}55`, background: 'transparent', color: C.red, fontSize: 12, cursor: 'pointer' }}>
            删除
          </button>
        </div>
      ))}
    </div>
  );
}
