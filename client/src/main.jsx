import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { applyTheme, getStoredTheme } from './theme.js';

// 启动时应用保存的主题
applyTheme(getStoredTheme());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
