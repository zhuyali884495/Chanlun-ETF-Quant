import React, { useState, useEffect, useCallback } from 'react';

function StarRating({ score, max = 5 }) {
  const stars = [];
  for (let i = 0; i < max; i++) {
    stars.push(i < score
      ? React.createElement('span', { key: i, style: { color: '#f59e0b', fontSize: 13 } }, '\u2605')
      : React.createElement('span', { key: i, style: { color: '#374151', fontSize: 13 } }, '\u2606')
    );
  }
  return React.createElement('div', { style: { display: 'inline-flex', gap: 2 } }, stars);
}

const INDUSTRY_OPTIONS = ['\u4e0d\u9650', '\u534a\u5bfc\u4f53', '\u901a\u4fe1', '\u65b0\u80fd\u6e90', '\u533b\u836f', '\u6d88\u8d39\u7535\u5b50', '\u519b\u5de5', '\u8bc1\u5238', '\u9ec4\u91d1', '\u5bbd\u57fa'];

const PRESET_LIST = [
  { name: '\ud83c\udfc6 \u8d44\u91d1\u9f99\u5934', template: 'lowValHighDiv', keys: ['mainNetInflow', 'bigNetInflow', 'scaleAbove5', 'highLiquidity'] },
  { name: '\ud83d\udcc8 \u6280\u672f\u7a81\u7834', template: 'highGrowth', keys: ['chanBuy', 'macdGold', 'breakZhongshu', 'rsi30_70'] },
  { name: '\ud83d\udcb0 \u4f4e\u4f30\u503c\u9ad8\u606f', template: 'lowValHighDiv', keys: ['lowValuation', 'sentimentAbove60', 'scaleAbove5', 'lowFee'] },
  { name: '\ud83d\ude80 \u666f\u6c14\u8d5b\u9053', template: 'broadEnhanced', keys: ['sentimentAbove60', 'trendUp', 'mainNetInflow'] },
];

const FACTOR_GROUPS = [
  {
    label: '\u8d44\u91d1\u9762',
    options: [
      { key: 'mainNetInflow', label: '\u4e3b\u529b\u51c0\u6d41\u5165>0' },
      { key: 'northFlow', label: '\u5317\u5411\u8d44\u91d1\u6301\u80a1\u63d0\u5347' },
      { key: 'bigNetInflow', label: '\u8d85\u5927\u5355\u51c0\u6d41\u5165>0' },
    ]
  },
  {
    label: '\u6280\u672f\u9762',
    options: [
      { key: 'chanBuy', label: '\u7f69\u8bba\u4e70\u70b9\u4fe1\u53f7' },
      { key: 'macdGold', label: 'MACD\u91d1\u53c9' },
      { key: 'rsi30_70', label: 'RSI 30-70\u533a\u95f4' },
      { key: 'breakZhongshu', label: '\u7a81\u7834\u4e2d\u67f1\u4e0a\u6cbf' },
    ]
  },
  {
    label: '\u57fa\u672c\u9762',
    options: [
      { key: 'lowTrackError', label: '\u8ddf\u8e2a\u8bef\u5dee<0.1%' },
      { key: 'highLiquidity', label: '\u6210\u4ea4>5000\u4e07' },
      { key: 'lowFee', label: '\u8d39\u7387<0.5%' },
      { key: 'scaleAbove5', label: '\u89c4\u6a21>5\u4ebf' },
    ]
  },
  {
    label: '\u666f\u6c14\u5ea6',
    options: [
      { key: 'sentimentAbove60', label: '\u666f\u6c14\u5ea6>60\u5206' },
      { key: 'trendUp', label: '\u8d8b\u52bf\u5411\u4e0a' },
      { key: 'lowValuation', label: '\u4f30\u503c\u504f\u4f4e<30%' },
    ]
  },
];

