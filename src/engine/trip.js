/* 纳西妲旅行 · 事实卡生成
 * 事实卡（TripFact）是唯一真相来源：文案与明信片都只是它的渲染结果。
 * 行程先由 journey 模拟器算出来（走到哪 / 路上发生了什么），再据此生成事实卡。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  var U = NT.util, R = NT.rng, C = NT.config;

  var trip = {};

  /** 料理 + 稀有道具提供多少行程预算（km 当量） */
  trip.foodBudget = function (dish, rareItems) {
    var km = (dish && dish.foodKm) || 320;
    (rareItems || []).forEach(function (it) { if (it && it.foodKm) km += it.foodKm; });
    return km;
  };

  /** 料理 + 道具带来的非行程效果 */
  trip.gatherEffects = function (dish, rareItems) {
    var eff = { weatherBias: null, meetBonus: 0, scoreBonus: 0, luck: false, durationBias: null };
    if (dish && dish.effect) {
      var e = dish.effect;
      if (e.weatherBias) eff.weatherBias = e.weatherBias;
      if (e.meetBonus) eff.meetBonus += e.meetBonus;
      if (e.scoreBonus) eff.scoreBonus += e.scoreBonus;
      if (e.luck) eff.luck = true;
      if (e.durationBias) eff.durationBias = e.durationBias;
    }
    (rareItems || []).forEach(function (it) {
      if (!it) return;
      if (it.scoreBonus) eff.scoreBonus += it.scoreBonus;
      if (it.meetBonus) eff.meetBonus += it.meetBonus;
    });
    return eff;
  };

  /**
   * @param o.mode        'region' | 'bearing' | 'random'
   * @param o.homeId      家乡地区 id
   */
  trip.create = function (o) {
    o = o || {};
    var now = o.now || Date.now();
    var seed = (typeof o.seed === 'number') ? (o.seed >>> 0) : ((now ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);

    var rand = R.mulberry32(seed);
    var prand = R.mulberry32(R.hashSeed(seed + ':presentation'));

    var history = o.history || [];
    var dish = NT.data.dishById(o.dishId) || NT.data.dishById('none');
    var rareItems = (o.rareItemIds || []).map(function (id) { return NT.data.rareDropById(id); }).filter(Boolean);
    var eff = trip.gatherEffects(dish, rareItems);
    var budgetKm = trip.foodBudget(dish, rareItems);

    // ---- 1. 旅途模拟 ----
    var jr = NT.journey.simulate({
      homeId: o.homeId || 'beijing',
      mode: o.mode || 'random',
      regionId: o.regionId,
      bearingId: o.bearingId,
      foodKm: budgetKm,
      meetBonus: eff.meetBonus,
      luck: eff.luck,
      history: history,
      seed: seed
    });

    var dest = NT.data.destinationById(jr.finalId) || NT.data.destinations[0];

    // ---- 2. 同伴：旅途中遇到的优先，否则在目的地再碰一次运气 ----
    var companion = jr.companionId ? NT.data.companionById(jr.companionId) : null;
    if (!companion) {
      companion = NT.gacha.pickCompanion(rand, {
        destination: dest, history: history, meetBonus: eff.meetBonus, luck: eff.luck
      });
    }

    // ---- 3. 明信片内容（地区自带 + 通用） ----
    var events = NT.gacha.pickEvents(rand, {
      destination: dest, luck: eff.luck, scoreBonus: eff.scoreBonus
    });

    var weather = NT.gacha.pickWeather(rand, {
      destination: dest,
      weatherBias: jr.soaked ? ['rain'] : eff.weatherBias    // 落汤鸡必然下雨
    });
    if (jr.soaked) weather = NT.data.weatherById('rain') || weather;

    var timeOfDay = NT.gacha.pickTimeOfDay(rand);

    // ---- 4. 稀有度 ----
    var rarity = NT.gacha.computeRarity({
      destination: dest, companion: companion, events: events,
      scoreBonus: eff.scoreBonus + (jr.reached ? 1 : 0) + (jr.effectiveKm > 2200 ? 1 : 0) +
                  (jr.budgetGainedKm >= 800 ? 1 : 0),
      luck: eff.luck
    });

    // ---- 5. 玩具 ----
    var toy = NT.gacha.pickToy(rand, {
      history: history, ownedToys: o.ownedToys || [], luck: eff.luck, scoreBonus: eff.scoreBonus
    });

    // ---- 6. 立绘姿态 ----
    var mood = 'idle';
    if (jr.soaked) mood = 'tired';
    else {
      for (var e = 0; e < events.length; e++) {
        if (events[e].mood === 'tired') mood = 'tired';
        else if (events[e].mood === 'happy' && mood !== 'tired') mood = 'happy';
      }
      if (!companion && mood === 'idle' && prand() < 0.3) mood = 'tired';
    }

    var durationMs = Math.round(jr.hours * 3600e3);
    NT.journey.scheduleSteps(jr, now, durationMs);

    return {
      id: 'trip_' + seed.toString(16) + '_' + U.uid(prand),
      seed: seed,
      engineVersion: C.ENGINE_VERSION,
      createdAt: now,
      dueAt: now + durationMs,
      durationMs: durationMs,

      mode: o.mode || 'random',
      homeId: jr.homeId,
      directionId: o.bearingId || null,
      dishId: dish ? dish.id : 'none',
      dishName: dish ? dish.name : '什么都不带',
      rareItemIds: rareItems.map(function (x) { return x.id; }),
      rareItemNames: rareItems.map(function (x) { return x.name; }),

      /** 旅途结果 */
      journey: {
        targetId: jr.targetId,
        reached: jr.reached,
        redirected: jr.redirected,
        soaked: jr.soaked,
        forceReturn: jr.forceReturn,
        costKm: jr.costKm,
        traveledKm: jr.traveledKm,
        budgetKm: budgetKm,
        budgetLeftKm: jr.budgetLeftKm,
        budgetGainedKm: jr.budgetGainedKm,
        budgetLostKm: jr.budgetLostKm,
        distanceTier: jr.distanceTier,
        steps: jr.steps
      },

      destinationId: dest.id,
      companionId: companion ? companion.id : null,
      weatherId: weather.id,
      timeOfDayId: timeOfDay.id,
      moodId: mood,
      rarity: rarity,
      toyId: toy ? toy.id : null,

      events: events.map(function (ev) {
        return {
          eventId: ev.id, name: ev.name, desc: ev.desc, stickerId: ev.sticker,
          category: ev.category, categoryLabel: ev.categoryLabel, rarity: ev.rarity
        };
      }),

      presentation: trip.makePresentation(prand, { destination: dest }),
      text: { source: 'template', diary: '', postcardBack: '' },
      settledAt: null
    };
  };

  /** 呈现参数：只影响画面观感，不影响任何游戏事实 */
  trip.makePresentation = function (prand, ctx) {
    var frames = ['polaroid', 'film', 'postcard', 'kraft', 'clean'];
    return {
      tilt: U.range(prand, -1.8, 1.8),
      charX: U.range(prand, 0.30, 0.72),
      charScale: U.range(prand, 0.86, 1.06) * (ctx.destination ? ctx.destination.depthScale : 1),
      charFlip: prand() < 0.5,
      grain: U.range(prand, 0.035, 0.095),
      vignette: U.range(prand, 0.06, 0.20),
      satAdj: U.range(prand, 0.94, 1.06),
      tempAdj: U.range(prand, -140, 140),
      stampRot: U.range(prand, -16, 16),
      stampOpacity: U.range(prand, 0.72, 0.92),
      stampX: U.range(prand, 0.60, 0.80),
      stampY: U.range(prand, 0.10, 0.26),
      frameId: U.pick(prand, frames),
      bgPanX: U.range(prand, -0.035, 0.035),
      bgZoom: U.range(prand, 1.00, 1.06),
      captionRot: U.range(prand, -1.5, 1.5)
    };
  };

  /** 渲染所需的实体解析 */
  trip.resolve = function (fact) {
    return {
      destination: NT.data.destinationById(fact.destinationId),
      target: fact.journey ? NT.data.destinationById(fact.journey.targetId) : null,
      home: NT.data.destinationById(fact.homeId) ||
            (NT.data.homeCityById(fact.homeId) ? { id: fact.homeId, name: NT.data.homeName(fact.homeId) } : null),
      companion: fact.companionId ? NT.data.companionById(fact.companionId) : null,
      weather: NT.data.weatherById(fact.weatherId),
      timeOfDay: NT.data.timeOfDayById(fact.timeOfDayId),
      toy: fact.toyId ? NT.data.toyById(fact.toyId) : null,
      events: fact.events || [],
      soaked: !!(fact.journey && fact.journey.soaked),
      reached: fact.journey ? fact.journey.reached : true,
      redirected: !!(fact.journey && fact.journey.redirected),
      steps: (fact.journey && fact.journey.steps) || []
    };
  };

  NT.trip = trip;
})(typeof window !== 'undefined' ? window : this);
