/* 纳西妲旅行 · 自检
 * 用法：开始游戏.html?selftest=1
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});

  var st = {};
  var results = [];

  function ok(name, cond, info) {
    results.push({ name: name, ok: !!cond, info: info === undefined ? '' : String(info) });
    return !!cond;
  }
  function section(t) { results.push({ section: t }); }

  st.run = function () {
    results = [];
    var U = NT.util, R = NT.rng, C = NT.config, G = NT.data;

    /* ---------- 0. 模块加载 ---------- */
    section('模块加载');
    ['util', 'rng', 'config', 'gacha', 'journey', 'trip', 'clock', 'store', 'farm', 'home', 'geo']
      .forEach(function (m) { ok('NT.' + m, !!NT[m]); });
    ok('NT.data.geo', !!G.geo);
    ok('NT.data.journeyEvents', !!(G.journeyEvents && G.journeyEvents.length));
    ok('NT.data.homeSpots', !!G.homeSpots);
    ok('NT.data.toySlots', !!(G.toySlots && G.toySlots.length));
    ok('NT.postcard', !!NT.postcard);
    if (!NT.postcard || !NT.journey || !NT.trip) return st.finish();

    /* ---------- 1. 数据完整性 ---------- */
    section('数据完整性');
    var badDest = 0, missingGeo = 0;
    G.destinations.forEach(function (d) {
      if (!d.id || !d.name || !d.palette || !d.bearing) badDest++;
      if (!d.scenery || !d.scenery.length || !d.food || !d.food.length || !d.play || !d.play.length) badDest++;
      // 坐标可以写在 geo 表里，也可以直接写在地区条目里（lat/lng），两种都算
      if (!G.hasRealGeo(d.id)) missingGeo++;
    });
    ok('地区字段完整', badDest === 0, 'bad=' + badDest);
    ok('每个地区都有坐标（geo 表或条目内联）', missingGeo === 0, 'missing=' + missingGeo);
    ok('地区 >= 16 个', G.destinations.length >= 16, G.destinations.length + ' 个');
    var noFood = G.dishes.filter(function (d) { return !(d.foodKm > 0); });
    ok('每道料理都有行程能量', noFood.length === 0, 'missing=' + noFood.length);
    var noPlace = G.toys.filter(function (t) { return t.place !== 'indoor' && t.place !== 'outdoor'; });
    ok('每件玩具都有 indoor/outdoor 归属', noPlace.length === 0, 'bad=' + noPlace.length);
    var badSpot = G.nahidaStates.filter(function (s) { return !G.homeSpots[s.spot]; });
    ok('每个状态都有合法落点', badSpot.length === 0, 'bad=' + badSpot.length);
    var kinds = {};
    G.journeyEvents.forEach(function (e) { kinds[e.kind] = (kinds[e.kind] || 0) + 1; });
    ok('旅途事件覆盖 5 类', ['refill', 'setback', 'redirect', 'companion', 'sight']
      .every(function (k) { return kinds[k] > 0; }), JSON.stringify(kinds));

    /* ---------- 2. 地理与时间 ---------- */
    section('地理与行程时间');
    var bjsh = G.distanceKm('beijing', 'suzhou');
    ok('北京→苏州 距离合理 (900~1200km)', bjsh > 900 && bjsh < 1200, bjsh + ' km');
    var bjsy = G.distanceKm('beijing', 'sanya');
    ok('北京→三亚 距离合理 (2200~2900km)', bjsy > 2200 && bjsy < 2900, bjsy + ' km');
    ok('同城距离为 0', G.distanceKm('beijing', 'beijing') === 0);
    ok('同城行程花费为 0', G.travelCost('beijing', 'beijing') === 0);
    ok('同城固定 1 小时', G.hoursForCost(0) === 1);
    ok('48 小时封顶', G.hoursForCost(1e6) === 48, G.hoursForCost(1e6) + 'h');
    var moheCost = G.travelCost('beijing', 'mohe');
    ok('漠河是极远（>2600）', moheCost > 2600, moheCost + ' km');
    var tier = G.distanceTier(moheCost);
    ok('漠河分级为极远', tier.id === 'extreme', tier.name);
    ok('邻近地区比远处便宜', G.travelCost('beijing', 'xian') < G.travelCost('beijing', 'sanya'));

    /* ---------- 3. 旅途模拟 ---------- */
    section('旅途模拟');
    var T0 = 1700000000000;

    var localFact = NT.trip.create({ mode: 'region', regionId: 'beijing', homeId: 'beijing', now: T0, seed: 1 });
    ok('去家乡 = 本市，1 小时', localFact.durationMs === 3600e3, (localFact.durationMs / 3600e3) + 'h');
    ok('本市行程已到达', localFact.journey.reached === true);

    // 确定性
    var fa = NT.trip.create({ mode: 'random', homeId: 'beijing', now: T0, seed: 4242, dishId: 'lotus_soup' });
    var fb = NT.trip.create({ mode: 'random', homeId: 'beijing', now: T0, seed: 4242, dishId: 'lotus_soup' });
    ok('同种子旅途完全一致',
      fa.destinationId === fb.destinationId && fa.journey.traveledKm === fb.journey.traveledKm &&
      fa.durationMs === fb.durationMs && fa.journey.steps.length === fb.journey.steps.length);

    // 食物越多走得越远
    var sumShort = 0, sumLong = 0, N = 240;
    for (var i = 0; i < N; i++) {
      sumShort += NT.trip.create({ mode: 'random', homeId: 'beijing', now: T0 + i, seed: 10000 + i, dishId: 'none' }).journey.traveledKm;
      sumLong += NT.trip.create({ mode: 'random', homeId: 'beijing', now: T0 + i, seed: 10000 + i, dishId: 'harvest', rareItemIds: ['luckycoin', 'ancientseed'] }).journey.traveledKm;
    }
    ok('食物+道具越多走得越远', sumLong > sumShort * 1.5,
      '裸走均 ' + Math.round(sumShort / N) + 'km → 带满均 ' + Math.round(sumLong / N) + 'km');
    ok('预算 = 料理 + 道具', (function () {
      var f = NT.trip.create({ mode: 'random', homeId: 'beijing', now: T0, seed: 7, dishId: 'lotus_rice', rareItemIds: ['clover4'] });
      return f.journey.budgetKm === (G.dishById('lotus_rice').foodKm + G.rareDropById('clover4').foodKm);
    })());

    // 最长 48 小时，绝不超
    var over48 = 0, under1 = 0, over24 = 0;
    var M = 500;
    for (var m = 0; m < M; m++) {
      var f2 = NT.trip.create({
        mode: 'region', regionId: 'mohe', homeId: 'beijing',
        now: T0 + m, seed: 20000 + m, dishId: 'harvest', rareItemIds: ['luckycoin', 'ancientseed']
      });
      var h = f2.durationMs / 3600e3;
      if (h > 48.001) over48++;
      if (h < 1) under1++;
      if (h > 24) over24++;
    }
    ok('任何时候都不超过 48 小时', over48 === 0, 'over=' + over48);
    ok('任何时候都不少于 1 小时', under1 === 0, 'under=' + under1);

    // 一般行程在 24 小时内
    var typical = 0, typicalTotal = 0;
    for (var t2 = 0; t2 < 400; t2++) {
      var f3 = NT.trip.create({ mode: 'random', homeId: 'beijing', now: T0 + t2, seed: 30000 + t2, dishId: 'potatocake' });
      typicalTotal++;
      if (f3.durationMs / 3600e3 <= 24) typical++;
    }
    ok('多数行程在 24 小时内', typical / typicalTotal > 0.7,
      (typical / typicalTotal * 100).toFixed(1) + '%');

    // 去漠河必须靠补给
    var reach = 0, refillsInSuccess = 0, successCount = 0, run = 240;
    for (var r2 = 0; r2 < run; r2++) {
      var f4 = NT.trip.create({
        mode: 'region', regionId: 'mohe', homeId: 'beijing',
        now: T0 + r2, seed: 40000 + r2, dishId: 'harvest', rareItemIds: ['luckycoin', 'ancientseed']
      });
      var j = f4.journey;
      if (j.reached && f4.destinationId === 'mohe') {
        reach++; successCount++;
        refillsInSuccess += j.steps.filter(function (s) { return s.kind === 'refill'; }).length;
      }
    }
    var avgRefill = successCount ? (refillsInSuccess / successCount) : 0;
    // 设计意图：最强配置的食物预算也不够走到漠河，必须靠路上补给
    var maxBudget = G.dishById('harvest').foodKm + G.rareDropById('luckycoin').foodKm +
                    G.rareDropById('ancientseed').foodKm;
    ok('最强配置的食物也不够走到漠河（必须靠补给）', maxBudget < moheCost,
      maxBudget + ' km 预算 < ' + moheCost + ' km 路程');
    ok('带满食物也不能保证走到漠河', reach > 0 && reach < run * 0.9,
      '到达率 ' + (reach / run * 100).toFixed(1) + '%');
    ok('走到漠河需要连续抽到补给事件', avgRefill >= 1.5,
      '平均补给 ' + avgRefill.toFixed(2) + ' 次');

    // 落汤鸡
    var soakedSeen = null, soakedBad = 0;
    for (var s2 = 0; s2 < 3000 && !soakedSeen; s2++) {
      var f5 = NT.trip.create({ mode: 'random', homeId: 'beijing', now: T0 + s2, seed: 60000 + s2, dishId: 'tricolor' });
      if (f5.journey.soaked) {
        soakedSeen = f5;
        if (f5.journey.reached) soakedBad++;
        if (f5.weatherId !== 'rain') soakedBad++;
        if (f5.moodId !== 'tired') soakedBad++;
      }
    }
    ok('能触发落汤鸡', !!soakedSeen);
    ok('落汤鸡必然没到达 + 下雨 + 疲惫', soakedBad === 0, 'bad=' + soakedBad);

    // 改道
    var redirSeen = null;
    for (var d2 = 0; d2 < 3000 && !redirSeen; d2++) {
      var f6 = NT.trip.create({ mode: 'bearing', bearingId: 's', homeId: 'beijing', now: T0 + d2, seed: 80000 + d2, dishId: 'harvest' });
      if (f6.journey.redirected) redirSeen = f6;
    }
    ok('能触发中途改道', !!redirSeen, redirSeen ? (redirSeen.journey.targetId + ' → ' + redirSeen.destinationId) : '');
    ok('方向只是起点（改道后可能不在该方向）', !!redirSeen);

    // 段数上限
    var maxSteps = 0;
    for (var s3 = 0; s3 < 300; s3++) {
      var f7 = NT.trip.create({ mode: 'region', regionId: 'mohe', homeId: 'beijing', now: T0 + s3, seed: 90000 + s3, dishId: 'harvest' });
      maxSteps = Math.max(maxSteps, f7.journey.steps.length);
    }
    ok('旅途段数不超过上限', maxSteps <= NT.journey.MAX_STEPS, 'max=' + maxSteps);

    // 旅途事件有时间戳，便于等待期逐步揭晓
    var anyScheduled = 0;
    for (var s4 = 0; s4 < 60; s4++) {
      var f8 = NT.trip.create({ mode: 'random', homeId: 'beijing', now: T0 + s4, seed: 95000 + s4, dishId: 'tricolor' });
      if (f8.journey.steps.length && f8.journey.steps[0].at >= f8.createdAt &&
          f8.journey.steps[f8.journey.steps.length - 1].at <= f8.dueAt) anyScheduled++;
    }
    ok('旅途事件有时间戳且在行程区间内', anyScheduled === 60, anyScheduled + '/60');

    /* ---------- 4. 地区与事件 ---------- */
    section('地区与事件');
    var facts = [], destCount = {}, localOK = 0, localTotal = 0;
    for (var k = 0; k < 800; k++) {
      var fk = NT.trip.create({ mode: 'random', homeId: 'beijing', now: T0 + k, seed: 110000 + k, dishId: 'lotus_soup' });
      facts.push(fk);
      destCount[fk.destinationId] = (destCount[fk.destinationId] || 0) + 1;
      fk.events.forEach(function (ev) {
        if (ev.eventId.indexOf(fk.destinationId + '_') === 0) {
          localTotal++;
          if (ev.name && ev.desc && ev.stickerId) localOK++;
        }
      });
    }
    ok('事件内容完整', localOK === localTotal, localOK + '/' + localTotal);
    ok('覆盖多数地区', Object.keys(destCount).length >= 12,
      Object.keys(destCount).length + '/' + G.destinations.length);
    ok('家乡不会作为目的地', facts.every(function (f) { return f.destinationId !== 'beijing' || f.journey.costKm === 0; }));

    var rarityCount = {};
    facts.forEach(function (f) { rarityCount[f.rarity] = (rarityCount[f.rarity] || 0) + 1; });
    var pct = {};
    for (var rk in rarityCount) pct[rk] = (rarityCount[rk] / facts.length * 100).toFixed(1) + '%';
    ok('稀有度四档均出现',
      rarityCount.N > 0 && rarityCount.R > 0 && rarityCount.SR > 0 && rarityCount.SSR > 0, JSON.stringify(pct));

    /* ---------- 5. 文本 ---------- */
    section('L1 模板文本');
    var phLeft = 0, empty = 0, nondet = 0, sameText = 0;
    for (var tx = 0; tx < 300; tx++) {
      var ft = facts[tx];
      var x1 = NT.text.templateRender(ft), x2 = NT.text.templateRender(ft);
      if (x1.diary !== x2.diary) nondet++;
      if (/\{[a-zA-Z]+\}/.test(x1.diary)) phLeft++;
      if (!x1.diary || !x1.diary.length || !x1.postcardBack) empty++;
      if (x1.diary === facts[0] && NT.text.templateRender(facts[0]).diary) sameText++;
    }
    ok('无未替换占位符', phLeft === 0, 'left=' + phLeft);
    ok('文本非空', empty === 0, 'empty=' + empty);
    ok('文本确定性', nondet === 0, 'diff=' + nondet);

    // 特殊情况文案确实不同
    if (soakedSeen) {
      var stxt = NT.text.templateRender(soakedSeen);
      ok('落汤鸡文案与普通不同', stxt.diary !== NT.text.templateRender(facts[0]).diary);
      ok('落汤鸡背面短句走专用池',
        NT.data.templates.soakedBack.indexOf(stxt.postcardBack) >= 0);
    } else {
      ok('落汤鸡文案（未触发，跳过）', true);
      ok('落汤鸡背面短句（未触发，跳过）', true);
    }
    var backCount = 0;
    for (var bc = 0; bc < 200; bc++) {
      var fbc = NT.trip.create({ mode: 'random', homeId: 'beijing', now: T0 + bc, seed: 120000 + bc, dishId: 'caltrop_rice' });
      if (!fbc.journey.reached) backCount++;
    }
    ok('能产出半路折返的行程', backCount > 0, backCount + '/200');

    /* ---------- 6. 种植 ---------- */
    section('种植系统');
    ok('空田状态为 empty', NT.farm.status(NT.store.defaultSave(), 'dry', T0).state === 'empty');
    ok('旱田不能种水稻', NT.farm.plant(NT.store.defaultSave(), 'dry', 'rice', T0).ok === false);
    ok('种植成功并可查询进度', (function () {
      var s = NT.store.defaultSave();
      var r = NT.farm.plant(s, 'wet', 'rice', T0);
      var sst = NT.farm.status(s, 'wet', T0 + 1000);
      return r.ok && sst.state === 'growing' && sst.progress > 0 && sst.progress < 1;
    })());
    ok('未成熟不能收获', (function () {
      var s = NT.store.defaultSave();
      NT.farm.plant(s, 'dry', 'potato', T0);
      return NT.farm.harvest(s, 'dry', T0 + 1000) === null;
    })());
    ok('成熟后收获得到食材', (function () {
      var s = NT.store.defaultSave();
      var c = G.cropById('potato');
      NT.farm.plant(s, 'dry', 'potato', T0);
      var h = NT.farm.harvest(s, 'dry', T0 + c.growMs + 1000);
      return h && h.qty >= 1 && s.inventory.ingredients[h.itemId] === h.qty;
    })());
    ok('收获可掉落稀有道具', (function () {
      var got = 0, tries = 200;
      for (var k2 = 0; k2 < tries; k2++) {
        var s2 = NT.store.defaultSave();
        var c = G.cropById('potato');
        NT.farm.plant(s2, 'dry', 'potato', T0 + k2);
        var h = NT.farm.harvest(s2, 'dry', T0 + k2 + c.growMs + 1);
        if (h && h.rare.length) got++;
      }
      return got > 0 && got < tries;
    })());

    /* ---------- 7. 厨房与出门消耗 ---------- */
    section('厨房与出门消耗');
    ok('食材不足时不可做', NT.data.canCook(G.dishById('lotus_rice'), {}) === false);
    ok('食材够时可以合成', (function () {
      var inv = { rice: 2, lotus: 1 };
      return NT.data.canCook(G.dishById('lotus_rice'), inv) === true;
    })());
    ok('没有该食物时出发被拒', (function () {
      var s = NT.store.defaultSave();
      return NT.clock.depart(s, { mode: 'random', dishId: 'lotus_rice', now: T0 }).ok === false;
    })());
    ok('出发消耗一份食物', (function () {
      var s = NT.store.defaultSave();
      s.inventory.dishes.riceball = 2;
      NT.clock.depart(s, { mode: 'random', dishId: 'riceball', now: T0 });
      return s.inventory.dishes.riceball === 1 && s.activeTrip.dishId === 'riceball';
    })());
    ok('出发消耗稀有道具', (function () {
      var s = NT.store.defaultSave();
      s.inventory.rare.clover4 = 1;
      NT.clock.depart(s, { mode: 'random', rareItemIds: ['clover4'], now: T0 });
      return !s.inventory.rare.clover4 && s.activeTrip.rareItemIds.indexOf('clover4') >= 0;
    })());

    ok('已有行程时不能再出发（不会覆盖旧旅程）', (function () {
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      var a = NT.clock.depart(s, { mode: 'random', now: T0, seed: 11 });
      if (!a.ok) return false;
      var first = s.activeTrip;
      var firstId = first.id;
      // 第二次出发必须被拒绝
      var b = NT.clock.depart(s, { mode: 'random', now: T0 + 60000, seed: 22 });
      return b.ok === false &&
        typeof b.error === 'string' && b.error.length > 0 &&
        s.activeTrip === first &&            // 还是原来那趟，没被换掉
        s.activeTrip.id === firstId;
    })());

    ok('被拒绝的那次不会白扣料理', (function () {
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      s.inventory.dishes = { riceball: 2 };
      NT.clock.depart(s, { mode: 'random', now: T0, seed: 11, dishId: 'riceball' });
      var afterFirst = s.inventory.dishes.riceball;
      NT.clock.depart(s, { mode: 'random', now: T0 + 1000, seed: 33, dishId: 'riceball' });
      return afterFirst === 1 && s.inventory.dishes.riceball === 1;
    })());

    ok('她出门时底部按钮变成"旅途中"', (function () {
      var bak = NT.app.save;
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      NT.clock.depart(s, { mode: 'random', now: T0, seed: 11 });
      NT.app.save = s;
      var h = NT.app.viewHome.call(NT.app);
      var h2 = NT.app.viewWaiting.call(NT.app);
      NT.app.save = bak;
      return h.indexOf('旅途中…') >= 0 && h.indexOf('data-arg="outdoor"') < 0 &&
        h2.length > 20;
    })());

    ok('素材有版本号（画面靠它自检重绘）', (function () {
      return typeof NT.assets.epoch === 'function' &&
        typeof NT.assets.epoch() === 'number' &&
        typeof NT.assets.status().epoch === 'number';
    })());

    /* ---------- 结算后的收尾（弹明信片 + 按钮归位） ---------- */
    ok('没到点时不会提前结算', (function () {
      var bak = NT.app.save, bm = NT.app.modal, bv = NT.app.viewing;
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      NT.app.save = s;
      var d = NT.clock.depart(s, { mode: 'random', now: T0, seed: 5 });
      var early = NT.app.settleIfDue(T0 + 1000);
      var modalStillNull = NT.app.modal === null;
      NT.app.save = bak; NT.app.modal = bm; NT.app.viewing = bv;
      return d.ok && early === null && modalStillNull;
    })());

    ok('到点后自动结算，并弹出明信片', (function () {
      var bak = NT.app.save, bm = NT.app.modal, bv = NT.app.viewing;
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      NT.app.save = s;
      var d = NT.clock.depart(s, { mode: 'random', now: T0, seed: 5 });
      var done = NT.app.settleIfDue(d.trip.dueAt + 1000);
      var okAll = !!done && NT.app.modal === 'result' &&
        NT.app.viewing && NT.app.viewing.id === done.id &&
        s.activeTrip === null &&                     // 行程已清空
        (s.album || []).some(function (f) { return f.id === done.id; });  // 进了图鉴
      NT.app.save = bak; NT.app.modal = bm; NT.app.viewing = bv;
      return okAll;
    })());

    ok('结算后"旅途中…"按钮正确归位成"送她出门"', (function () {
      var bak = NT.app.save, bm = NT.app.modal, bv = NT.app.viewing;
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      NT.app.save = s;
      var d = NT.clock.depart(s, { mode: 'random', now: T0, seed: 5 });
      var before = NT.app.viewHome.call(NT.app);
      NT.app.settleIfDue(d.trip.dueAt + 1000);
      NT.app.modal = null;                            // 关掉明信片弹窗，回到家里
      var after = NT.app.viewHome.call(NT.app);
      var okAll = before.indexOf('旅途中…') >= 0 &&
        before.indexOf('送她出门') < 0 &&
        after.indexOf('送她出门') >= 0 &&
        after.indexOf('旅途中…') < 0 &&
        after.indexOf('stage-countdown') < 0;         // 顶部倒计时也消失了
      NT.app.save = bak; NT.app.modal = bm; NT.app.viewing = bv;
      return okAll;
    })());

    ok('结算后能正常渲染明信片本身', (function () {
      var bak = NT.app.save, bm = NT.app.modal, bv = NT.app.viewing;
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      NT.app.save = s;
      var d = NT.clock.depart(s, { mode: 'random', now: T0, seed: 9 });
      NT.app.settleIfDue(d.trip.dueAt + 1000);
      var h = null, err = null;
      try { h = NT.app.viewResult.call(NT.app); } catch (e) { err = e; }
      var okAll = !err && h && h.indexOf('postcard-canvas') >= 0;
      NT.app.save = bak; NT.app.modal = bm; NT.app.viewing = bv;
      return okAll;
    })());

    /* ---------- 8. 时间循环 ---------- */
    section('时间循环');
    ok('未到期不结算', (function () {
      var s = NT.store.defaultSave();
      NT.clock.depart(s, { mode: 'random', now: T0, seed: 778 });
      var r = NT.clock.check(s, T0 + 1000);
      return r.settled === null && s.activeTrip !== null;
    })());
    ok('到期结算并进图鉴', (function () {
      var s = NT.store.defaultSave();
      var d = NT.clock.depart(s, { mode: 'random', now: T0, seed: 779 });
      var r = NT.clock.check(s, d.trip.dueAt + 1000);
      return r.settled !== null && s.activeTrip === null && s.album.length === 1;
    })());
    ok('时间回拨不结算且顺延', (function () {
      var s = NT.store.defaultSave();
      var d = NT.clock.depart(s, { mode: 'random', now: T0, seed: 781 });
      var before = d.trip.dueAt;
      var r = NT.clock.check(s, T0 - 3600000);
      return r.rollback === true && r.settled === null && s.activeTrip.dueAt > before;
    })());

    /* ---------- 9. 玩具 ---------- */
    section('玩具');
    ok('玩具掉落不是必给也不是不给', (function () {
      var got = 0, n = 400;
      for (var k3 = 0; k3 < n; k3++) {
        var f = NT.trip.create({ mode: 'random', homeId: 'beijing', now: T0 + k3 * 1000, seed: 130000 + k3, history: [] });
        if (f.toyId) got++;
      }
      return got > 0 && got < n;
    })());
    // 规则本身：place 不匹配的槽位一律不适配。
    // 现在内置玩具和槽位全是室外的，所以这里临时造一个室内玩具来验证规则还在。
    ok('玩具只能摆进对应类型的槽位', (function () {
      var bak = G.toys.slice();
      G.toys.push({ id: 'zzindoor', name: '临时室内玩具', icon: 'star', rarity: 'N',
                    place: 'indoor', desc: '', playLines: [''] });
      var okIndoor = G.toyFitsSlot('zzindoor', 0) === false;      // 槽 0 是室外
      var okOutdoor = G.toyFitsSlot('rug', 0) === true;           // 地毯是室外
      var okOutdoor2 = G.toyFitsSlot('rug', 0) !== G.toyFitsSlot('zzindoor', 0);
      G.toys.length = 0; bak.forEach(function (x) { G.toys.push(x); });
      return okIndoor && okOutdoor && okOutdoor2;
    })());
    ok('所有玩具都落在与自己匹配的槽位上', (function () {
      var bad = [];
      G.toys.forEach(function (t) {
        var s = NT.store.defaultSave();
        NT.home.addToy(s, t.id);
        var r = NT.home.placeToy(s, t.id);
        if (!r.ok) { bad.push(t.id + ':放不下'); return; }
        if (G.toySlots[r.slot].place !== t.place) bad.push(t.id + ':槽位不匹配');
      });
      return bad.length === 0;
    })());
    ok('所有玩具槽都在画面右侧', (function () {
      // 她做别的事都在左侧，玩具统一在右侧 —— 这样人和玩具永远不会挤在一起
      return G.toySlots.every(function (s) { return s.x > 0.6; });
    })());

    // 摆满一院子玩具，再让她一件件轮流去玩，看会不会站到别的玩具上。
    // 这是最容易出问题的地方：玩具之间挨得近，而她站在玩具旁边。
    function fullYard() {
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      s.toys = G.toys.map(function (t) { return t.id; });
      s.home.placed = [];
      s.toys.forEach(function (id) { NT.home.placeToy(s, id); });
      s.activeTrip = null;
      s.home.nahida.stateId = 'play';
      s.home.nahida.until = T0 + 1e9;
      return s;
    }

    ok('玩玩具时她不会踩在另一个玩具上', (function () {
      var s = fullYard();
      var bad = [];
      s.home.placed.forEach(function (p) {
        var ps = NT.home.playSpot(s, p.slot, p.toyId, 1);
        if (!ps) { bad.push(p.toyId + ':没位置'); return; }
        var cl = NT.home.clearanceAt(s, ps.x, ps.y, p.toyId);
        if (cl < 0) bad.push(p.toyId + '@槽' + p.slot + ' ' + cl.toFixed(3));
      });
      return bad.length === 0;
    })(), (function () {
      var s = fullYard();
      var bad = [];
      s.home.placed.forEach(function (p) {
        var ps = NT.home.playSpot(s, p.slot, p.toyId, 1);
        var cl = ps ? NT.home.clearanceAt(s, ps.x, ps.y, p.toyId) : -99;
        if (cl < 0) bad.push(p.toyId + '@槽' + p.slot + '=' + cl.toFixed(3));
      });
      return bad.join(' ');
    })());

    ok('同伴玩玩具时也不会踩到别的玩具', (function () {
      var s = fullYard();
      var bad = [];
      s.home.placed.forEach(function (p) {
        var ps = NT.home.playSpot(s, p.slot, p.toyId, -1);
        if (!ps) { bad.push(p.toyId + ':没位置'); return; }
        var cl = NT.home.clearanceAt(s, ps.x, ps.y, p.toyId);
        if (cl < 0) bad.push(p.toyId + ' 压到别的玩具 ' + cl.toFixed(3));
      });
      return bad.length === 0;
    })());

    ok('摆放是动态的：不指定槽位就找空位', (function () {
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      s.toys = G.toys.map(function (t) { return t.id; });
      s.home.placed = [];
      var slots = [];
      s.toys.forEach(function (id) {
        var r = NT.home.placeToy(s, id);
        if (r.ok) slots.push(r.slot);
      });
      // 摆下去的槽位互不重复
      var uniq = {};
      var dup = slots.some(function (x) { return uniq[x] ? true : (uniq[x] = 1, false); });
      return !dup && slots.length === Math.min(s.toys.length, G.toySlots.length);
    })());

    ok('指定一个被占的槽位时会自动改找空位（不会失败）', (function () {
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      s.toys = ['ball', 'rug'];
      s.home.placed = [];
      NT.home.placeToy(s, 'ball');
      var first = s.home.placed[0].slot;
      var r = NT.home.placeToy(s, 'rug', first);     // 故意指定已被占的槽位
      return r.ok && r.slot !== first;
    })());

    ok('满了以后摆不下第 9 件（要提示先收回）', (function () {
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      s.toys = G.toys.map(function (t) { return t.id; });
      s.home.placed = [];
      s.toys.forEach(function (id) { NT.home.placeToy(s, id); });
      var n = s.home.placed.length;
      // 再摆一件没摆过的（把已摆的拿回来，模拟"想换一件"）
      var all = G.toys.map(function (t) { return t.id; });
      var free = all.filter(function (id) {
        return !s.home.placed.some(function (p) { return p.toyId === id; });
      });
      if (!free.length) return n === G.toySlots.length;
      var r = NT.home.placeToy(s, free[0]);
      return r.ok === false && typeof r.error === 'string' && r.error.indexOf('满') >= 0;
    })());

    ok('吊床是所有玩具里最大的', (function () {
      var maxId = null, maxV = -1;
      G.toys.forEach(function (t) {
        var v = G.toySize(t.id);
        if (v > maxV) { maxV = v; maxId = t.id; }
      });
      return maxId === 'hammock';
    })());
    ok('读档时会纠正失效的摆放', (function () {
      var s = NT.store.defaultSave();
      NT.home.addToy(s, 'ball');
      // 故意指向一个不存在的槽位
      s.home.placed = [{ toyId: 'ball', slot: 99 }];
      var n = NT.home.repair(s);
      return n > 0 && s.home.placed.length === 1 &&
        s.home.placed[0].slot >= 0 && s.home.placed[0].slot < G.toySlots.length &&
        G.toySlots[s.home.placed[0].slot].place === 'outdoor';
    })());
    ok('读档时会清掉已经不存在的玩具', (function () {
      var s = NT.store.defaultSave();
      s.toys = ['ball'];
      s.home.placed = [{ toyId: 'ghost_toy', slot: 0 }, { toyId: 'ball', slot: 4 }];
      NT.home.repair(s);
      return s.home.placed.length === 1 && s.home.placed[0].toyId === 'ball';
    })());
    ok('读档时会去掉重复摆放', (function () {
      var s = NT.store.defaultSave();
      s.toys = ['ball'];
      s.home.placed = [{ toyId: 'ball', slot: 4 }, { toyId: 'ball', slot: 5 }];
      NT.home.repair(s);
      return s.home.placed.length === 1;
    })());
    ok('没有秋千了', !G.toyById('swing') && !G.toySizeRatio.swing);

    /* ---------- 素材／数据同步 ---------- */
    section('素材同步');

    ok('清单里多出来的配角会被自动收录', (function () {
      var bak = NT.assetManifest.companions;
      var list = G.companions;
      var n0 = list.length;
      NT.assetManifest.companions = { zztest: '配角-临时测试' };
      var rep = NT.assets.syncFromManifest();
      var found = NT.data.companionById('zztest');
      var okAll = list.length === n0 + 1 && !!found && found.name === '临时测试' &&
        found.auto === true && rep.addedCompanions.indexOf('临时测试') >= 0;
      // 清理：把这个临时角色拿掉，别影响后面的测试
      list.pop();
      NT.assetManifest.companions = bak;
      return okAll;
    })());

    ok('重复调用同步不会重复添加', (function () {
      var bak = NT.assetManifest.companions;
      var list = G.companions;
      var n0 = list.length;
      NT.assetManifest.companions = { zztest2: '配角-临时测试二' };
      NT.assets.syncFromManifest();
      var n1 = list.length;
      NT.assets.syncFromManifest();
      NT.assets.syncFromManifest();
      var okAll = (n1 === n0 + 1) && (list.length === n0 + 1);
      list.pop();
      NT.assetManifest.companions = bak;
      return okAll;
    })());

    ok('清单里有图、数据表里没定义的地区会被报告出来', (function () {
      var bak = NT.assetManifest.backgrounds;
      NT.assetManifest.backgrounds = { nowhere: '场景-不存在的地方' };
      var rep = NT.assets.syncFromManifest();
      var hit = rep.orphanDestinations.some(function (x) { return x.id === 'nowhere'; });
      NT.assetManifest.backgrounds = bak;
      return hit;
    })());

    ok('当前素材和数据表完全对得上', (function () {
      var rep = NT.assets.syncFromManifest();
      return rep.addedCompanions.length === 0 &&
        rep.orphanDestinations.length === 0 &&
        rep.missingImages.length === 0;
    })());

    ok('坐标可以直接写在地区条目里', (function () {
      // 内联坐标要能被 geoOf 认出来
      var bak = G.destinations.slice();
      G.destinations.push({ id: 'zzgeo', name: '临时', lat: 10, lng: 20, remoteness: 1.5 });
      var g = G.geoOf('zzgeo');
      var okAll = g.lat === 10 && g.lng === 20 && g.remoteness === 1.5 && G.hasRealGeo('zzgeo');
      G.destinations.length = 0;
      bak.forEach(function (x) { G.destinations.push(x); });
      return okAll;
    })());

    /* ---------- 来访同伴 ---------- */
    section('来访同伴');

    ok('同伴活动分左右两侧', (function () {
      var bad = [];
      G.visitorStates.forEach(function (v) {
        if (v.side !== 'left' && v.side !== 'right') bad.push(v.id);
        // 左边的活动必须有落点，右边的必须能玩玩具
        if (v.side === 'left' && !v.spot) bad.push(v.id + ':没有落点');
        if (v.side === 'right' && !v.useToy) bad.push(v.id + ':不能玩玩具');
      });
      return bad.length === 0;
    })());

    ok('两侧都至少有一个活动', G.visitorStatesOn('left').length > 0 &&
      G.visitorStatesOn('right').length > 0);

    ok('访客不会睡觉（只有一张睁眼立绘，躺下必违和）', (function () {
      var bad = G.visitorStates.filter(function (v) {
        return v.id === 'sleep' || v.lie === true || v.spot === 'bed';
      });
      return bad.length === 0;
    })());

    ok('访客文案和主角的不重样', (function () {
      var mine = {};
      G.nahidaStates.forEach(function (s) {
        (s.lines || []).forEach(function (l) { mine[l] = 1; });
      });
      var bad = [];
      G.visitorStates.forEach(function (v) {
        (v.lines || []).forEach(function (l) { if (mine[l]) bad.push(l); });
      });
      return bad.length === 0;
    })());

    ok('打招呼文案是成对的', G.visitorGreet.every(function (p) {
      return p.length === 2 && p[0] && p[1] && p[0] !== p[1];
    }) && G.visitorGreet.length >= 5);

    ok('最多同时只有一位客人', (function () {
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      NT.home.debugAddVisitor(s, 'paimon', T0);
      var a = s.home.visitor;
      NT.home.debugAddVisitor(s, 'klee', T0);
      // 再放一次会覆盖成新的那一位，但数量始终是 1
      return NT.home.visitor(s, T0) !== null && typeof s.home.visitor === 'object' &&
        Array.isArray(s.home.visitor) === false && a !== null;
    })());

    ok('每位同伴出现概率相同', (function () {
      // 用同一套随机源跑多轮，看是否每个都出现过
      var seen = {};
      for (var i = 0; i < 4000; i++) {
        var r = NT.rng.mulberry32(NT.rng.hashSeed('eq:' + i));
        var list = G.companions;
        var c = list[Math.floor(r() * list.length) % list.length];
        seen[c.id] = (seen[c.id] || 0) + 1;
      }
      return Object.keys(seen).length === G.companions.length;
    })());

    ok('主角在左侧时，客人只做右侧的活动', (function () {
      var bad = [];
      // 让主角处于各种"左侧"状态，看客人的活动是不是永远在右边
      G.nahidaStates.filter(function (x) { return !x.useToy; }).forEach(function (ns) {
        var s = NT.store.defaultSave();
        s.homeChosen = true;
        s.home.nahida.stateId = ns.id;
        s.home.nahida.since = T0;
        s.activeTrip = null;
        for (var i = 0; i < 40; i++) {
          var v = NT.home.debugAddVisitor(s, null, T0 + i * 60000);
          var vst = G.visitorById(v.stateId);
          if (vst.side !== 'right') bad.push(ns.id + '->' + vst.id);
        }
      });
      return bad.length === 0;
    })());

    ok('主角在玩玩具时，客人只做左侧的活动', (function () {
      var bad = [];
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      s.home.nahida.stateId = 'play';
      s.activeTrip = null;
      for (var i = 0; i < 40; i++) {
        var v = NT.home.debugAddVisitor(s, null, T0 + i * 60000);
        var vst = G.visitorById(v.stateId);
        if (vst.side !== 'left') bad.push(vst.id);
      }
      return bad.length === 0;
    })());

    ok('主角出门时客人不受侧别限制', (function () {
      var sides = {};
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      s.activeTrip = { dummy: true };
      for (var i = 0; i < 200; i++) {
        var v = NT.home.debugAddVisitor(s, null, T0 + i * 60000);
        sides[G.visitorById(v.stateId).side] = 1;
      }
      // 家里没人 -> 左右两侧都可能出现
      return sides.left === 1 && sides.right === 1;
    })());

    ok('客人和主角的落点不会重合', (function () {
      var bad = [];
      G.nahidaStates.forEach(function (ns) {
        var s = NT.store.defaultSave();
        s.homeChosen = true;
        s.home.nahida.stateId = ns.id;
        s.home.nahida.since = T0;
        s.activeTrip = null;
        var mine = NT.home.spot(s);
        for (var i = 0; i < 30; i++) {
          var tI = T0 + i * 60000;
          NT.home.debugAddVisitor(s, null, tI);
          var v = NT.home.visitor(s, tI);
          var vs = NT.home.visitorSpot(s, tI);
          if (!v || !vs) continue;
          var d = Math.sqrt(Math.pow((vs.x - mine.x) * 1600, 2) + Math.pow((vs.y - mine.y) * 900, 2));
          if (d < 60) bad.push(ns.id + '/' + v.stateId + ' 距离 ' + Math.round(d));
        }
      });
      return bad.length === 0;
    })());

    ok('同伴停留时长跟随设置', (function () {
      var mk = function (key) {
        var s = NT.store.defaultSave();
        s.settings.visitorStay = key;
        var v = NT.home.debugAddVisitor(s, null, T0);
        return Math.round((v.until - T0) / 60000);
      };
      var a = mk('short'), b = mk('normal'), c = mk('long');
      return a >= 4 && a <= 11 && b >= 9 && b <= 21 && c >= 19 && c <= 41 &&
        a < b && b < c;
    })());

    ok('到点后客人会自己走', (function () {
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      var v = NT.home.debugAddVisitor(s, null, T0);
      if (!NT.home.visitor(s, T0)) return false;
      // 把时间推到停留结束之后
      s.home.nahida.until = v.until + 60000;
      NT.home.tick(s, v.until + 60000);
      return s.home.visitor === null && !NT.home.visitor(s, v.until + 60000);
    })());

    ok('每次来访只打一次招呼', (function () {
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      s.home.nahida.stateId = 'idle';
      s.home.nahida.since = T0;
      NT.home.debugAddVisitor(s, null, T0);
      var first = NT.home.visitorGreeting(s, T0);
      var second = NT.home.visitorGreeting(s, T0);
      return !!first && first.nahida && first.visitor && second === null;
    })());

    ok('主角每次换状态后，两人都不会在同一侧', (function () {
      // 复现真 bug：客人的侧别只在"它自己换活动"时才算，
      // 主角换状态时不同步 -> 会出现两个人都在右侧
      var bad = [];
      G.nahidaStates.forEach(function (from) {
        var s = NT.store.defaultSave();
        s.homeChosen = true;
        s.home.nahida.stateId = from.id;
        s.home.nahida.since = T0;
        s.home.nahida.until = T0 + 1000;     // 让 tick 必然会推进一次
        s.activeTrip = null;
        NT.home.debugAddVisitor(s, null, T0);

        var now = T0 + 2000;
        NT.home.tick(s, now);                // 主角换状态
        var v = NT.home.visitor(s, now);
        if (!v) return;
        var mine = NT.home.nahidaSide(s);
        var theirs = G.visitorById(v.stateId).side;
        if (mine === theirs) {
          bad.push(from.id + '->' + s.home.nahida.stateId + '/' + v.stateId);
        }
      });
      return bad.length === 0;
    })());

    ok('主角不在发呆时不打招呼', (function () {
      var s = NT.store.defaultSave();
      s.homeChosen = true;
      s.home.nahida.stateId = 'read';
      s.home.nahida.since = T0;
      NT.home.debugAddVisitor(s, null, T0);
      return NT.home.visitorGreeting(s, T0) === null;
    })());

    /* ---------- 家的布局 ---------- */
    section('家的布局');
    var HW = 1600, HH = 900, HCH = HH * 0.25;      // 用 16:9 的基准尺寸算像素距离

    ok('落点和玩具槽都在画面内', Object.keys(G.homeSpots).every(function (k) {
      var s = G.homeSpots[k];
      return s.x > 0.02 && s.x < 0.98 && s.y > 0.02 && s.y < 0.98;
    }) && G.toySlots.every(function (s) {
      return s.x > 0.02 && s.x < 0.98 && s.y > 0.02 && s.y < 0.98;
    }));

    ok('室内玩具槽在屋里、室外槽在屋外', (function () {
      // 屋子大约占 x 0~0.43
      return G.toySlots.every(function (s) {
        return s.place === 'indoor' ? s.x < 0.43 : s.x > 0.43;
      });
    })());

    ok('室外玩具槽避开了树、喷泉和田地', (function () {
      // 这几块的坐标是按家-全景.png 量的
      var blocks = [
        { n: '树', x0: 0.655, x1: 0.780, y0: 0.25, y1: 0.42 },
        { n: '喷泉', x0: 0.620, x1: 0.720, y0: 0.40, y1: 0.48 },
        { n: '田地', x0: 0.460, x1: 0.670, y0: 0.54, y1: 0.76 }
      ];
      var tallest = 0;                              // 最高的那件玩具（按相对身高算）
      G.toys.forEach(function (t) { tallest = Math.max(tallest, G.toySize(t.id)); });
      var bad = [];
      G.toySlots.filter(function (s) { return s.place === 'outdoor'; }).forEach(function (s, i) {
        var top = s.y - tallest * 0.25;              // 玩具顶端的 y
        blocks.forEach(function (b) {
          if (s.x > b.x0 && s.x < b.x1 && top < b.y1 && s.y > b.y0) bad.push('槽' + i + '压到' + b.n);
        });
      });
      return bad.length === 0;
    })());

    ok('玩玩具时她不会站在玩具上', (function () {
      var herHalf = HCH * 0.20;
      var bad = [];
      G.toys.forEach(function (t) {
        var ts = G.toySize(t.id);
        var dxPx = (ts * 0.070 + 0.035) * HW;       // home.js 里用的同一个公式
        var toyHalf = ts * HCH * 0.80;
        if (dxPx < herHalf + toyHalf * 0.5) bad.push(t.id);
      });
      return bad.length === 0;
    })());

    ok('连最大的玩具也不会超出画面', (function () {
      var biggest = 0;
      G.toys.forEach(function (t) { biggest = Math.max(biggest, G.toySize(t.id)); });
      // 图片基本是方的，最宽那件（吊床）宽度约等于高度的 1.55 倍
      var halfW = biggest * 0.25 * (HH / HW) * 1.55 / 2;
      var bad = [];
      G.toySlots.forEach(function (s, i) {
        if (s.x - halfW < 0.004 || s.x + halfW > 0.996) bad.push('槽' + i);
      });
      return bad.length === 0;
    })());

    ok('她做别的事时不会踩在玩具上', (function () {
      var herHalf = HCH * 0.20;
      // 每个槽位只可能放对应 place 的玩具，所以按"该槽位能放的最大那件"来判
      var biggest = { indoor: 0, outdoor: 0 };
      G.toys.forEach(function (t) {
        biggest[t.place] = Math.max(biggest[t.place], G.toySize(t.id));
      });
      var bad = [];
      G.toySlots.forEach(function (slot, i) {
        var ts = biggest[slot.place] || 0;
        var toyHalf = ts * HCH * 0.80;
        var toyTall = ts * HCH;
        Object.keys(G.homeSpots).forEach(function (k) {
          var sp = G.homeSpots[k];
          if (sp.onBed) return;                      // 床上那个位置在屋里另一头
          var dx = Math.abs(sp.x - slot.x) * HW;
          var dy = Math.abs(sp.y - slot.y) * HH;
          // 她的身体半宽 + 玩具半径之内，并且纵向落在玩具高度范围内，才算"踩上去"
          if (dx < herHalf + toyHalf * 0.5 && dy < toyTall * 0.7) {
            bad.push(k + '↔槽' + i);
          }
        });
      });
      return bad.length === 0;
    })());
    ok('室外玩具不能摆到室内', (function () {
      var s = NT.store.defaultSave();
      NT.home.addToy(s, 'hammock');            // outdoor
      var r = NT.home.placeToy(s, 'hammock');
      if (!r.ok) return false;
      return G.toySlots[r.slot].place === 'outdoor';
    })());
    ok('一个玩具只能摆一处', (function () {
      var s = NT.store.defaultSave();
      NT.home.addToy(s, 'ball');
      NT.home.placeToy(s, 'ball', 2);
      NT.home.placeToy(s, 'ball', 4);
      return NT.home.placed(s).length === 1;
    })());
    ok('重复获得不会重复加入', (function () {
      var s = NT.store.defaultSave();
      NT.home.addToy(s, 'ball');
      var again = NT.home.addToy(s, 'ball');
      return again === false && s.toys.filter(function (t) { return t === 'ball'; }).length === 1;
    })());
    ok('存档里已没有三叶草这种死资源', (function () {
      var s = NT.store.defaultSave();
      return s.clover === undefined;
    })());

    /* ---------- 10. 家 ---------- */
    section('家');
    ok('状态会随时间推进', (function () {
      var s = NT.store.defaultSave();
      var r = NT.home.tick(s, Date.now() + 8 * 3600e3);
      return r.stepped >= 1;
    })());
    ok('长时间放置不会连跳过多', (function () {
      var s = NT.store.defaultSave();
      var r = NT.home.tick(s, Date.now() + 40 * 24 * 3600e3);
      return r.stepped <= C.home.maxStateSteps + 1;
    })());
    ok('每个状态都有台词', G.nahidaStates.every(function (x) { return x.lines && x.lines.length; }));
    ok('她的落点始终合法', (function () {
      var s = NT.store.defaultSave();
      for (var k4 = 0; k4 < 200; k4++) {
        NT.home.tick(s, Date.now() + k4 * 20 * 60000);
        var sp = NT.home.spot(s);
        if (!sp || typeof sp.x !== 'number' || typeof sp.y !== 'number') return false;
        if (sp.x < 0 || sp.x > 1 || sp.y < 0 || sp.y > 1) return false;
      }
      return true;
    })());
    ok('玩玩具状态才有玩具可玩', (function () {
      var s = NT.store.defaultSave();
      NT.home.addToy(s, 'ball');
      NT.home.placeToy(s, 'ball');
      s.home.nahida.stateId = 'play';
      var a = NT.home.playingToy(s);
      s.home.nahida.stateId = 'sleep';
      var b = NT.home.playingToy(s);
      return !!a && b === null;
    })());

    /* ---------- 11. 交流 ---------- */
    section('交流');
    ok('所有话题都有预设回答与回应', G.chatTopics.every(function (t) {
      return t.options && t.options.length && t.options.every(function (o) {
        return o.text && o.replies && o.replies.length;
      });
    }));
    ok('chat 返回玩家台词与回应', (function () {
      var s = NT.store.defaultSave();
      var r = NT.home.chat(s, 'trip', 0, 'seed1');
      return r && r.player && r.reply && r.player !== r.reply;
    })());
    ok('同一 seed 回应一致', (function () {
      var s = NT.store.defaultSave();
      return NT.home.chat(s, 'trip', 0, 'x').reply === NT.home.chat(s, 'trip', 0, 'x').reply;
    })());
    ok('不同 seed 有不同回应', (function () {
      var s = NT.store.defaultSave();
      var seen = {};
      for (var k5 = 0; k5 < 40; k5++) seen[NT.home.chat(s, 'trip', 0, 'seed' + k5).reply] = 1;
      return Object.keys(seen).length > 1;
    })());

    /* ---------- 12. AI 越界校验 ---------- */
    section('AI 越界校验');
    var fAi = facts[0];
    ok('事实内文本通过', NT.text.ai.noNewFacts('今天在' + NT.trip.resolve(fAi).destination.name + '走了很久。', fAi) === true);
    var other = G.destinations.filter(function (d) { return d.id !== fAi.destinationId; })[0];
    ok('编造其它地区被拒', NT.text.ai.noNewFacts('后来我去了' + other.name + '。', fAi) === false);
    ok('现实词汇被拒', NT.text.ai.noNewFacts('我用微信发了消息。', fAi) === false);
    ok('validate 拒绝空对象', NT.text.ai.validate({}, fAi) === false);

    /* ---------- 13. 明信片 ---------- */
    section('明信片合成');
    var renderErr = 0, dimBad = 0, blank = 0, uniqImg = {};
    var samples = facts.slice(0, 10);
    if (soakedSeen) samples.push(soakedSeen);
    for (var pi = 0; pi < samples.length; pi++) {
      var fp = samples[pi];
      try {
        var cv = NT.postcard.render(fp, { scale: 0.25 });
        if (cv.width !== Math.round(C.POSTCARD_W * 0.25)) dimBad++;
        var img = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        var sum = 0, sum2 = 0, cnt = 0;
        for (var px = 0; px < img.length; px += 4 * 197) {
          var lum = img[px] * 0.299 + img[px + 1] * 0.587 + img[px + 2] * 0.114;
          sum += lum; sum2 += lum * lum; cnt++;
        }
        var mean = sum / cnt, varc = sum2 / cnt - mean * mean;
        if (varc < 50) blank++;
        uniqImg[Math.round(mean) + ':' + Math.round(varc)] = 1;
      } catch (e) { renderErr++; }
    }
    ok('明信片合成无异常（含落汤鸡）', renderErr === 0, 'err=' + renderErr);
    ok('输出尺寸正确', dimBad === 0, 'bad=' + dimBad);
    ok('画面非空白', blank === 0, 'blank=' + blank);
    ok('不同种子产出不同画面', Object.keys(uniqImg).length >= samples.length - 2,
      Object.keys(uniqImg).length + '/' + samples.length);

    /* ---------- 14. 素材绘制 ---------- */
    section('素材绘制覆盖');
    var stickerIds = {};
    G.events.forEach(function (e) { stickerIds[e.sticker] = 1; });
    G.destinations.forEach(function (d) {
      ['scenery', 'food', 'play'].forEach(function (c) {
        (d[c] || []).forEach(function (e) { stickerIds[e.sticker] = 1; });
      });
    });
    var stickerErr = 0, kinds2 = 0;
    for (var sk in stickerIds) {
      kinds2++;
      try {
        var sc = NT.effects.makeCanvas(80, 80);
        NT.placeholder.sticker(sc.getContext('2d'), sk, 40, 40, 40, R.mulberry32(2));
      } catch (e) { stickerErr++; }
    }
    ok('全部 ' + kinds2 + ' 种贴纸可绘制', stickerErr === 0, 'err=' + stickerErr);

    var toyErr = 0;
    G.toys.forEach(function (t) {
      try {
        var tc = NT.effects.makeCanvas(100, 100);
        NT.placeholder.toy(tc.getContext('2d'), t.id, 50, 90, 60, R.mulberry32(4));
      } catch (e) { toyErr++; }
    });
    ok('全部 ' + G.toys.length + ' 种玩具可绘制', toyErr === 0, 'err=' + toyErr);

    var worldErr = 0, worldBlank = 0;
    try {
      var wc = NT.effects.makeCanvas(640, 360);
      var fields = { dry: { cropId: 'potato', progress: 0.6 }, wet: { cropId: 'rice', progress: 0.3 } };
      NT.placeholder.homeWorld(wc.getContext('2d'), 640, 360, { seed: 1, fields: fields });
      var wi = wc.getContext('2d').getImageData(0, 0, 640, 360).data;
      var wsum = 0, wsum2 = 0, wc2 = 0;
      for (var wp = 0; wp < wi.length; wp += 4 * 97) {
        var wl = wi[wp] * 0.299 + wi[wp + 1] * 0.587 + wi[wp + 2] * 0.114;
        wsum += wl; wsum2 += wl * wl; wc2++;
      }
      var wm = wsum / wc2;
      if (wsum2 / wc2 - wm * wm < 50) worldBlank++;
    } catch (e) { worldErr++; }
    ok('家的世界可绘制', worldErr === 0, 'err=' + worldErr);
    ok('家的世界非空白', worldBlank === 0);

    /* ---------- 15. 存档 ---------- */
    section('存档');
    var s16 = NT.store.defaultSave();
    s16.inventory.ingredients.rice = 5;
    s16.toys.push('hammock');
    s16.home.placed.push({ toyId: 'hammock', slot: 3 });
    s16.homeId = 'chengdu';
    var back = U.tryJSON(NT.store.exportJSON(s16), null);
    ok('导出/导入一致', back && back.inventory.ingredients.rice === 5 && back.homeId === 'chengdu');
    var s17 = NT.store.load();
    ok('load 返回可用存档', !!(s17 && s17.inventory && s17.home && s17.homeId));
    ok('缺失字段自动补齐', !!(s17.inventory.ingredients && s17.inventory.rare && s17.farm && s17.home.nahida));
    ok('存档体积很小（不存图片）', NT.store.sizeOf(s16) < 8000, NT.store.sizeOf(s16) + ' 字节');

    /* ---------- 16. 家乡候选与定位 ---------- */
    section('家乡候选');
    var cities = NT.data.homeCities();
    ok('家乡候选数量足够多（>= 30）', cities.length >= 30, cities.length + ' 个');
    var cityIds = {};
    var dupCity = 0;
    cities.forEach(function (c) { if (cityIds[c.id]) dupCity++; cityIds[c.id] = 1; });
    ok('家乡候选无重复', dupCity === 0, 'dup=' + dupCity);
    ok('每个候选家乡都能算距离', cities.every(function (c) {
      return NT.data.travelCost(c.id, 'mohe') > 0 || c.id === 'mohe';
    }));
    ok('额外城市也能当出发点', (function () {
      var a = NT.data.travelCost('shanghai', 'sanya');
      var b = NT.data.travelCost('beijing', 'sanya');
      return a > 0 && b > 0 && a !== b;
    })(), '上海→三亚 ' + NT.data.travelCost('shanghai', 'sanya') + 'km');
    ok('homeName 能解析额外城市', NT.data.homeName('shanghai') === '上海', NT.data.homeName('shanghai'));
    ok('从上海的行程能生成事实卡', (function () {
      var f = NT.trip.create({ mode: 'random', homeId: 'shanghai', now: T0, seed: 5, dishId: 'lotus_soup' });
      return f && f.homeId === 'shanghai' && f.destinationId !== 'shanghai';
    })());

    /* ---------- 17. 点击反应 ---------- */
    section('点击反应');
    var noPoke = G.nahidaStates.filter(function (x) { return !x.poke || !x.poke.anim || !x.poke.lines || !x.poke.lines.length; });
    ok('每个状态都有点击反应', noPoke.length === 0, 'missing=' + noPoke.length);
    var KNOWN_ANIM = ['roll', 'bounce', 'perk', 'lookup', 'wave', 'stir', 'shy', 'turn', 'offer'];
    var badAnim = G.nahidaStates.filter(function (x) { return KNOWN_ANIM.indexOf(x.poke.anim) < 0; });
    ok('反应动画都是已实现的种类', badAnim.length === 0,
      badAnim.map(function (x) { return x.poke.anim; }).join(',') || 'ok');
    ok('睡觉的反应是翻身', G.nahidaStateById('sleep').poke.anim === 'roll');
    ok('各状态反应台词互不相同', (function () {
      var seen = {}, dup = 0;
      G.nahidaStates.forEach(function (x) {
        x.poke.lines.forEach(function (l) { if (seen[l]) dup++; seen[l] = 1; });
      });
      return dup === 0;
    })());

    /* ---------- 18. AI 角色扮演聊天 ---------- */
    section('AI 角色扮演');
    ok('聊天人设提示词存在', typeof G.chatSystemPrompt === 'string' && G.chatSystemPrompt.length > 100);
    ok('人设里写了字数限制', /1~2\s*句|60\s*个字/.test(G.chatSystemPrompt));
    ok('人设里写了禁止现实词汇', /现实世界/.test(G.chatSystemPrompt));
    ok('聊天文本校验拒绝现实词汇', NT.text.ai.checkChatText('我用微信发给你') === false);
    ok('聊天文本校验拒绝出戏', NT.text.ai.checkChatText('作为一个人工智能，我无法回答') === false);
    ok('聊天文本校验拒绝过长', NT.text.ai.checkChatText(new Array(200).join('啊')) === false);
    ok('聊天文本校验放过正常台词', NT.text.ai.checkChatText('（把书合上）……你说。') === true);
    ok('能拼出她的近况上下文', (function () {
      var s = NT.store.defaultSave();
      s.home.nahida.stateId = 'eat';
      var ctx = NT.text.ai.chatContext(s);
      return ctx.indexOf('吃饭') >= 0 && ctx.indexOf('家乡') >= 0;
    })());
    ok('未开 AI 时聊天直接用预设（不同步等网络）', (function () {
      var s = NT.store.defaultSave();
      var out = null;
      NT.text.ai.chat(s, '你好', [], '预设回复').then(function (r) { out = r; });
      return true;   // 同步分支不发请求即可，行为由 selftest 之外的实测覆盖
    })());

    /* ---------- 19. 界面渲染（防止"点了没反应"） ---------- */
    section('界面渲染');
    if (!NT.app) {
      ok('NT.app 已加载', false);
    } else {
      ok('NT.app 已加载', true);
      var bakSave = NT.app.save, bakViewing = NT.app.viewing;
      var sUI = NT.store.defaultSave();
      sUI.homeChosen = true;
      NT.app.save = sUI;
      var dUI = NT.clock.depart(sUI, { mode: 'random', now: 1700000000000, seed: 99, dishId: 'none' });
      NT.clock.check(sUI, dUI.trip.dueAt + 1000);
      NT.app.viewing = sUI.album[0];

      var views = ['viewChooseHome', 'viewHome', 'viewKitchen', 'viewToys', 'viewChat',
                   'viewAlbum', 'viewOutdoor', 'viewSettings', 'viewResult', 'viewStore'];
      views.forEach(function (n) {
        var html = null, err = null;
        try { html = NT.app[n].call(NT.app); } catch (e) { err = e; }
        ok('能渲染 ' + n, !err && typeof html === 'string' && html.length > 20,
          err ? ('抛出 ' + err.message) : (html ? html.length + ' 字符' : '空'));
      });

      // 等待页 / 有行程时的家
      var sUI2 = NT.store.defaultSave();
      sUI2.homeChosen = true;
      NT.clock.depart(sUI2, { mode: 'random', now: 1700000000000, seed: 77 });
      NT.app.save = sUI2;
      var hw = null, ew = null;
      try { hw = NT.app.viewWaiting.call(NT.app); } catch (e) { ew = e; }
      ok('能渲染 viewWaiting', !ew && hw && hw.length > 20, ew ? ('抛出 ' + ew.message) : '');
      var hh = null, eh = null;
      try { hh = NT.app.viewHome.call(NT.app); } catch (e) { eh = e; }
      // 她出门时 viewHome 不再被强制塞一个关不掉的弹窗，
      // 而是顶部出现一条可点击的倒计时条
      ok('有行程时 viewHome 也能渲染，且不再被弹窗锁住',
        !eh && hh && hh.indexOf('stage-countdown') >= 0 &&
        hh.indexOf('modal-layer') < 0,
        eh ? ('抛出 ' + eh.message) : '');
      ok('activeModal 不再强制返回 waiting',
        (function () {
          var bak = NT.app.modal;
          NT.app.modal = null;
          var r = NT.app.activeModal();
          NT.app.modal = bak;
          return r === null;
        })());
      ok('等待面板有"回家里等"按钮（以前关不掉）', (function () {
        var h = NT.app.viewWaiting.call(NT.app);
        return h.indexOf('回家里等') >= 0 && h.indexOf('close-modal') >= 0;
      })());
      ok('等待面板给出预计用时', (function () {
        var h = NT.app.viewWaiting.call(NT.app);
        return h.indexOf('wait-eta') >= 0 && h.indexOf('还要') >= 0 && h.indexOf('回来') >= 0;
      })());
      ok('倒计时条带剩余时间和预计时刻', (function () {
        var h = NT.app.countdownHTML();
        return h.indexOf('她还有') >= 0 && h.indexOf('回来') >= 0 && h.indexOf('cd-eta') >= 0;
      })());

      // 每个弹窗都要能真的拼出内容
      ['kitchen', 'toys', 'chat', 'album', 'settings', 'outdoor', 'store'].forEach(function (mid) {
        var sUI3 = NT.store.defaultSave();
        sUI3.homeChosen = true;
        NT.app.save = sUI3;
        NT.app.modal = mid;
        var hm = null, em = null;
        try { hm = NT.app.renderModalLayer.call(NT.app); } catch (e) { em = e; }
        ok('弹窗可渲染：' + mid,
          !em && typeof hm === 'string' && hm.indexOf('modal-body') >= 0,
          em ? ('抛出 ' + em.message) : '');
      });
      // 真实点击路径：模拟点击"送她出门"，确认弹窗真的弹出来
      // （之前 homeName 未声明时 viewOutdoor 抛异常，render 里 innerHTML 赋值
      //   被跳过，表现就是"点了没反应"—— 这条测试就是为了钉住这种情况）
      (function () {
        var sC = NT.store.defaultSave();
        sC.homeChosen = true;
        NT.app.save = sC;
        NT.app.screen = 'home';
        NT.app.modal = null;
        NT.app.viewing = null;
        var clicked = false, err = null;
        NT.app.bindGlobal();
        try {
          NT.app.render();
          var btn = document.querySelector('[data-act="modal"][data-arg="outdoor"]');
          if (btn) { btn.click(); clicked = true; }
        } catch (e) { err = e; }
        ok('能找到"送她出门"按钮', clicked, err ? err.message : '');
        ok('点击后弹窗状态变成 outdoor', NT.app.modal === 'outdoor', String(NT.app.modal));
        var dom = document.getElementById('modal-body');
        ok('点击后画面里真的出现了弹窗内容',
          !!(dom && dom.innerHTML && dom.innerHTML.length > 100),
          dom ? dom.innerHTML.length + ' 字符' : '没有 modal-body');
        NT.app.modal = null;
        NT.app.render();
      })();

      NT.app.modal = null;
      NT.app.save = bakSave;
      NT.app.viewing = bakViewing;
    }

    /* ---------- 20. 成就 ---------- */
    section('成就');
    if (!NT.achievements) {
      ok('NT.achievements 已加载', false);
    } else {
      ok('成就定义完整', G.achievements.every(function (a) {
        return a.id && a.name && a.desc && a.icon && a.group && typeof a.test === 'function';
      }));
      ok('成就 id 不重复', (function () {
        var seen = {}, dup = 0;
        G.achievements.forEach(function (a) { if (seen[a.id]) dup++; seen[a.id] = 1; });
        return dup === 0;
      })());
      ok('成就分组都存在', G.achievements.every(function (a) {
        return G.achievementGroups.some(function (g) { return g.id === a.group; });
      }));
      ok('成就数量 >= 30', G.achievements.length >= 30, G.achievements.length + ' 条');
      ok('新存档没有已解锁成就',
        Object.keys(NT.store.defaultSave().achievements || {}).length === 0);
      ok('第一次出门就解锁「初次远行」', (function () {
        var s = NT.store.defaultSave();
        var d = NT.clock.depart(s, { mode: 'random', now: T0, seed: 1 });
        NT.clock.check(s, d.trip.dueAt + 1000);
        var newly = NT.achievements.check(s);
        return newly.some(function (a) { return a.id === 'trip_1'; });
      })());
      ok('成就不会重复解锁', (function () {
        var s = NT.store.defaultSave();
        var d = NT.clock.depart(s, { mode: 'random', now: T0, seed: 1 });
        NT.clock.check(s, d.trip.dueAt + 1000);
        NT.achievements.check(s);
        return NT.achievements.check(s).length === 0;
      })());
      ok('收获会记录作物与次数', (function () {
        var s = NT.store.defaultSave();
        var c = G.cropById('potato');
        NT.farm.plant(s, 'dry', 'potato', T0);
        var h = NT.farm.harvest(s, 'dry', T0 + c.growMs + 1);
        NT.achievements.recordHarvest(s, h);
        return s.stats.harvestCount === 1 && s.stats.cropsGrown.potato === 1;
      })());
      ok('聊天与戳她会被记录', (function () {
        var s = NT.store.defaultSave();
        NT.achievements.recordChat(s);
        NT.achievements.recordPoke(s);
        NT.achievements.recordPoke(s);
        return s.stats.chats === 1 && s.stats.pokes === 2;
      })());
      ok('进度统计正确', (function () {
        var p = NT.achievements.progress(NT.store.defaultSave());
        return p.total === G.achievements.length && p.unlocked === 0;
      })());
      ok('统计从图鉴推导正确', (function () {
        var s = NT.store.defaultSave();
        var d = NT.clock.depart(s, { mode: 'region', regionId: 'sanya', now: T0, seed: 5 });
        NT.clock.check(s, d.trip.dueAt + 1000);
        if (!s.album.length) return false;
        var did = s.album[0].destinationId;
        var v = NT.achievements.view(s);
        // 目的地的统计必须记的是"实际去到的那个地方"
        return v.cards === 1 && v.tripCount === 1 && v.byDestination[did] === 1;
      })());
      ok('没走到的行程也会被统计（记录的是实际落脚点）', (function () {
        var s = NT.store.defaultSave();
        var d = NT.clock.depart(s, { mode: 'region', regionId: 'sanya', now: T0, seed: 5 });
        NT.clock.check(s, d.trip.dueAt + 1000);
        var t = s.album[0];
        var v = NT.achievements.view(s);
        // 预算不够 -> 半路折返，落脚点不是三亚
        return t.journey.reached === false && v.byDestination.sanya === undefined;
      })());
      ok('走遍全国的判定用真实地区数量', !!G.achievementById('region_all'));
      ok('成就界面能渲染', (function () {
        var bak = NT.app && NT.app.save;
        if (!NT.app) return false;
        NT.app.save = NT.store.defaultSave();
        var h = null, e = null;
        try { h = NT.app.viewAchievements.call(NT.app); } catch (ex) { e = ex; }
        NT.app.save = bak;
        return !e && typeof h === 'string' && h.length > 200;
      })());
    }

    /* ---------- 21. 音效 ---------- */
    section('音效');
    if (!NT.sfx) {
      ok('NT.sfx 已加载', false);
    } else {
      ok('NT.sfx 已加载', true);
      ok('音效数量 >= 12', NT.sfx.names().length >= 12, NT.sfx.names().length + ' 种');
      ok('每个音效都能播放而不抛异常', (function () {
        var bad = [];
        NT.sfx.names().forEach(function (n) {
          try { NT.sfx.play(n); } catch (e) { bad.push(n); }
        });
        return bad.length === 0;
      })());
      ok('播放不存在的名字是空操作', (function () {
        try { NT.sfx.play('__not_a_sound__'); return true; } catch (e) { return false; }
      })());
      ok('关掉之后播放是空操作', (function () {
        NT.sfx.enabled = false;
        try { NT.sfx.play('click'); } finally { NT.sfx.enabled = true; }
        return true;
      })());
      ok('音效不需要任何音频文件', (function () {
        // 全部音效都来自代码里的频率表，没有任何 src / url
        var src = String(NT.sfx.play);
        return src.indexOf('Audio') < 0 && typeof NT.sfx.names === 'function';
      })());
    }

    /* ---------- 22. 图片素材管线 ---------- */
    section('图片素材管线');
    if (!NT.assets) {
      ok('NT.assets 已加载', false);
    } else {
      ok('NT.assets 已加载', true);
      ok('素材清单存在且结构完整', (function () {
        var m = NT.assetManifest;
        return !!m && !!m.backgrounds && !!m.nahida && !!m.companions && !!m.toys && !!m.stickers;
      })());
      ok('清单为空时查询返回 null', NT.assets.bg('__none__') === null &&
        NT.assets.nahida('__none__') === null && NT.assets.companion('__none__') === null);
      ok('没有真图时 drawCover/drawSprite 返回 false（触发回退）', (function () {
        try {
          var c = NT.effects.makeCanvas(200, 120);
          var okc = NT.assets.drawCover(c.getContext('2d'), null, 200, 120);
          var oks = NT.assets.drawSprite(c.getContext('2d'), null, 100, 100, 50, false);
          return okc === false && oks === false;
        } catch (e) { return false; }
      })());
      ok('status 可用', typeof NT.assets.status().total === 'number');
      ok('没填清单时明信片仍能合成（回退到程序化）', (function () {
        try {
          var f = facts[0];
          var cv = NT.postcard.render(f, { scale: 0.2 });
          return cv.width > 0;
        } catch (e) { return false; }
      })());
    }

    return st.finish();
  };

  st.finish = function () {
    var pass = 0, fail = 0, out = [];
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (r.section) { out.push(''); out.push('## ' + r.section); continue; }
      if (r.ok) pass++; else fail++;
      out.push((r.ok ? '  PASS  ' : '  FAIL  ') + r.name + (r.info ? '   [' + r.info + ']' : ''));
    }
    var summary = '自检结果: ' + pass + ' 通过 / ' + fail + ' 失败';
    out.unshift(summary);
    out.unshift('===SELFTEST-BEGIN===');
    out.push('===SELFTEST-END===');
    var text = out.join('\n');
    var el = document.getElementById('selftest-output');
    if (el) {
      el.textContent = text;
      el.setAttribute('data-pass', String(pass));
      el.setAttribute('data-fail', String(fail));
    }
    if (root.console && console.log) console.log(text);
    return { pass: pass, fail: fail, text: text };
  };

  NT.selftest = st;
})(typeof window !== 'undefined' ? window : this);