function ETFCard({ etf, rank, onClick }) {
  const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '14px 16px',
    marginBottom: 10,
    cursor: 'pointer',
  };
  const chgColor = etf.chg >= 0 ? '#22c55e' : '#ef4444';
  const scoreBg = etf.score >= 4 ? '#22c55e' : etf.score >= 3 ? '#3b82f6' : '#6b7280';

  return React.createElement('div', { style: cardStyle, onClick: onClick },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement('div', { style: { background: scoreBg, color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700, minWidth: 24, textAlign: 'center' } }, '#' + rank),
        React.createElement('div', null,
          React.createElement('div', { style: { fontWeight: 700, fontSize: 15, color: 'var(--text)' } }, etf.name),
          React.createElement('div', { style: { fontSize: 12, color: 'var(--text-muted)' } }, etf.code)
        )
      ),
      React.createElement('div', { style: { textAlign: 'right' } },
        React.createElement('div', { style: { fontSize: 18, fontWeight: 700, color: chgColor } }, etf.price != null ? etf.price.toFixed(3) : '-'),
        React.createElement('div', { style: { fontSize: 13, color: chgColor } }, etf.chg != null ? (etf.chg >= 0 ? '+' + etf.chg.toFixed(2) + '%' : etf.chg.toFixed(2) + '%') : '-')
      )
    ),
    React.createElement('div', { style: { display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 } },
      etf.tags.map(function(tag, i) {
        return React.createElement('span', { key: i, style: { padding: '2px 8px', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', borderRadius: 20, fontSize: 11 } }, tag);
      })
    ),
    React.createElement('div', { style: { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 } }, etf.reason),
    React.createElement('div', { style: { marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      React.createElement(StarRating, { score: Math.round(etf.score) }),
      React.createElement('div', { style: { fontSize: 12, color: 'var(--text-muted)' } }, '\u7efc\u5408\u8bc4\u5206 ' + etf.score.toFixed(1) + '/5')
    )
  );
}

// 模板列表（用于策略选择器）
const TEMPLATE_LIST = [
  { id: 'lowValHighDiv', name: '\u4f4e\u4f30\u9ad8\u80a1\u606f', icon: '\ud83c\udfc6', color: '#22c55e' },
  { id: 'highGrowth', name: '\u9ad8\u666f\u6c14\u6210\u957f', icon: '\ud83d\ude80', color: '#a855f7' },
  { id: 'broadEnhanced', name: '\u5bbd\u57fa\u589e\u5f3a', icon: '\ud83d\udee1️f', color: '#3b82f6' },
  { id: 'lowVolStable', name: '\u4f4e\u6ce2\u52a8\u7a33\u504f', icon: '\u2696\ufe0f', color: '#06b6d4' },
];

export default function StockSelect({ onSelectETF }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('lowValHighDiv');
  const [selectedFactors, setSelectedFactors] = useState({});
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [sourceNote, setSourceNote] = useState('');
  const [suggestion, setSuggestion] = useState('');

  const fetchResults = useCallback(async function(templateId, factorKeys) {
    setLoading(true);
    try {
      // ✅ 使用 GET 而非 POST（避免 JSON body 解析问题）
      var params = [];
      if (templateId) params.push('template=' + encodeURIComponent(templateId));
      if (factorKeys && factorKeys.length > 0) {
        params.push('filters=' + encodeURIComponent(JSON.stringify(factorKeys)));
      }
      var url = '/api/select/etf' + (params.length > 0 ? '?' + params.join('&') : '');
      var resp = await fetch(url);
      var json = await resp.json();
      var apiData = json && json.data;
      if (!apiData) { setResults([]); setLoading(false); return; }

      // ✅ 保存 API 元数据
      if (apiData.quota) setQuotaInfo(apiData.quota);
      setSourceNote(apiData.note || '');
      setSuggestion(apiData.suggestion || '');

      // ✅ 从 API 响应中提取 items
      var items = apiData.items || [];
      var shown = items.slice(0, 10);
      setResults(shown.map(function(item, i) {
        return {
          code: item.code || item.symbol || ('ETF' + i),
          name: item.name || item.fundName || ('ETF' + (i + 1)),
          score: item.score || (5 - i * 0.3),
          tags: buildTags(item, apiData.template && apiData.template.id),
          price: item.price || item.nav || null,
          chg: item.chg || item.涨跌幅 || 0,
          reason: item.reason || buildReason(item, apiData.template && apiData.template.id),
          rank: i + 1,
        };
      }));
    } catch (e) {
      console.error('Select error:', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function buildTags(item, templateId) {
    var tags = [];
    if (item.dividendYield >= 2.0) tags.push('\u9ad8\u80a1\u606f ' + item.dividendYield + '%');
    if (item.roe >= 15) tags.push('ROE ' + item.roe + '%');
    if (item.pe > 0 && item.pe < 20) tags.push('\u4f4e PE ' + item.pe);
    if (item.yoyGrowth >= 20) tags.push('\u6210\u957f +' + item.yoyGrowth + '%');
    if (item.vol < 0.02) tags.push('\u4f4e\u6ce2\u52a8');
    if (tags.length === 0) tags.push('\u7efc\u5408\u6807\u8d76');
    return tags;
  }

  function buildReason(item, templateId) {
    var parts = [];
    if (templateId === 'lowValHighDiv') {
      if (item.dividendYield >= 2.0) parts.push('\u80a1\u606f' + item.dividendYield + '%');
      if (item.pe < 20) parts.push('PE' + item.pe);
    } else if (templateId === 'highGrowth') {
      if (item.yoyGrowth >= 20) parts.push('\u589e\u901f' + item.yoyGrowth + '%');
      if (item.roe >= 15) parts.push('ROE' + item.roe + '%');
    } else {
      if (item.score >= 4) parts.push('\u7efc\u5408\u8bc4\u5206\u4f18\u79c0');
    }
    return parts.length > 0 ? parts.join(' / ') : '\u5408\u9002\u914d\u7f6e';
  }

  useEffect(function() {
    var keys = Object.keys(selectedFactors).filter(function(k) { return selectedFactors[k]; });
    fetchResults(selectedTemplate, keys);
  }, [selectedTemplate]);

  function handleETFClick(etf) {
    if (onSelectETF) onSelectETF(etf.code);
  }

  function handlePresetClick(preset) {
    setSelectedTemplate(preset.template);
    var factorObj = {};
    preset.keys.forEach(function(k) { factorObj[k] = true; });
    setSelectedFactors(factorObj);
    fetchResults(preset.template, preset.keys);
  }

  function handleFactorToggle(key) {
    var newFactors = Object.assign({}, selectedFactors);
    if (newFactors[key]) { delete newFactors[key]; } else { newFactors[key] = true; }
    setSelectedFactors(newFactors);
    var activeKeys = Object.keys(newFactors).filter(function(k) { return newFactors[k]; });
    fetchResults(selectedTemplate, activeKeys);
  }

  function handleApplyClick() {
    var activeKeys = Object.keys(selectedFactors).filter(function(k) { return selectedFactors[k]; });
    fetchResults(selectedTemplate, activeKeys);
  }

  // Build header
  var headerDiv = React.createElement('div', { style: { marginBottom: 20 } },
    React.createElement('h2', { style: { fontSize: 20, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' } }, '\ud83c\udfaf \u667a\u80fd\u9009\u80a1'),
    React.createElement('div', { style: { fontSize: 13, color: 'var(--text-muted)' } }, '\u57fa\u4e8e\u8d44\u91d1\u9762 \u00b7 \u6280\u672f\u9762 \u00b7 \u57fa\u672c\u9762 \u00b7 \u666f\u6c14\u5ea6 \u56db\u7ef4\u56e0\u5b50\u7cbe\u9009ETF')
  );

  // Quota status bar
  var quotaBar = null;
  if (quotaInfo) {
    var remaining = quotaInfo.remaining || 0;
    var total = quotaInfo.total || 300;
    var pct = Math.round((remaining / total) * 100);
    var quotaColor = remaining < 50 ? '#ef4444' : remaining < 100 ? '#eab308' : '#22c55e';
    quotaBar = React.createElement('div', { style: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 } },
      React.createElement('div', { style: { color: 'var(--text-muted)' } },
        sourceNote || '\u6570\u636e\u6765\u6e90\uff1a\u4e1c\u65b9\u8d22\u5bcc\u5b9e\u65f6\u884c\u60c5+\u7f69\u8bba\u5206\u6790'
      ),
      React.createElement('div', { style: { color: quotaColor, fontWeight: 600 } },
        '\u989d\u5ea6: ' + remaining + '/' + total + ' \u6b21 (' + pct + '% \u5269\u4f59)'
      )
    );
  }

  // Strategy selector
  var strategyDiv = React.createElement('div', { style: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 12 } },
    React.createElement('div', { style: { fontWeight: 700, fontSize: 14, marginBottom: 10, color: 'var(--text)' } }, '\ud83d\udd0d \u7b56\u7565\u6a21\u677f'),
    React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 } },
      TEMPLATE_LIST.map(function(t) {
        var isActive = selectedTemplate === t.id;
        return React.createElement('button', {
          key: t.id,
          onClick: function() { setSelectedTemplate(t.id); fetchResults(t.id, []); },
          style: {
            padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
            border: isActive ? '2px solid ' + t.color : '1px solid var(--border)',
            background: isActive ? t.color + '22' : 'var(--bg)',
            color: isActive ? t.color : 'var(--text-muted)',
            fontWeight: isActive ? 700 : 400,
          }
        }, t.icon + ' ' + t.name);
      })
    ),
    // Factor groups
    FACTOR_GROUPS.map(function(group) {
      var opts = group.options.map(function(opt) {
        var isActive = !!selectedFactors[opt.key];
        return React.createElement('button', {
          key: opt.key,
          onClick: function() { handleFactorToggle(opt.key); },
          title: opt.label,
          style: {
            padding: '3px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            border: isActive ? '1px solid #3b82f6' : '1px solid var(--border)',
            background: isActive ? 'rgba(59,130,246,0.12)' : 'var(--bg)',
            color: isActive ? '#3b82f6' : 'var(--text-muted)',
          }
        }, opt.label);
      });
      return React.createElement('div', { key: group.label, style: { marginBottom: 8 } },
        React.createElement('div', { style: { fontSize: 11, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 } }, group.label),
        React.createElement('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } }, opts)
      );
    }),
    React.createElement('button', {
      onClick: handleApplyClick,
      style: { width: '100%', marginTop: 10, padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14 }
    }, '\u2699\ufe0f \u5f00\u59cb\u7b5b\u9009')
  );

  // Stats bar
  var statsDiv = React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 } },
    React.createElement('div', { style: { fontSize: 13, color: 'var(--text-muted)' } },
      loading ? '\ud83d\udd04 \u7b5b\u9009\u4e2d...' : '\u5171 ' + results.length + ' \u53eaETF\uff0c\u5c55\u793a TOP ' + results.length
    ),
    React.createElement('div', { style: { fontSize: 12, color: 'var(--text-muted)' } }, quotaInfo ? '' : '\u6570\u636e\u6765\u6e90\uff1a\u4e1c\u65b9\u8d22\u5bcc\u5b9e\u65f6\u884c\u60c5+\u7f69\u8bba\u5206\u6790')
  );

  // Results
  var contentDiv;
  if (loading) {
    contentDiv = React.createElement('div', { style: { textAlign: 'center', padding: 40, color: 'var(--text-muted)' } }, '\ud83d\udd04 \u6b63\u5728\u5206\u6790\u6807\u7684...');
  } else if (results.length === 0) {
    contentDiv = React.createElement('div', { style: { textAlign: 'center', padding: 40 } },
      React.createElement('div', { style: { fontSize: 48, marginBottom: 12 } }, '\ud83e\udd14'),
      React.createElement('div', { style: { color: 'var(--text)', fontSize: 15, marginBottom: 8 } }, '\u6682\u65e0\u7b26\u5408\u6761\u4ef6\u7684ETF'),
      React.createElement('div', { style: { color: 'var(--text-muted)', fontSize: 13 } }, '\u8bf7\u5c1d\u8bd5\u9009\u62e9\u5176\u4ed6\u7b56\u7565\u6216\u8c03\u6574\u7b5b\u9009\u6761\u4ef6')
    );
  } else {
    contentDiv = results.map(function(etf) {
      return React.createElement(ETFCard, { key: etf.code + etf.rank, etf: etf, rank: etf.rank, onClick: function() { handleETFClick(etf); } });
    });
  }

  // Suggestion card
  var suggestionDiv = null;
  if (suggestion && !loading) {
    suggestionDiv = React.createElement('div', { style: { marginTop: 16, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: 14 } },
      React.createElement('div', { style: { fontWeight: 700, fontSize: 13, color: '#3b82f6', marginBottom: 8 } }, '\ud83d\udca1 \u914d\u7f6e\u5efa\u8bae'),
      React.createElement('div', { style: { fontSize: 13, color: 'var(--text)', lineHeight: 1.7 } }, suggestion)
    );
  }

  // Footer
  var footerDiv = React.createElement('div', { style: { marginTop: 20, padding: 12, background: 'var(--bg-card)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 } },
    React.createElement('b', null, '\u8bc4\u5206\u8bf4\u660e\uff1a'),
    '\u7efc\u5408\u8d44\u91d1\u51c0\u6d41\u5165\u3001\u6280\u672f\u4e70\u70b9\u4fe1\u53f7\u3001\u666f\u6c14\u5ea6\u3001\u6d41\u52a8\u6027\u548c\u89c4\u6a21\u7b49\u56e0\u7d20\uff0c\u5f53\u524d\u7248\u672c\u4f7f\u7528\u672c\u5730\u53c2\u8003\u6570\u636e\u5e93\u8fdb\u884c\u8bc4\u7b97\u3002',
    React.createElement('br'),
    React.createElement('b', null, '\u70b9\u51fb\u4efb\u4e00\u6807\u7684'),
    ' \u2192 \u8df3\u8f6c\u5b8c\u6574\u5206\u6790\u62a5\u544a\uff08\u884c\u60c5+\u7f69\u8bba+\u8d44\u91d1+\u7f51\u683c+\u98ce\u9669\u5168\u7ef4\u5ea6\uff09'
  );

  return React.createElement('div', { style: { padding: 16, maxWidth: 800, margin: '0 auto' } },
    headerDiv,
    quotaBar,
    strategyDiv,
    statsDiv,
    contentDiv,
    suggestionDiv,
    footerDiv
  );
}
