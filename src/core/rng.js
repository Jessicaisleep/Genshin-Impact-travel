/* 纳西妲旅行 · 种子随机数
 * 设计红线：一切游戏随机都必须来自种子，保证同种子同结果、可复现、可测试。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});

  /** mulberry32：小巧、质量足够的确定性 PRNG */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 把任意字符串转成 32 位种子 */
  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  var rng = { mulberry32: mulberry32, hashSeed: hashSeed };

  /** 带权抽签。items: [{weight, ...}] 或 [{w, ...}]
   *  返回被选中的元素本身，全部权重为 0 时返回 null。 */
  rng.weighted = function (rand, items, weightKey) {
    weightKey = weightKey || 'weight';
    var total = 0, i, w;
    for (i = 0; i < items.length; i++) {
      w = items[i][weightKey];
      if (typeof w === 'number' && w > 0) total += w;
    }
    if (total <= 0) return null;
    var r = rand() * total;
    var acc = 0;
    for (i = 0; i < items.length; i++) {
      w = items[i][weightKey];
      if (typeof w !== 'number' || w <= 0) continue;
      acc += w;
      if (r < acc) return items[i];
    }
    return items[items.length - 1];
  };

  /** 无放回带权抽取 n 个 */
  rng.weightedMany = function (rand, items, n, weightKey) {
    var pool = items.slice(), out = [];
    while (out.length < n && pool.length) {
      var pick = rng.weighted(rand, pool, weightKey);
      if (!pick) break;
      out.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
    return out;
  };

  NT.rng = rng;
})(typeof window !== 'undefined' ? window : this);
