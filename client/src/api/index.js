const BASE = '/api';

export async function fetchEtfList() {
  const r = await fetch(`${BASE}/etf/list`);
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg);
  return j.data;
}

export async function fetchCycleList() {
  const r = await fetch(`${BASE}/cycle/list`);
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg);
  return j.data;
}

export async function fetchChanAnalysis(code, cycle) {
  const r = await fetch(`${BASE}/chan/${code}?cycle=${encodeURIComponent(cycle)}`);
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg);
  return j.data;
}

export async function refreshChan(code, cycle) {
  const r = await fetch(`${BASE}/chan/${code}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cycle }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg);
  return j.data;
}

export async function fetchPortfolio() {
  const r = await fetch(`${BASE}/portfolio`);
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg);
  return j.data;
}

export async function fetchSentimentData(code) {
  const r = await fetch(`${BASE}/sentiment/${code || ''}`);
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg);
  return j.data;
}

export async function fetchGridData(code, opts = {}) {
  const { capital, riskLevel, customVol, customBand } = opts;
  let url = `${BASE}/grid/${code}`;
  let method = 'GET';
  let body = null;
  if (capital !== undefined || riskLevel !== undefined || customVol || customBand) {
    method = 'POST';
    body = JSON.stringify({ capital, riskLevel, customVol, customBand });
  }
  const r = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body,
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg);
  return j.data;
}

export async function fetchCapitalData(code, period = 1) {
  const r = await fetch(`${BASE}/capital/${code}?period=${period}`);
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg);
  return j.data;
}

export async function fetchRiskData(code, opts = {}) {
  const { riskLevel, positions } = opts;
  let url = `${BASE}/risk/${code}`;
  const params = [];
  if (riskLevel !== undefined) params.push(`riskLevel=${riskLevel}`);
  if (positions) params.push(`positions=${encodeURIComponent(JSON.stringify(positions))}`);
  if (params.length > 0) url += '?' + params.join('&');
  const r = await fetch(url);
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg);
  return j.data;
}

export async function fetchAlerts() {
  const r = await fetch(`${BASE}/alerts`);
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg);
  return j.data;
}

export async function addAlert(code, type, threshold, name) {
  const r = await fetch(`${BASE}/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, type, threshold, name }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg);
  return j.data;
}

export async function deleteAlert(code, type) {
  const r = await fetch(`${BASE}/alerts`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, type }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg);
  return j.data;
}

export async function checkAlerts() {
  const r = await fetch(`${BASE}/alerts/check`, { method: 'POST' });
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg);
  return j.data;
}

export async function fetchEtfScreen(opts = {}) {
  const { template, filters } = opts;
  let url = `${BASE}/select/etf`;
  const params = [];
  if (template) params.push(`template=${encodeURIComponent(template)}`);
  if (filters) params.push(`filters=${encodeURIComponent(JSON.stringify(filters))}`);
  if (params.length > 0) url += '?' + params.join('&');
  const r = await fetch(url);
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg);
  return j.data;
}
