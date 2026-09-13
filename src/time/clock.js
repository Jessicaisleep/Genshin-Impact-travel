/* 纳西妲旅行 · 时间循环
 * 核心：时间戳补偿结算 —— 关掉页面几天再打开，照样正确结算。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  var C = NT.config;

  var clock = {};

  var MISSED_AFTER_MS = 7 * 24 * 3600e3;

  /**
   * 让纳西妲出发。
   * @param opts {mode, regionId, bearingId, dishId, rareItemIds, now, seed}
   *   会消耗 dishId 对应的一份料理 与 rareItemIds 里的稀有道具。
   */
  clock.depart = function (save, opts) {
    opts = opts || {};
    var now = opts.now || Date.now();
    var inv = save.inventory;

    // 她还在外面的时候不能再送一次 ——
    // 否则新行程会直接覆盖掉旧的，旧的那趟和它的明信片就凭空消失了。
    if (save.activeTrip) {
      return { ok: false, error: '她还在外面呢，等她回来再送。' };
    }

    var dishId = opts.dishId || 'none';
    if (dishId !== 'none') {
      if ((inv.dishes[dishId] || 0) <= 0) {
        return { ok: false, error: '没有这份食物了' };
      }
      inv.dishes[dishId] -= 1;
      if (inv.dishes[dishId] <= 0) delete inv.dishes[dishId];
    }

    var rareIds = (opts.rareItemIds || []).slice();
    for (var i = 0; i < rareIds.length; i++) {
      if ((inv.rare[rareIds[i]] || 0) <= 0) return { ok: false, error: '没有这个道具' };
    }
    for (var j = 0; j < rareIds.length; j++) {
      inv.rare[rareIds[j]] -= 1;
      if (inv.rare[rareIds[j]] <= 0) delete inv.rare[rareIds[j]];
    }

    var fact = NT.trip.create({
      mode: opts.mode || 'random',
      regionId: opts.regionId,
      bearingId: opts.bearingId,
      dishId: dishId,
      rareItemIds: rareIds,
      homeId: save.homeId || 'beijing',
      history: save.album || [],
      ownedToys: save.toys || [],
      now: now,
      seed: opts.seed
    });
    fact.text = NT.text.templateRender(fact);

    save.activeTrip = fact;
    save.lastSeenAt = now;
    save.stats.tripCount = (save.stats.tripCount || 0) + 1;
    return { ok: true, trip: fact };
  };

  /**
   * 每次打开应用时调用。
   * @returns {{settled, rollback, missed, toyAdded}}
   */
  clock.check = function (save, now) {
    now = now || Date.now();
    var result = { settled: null, rollback: false, missed: false, toyAdded: null };
    var last = save.lastSeenAt || now;

    // 系统时间回拨：顺延 dueAt，不指责玩家
    if (now < last - C.clockToleranceMs) {
      var delta = last - now;
      if (save.activeTrip) save.activeTrip.dueAt += delta;
      result.rollback = true;
    }
    save.lastSeenAt = now;

    var t = save.activeTrip;
    if (t && now >= t.dueAt) {
      if (now - t.dueAt > MISSED_AFTER_MS) result.missed = true;
      result.settled = clock._settle(save, t, now);
      result.toyAdded = result.settled._toyAdded || null;
    }
    // 顺带推进纳西妲的状态
    NT.home.tick(save, now);
    return result;
  };

  clock._settle = function (save, t, now) {
    t.settledAt = now;
    save.activeTrip = null;

    save.album = save.album || [];
    save.album.push(t);

    save.stats = save.stats || { tripCount: 0, byDestination: {}, byCompanion: {} };
    save.stats.byDestination = save.stats.byDestination || {};
    save.stats.byCompanion = save.stats.byCompanion || {};
    save.stats.byDestination[t.destinationId] = (save.stats.byDestination[t.destinationId] || 0) + 1;
    if (t.companionId) {
      save.stats.byCompanion[t.companionId] = (save.stats.byCompanion[t.companionId] || 0) + 1;
      save.companionAffinity = save.companionAffinity || {};
      save.companionAffinity[t.companionId] = (save.companionAffinity[t.companionId] || 0) + 1;
    }

    // 带回的玩具
    if (t.toyId) {
      var isNew = NT.home.addToy(save, t.toyId);
      t._toyAdded = { toy: NT.data.toyById(t.toyId), isNew: isNew };
      // 新玩具自动摆到当前场景（如果放得下）
      if (isNew) {
        var r = NT.home.placeToy(save, t.toyId, save.home.sceneId);
        t._toyAdded.placed = !!(r && r.ok);
      }
    }
    return t;
  };

  clock.remaining = function (fact, now) {
    if (!fact) return 0;
    now = now || Date.now();
    return Math.max(0, fact.dueAt - now);
  };

  NT.clock = clock;
})(typeof window !== 'undefined' ? window : this);
