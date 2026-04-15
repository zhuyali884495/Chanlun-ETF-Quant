'use strict';

/**
 * 缠论核心算法引擎 v1.0
 * 实现：K线包含处理 → 分型 → 笔 → 线段 → 中枢 → 走势 → 背驰 → 买卖点
 */

// ─── K线数据容器 ───────────────────────────────────────────────
class KLine {
  constructor(data) {
    this.index = data.index;
    this.date = data.date;
    this.open = parseFloat(data.open);
    this.high = parseFloat(data.high);
    this.low = parseFloat(data.low);
    this.close = parseFloat(data.close);
    this.vol = parseFloat(data.vol || 0);
    // 处理后字段（包含关系处理后）
    this.touched = false;   // 包含处理标记
    this.merged = false;    // 是否被包含
  }
}

// ─── 分型 ──────────────────────────────────────────────────────
class FenXing {
  constructor(type, klines, index) {
    this.type = type;         // 'ding' | 'di'
    this.klines = klines;     // 构成该分型的3根K线
    this.index = index;       // 中间那根的位置
    this.price = klines[1].high;  // 顶分型用high，底分型用low
  }
}

// ─── 笔 ────────────────────────────────────────────────────────
class Bi {
  constructor(start, end, type) {
    this.start = start;       // 起始分型index
    this.end = end;           // 结束分型index
    this.type = type;         // 'up' | 'down'
    this.high = Math.max(start.price, end.price);
    this.low = Math.min(start.price, end.price);
    this.startK = start;
    this.endK = end;
    this.zhongshu = null;     // 关联的中枢
  }
}

// ─── 线段 ──────────────────────────────────────────────────────
class XianDuan {
  constructor(biList, type) {
    this.biList = biList;     // 构成线段的笔列表
    this.type = type;         // 'up' | 'down'
    this.high = Math.max(...biList.map(b => b.high));
    this.low = Math.min(...biList.map(b => b.low));
    this.zhongshuList = [];   // 线段内的中枢
  }
}

// ─── 中枢 ─────────────────────────────────────────────────────
class ZhongShu {
  constructor(beginBi, endBi, range, level) {
    this.beginBi = beginBi;
    this.endBi = endBi;
    this.level = level;       // 'bi' | 'xianduan'
    this.high = range.high;
    this.low = range.low;
    this.priceRange = range.high - range.low;
  }
}

// ─── 走势 ──────────────────────────────────────────────────────
class Trend {
  constructor(type, biList, zhongshu) {
    this.type = type;         // 'up' | 'down' | 'panzheng'
    this.biList = biList;
    this.zhongshu = zhongshu;
    this.high = Math.max(...biList.map(b => b.high));
    this.low = Math.min(...biList.map(b => b.low));
  }
}

// ─── 背驰判断结果 ──────────────────────────────────────────────
class BeiChi {
  constructor(type, location, strength, targetBiIndex) {
    this.type = type;         // 'qushi' | 'panzheng'
    this.location = location; // 在哪个走势末端
    this.strength = strength; // 1-10评级
    this.targetBiIndex = targetBiIndex; // 背驰段索引
  }
}

// ─── 买卖点 ────────────────────────────────────────────────────
class BuySellPoint {
  constructor(type, index, price, level, valid) {
    this.type = type;   // 'yi_buy'|'er_buy'|'san_buy'|'yi_sell'|'er_sell'|'san_sell'
    this.index = index;
    this.price = price;
    this.level = level; // 1-5星
    this.valid = valid; // 有效/无效
  }
}

// ─── 核心引擎 ──────────────────────────────────────────────────
class ChanEngine {
  constructor() {
    this.rawKlines = [];
    this.mergedKlines = [];    // 处理包含关系后的K线
    this.fenxingList = [];     // 分型列表
    this.biList = [];          // 笔列表
    this.xianduanList = [];   // 线段列表
    this.zhongshuBiList = [];  // 笔级别中枢
    this.zhongshuXDList = [];  // 线段级别中枢
    this.trendList = [];       // 走势列表
    this.beichiList = [];      // 背驰列表
    this.buySellPoints = [];   // 买卖点
    this.supportLevels = [];   // 支撑位
    this.resistanceLevels = []; // 压力位
  }

  // ── 加载原始K线数据 ─────────────────────────────────────────
  loadKlines(rawData) {
    this.rawKlines = rawData.map((d, i) => new KLine({ ...d, index: i }));
    this._reset();
  }

