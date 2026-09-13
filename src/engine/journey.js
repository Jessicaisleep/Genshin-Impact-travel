/* 纳西妲旅行 · 旅途模拟
 * 把一次出行切成若干"段"：每段消耗食物前进，并触发一次事件。
 * 食物/道具决定预算，事件能补给（走更远）、夺取（提前回家）、改道、或遇到同伴。
 * 去极远的地方（漠河、喀纳斯）必须连续抽到补给事件才够。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  var U = NT.util, R = NT.rng;

  var journey = {};

  journey.STEP_MIN = 280;
  journey.STEP_MAX = 620;
  journey.MAX_STEPS = 10;

  /* ---------------- 目标选择 ---------------- */

  /** 相对家乡的物理方位判定 */
  function inDirection(destId, homeId, bearing) {
    if (!bearing || bearing === 'any') return true;
    var d = NT.data.geoOf(destId), h = NT.data.geoOf(homeId);
    var dLat = d.lat - h.lat, dLng = d.lng - h.lng;
    switch (bearing) {
      case 'n': return dLat > 1.5;
      case 's': return dLat < -1.5;
      case 'e': return dLng > 1.5;
      case 'w': return dLng < -1.5;
      case 'c': return Math.abs(dLat) <= 4 && Math.abs(dLng) <= 5;
      default: return true;
    }
  }

  journey.pickTarget = function (rand, opts) {
    var homeId = opts.homeId;
    var list = NT.data.destinations;

    if (opts.mode === 'region' && opts.regionId) {
      var t = NT.data.destinationById(opts.regionId);
      if (t) return t;
    }

    var pool = [];
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      if (d.id === homeId) continue;                 // 不会"去"自己家
      if (opts.mode === 'bearing' && !inDirection(d.id, homeId, opts.bearingId)) continue;
      // 近的地方更容易被选中（远的地方要玩家指定或运气好）
      var cost = NT.data.travelCost(homeId, d.id);
      var w = d.weight * (cost > 2600 ? 0.35 : cost > 1800 ? 0.6 : 1);
      pool.push({ dest: d, weight: w });
    }
    if (!pool.length) {
      // 方向过滤后没剩下 -> 退回到该方向的"标签"
      var tag = opts.bearingId;
      for (var j = 0; j < list.length; j++) {
        if (list[j].id === homeId) continue;
        if (opts.mode === 'bearing' && tag && tag !== 'any' && list[j].bearing !== tag) continue;
        pool.push({ dest: list[j], weight: list[j].weight });
      }
    }
    if (!pool.length) {
      for (var k = 0; k < list.length; k++) {
        if (list[k].id !== homeId) pool.push({ dest: list[k], weight: list[k].weight });
      }
    }
    var chosen = R.weighted(rand, pool);
    return chosen ? chosen.dest : list[0];
  };

  /* ---------------- 事件判定 ---------------- */

  function rollEvent(rand, ctx) {
    var all = NT.data.journeyEvents;
    var pool = [];
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e.needCompanion && !ctx.companion) continue;
      if (e.id === 'set_river' && ctx.riverUsed) continue;        // 掉河里只来一次
      if (e.kind === 'companion' && ctx.companion) continue;       // 已经遇到了
      if (e.kind === 'redirect' && ctx.redirectUsed) continue;     // 改道是惊喜，一次就够了
      pool.push({ ev: e, weight: e.weight });
    }
    if (!pool.length) return null;
    var chosen = R.weighted(rand, pool);
    return chosen ? chosen.ev : null;
  }

  /* ---------------- 主模拟 ---------------- */

  /**
   * @param o { homeId, mode, regionId, bearingId, foodKm, seed, meetBonus }
   * @returns 旅途结果
   */
  journey.simulate = function (o) {
    var rand = R.mulberry32(o.seed >>> 0);
    var homeId = o.homeId || 'beijing';

    var target = journey.pickTarget(rand, o);
    var targetId = target.id;
    var targetCost = NT.data.travelCost(homeId, targetId);

    var budget = o.foodKm || 320;
    var initialBudget = budget;
    var traveled = 0;
    var steps = [];
    var companion = null;
    var redirected = false;
    var soaked = false;
    var forceReturn = false;
    var riverUsed = false;
    var redirectUsed = false;
    var budgetGained = 0;
    var budgetLost = 0;

    for (var s = 0; s < journey.MAX_STEPS; s++) {
      var remaining = targetCost - traveled;
      if (remaining <= 0) break;

      var stepKm = Math.min(remaining, budget, Math.round(U.range(rand, journey.STEP_MIN, journey.STEP_MAX)));
      if (stepKm < 60) { forceReturn = true; break; }   // 走不动了

      budget -= stepKm;
      traveled += stepKm;

      var ev = rollEvent(rand, {
        companion: companion, riverUsed: riverUsed, redirectUsed: redirectUsed,
        homeId: homeId, targetId: targetId
      });

      var record = {
        index: steps.length,
        km: stepKm,
        eventId: ev ? ev.id : null,
        kind: ev ? ev.kind : null,
        name: ev ? ev.name : '赶路',
        text: '',
        delta: 0,
        targetAfter: null
      };

      if (ev) {
        var text = ev.text;

        if (ev.kind === 'refill') {
          var gain = Math.round(U.range(rand, ev.km[0], ev.km[1]));
          budget += gain; budgetGained += gain;
          record.delta = gain;

        } else if (ev.kind === 'setback') {
          if (ev.soaked) soaked = true;
          if (ev.forceReturn) {
            riverUsed = true;
            forceReturn = true;
            record.forceReturn = true;
          } else {
            var loss = Math.min(budget, Math.round(U.range(rand, ev.km[0], ev.km[1])));
            budget -= loss; budgetLost += loss;
            record.delta = -loss;
          }

        } else if (ev.kind === 'redirect') {
          var newTarget = null;
          if (ev.useCompanionHome && companion) {
            var hid = NT.data.companionHome[companion.id];
            if (hid && hid !== targetId && hid !== homeId) newTarget = NT.data.destinationById(hid);
          }
          if (!newTarget) {
            // 在当前行进方向附近找一个别的地方
            var f = targetCost > 0 ? traveled / targetCost : 0;
            var pt = NT.data.lerpGeo(homeId, targetId, f);
            var cand = NT.data.nearestDestination(pt, [targetId, homeId]);
            if (cand) newTarget = cand;
          }
          if (newTarget) {
            targetId = newTarget.id;
            targetCost = NT.data.travelCost(homeId, targetId);
            redirected = true;
            redirectUsed = true;
            record.targetAfter = targetId;
            text = text.replace(/\{dest\}/g, newTarget.name);
          }

        } else if (ev.kind === 'companion') {
          companion = NT.gacha.pickCompanion(rand, {
            destination: NT.data.destinationById(targetId),
            history: o.history || [],
            meetBonus: (o.meetBonus || 0) + 0.35,   // 旅途中的相遇是额外的
            luck: o.luck
          });
          if (!companion) companion = NT.data.companions[0];
          record.companionId = companion.id;
          text = text.replace(/\{companion\}/g, companion.name);
        }

        record.text = String(text).replace(/\{companion\}/g, companion ? companion.name : '同伴');
      } else {
        record.text = '这一段没什么特别的，就是一直走。';
      }

      steps.push(record);
      if (forceReturn) break;
    }

    var reached = traveled >= targetCost && !forceReturn;
    var finalId = targetId;

    if (!reached) {
      // 半路折返：按走了多少比例插值出一个位置，再找最近的地区
      var frac = targetCost > 0 ? U.clamp(traveled / targetCost, 0, 1) : 0;
      var point = NT.data.lerpGeo(homeId, targetId, frac);
      var near = NT.data.nearestDestination(point, [homeId]);
      if (near) finalId = near.id;
      // 折返时至少要走出一段距离，不然就还在本市
      if (traveled < 120) finalId = homeId;
    }

    // 时间：到达按单程算；折返按往返算
    var effectiveKm = reached ? traveled : traveled * 1.7;
    var hours = NT.data.hoursForCost(effectiveKm);
    if (traveled <= 0) hours = NT.data.MIN_HOURS;

    return {
      homeId: homeId,
      targetId: targetId,
      finalId: finalId,
      reached: reached,
      redirected: redirected,
      soaked: soaked,
      forceReturn: forceReturn,
      costKm: targetCost,
      initialBudgetKm: initialBudget,
      budgetLeftKm: Math.max(0, budget),
      budgetGainedKm: budgetGained,
      budgetLostKm: budgetLost,
      traveledKm: traveled,
      effectiveKm: Math.round(effectiveKm),
      steps: steps,
      companionId: companion ? companion.id : null,
      hours: hours,
      distanceTier: NT.data.distanceTier(targetCost).name
    };
  };

  /** 把旅途事件按时间摊到整个时长上，便于等待期间逐步揭晓 */
  journey.scheduleSteps = function (result, startedAt, durationMs) {
    if (!result.steps.length) return result.steps;
    var total = 0;
    result.steps.forEach(function (s) { total += s.km; });
    if (total <= 0) total = 1;
    var acc = 0;
    result.steps.forEach(function (s, i) {
      acc += s.km;
      var f = i === result.steps.length - 1 ? 1 : (acc / total) * 0.92;
      s.at = startedAt + Math.round(durationMs * f);
    });
    return result.steps;
  };

  /** 当前已经"发生"了的旅途事件（用于等待页的提示） */
  journey.revealedSteps = function (fact, now) {
    var out = [];
    var steps = (fact.journey && fact.journey.steps) || [];
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].at && steps[i].at <= now) out.push(steps[i]);
    }
    return out;
  };

  NT.journey = journey;
})(typeof window !== 'undefined' ? window : this);
