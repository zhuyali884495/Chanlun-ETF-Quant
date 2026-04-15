'use strict';
const fs = require('fs');
const path = 'C:/Users/34856/chan-theory-h5/client/src/components/Page.jsx';
let content = fs.readFileSync(path, 'utf8');

// SentimentPage: add navTarget param + useEffect
content = content.replace(
  'export function SentimentPage() {',
  'export function SentimentPage({ navTarget, onNavTargetUsed }) {'
);
content = content.replace(
  '  // 默认加载第一只ETF\n  useEffect(() => { load(); }, []);\n\n  const dimColors',
  '  useEffect(() => { load(); }, [selected, period]);\n  // 联动跳转\n  useEffect(() => {\n    if (navTarget && navTarget.tab === \'sentiment\') {\n      const etf = CORE_ETFS.find(e => e.code === navTarget.code);\n      if (etf) { setSelected(etf); setPeriod(1); }\n      if (onNavTargetUsed) onNavTargetUsed();\n    }\n  }, [navTarget]);\n\n  const dimColors'
);

// GridPage: add navTarget param + useEffect
content = content.replace(
  'export function GridPage() {\n  const [loading, setLoading] = useState(false);\n  const [data, setData] = useState(null);\n  const [selected, setSelected] = useState(CORE_ETFS[0]);',
  'export function GridPage({ navTarget, onNavTargetUsed }) {\n  const [loading, setLoading] = useState(false);\n  const [data, setData] = useState(null);\n  const [selected, setSelected] = useState(CORE_ETFS[0]);'
);
// Find GridPage load useEffect and add navTarget handling after it
const gridPageNavEffect = `
  // 联动跳转
  useEffect(() => {
    if (navTarget && navTarget.tab === 'grid') {
      const etf = CORE_ETFS.find(e => e.code === navTarget.code);
      if (etf) setSelected(etf);
      if (onNavTargetUsed) onNavTargetUsed();
    }
  }, [navTarget]);
`;
// Insert after GridPage's initial useEffect(() => { load(); }, []);
content = content.replace(
  '  // 默认加载第一只ETF\n  useEffect(() => { load(); }, []);\n\n  const RISK_OPTIONS',
  '  useEffect(() => { load(); }, [selected, riskLevel]);\n  // 联动跳转\n  useEffect(() => {\n    if (navTarget && navTarget.tab === \'grid\') {\n      const etf = CORE_ETFS.find(e => e.code === navTarget.code);\n      if (etf) setSelected(etf);\n      if (onNavTargetUsed) onNavTargetUsed();\n    }\n  }, [navTarget]);\n\n  const RISK_OPTIONS'
);

// CapitalPage: add navTarget param
content = content.replace(
  'export function CapitalPage() {\n  const [loading, setLoading] = useState(false);\n  const [data, setData] = useState(null);\n  const [selected, setSelected] = useState(CORE_ETFS[0]);\n  const [period, setPeriod] = useState(1);',
  'export function CapitalPage({ navTarget, onNavTargetUsed }) {\n  const [loading, setLoading] = useState(false);\n  const [data, setData] = useState(null);\n  const [selected, setSelected] = useState(CORE_ETFS[0]);\n  const [period, setPeriod] = useState(1);'
);
content = content.replace(
  "  useEffect(() => { load(); }, [selected, period]);\n\n  const PERIOD_OPTIONS",
  "  useEffect(() => { load(); }, [selected, period]);\n  // 联动跳转\n  useEffect(() => {\n    if (navTarget && navTarget.tab === 'capital') {\n      const etf = CORE_ETFS.find(e => e.code === navTarget.code);\n      if (etf) { setSelected(etf); setPeriod(1); }\n      if (onNavTargetUsed) onNavTargetUsed();\n    }\n  }, [navTarget]);\n\n  const PERIOD_OPTIONS"
);

// RiskPage: add navTarget param
content = content.replace(
  'export function RiskPage() {\n  const [loading, setLoading] = useState(false);\n  const [data, setData] = useState(null);\n  const [selected, setSelected] = useState(CORE_ETFS[0]);\n  const [riskLevel, setRiskLevel] = useState(1);',
  'export function RiskPage({ navTarget, onNavTargetUsed }) {\n  const [loading, setLoading] = useState(false);\n  const [data, setData] = useState(null);\n  const [selected, setSelected] = useState(CORE_ETFS[0]);\n  const [riskLevel, setRiskLevel] = useState(1);'
);
content = content.replace(
  "  useEffect(() => { load(); }, [selected, riskLevel]);\n\n  const RISK_OPTIONS",
  "  useEffect(() => { load(); }, [selected, riskLevel]);\n  // 联动跳转\n  useEffect(() => {\n    if (navTarget && navTarget.tab === 'risk') {\n      const etf = CORE_ETFS.find(e => e.code === navTarget.code);\n      if (etf) { setSelected(etf); setRiskLevel(1); }\n      if (onNavTargetUsed) onNavTargetUsed();\n    }\n  }, [navTarget]);\n\n  const RISK_OPTIONS"
);

// SelectPage: add navTarget param (SelectPage doesn't need navTarget but OK)
content = content.replace(
  'export function SelectPage() {\n  const [result, setResult] = useState(null);\n  const [loading, setLoading] = useState(false);',
  'export function SelectPage({ navTarget, onNavTargetUsed }) {\n  const [result, setResult] = useState(null);\n  const [loading, setLoading] = useState(false);'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Done! Changes applied.');
