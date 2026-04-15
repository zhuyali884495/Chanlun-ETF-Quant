// 主题定义：三套可切换的简约金融模板
export const THEMES = {
  light: {
    id: 'light',
    name: '简约白',
    vars: {
      // 背景
      '--bg': '#FFFFFF',
      '--bg-sidebar': '#F5F7FA',
      '--bg-card': '#FFFFFF',
      '--bg-input': '#F5F7FA',
      '--bg-hover': '#EEF1F6',
      '--bg-nav': '#1677FF',
      // 文字
      '--text': '#1D2129',
      '--text-muted': '#868D95',
      '--text-on-primary': '#FFFFFF',
      // 边框
      '--border': '#E8EAED',
      // 主色
      '--primary': '#1677FF',
      '--primary-hover': '#4096FF',
      '--primary-bg': 'rgba(22,119,255,0.08)',
      // 数据色
      '--up': '#E53E3E',
      '--down': '#38A169',
      '--neutral': '#868D95',
      // 阴影
      '--shadow': '0 2px 12px rgba(0,0,0,0.06)',
      '--shadow-sm': '0 1px 4px rgba(0,0,0,0.04)',
    },
  },
  dark: {
    id: 'dark',
    name: '科技黑',
    vars: {
      '--bg': '#1A1D23',
      '--bg-sidebar': '#272B33',
      '--bg-card': '#23272F',
      '--bg-input': '#2D323C',
      '--bg-hover': '#323844',
      '--bg-nav': '#6366F1',
      '--text': '#F5F7FA',
      '--text-muted': '#9CA3AF',
      '--text-on-primary': '#FFFFFF',
      '--border': '#3A3F4B',
      '--primary': '#6366F1',
      '--primary-hover': '#818CF8',
      '--primary-bg': 'rgba(99,102,241,0.15)',
      '--up': '#48BB78',
      '--down': '#F56565',
      '--neutral': '#9CA3AF',
      '--shadow': '0 2px 12px rgba(0,0,0,0.3)',
      '--shadow-sm': '0 1px 4px rgba(0,0,0,0.2)',
    },
  },
  business: {
    id: 'business',
    name: '商务蓝',
    vars: {
      '--bg': '#F8FAFC',
      '--bg-sidebar': '#EFF4F9',
      '--bg-card': '#FFFFFF',
      '--bg-input': '#F1F5F9',
      '--bg-hover': '#E8EFF7',
      '--bg-nav': '#0F4C81',
      '--text': '#2D3748',
      '--text-muted': '#718096',
      '--text-on-primary': '#FFFFFF',
      '--border': '#DDE3EC',
      '--primary': '#0F4C81',
      '--primary-hover': '#1A5FA0',
      '--primary-bg': 'rgba(15,76,129,0.08)',
      '--up': '#C53030',
      '--down': '#2F855A',
      '--neutral': '#718096',
      '--shadow': 'none',
      '--shadow-sm': 'none',
    },
  },
};

const STORAGE_KEY = 'fin-h5-theme';

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES[stored]) return stored;
  } catch {}
  return 'light';
}

export function setStoredTheme(id) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch {}
}

// 注入主题CSS变量到document
export function applyTheme(themeId) {
  const theme = THEMES[themeId] || THEMES.light;
  let styleEl = document.getElementById('theme-css-vars');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'theme-css-vars';
    document.head.appendChild(styleEl);
  }
  const vars = Object.entries(theme.vars).map(([k, v]) => `${k}:${v}`).join(';');
  styleEl.textContent = `:root{${vars}}`;
  // 同时设data属性供CSS选择器用
  document.documentElement.setAttribute('data-theme', themeId);
}