  _reset() {
    this.mergedKlines = [];
    this.fenxingList = [];
    this.biList = [];
    this.xianduanList = [];
    this.zhongshuBiList = [];
    this.zhongshuXDList = [];
    this.trendList = [];
    this.beichiList = [];
    this.buySellPoints = [];
    this.supportLevels = [];
    this.resistanceLevels = [];
  }

  // ── 全量分析 ─────────────────────────────────────────────────
  analyze() {
    this._mergeContains();     // 1. 处理包含关系
    this._findFenXing();        // 2. 识别分型
    this._buildBi();           // 3. 构建笔
    this._buildXianDuan();     // 4. 构建线段
    this._findZhongShu();      // 5. 识别中枢
    this._findTrend();         // 6. 划分走势
    this._findBeiChi();        // 7. 判断背驰
    this._findBuySellPoints(); // 8. 定位买卖点
    this._findSupportResistance(); // 9. 支撑压力位
    return this._buildResult();
  }

  // ────────────────────────────────────────────────────────────
  // 步骤1：处理包含关系
  // ────────────────────────────────────────────────────────────
  _mergeContains() {
    const kl = this.rawKlines;
    if (!kl || kl.length === 0) return;

    let merged = [new KLine(kl[0])];
    merged[0].touched = false;

    for (let i = 1; i < kl.length; i++) {
      const prev = merged[merged.length - 1];
      const curr = kl[i];

      const prevIsUp = prev.high - prev.low >= 0; // 阳线（其实直接比较）
      const currHighAbove = curr.high > prev.high;
      const currLowBelow = curr.low < prev.low;
      const currHighBelow = curr.high < prev.high;
      const currLowAbove = curr.low > prev.low;

      if ((currHighAbove && currLowAbove) || (currHighBelow && currLowBelow)) {
        // 无包含关系，直接保留
        merged.push(new KLine(curr));
      } else {
        // 有包含关系：合并
        prev.high = Math.max(prev.high, curr.high);
        prev.low = Math.min(prev.low, curr.low);
        prev.close = curr.close; // 取最后一根的收盘
        prev.merged = true;
      }
    }

    // 去除连续合并的K线（再次检查）
    let finalMerged = [merged[0]];
    for (let i = 1; i < merged.length; i++) {
      const p = finalMerged[finalMerged.length - 1];
      const c = merged[i];
      if ((c.high > p.high && c.low > p.low) || (c.high < p.high && c.low < p.low)) {
        finalMerged.push(c);
      } else {
        p.high = Math.max(p.high, c.high);
        p.low = Math.min(p.low, c.low);
        p.close = c.close;
      }
    }

    // 重新编号
    finalMerged.forEach((k, i) => { k.index = i; });
    this.mergedKlines = finalMerged;
  }

