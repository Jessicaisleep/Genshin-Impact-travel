/* 纳西妲旅行 · 抽签与约束
 * 所有随机都通过传入的 rand()（种子 PRNG），保证可复现、可测试。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  var U = NT.util, R = NT.rng, C = NT.config;

  var RARITY_SCORE = { N: 0, R: 1, SR: 2, SSR: 4 };
  var CATEGORY_LABEL = { scenery: '景观', food: '美食', play: '游玩' };

  var gacha = {};
  gacha.CATEGORY_LABEL = CATEGORY_LABEL;

  /* ---------- 地区事件池 ---------- */
  var _regionEventCache = {};

  /** 把某个地区的 scenery/food/play 展开成事件对象 */
  gacha.regionEvents = function (destId) {
    if (_regionEventCache[destId]) return _regionEventCache[destId];
    var dest = NT.data.destinationById(destId);
    if (!dest) return [];
    var out = [];
    ['scenery', 'food', 'play'].forEach(function (cat) {
      var list = dest[cat] || [];
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        out.push({
          id: destId + '_' + cat + '_' + i,
          name: e.name,
          desc: e.desc,
          sticker: e.sticker,
          category: cat,
          categoryLabel: CATEGORY_LABEL[cat],
          regionLocal: true,
          // 本地的第一个偏常见，第二个稍稀有一些
          rarity: i === 0 ? 'N' : 'R',
          weight: i === 0 ? 11 : 7,
          mood: cat === 'play' ? 'happy' : (cat === 'scenery' ? 'idle' : 'happy')
        });
      }
    });
    _regionEventCache[destId] = out;
    return out;
  };

  /* ---------- 目的地 ---------- */

  /**
   * @param ctx { mode:'region'|'bearing'|'random', regionId, bearingId, history }
   */
  gacha.pickDestination = function (rand, ctx) {
    var history = ctx.history || [];

    // 指定地区：只要不是连续去太多次，就直接给
    if (ctx.mode === 'region' && ctx.regionId) {
      var target = NT.data.destinationById(ctx.regionId);
      if (target) {
        var run = 0;
        for (var h = history.length - 1; h >= 0; h--) {
          if (history[h].destinationId === target.id) run++; else break;
        }
        // 连续去了太多次就换个地方，避免完全没变化
        if (run < 3) return target;
      }
    }

    // 最近连续去过的地方降权
    var lastId = history.length ? history[history.length - 1].destinationId : null;
    var run2 = 0;
    for (var h2 = history.length - 1; h2 >= 0; h2--) {
      if (history[h2].destinationId === lastId) run2++; else break;
    }
    var avoid = (lastId && run2 >= C.pity.destinationRepeatLimit) ? lastId : null;

    var pool = [];
    var list = NT.data.destinations;
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      if (avoid && d.id === avoid) continue;
      if (ctx.mode === 'bearing' && ctx.bearingId && ctx.bearingId !== 'any' && d.bearing !== ctx.bearingId) continue;
      pool.push({ dest: d, weight: d.weight });
    }
    if (!pool.length) {
      pool = list.map(function (x) { return { dest: x, weight: x.weight }; });
    }
    var chosen = R.weighted(rand, pool);
    return chosen ? chosen.dest : list[0];
  };

  /* ---------- 同伴 ---------- */

  gacha.pickCompanion = function (rand, ctx) {
    var dest = ctx.destination;
    var history = ctx.history || [];

    // 保底：连续独行达到阈值 -> 强制遇到
    var gap = 0;
    for (var h = history.length - 1; h >= 0; h--) {
      if (!history[h].companionId) gap++; else break;
    }
    var forceMeet = gap >= C.pity.companionGap;

    var meetChance = 0.58 + (ctx.meetBonus || 0);
    if (ctx.luck) meetChance += 0.08;
    var willMeet = forceMeet || rand() < meetChance;
    if (!willMeet) return null;

    var pool = [];
    var list = NT.data.companions;
    for (var c = 0; c < list.length; c++) {
      var comp = list[c];
      var w = comp.weight;
      // 与地区气质契合的角色更容易出现
      if (dest && comp.tags) {
        for (var t = 0; t < comp.tags.length; t++) {
          if (dest.tags.indexOf(comp.tags[t]) >= 0) { w *= 2.0; break; }
        }
      }
      // 最近同行过的降权
      for (var r = 0; r < Math.min(3, history.length); r++) {
        if (history[history.length - 1 - r].companionId === comp.id) { w *= 0.35; break; }
      }
      pool.push({ comp: comp, weight: w });
    }
    var chosen = R.weighted(rand, pool);
    return chosen ? chosen.comp : null;
  };

  /* ---------- 事件 ---------- */

  /**
   * 事件池 = 该地区自带的景观/美食/游玩 + 全局通用事件（提供稀有度上限）
   * @returns [{id,name,desc,sticker,category,categoryLabel,rarity,mood}]
   */
  gacha.buildEventPool = function (dest) {
    var local = gacha.regionEvents(dest.id);
    var tags = dest.tags || [];
    var globals = [];
    var all = NT.data.events;
    for (var i = 0; i < all.length; i++) {
      var ev = all[i];
      if (ev.fitsTags && ev.fitsTags.length) {
        var ok = false;
        for (var t = 0; t < ev.fitsTags.length; t++) {
          if (tags.indexOf(ev.fitsTags[t]) >= 0) { ok = true; break; }
        }
        if (!ok) continue;
      }
      var copy = {};
      for (var k in ev) copy[k] = ev[k];
      copy.category = 'extra';
      copy.categoryLabel = '途中';
      globals.push(copy);
    }
    return local.concat(globals);
  };

  gacha.pickEvents = function (rand, ctx) {
    var dest = ctx.destination;
    var pool = gacha.buildEventPool(dest).map(function (ev) {
      var w = ev.weight;
      // 稀有事件受幸运加成
      if (ctx.luck && (ev.rarity === 'SR' || ev.rarity === 'SSR')) w *= 2;
      if (ctx.scoreBonus > 0 && (ev.rarity === 'SR' || ev.rarity === 'SSR')) w *= 1 + ctx.scoreBonus * 0.25;
      return { ev: ev, weight: w };
    });

    var n = 1;
    var roll = rand();
    if (roll < 0.34) n = 1; else if (roll < 0.76) n = 2; else n = 3;

    var picked = R.weightedMany(rand, pool, n);
    return picked.map(function (x) { return x.ev; });
  };

  /* ---------- 天气 / 时段 ---------- */

  gacha.pickWeather = function (rand, ctx) {
    var dest = ctx.destination;
    var compat = dest && dest.weatherCompat ? dest.weatherCompat : null;
    var pool = [];
    var list = NT.data.weathers;
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      if (compat && compat.indexOf(w.id) < 0) continue;
      var weight = w.weight;
      if (ctx.weatherBias && ctx.weatherBias.indexOf(w.id) >= 0) weight *= 3;
      pool.push({ w: w, weight: weight });
    }
    if (!pool.length) pool = list.map(function (x) { return { w: x, weight: x.weight }; });
    var chosen = R.weighted(rand, pool);
    return chosen ? chosen.w : list[0];
  };

  gacha.pickTimeOfDay = function (rand) {
    var list = NT.data.timesOfDay;
    var chosen = R.weighted(rand, list.map(function (x) { return { t: x, weight: x.weight }; }));
    return chosen ? chosen.t : list[1];
  };

  gacha.pickDuration = function (rand, ctx) {
    var pool = C.durations.map(function (d) { return { d: d, weight: d.weight }; });
    if (ctx.durationBias) {
      for (var i = 0; i < pool.length; i++) {
        if (pool[i].d.id === ctx.durationBias) pool[i].weight *= 3.2;
      }
    }
    var chosen = R.weighted(rand, pool);
    var band = chosen ? chosen.d : C.durations[0];
    return { bandId: band.id, ms: Math.round(U.range(rand, band.min, band.max)) };
  };

  /* ---------- 稀有度 ---------- */

  gacha.scoreOf = function (ctx) {
    var destScore = RARITY_SCORE[ctx.destination ? ctx.destination.rarity : 'N'] || 0;
    var compScore = ctx.companion ? (RARITY_SCORE[ctx.companion.rarity] || 0) : 0;
    var evScore = 0;
    var evs = ctx.events || [];
    for (var i = 0; i < evs.length; i++) {
      var s = RARITY_SCORE[evs[i].rarity] || 0;
      if (s > evScore) evScore = s;
    }
    return destScore + compScore + evScore +
      (ctx.scoreBonus || 0) + (ctx.luck ? 1 : 0);
  };

  gacha.computeRarity = function (ctx) {
    var evScore = 0;
    var evs = ctx.events || [];
    for (var i = 0; i < evs.length; i++) {
      var s = RARITY_SCORE[evs[i].rarity] || 0;
      if (s > evScore) evScore = s;
    }
    // SSR 级事件直接锁定
    if (evScore >= 4) return 'SSR';

    var score = gacha.scoreOf(ctx);
    if (score >= 8) return 'SSR';
    if (score >= 5) return 'SR';
    if (score >= 3) return 'R';
    return 'N';
  };

  /* ---------- 玩具 ---------- */

  /** 旅行带回玩具。保底：连续 toyGap 次没带回则必给 */
  gacha.pickToy = function (rand, ctx) {
    var history = ctx.history || [];
    var owned = ctx.ownedToys || [];
    var miss = 0;
    for (var h = history.length - 1; h >= 0; h--) {
      if (!history[h].toyId) miss++; else break;
    }
    var force = miss >= C.pity.toyGap;
    var chance = 0.34 + (ctx.luck ? 0.10 : 0) + (ctx.scoreBonus || 0) * 0.05;
    if (!force && rand() >= chance) return null;

    // 优先给还没有的玩具；都有了就随机给一个
    var all = NT.data.toys;
    var candidates = all.filter(function (t) { return owned.indexOf(t.id) < 0; });
    if (!candidates.length) candidates = all;

    var pool = candidates.map(function (t) {
      return { toy: t, weight: C.toyRarityWeight[t.rarity] || 30 };
    });
    var chosen = R.weighted(rand, pool);
    return chosen ? chosen.toy : null;
  };

  NT.gacha = gacha;
})(typeof window !== 'undefined' ? window : this);
