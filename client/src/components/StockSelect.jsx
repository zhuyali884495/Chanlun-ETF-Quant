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
  { name: '\ud83c\udfc6 \u8d44\u91d1\u9f99\u5934', keys: ['mainNetInflow', 'bigNetInflow', 'scaleAbove5', 'highLiquidity'] },
  { name: '\ud83d\udcc8 \u6280\u672f\u7a81\u7834', keys: ['chanBuy', 'macdGold', 'breakZhongshu', 'rsi30_70'] },
  { name: '\ud83d\udcb0 \u4f4e\u4f30\u503c\u9ad8\u606f', keys: ['lowValuation', 'sentimentAbove60', 'scaleAbove5', 'lowFee'] },
  { name: '\ud83d\ude80 \u666f\u6c14\u8d5b\u9053', keys: ['sentimentAbove60', 'trendUp', 'mainNetInflow'] },
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

export default function StockSelect({ onSelectETF }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFactors, setSelectedFactors] = useState({});
  const [selectedIndustry, setSelectedIndustry] = useState('\u4e0d\u9650');
  const [minScore, setMinScore] = useState(3);

  const fetchResults = useCallback(async function(filterOpts) {
    setLoading(true);
    try {
      var url = '/api/etf/list';
      var method = 'GET';
      var body = undefined;
      if (filterOpts && filterOpts.keys && filterOpts.keys.length > 0) {
        url = '/api/select/etf';
        method = 'POST';
        body = JSON.stringify({ filters: filterOpts.keys, industry: selectedIndustry, minScore: minScore });
      }
      var resp = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: body,
      });
      var data = await resp.json();
      var items = data && data.data;
      if (!items) { setResults([]); setLoading(false); return; }
      if (!Array.isArray(items)) items = [];
      var shown = items.slice(0, 10);
      setResults(shown.map(function(item, i) {
        return {
          code: item.code || item.symbol || ('ETF' + i),
          name: item.name || item.fundName || ('ETF' + (i + 1)),
          score: item.score || (5 - i * 0.3),
          tags: item.tags || ['\u7efc\u5408\u6807\u7684'],
          price: item.price || item.nav || null,
          chg: item.chg || item.涨跌幅 || 0,
          reason: item.reason || '\u7efc\u5408\u8bc4\u5206\u9760\u524d\uff0c\u4f18\u9009\u6807\u7684',
          rank: i + 1,
        };
      }));
    } catch (e) {
      console.error('Select error:', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [selectedIndustry, minScore]);

  useEffect(function() {
    fetchResults(null);
  }, [fetchResults]);

  function handleETFClick(etf) {
    if (onSelectETF) {
      onSelectETF(etf.code);
    } else {
      window.location.hash = '#/chan?code=' + etf.code;
    }
  }

  function handlePresetClick(keys) {
    var factorObj = {};
    keys.forEach(function(k) { factorObj[k] = true; });
    setSelectedFactors(factorObj);
    fetchResults({ keys: keys });
  }

  function handleFactorToggle(key) {
    var newFactors = Object.assign({}, selectedFactors);
    if (newFactors[key]) { delete newFactors[key]; } else { newFactors[key] = true; }
    setSelectedFactors(newFactors);
    var activeKeys = Object.keys(newFactors);
    fetchResults({ keys: activeKeys });
  }

  function handleIndustrySelect(ind) {
    setSelectedIndustry(ind);
    var activeKeys = Object.keys(selectedFactors);
    fetchResults({ keys: activeKeys, industry: ind });
  }

  function handleApplyClick() {
    var activeKeys = Object.keys(selectedFactors).filter(function(k) { return selectedFactors[k]; });
    fetchResults({ keys: activeKeys });
  }

  // Build header
  var headerDiv = React.createElement('div', { style: { marginBottom: 20 } },
    React.createElement('h2', { style: { fontSize: 20, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' } }, '\ud83c\udfaf \u667a\u80fd\u9009\u80a1'),
    React.createElement('div', { style: { fontSize: 13, color: 'var(--text-muted)' } }, '\u57fa\u4e8e\u8d44\u91d1\u9762 \u00b7 \u6280\u672f\u9762 \u00b7 \u57fa\u672c\u9762 \u00b7 \u666f\u6c14\u5ea6 \u56db\u7ef4\u56e0\u5b50\u7cbe\u9009ETF')
  );

  // Preset buttons
  var presetDiv = React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 } },
    PRESET_LIST.map(function(preset, i) {
      return React.createElement('button', {
        key: i,
        onClick: function() { handlePresetClick(preset.keys); },
        style: { padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
      }, preset.name);
    })
  );

  // Industry filters
  var industryDiv = React.createElement('div', { style: { marginBottom: 12 } },
    React.createElement('div', { style: { fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 } }, '\u884c\u4e1a\u8d5b\u9053'),
    React.createElement('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
      INDUSTRY_OPTIONS.map(function(ind) {
        var isActive = selectedIndustry === ind;
        return React.createElement('button', {
          key: ind,
          onClick: function() { handleIndustrySelect(ind); },
          style: {
            padding: '3px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            border: isActive ? '1px solid #3b82f6' : '1px solid var(--border)',
            background: isActive ? 'rgba(59,130,246,0.12)' : 'var(--bg)',
            color: isActive ? '#3b82f6' : 'var(--text-muted)',
          }
        }, ind);
      })
    )
  );

  // Factor groups
  var factorGroups = FACTOR_GROUPS.map(function(group) {
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
    return React.createElement('div', { key: group.label, style: { marginBottom: 10 } },
      React.createElement('div', { style: { fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 } }, group.label),
      React.createElement('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } }, opts)
    );
  });

  // Apply button
  var applyBtn = React.createElement('button', {
    onClick: handleApplyClick,
    style: { width: '100%', marginTop: 8, padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14 }
  }, '\ud83d\udd0d \u5f00\u59cb\u7b5b\u9009');

  // Filter panel
  var filterPanel = React.createElement('div', { style: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 } },
    React.createElement('div', { style: { fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--text)' } }, '\u2699\ufe4f \u81ea\u5b9a\u4e49\u9009\u80a1\u6761\u4ef6'),
    presetDiv,
    industryDiv,
    factorGroups,
    applyBtn
  );

  // Stats bar
  var statsDiv = React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } },
    React.createElement('div', { style: { fontSize: 13, color: 'var(--text-muted)' } },
      loading ? '\ud83d\udd04 \u7b5b\u9009\u4e2d...' : '\u5171\u7b5b\u9009 ' + results.length + ' \u53eaETF\uff0c\u5c55\u793a TOP ' + results.length
    ),
    React.createElement('div', { style: { fontSize: 12, color: 'var(--text-muted)' } }, '\u6570\u636e\u6765\u6e90\uff1a\u4e1c\u65b9\u8d22\u5bcc\u5b9e\u65f6\u884c\u60c5+\u7f69\u8bba\u5206\u6790')
  );

  // Results
  var contentDiv;
  if (loading) {
    contentDiv = React.createElement('div', { style: { textAlign: 'center', padding: 40, color: 'var(--text-muted)' } }, '\ud83d\udd04 \u6b63\u5728\u5206\u6790\u6807\u7684...');
  } else if (results.length === 0) {
    contentDiv = React.createElement('div', { style: { textAlign: 'center', padding: 40, color: 'var(--text-muted)' } }, '\u6682\u65e0\u7b26\u5408\u6761\u4ef6\u7684ETF\uff0c\u8bf7\u5c1d\u8bd5\u5176\u4ed6\u7b5b\u9009\u6761\u4ef6');
  } else {
    contentDiv = results.map(function(etf) {
      return React.createElement(ETFCard, { key: etf.code + etf.rank, etf: etf, rank: etf.rank, onClick: function() { handleETFClick(etf); } });
    });
  }

  // Footer note
  var footerDiv = React.createElement('div', { style: { marginTop: 20, padding: 12, background: 'var(--bg-card)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 } },
    React.createElement('b', null, '\u8bc4\u5206\u8bf4\u660e\uff1a'),
    '\u7efc\u5408\u8d44\u91d1\u51c0\u6d41\u5165\u3001\u6280\u672f\u4e70\u70b9\u4fe1\u53f7\u3001\u666f\u6c14\u5ea6\u3001\u6d41\u52a8\u6027\u548c\u89c4\u6a21\u7b49\u56e0\u7d20\uff0c5\u5206\u5236\u8bc4\u5206\u3002',
    React.createElement('br'),
    React.createElement('b', null, '\u70b9\u51fb\u4efb\u4e00\u6807\u7684'),
    ' \u2192 \u8df3\u8f6c\u5b8c\u6574\u5206\u6790\u62a5\u544a\uff08\u884c\u60c5+\u7f69\u8bba+\u8d44\u91d1+\u7f51\u683c+\u98ce\u9669\u5168\u7ef4\u5ea6\uff09'
  );

  return React.createElement('div', { style: { padding: 16, maxWidth: 800, margin: '0 auto' } },
    headerDiv,
    filterPanel,
    statsDiv,
    contentDiv,
    footerDiv
  );
}
