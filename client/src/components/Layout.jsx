import React, { useState, useEffect, useRef } from 'react';
import { CORE_ETFS } from '../constants.js';
import { THEMES, applyTheme, getStoredTheme, setStoredTheme } from '../theme.js';

function MenuIcon({ name }) {
  const icons = {
    home: '🏠', chan: '📈', sentiment: '🌡️', grid: '📊',
    capital: '💰', risk: '🛡️', select: '🔍', portfolio: '💼',
    settings: '⚙️', alerts: '🔔',
  };
  return <span style={{ marginRight: 8 }}>{icons[name] || '•'}</span>;
}

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}

export default function Layout({ children, activeTab, onTabChange, alertCount, onSearch }) {
  const { w } = useWindowSize();
  const isMobile = w < 768;
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [searchVal, setSearchVal] = useState('');
  const [themeId, setThemeId] = useState(getStoredTheme);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const searchRef = useRef(null);
  const themeMenuRef = useRef(null);

  // 应用主题
  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  // 点击外部关闭主题菜单
  useEffect(() => {
    const handler = (e) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Enter' && searchVal.trim() && document.activeElement === searchRef.current) {
        const q = searchVal.trim().toUpperCase();
        const found = CORE_ETFS.find(etf =>
          etf.code.includes(q) || etf.name.toUpperCase().includes(q)
        );
        if (found && onSearch) { onSearch(found.code); setSearchVal(''); }
        else if (!found) {
          searchRef.current?.setCustomValidity('未找到标的');
          searchRef.current?.reportValidity();
          setTimeout(() => { if (searchRef.current) searchRef.current.setCustomValidity(''); }, 1500);
        }
      }
    };
    const input = searchRef.current;
    if (input) input.addEventListener('keydown', handler);
    return () => { if (input) input.removeEventListener('keydown', handler); };
  }, [searchVal, onSearch]);

  const menuItems = [
    { key: 'home', label: '首页' },
    { key: 'chan', label: '缠论分析' },
    { key: 'sentiment', label: '景气度打分' },
    { key: 'grid', label: '网格策略' },
    { key: 'capital', label: '资金研判' },
    { key: 'risk', label: '风险测评' },
    { key: 'select', label: '标的筛选' },
    { key: 'portfolio', label: '我的持仓' },
    { key: 'alerts', label: '智能预警', badge: alertCount },
    { key: 'settings', label: '系统设置' },
  ];

  const NavContent = ({ onClose }) => (
    <div style={{
      display: 'flex', flexDirection: 'column',
      gap: 2, padding: '8px 6px',
      overflowY: 'auto', flex: 1,
    }}>
      {menuItems.map(item => (
        <button
          key={item.key}
          onClick={() => { onTabChange(item.key); if (onClose) onClose(); }}
          style={{
            display: 'flex', alignItems: 'center',
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === item.key ? 'var(--primary-bg)' : 'transparent',
            color: activeTab === item.key ? 'var(--primary)' : 'var(--text-muted)',
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: activeTab === item.key ? 600 : 400,
            textAlign: 'left',
            width: '100%',
            transition: 'all 0.15s',
            position: 'relative',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { if (activeTab !== item.key) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)'; } }}
          onMouseLeave={e => { if (activeTab !== item.key) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
        >
          <MenuIcon name={item.key} />
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.badge > 0 && (
            <span style={{
              background: 'var(--down)', color: '#fff', borderRadius: 10,
              padding: '1px 7px', fontSize: 11, fontWeight: 700,
              minWidth: 20, textAlign: 'center',
            }}>{item.badge}</span>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: 'var(--bg)',
      color: 'var(--text)',
    }}>
      {/* 左侧边栏（PC） */}
      {!isMobile && (
        <div style={{
          width: 210,
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '20px 16px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>🦞 金融内网</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>A股 ETF 分析系统</div>
          </div>
          <NavContent />
        </div>
      )}

      {/* 移动端侧边栏 */}
      {isMobile && sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)' }} onClick={() => setSidebarOpen(false)}>
          <div style={{
            width: 260, height: '100%', background: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '16px 16px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>🦞 金融内网</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>A股 ETF 分析系统</div>
              </div>
              <button onClick={() => setSidebarOpen(false)} style={{
                background: 'var(--border)', border: 'none', borderRadius: 8,
                color: 'var(--text)', fontSize: 16, width: 30, height: 30,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>
            <NavContent onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* 主内容 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 顶部导航栏 */}
        <div style={{
          height: 52,
          background: 'var(--bg-nav)',
          display: 'flex', alignItems: 'center',
          padding: '0 16px', gap: 12, flexShrink: 0,
        }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(true)} style={{
              background: 'none', border: 'none', color: 'var(--text-on-primary)',
              fontSize: 22, cursor: 'pointer', padding: 4, lineHeight: 1,
            }}>☰</button>
          )}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-on-primary)' }}>
              {menuItems.find(m => m.key === activeTab)?.label || '首页'}
            </span>
          </div>

          {/* 搜索框（非移动端） */}
          {!isMobile && (
            <div style={{ flex: 1, maxWidth: 280, position: 'relative' }}>
              <input
                ref={searchRef}
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                placeholder="搜索ETF代码/名称 → 回车跳转"
                style={{
                  width: '100%', padding: '6px 32px 6px 10px',
                  borderRadius: 8, border: 'none',
                  background: 'rgba(255,255,255,0.2)',
                  color: 'var(--text-on-primary)', fontSize: 12,
                  boxSizing: 'border-box', outline: 'none',
                }}
                onFocus={e => e.target.style.background = 'rgba(255,255,255,0.3)'}
                onBlur={e => e.target.style.background = 'rgba(255,255,255,0.2)'}
              />
              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'rgba(255,255,255,0.7)', pointerEvents: 'none' }}>🔍</span>
            </div>
          )}

          {/* 主题切换 */}
          <div ref={themeMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowThemeMenu(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.15)',
                color: 'var(--text-on-primary)', fontSize: 12,
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              🎨 {THEMES[themeId]?.name || '主题'}
              <span style={{ fontSize: 10 }}>▼</span>
            </button>

            {showThemeMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                boxShadow: 'var(--shadow)',
                minWidth: 140, zIndex: 300,
                overflow: 'hidden',
              }}>
                {Object.values(THEMES).map(theme => (
                  <button
                    key={theme.id}
                    onClick={() => {
                      setThemeId(theme.id);
                      setStoredTheme(theme.id);
                      setShowThemeMenu(false);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '10px 14px',
                      border: 'none',
                      background: themeId === theme.id ? 'var(--primary-bg)' : 'transparent',
                      color: themeId === theme.id ? 'var(--primary)' : 'var(--text)',
                      fontSize: 13, cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: themeId === theme.id ? 600 : 400,
                    }}
                    onMouseEnter={e => { if (themeId !== theme.id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (themeId !== theme.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: theme.vars['--primary'],
                      border: '2px solid var(--border)',
                      flexShrink: 0,
                    }} />
                    {theme.name}
                    {themeId === theme.id && <span style={{ marginLeft: 'auto', color: 'var(--primary)' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 时间 */}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
            {new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: 'var(--bg)' }}>
          {children}
        </div>

        {/* 底部信息栏 */}
        <div style={{
          height: 30,
          background: 'var(--bg-sidebar)',
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', fontSize: 11, color: 'var(--text-muted)',
          flexShrink: 0,
        }}>
          <span>🦞 金融内网 H5</span>
          <span>数据来源：东方财富</span>
        </div>
      </div>
    </div>
  );
}