  // ────────────────────────────────────────────────────────────
  // 步骤2：识别分型（顶分型 / 底分型）
  // ────────────────────────────────────────────────────────────
  _findFenXing() {
    const kl = this.mergedKlines;
    this.fenxingList = [];

    for (let i = 1; i < kl.length - 1; i++) {
      const left = kl[i - 1];
      const mid = kl[i];
      const right = kl[i + 1];

      // 顶分型：中间K线高点最高，低点也高于两侧
      const isDing = mid.high > left.high && mid.high > right.high &&
                    mid.low > left.low && mid.low > right.low;
      // 底分型：中间K线低点最低，高点也低于两侧
      const isDi = mid.low < left.low && mid.low < right.low &&
                   mid.high < left.high && mid.high < right.high;

      if (isDing) {
        this.fenxingList.push(new FenXing('ding', [left, mid, right], i));
      } else if (isDi) {
        this.fenxingList.push(new FenXing('di', [left, mid, right], i));
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // 步骤3：构建笔（5根不包含关系的K线，顶底交替）
  // ────────────────────────────────────────────────────────────
  _buildBi() {
    const fx = this.fenxingList;
    this.biList = [];

    if (fx.length < 2) return;

    let i = 0;
    while (i < fx.length - 1) {
      const curr = fx[i];
      const next = fx[i + 1];

      // 笔的条件：顶分型之后是底分型（下跌笔），或底分型之后是顶分型（上涨笔）
      // 且两分型之间不包含关系（已经处理过了）
      // 笔的幅度要求：|价格差| > 0（简化版，不设最小幅度）
      let type, start, end;
      if (curr.type === 'ding' && next.type === 'di') {
        // 下跌笔：从顶到腰
        type = 'down';
        start = curr;
        end = next;
        i += 2;
      } else if (curr.type === 'di' && next.type === 'ding') {
        // 上涨笔：从腰到顶
        type = 'up';
        start = curr;
        end = next;
        i += 2;
      } else {
        i++;
        continue;
      }

      // 笔内K线数量检查（至少5根，处理包含后重新数）
      const startIdx = start.index;
      const endIdx = end.index;
      if (endIdx - startIdx >= 4) { // 至少5根K线（含首尾）
        this.biList.push(new Bi(start, end, type));
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // 步骤4：构建线段（3笔重叠构成线段）
  // ────────────────────────────────────────────────────────────
  _buildXianDuan() {
    const bi = this.biList;
    this.xianduanList = [];

    if (bi.length < 3) return;

    let i = 0;
    while (i <= bi.length - 3) {
      const b1 = bi[i];
      const b2 = bi[i + 1];
      const b3 = bi[i + 2];

      // 线段：3笔有重叠区域，且第2笔与第1、3笔反向
      const b1Up = b1.type === 'up';
      const overlap = this._hasOverlap(b1, b2);

      if (overlap && b1.type !== b2.type && b2.type !== b3.type) {
        // 可以构成线段
        const type = b2.type;
        const xdBiList = [b1, b2, b3];

        // 延伸检查：后续笔若仍在同一方向内，继续延伸
        let extendIdx = i + 3;
        while (extendIdx < bi.length) {
          const nextBi = bi[extendIdx];
          if (nextBi.type === type && this._hasOverlap(bi[extendIdx - 1], nextBi)) {
            xdBiList.push(nextBi);
            extendIdx++;
          } else {
            break;
          }
        }

        this.xianduanList.push(new XianDuan(xdBiList, type));
        i = extendIdx;
      } else {
        i++;
      }
    }
  }

  _hasOverlap(bi1, bi2) {
    const h = Math.min(bi1.high, bi2.high);
    const l = Math.max(bi1.low, bi2.low);
    return h > l; // 有重叠区域
  }

  // ────────────────────────────────────────────────────────────
  // 步骤5：识别中枢（至少3笔有重叠区域）
  // ────────────────────────────────────────────────────────────
  _findZhongShu() {
    this.zhongshuBiList = [];
    const bi = this.biList;
    if (bi.length < 3) return;

    let i = 0;
    while (i <= bi.length - 3) {
      // 找3笔重叠
      const overlap1 = this._hasOverlap(bi[i], bi[i + 1]);
      const overlap2 = this._hasOverlap(bi[i + 1], bi[i + 2]);

      if (overlap1 && overlap2) {
        // 确认中枢：连续笔之间两两重叠
        let zxHigh = Math.max(bi[i].high, bi[i + 1].high, bi[i + 2].high);
        let zxLow = Math.min(bi[i].low, bi[i + 1].low, bi[i + 2].low);

        // 延伸中枢
        let endIdx = i + 2;
        while (endIdx < bi.length - 1) {
          const nextBi = bi[endIdx + 1];
          const lastBi = bi[endIdx];
          if (this._hasOverlap(lastBi, nextBi)) {
            zxHigh = Math.max(zxHigh, nextBi.high);
            zxLow = Math.min(zxLow, nextBi.low);
            endIdx++;
          } else {
            break;
          }
        }

        const zx = new ZhongShu(bi[i], bi[endIdx], { high: zxHigh, low: zxLow }, 'bi');
        // 避免重复
        if (!this._zxExists(zx, this.zhongshuBiList)) {
          this.zhongshuBiList.push(zx);
        }
        i = endIdx + 1;
      } else {
        i++;
      }
    }

    // 线段级别中枢（用线段构建）
    this._findZhongShuXD();
  }

  _findZhongShuXD() {
    this.zhongshuXDList = [];
    const xd = this.xianduanList;
    if (xd.length < 2) return;

    let i = 0;
    while (i <= xd.length - 2) {
      const overlap = this._hasOverlapXD(xd[i], xd[i + 1]);
      if (overlap) {
        let zxHigh = Math.max(xd[i].high, xd[i + 1].high);
        let zxLow = Math.min(xd[i].low, xd[i + 1].low);
        let endIdx = i + 1;

        while (endIdx < xd.length - 1) {
          if (this._hasOverlapXD(xd[endIdx], xd[endIdx + 1])) {
            zxHigh = Math.max(zxHigh, xd[endIdx + 1].high);
            zxLow = Math.min(zxLow, xd[endIdx + 1].low);
            endIdx++;
          } else break;
        }

        const zx = new ZhongShu(xd[i], xd[endIdx], { high: zxHigh, low: zxLow }, 'xianduan');
        if (!this._zxExists(zx, this.zhongshuXDList)) {
          this.zhongshuXDList.push(zx);
        }
        i = endIdx + 1;
      } else i++;
    }
  }

  _hasOverlapXD(xd1, xd2) {
    const h = Math.min(xd1.high, xd2.high);
    const l = Math.max(xd1.low, xd2.low);
    return h > l;
  }

  _zxExists(newZx, list) {
    return list.some(z => Math.abs(z.high - newZx.high) < 0.001 && Math.abs(z.low - newZx.low) < 0.001);
  }

  // ────────────────────────────────────────────────────────────
  // 步骤6：走势划分
  // ────────────────────────────────────────────────────────────
  _findTrend() {
    this.trendList = [];
    const bi = this.biList;
    const zxList = this.zhongshuBiList;

    if (bi.length < 3) return;

    let i = 0;
    while (i < bi.length) {
      const currBi = bi[i];
      // 找这个笔所属的中枢
      const relatedZx = zxList.find(z => z.beginBi === currBi || z.endBi === currBi) || zxList[0];

      // 找出同方向的连续笔
      let j = i + 1;
      while (j < bi.length && bi[j].type === currBi.type) j++;

      const trendBiList = bi.slice(i, j);
      if (trendBiList.length >= 2) {
        // 判断走势类型
        let type = currBi.type === 'up' ? 'up' : 'down';
        // 简化：盘整判断需要同级别反向
        this.trendList.push(new Trend(type, trendBiList, relatedZx));
      }
      i = j > i ? j : i + 1;
    }
  }

  // ────────────────────────────────────────────────────────────
  // 步骤7：背驰判断（MACD面积 + 力度对比）
  // ────────────────────────────────────────────────────────────
  _findBeiChi() {
    this.beichiList = [];
    const bi = this.biList;
    if (bi.length < 4) return;

    // 遍历最近若干笔，找背驰
    const lookback = Math.min(bi.length - 2, 10);
    for (let i = 0; i < lookback; i++) {
      const curr = bi[bi.length - 1 - i];
      const prev = bi[bi.length - 2 - i];
      const prevPrev = bi[bi.length - 3 - i];

      if (!prev || !prevPrev) continue;

      // 同向笔比较力度（用价格幅度 × 成交量）
      const currPower = Math.abs(curr.high - curr.low) * (curr.startK.vol || 1);
      const prevPower = Math.abs(prev.high - prev.low) * (prev.startK.vol || 1);

      // 趋势背驰：同向走势中后一笔力度小于前一笔
      if (curr.type === prev.type) {
        if (currPower < prevPower * 0.8) { // 80%以下视为背驰
          const strength = Math.round((1 - currPower / prevPower) * 10);
          this.beichiList.push(new BeiChi('qushi', bi.length - 1 - i, Math.max(1, Math.min(10, strength)), i));
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // 步骤8：买卖点定位
  // ────────────────────────────────────────────────────────────
  _findBuySellPoints() {
    this.buySellPoints = [];
    const bi = this.biList;
    const zxList = this.zhongshuBiList;

    if (bi.length < 3 || zxList.length === 0) return;

    const latestZx = zxList[zxList.length - 1];

    // 一买：下跌笔结束后，第一个底分型对应位置（需确认背驰）
    // 二买：下跌走势第一次回踩中枢下沿不破
    // 三买：上涨回踩中枢上沿不破

    // 一卖：上涨笔结束后，第一个顶分型
    // 二卖：上涨走势第一次反弹中枢上沿不过
    // 三卖：下跌反弹中枢下沿不过

    for (let i = 1; i < bi.length - 1; i++) {
      const curr = bi[i];
      const prev = bi[i - 1];
      const next = bi[i + 1];

      if (curr.type === 'down' && prev.type === 'up' && next) {
        // 一买：下跌笔起点（底分型后第一笔的起点）
        const beichi = this.beichiList.find(b => b.type === 'qushi');
        const level = beichi ? Math.min(5, beichi.strength) : 2;
        this.buySellPoints.push(new BuySellPoint('yi_buy', curr.startK.index, curr.low, level, true));
      }

      if (curr.type === 'up' && prev.type === 'down' && next) {
        // 一卖：上涨笔起点（顶分型后第一笔的起点）
        this.buySellPoints.push(new BuySellPoint('yi_sell', curr.startK.index, curr.high, 3, true));
      }
    }

    // 二买：回踩中枢下沿不破
    if (latestZx) {
      const lastBi = bi[bi.length - 1];
      if (lastBi.type === 'down' && lastBi.low > latestZx.low * 0.99) {
        this.buySellPoints.push(new BuySellPoint('er_buy', lastBi.endK.index, latestZx.low, 4, true));
      }
      // 二卖：反弹中枢上沿不过
      if (lastBi.type === 'up' && lastBi.high < latestZx.high * 1.01) {
        this.buySellPoints.push(new BuySellPoint('er_sell', lastBi.endK.index, latestZx.high, 4, true));
      }
      // 三买：突破中枢上沿后回踩
      if (lastBi.type === 'up' && lastBi.high > latestZx.high) {
        this.buySellPoints.push(new BuySellPoint('san_buy', lastBi.endK.index, latestZx.high, 3, true));
      }
      // 三卖
      if (lastBi.type === 'down' && lastBi.low < latestZx.low) {
        this.buySellPoints.push(new BuySellPoint('san_sell', lastBi.endK.index, latestZx.low, 3, true));
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // 步骤9：支撑压力位
  // ────────────────────────────────────────────────────────────
  _findSupportResistance() {
    this.supportLevels = [];
    this.resistanceLevels = [];

    const kl = this.mergedKlines;
    const zxList = this.zhongshuBiList;

    // 中枢下沿 = 支撑
    // 中枢上沿 = 压力
    for (const zx of zxList) {
      this.supportLevels.push({ price: zx.low, type: 'zhongshu', label: `中枢下沿 ${zx.low.toFixed(2)}` });
      this.resistanceLevels.push({ price: zx.high, type: 'zhongshu', label: `中枢上沿 ${zx.high.toFixed(2)}` });
    }

    // 前低（前10根范围）
    const recentKL = kl.slice(-20);
    if (recentKL.length > 0) {
      const minLow = Math.min(...recentKL.map(k => k.low));
      const maxHigh = Math.max(...recentKL.map(k => k.high));
      const lastClose = recentKL[recentKL.length - 1].close;
      if (minLow < lastClose) {
        this.supportLevels.push({ price: minLow, type: 'qian_di', label: `前低 ${minLow.toFixed(2)}` });
      }
      if (maxHigh > lastClose) {
        this.resistanceLevels.push({ price: maxHigh, type: 'qian_gao', label: `前高 ${maxHigh.toFixed(2)}` });
      }
    }

    // 排序
    this.supportLevels.sort((a, b) => a.price - b.price);
    this.resistanceLevels.sort((a, b) => b.price - a.price);
  }

  // ────────────────────────────────────────────────────────────
  // 构建输出结果
  // ────────────────────────────────────────────────────────────
  _buildResult() {
    const latestBi = this.biList[this.biList.length - 1];
    const latestZx = this.zhongshuBiList[this.zhongshuBiList.length - 1];

    // 当前走势定性
    let structure定性 = '无明确走势';
    let currentTrend = '观望';

    if (latestBi) {
      if (latestBi.type === 'up') {
        structure定性 = '上涨笔中' + (latestZx ? `，处于中枢区间 [${latestZx.low.toFixed(2)}, ${latestZx.high.toFixed(2)}]` : '');
        currentTrend = '看多';
      } else {
        structure定性 = '下跌笔中' + (latestZx ? `，处于中枢区间 [${latestZx.low.toFixed(2)}, ${latestZx.high.toFixed(2)}]` : '');
        currentTrend = '看空';
      }
    }

    // 操作建议
    const buyPoints = this.buySellPoints.filter(p => p.type.startsWith('yi_') && p.type.includes('buy'));
    const sellPoints = this.buySellPoints.filter(p => p.type.startsWith('yi_') && p.type.includes('sell'));
    let advice = '等待买点形成';

    if (latestBi && latestBi.type === 'down') {
      advice = '下跌笔运行中，等待背驰确认后可考虑一买建仓，关注中枢下沿支撑';
    } else if (latestBi && latestBi.type === 'up') {
      advice = '上涨笔运行中，持有待涨，关注中枢上沿压力，若背驰出现考虑减仓';
    }

    // 三种走势分类
    const lastPrice = this.mergedKlines[this.mergedKlines.length - 1]?.close || 0;
    const forecasts = [];

    if (latestBi) {
      const hasBeiChi = this.beichiList.length > 0;
      forecasts.push({
        type: '延续',
        prob: hasBeiChi ? '低' : '中',
        desc: latestBi.type === 'up' ? '继续上涨创出新高，形成上涨线段延续' : '继续下跌创出新低，形成下跌线段延续',
        action: latestBi.type === 'up' ? '持股/逢低加仓' : '观望/止损'
      });
      forecasts.push({
        type: '转折',
        prob: hasBeiChi ? '高' : '中',
        desc: '出现背驰信号，走势分类将发生改变，注意把握买卖点',
        action: hasBeiChi ? '减仓/止损' : '密切观察'
      });
      forecasts.push({
        type: '中枢扩展',
        prob: '中',
        desc: '在现有中枢区间震荡，消化筹码后选择方向',
        action: '高抛低吸，降低成本'
      });
    }

    return {
      meta: {
        totalKlines: this.rawKlines.length,
        mergedKlines: this.mergedKlines.length,
        biCount: this.biList.length,
        xianDuanCount: this.xianduanList.length,
        zhongshuCount: this.zhongshuBiList.length,
      },
      structure: {
        定性: structure定性,
        当前走势: currentTrend,
        最新笔: latestBi ? { type: latestBi.type, from: latestBi.startK.index, to: latestBi.endK.index, high: latestBi.high, low: latestBi.low } : null,
        最新中枢: latestZx ? { high: latestZx.high, low: latestZx.low, level: latestZx.level } : null,
      },
      advice: {
        操作建议: advice,
        当前买点: this.buySellPoints.filter(p => p.type.includes('buy')).map(p => ({ type: p.type, price: p.price, level: p.level })),
        当前卖点: this.buySellPoints.filter(p => p.type.includes('sell')).map(p => ({ type: p.type, price: p.price, level: p.level })),
      },
      forecasts,
      klineData: this.mergedKlines.map(k => ({
        index: k.index,
        date: k.date,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        vol: k.vol,
      })),
      fenxing: this.fenxingList.map(fx => ({
        type: fx.type,
        index: fx.index,
        price: fx.type === 'ding' ? fx.klines[1].high : fx.klines[1].low,
      })),
      bi: this.biList.map(b => ({
        type: b.type,
        startIndex: b.start.index,
        endIndex: b.end.index,
        startPrice: b.type === 'up' ? b.startK.low : b.startK.high,
        endPrice: b.type === 'up' ? b.endK.high : b.endK.low,
        high: b.high,
        low: b.low,
      })),
      xianduan: this.xianduanList.map(xd => ({
        type: xd.type,
        biCount: xd.biList.length,
        high: xd.high,
        low: xd.low,
      })),
      zhongshu: this.zhongshuBiList.map(zx => ({
        level: zx.level,
        high: zx.high,
        low: zx.low,
        beginBiIndex: zx.beginBi.index,
        endBiIndex: zx.endBi.index,
      })),
      beichi: this.beichiList.map(bc => ({
        type: bc.type,
        location: bc.location,
        strength: bc.strength,
      })),
      buypoints: this.buySellPoints.filter(p => p.type.includes('buy')).map(p => ({
        type: p.type,
        index: p.index,
        price: p.price,
        level: p.level,
        label: p.type === 'yi_buy' ? '一买' : p.type === 'er_buy' ? '二买' : '三买',
      })),
      sellpoints: this.buySellPoints.filter(p => p.type.includes('sell')).map(p => ({
        type: p.type,
        index: p.index,
        price: p.price,
        level: p.level,
        label: p.type === 'yi_sell' ? '一卖' : p.type === 'er_sell' ? '二卖' : '三卖',
      })),
      support: this.supportLevels.slice(0, 5),
      resistance: this.resistanceLevels.slice(0, 5),
    };
  }
}

module.exports = { ChanEngine, KLine, FenXing, Bi, XianDuan, ZhongShu, Trend, BeiChi, BuySellPoint };
