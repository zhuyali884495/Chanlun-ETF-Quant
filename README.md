# 🦞 金融内网 · A股 ETF 分析系统

基于**缠论**、**景气度量化打分**、**网格策略**的A股 ETF 智能分析平台。

> 接入东方财富权威数据，支持缠论结构分析、行业景气度研判、持仓管理、买卖点预警。

---

## 功能特性

### 📈 缠论结构分析
- 自动识别笔、线段、中枢、背驰
- 标注一买/二买/三买，一卖/二卖/三卖
- 支持日线、60分钟、30分钟、周线四周期切换
- 关键支撑位 / 压力位标注
- 走势分类与应对预案
- 📥 分析报告一键导出（打印PDF）
- 🔔 买卖点预警规则设置

### 🌡️ 行业景气度打分
- **五维度量化模型**：供需格局、政策导向、业绩表现、估值分位、资金流向
- SVG 雷达图可视化
- 12期景气度趋势图
- 拐点预判 + 持续性评级
- 行业内排名
- 操作配置建议

### 📊 网格策略
- 基于波动率的自适应网格参数
- 止损/止盈建议

### 💰 资金研判
- 主力资金流向分析
- DDX 指标追踪
- 次日资金预判

### 🛡️ 风险测评
- 波幅风险、趋势风险、流动性风险量化

### 🔍 标的筛选
- 按分红、PE分位、ROE条件筛选全市场 ETF

### 💼 持仓管理
- 实时持仓市值、盈亏核算
- 账户资产全景展示

### 🔔 智能预警
- Cron 定时自动检查买卖点
- 微信/PushPlus 推送通知

---

## 技术架构

```
client/          React 18 + Vite + lightweight-charts
server/           Node.js + Express
缠论引擎          server/chan/engine.js（K线处理 → 分型 → 笔 → 线段 → 中枢 → 背驰）
数据源            东方财富 mx-data API（通过 MX_APIKEY 接入）
```

---

## 快速启动

### 1. 安装依赖

```bash
cd client && npm install
cd ../server && npm install
```

### 2. 配置数据 API

在环境变量中设置东方财富 mx-data API Key（[获取地址](https://dl.dfcfs.com/m/itc4)）：

```bash
export MX_APIKEY=your_api_key_here
```

### 3. 启动服务

```bash
# 后端（端口 3099）
cd server && node index.js

# 前端（端口 5173，另起终端）
cd client && npm run dev
```

访问 `http://localhost:5173`

---

## 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `MX_APIKEY` | 东方财富妙想数据 API Key | ✅ |

---

## 项目结构

```
chan-theory-h5/
├── client/
│   ├── src/
│   │   ├── App.jsx              # 主应用 + 缠论分析 Tab
│   │   ├── components/
│   │   │   ├── Layout.jsx       # 导航布局
│   │   │   ├── HomePage.jsx     # 首页
│   │   │   ├── Page.jsx          # 景气度/网格/资金/风险等模块
│   │   │   ├── Portfolio.jsx     # 持仓
│   │   │   └── Alerts.jsx        # 预警
│   │   ├── api/index.js          # API 调用层
│   │   ├── data/DataProvider.jsx # 数据层（缓存 + 交易时段判断）
│   │   └── constants.js          # 核心 ETF 列表
│   └── vite.config.js
├── server/
│   ├── chan/
│   │   ├── engine.js             # 缠论引擎 v2
│   │   ├── analysis.js           # 缠论+景气度+网格+资金+风险分析
│   │   ├── xuangu.js            # ETF 标的筛选
│   │   └── portfolio.js          # 持仓 + 预警
│   ├── data/alerts.json          # 预警数据
│   └── index.js                  # Express 路由
└── README.md
```

---

## 核心 ETF 标的

| 代码 | 名称 | 行业 |
|------|------|------|
| 159326 | 电网设备ETF | 电力设备 |
| 515880 | 通信ETF | 通信服务 |
| 512480 | 半导体ETF | 半导体 |
| 510300 | 沪深300ETF | 大盘蓝筹 |
| 588000 | 科创50ETF | 硬科技 |

---

## License

MIT © 龙虾 🦞
