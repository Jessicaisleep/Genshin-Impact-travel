/* 纳西妲旅行 · 成就系统
 * 旅行相关的统计直接从图鉴（album）推导 —— 事实卡里本来就记录了所有细节，
 * 不需要额外维护一堆计数器；只有种植/聊天/戳她这类"发生过就没了"的才单独计数。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});

  var ach = {};

  /** 补齐 save.stats 里成就需要的计数字段 */
  ach.ensureStats = function (save) {
    save.stats = save.stats || {};
    var s = save.stats;
    if (typeof s.harvestCount !== 'number') s.harvestCount = 0;
    if (!s.cropsGrown) s.cropsGrown = {};
    if (!s.rareFound) s.rareFound = {};
    if (typeof s.chats !== 'number') s.chats = 0;
    if (typeof s.pokes !== 'number') s.pokes = 0;
    if (!save.achievements) save.achievements = {};
    return s;
  };

  /** 把存档折算成判定用的扁平统计 */
  ach.view = function (save) {
    var st = ach.ensureStats(save);
    var album = save.album || [];
    var v = {
      tripCount: album.length + (save.activeTrip ? 1 : 0),
      cards: album.length,
      toys: (save.toys || []).length,
      byDestination: {},
      byCompanion: {},
      rarity: { N: 0, R: 0, SR: 0, SSR: 0 },
      maxTravelKm: 0,
      maxRefillInTrip: 0,
      localTrips: 0,
      soaked: 0,
      redirected: 0,
      turnedBack: 0,
      harvestCount: st.harvestCount,
      cropsGrown: st.cropsGrown,
      rareFound: st.rareFound,
      chats: st.chats,
      pokes: st.pokes
    };
    for (var i = 0; i < album.length; i++) {
      var t = album[i];
      var j = t.journey || {};
      v.byDestination[t.destinationId] = (v.byDestination[t.destinationId] || 0) + 1;
      if (t.companionId) v.byCompanion[t.companionId] = (v.byCompanion[t.companionId] || 0) + 1;
      if (v.rarity[t.rarity] !== undefined) v.rarity[t.rarity]++;
      if ((j.traveledKm || 0) > v.maxTravelKm) v.maxTravelKm = j.traveledKm || 0;
      if (j.costKm === 0) v.localTrips++;
      if (j.soaked) v.soaked++;
      if (j.redirected) v.redirected++;
      if (j.reached === false) v.turnedBack++;
      var refills = 0;
      (j.steps || []).forEach(function (s) { if (s.kind === 'refill') refills++; });
      if (refills > v.maxRefillInTrip) v.maxRefillInTrip = refills;
    }
    return v;
  };

  /**
   * 判定所有未解锁的成就。
   * @returns 本次新解锁的成就定义数组（已写入 save.achievements）
   */
  ach.check = function (save, now) {
    var st = ach.ensureStats(save);
    now = now || Date.now();
    var v = ach.view(save);
    var all = NT.data.achievements || [];
    var newly = [];
    for (var i = 0; i < all.length; i++) {
      var a = all[i];
      if (st && save.achievements[a.id]) continue;
      var ok = false;
      try { ok = !!a.test(v, save); } catch (e) { ok = false; }
      if (ok) {
        save.achievements[a.id] = now;
        newly.push(a);
      }
    }
    return newly;
  };

  /** 全部成就 + 解锁状态 */
  ach.list = function (save) {
    var got = save.achievements || {};
    return (NT.data.achievements || []).map(function (a) {
      return { def: a, unlockedAt: got[a.id] || 0, unlocked: !!got[a.id] };
    });
  };

  ach.progress = function (save) {
    var got = save.achievements || {};
    var total = (NT.data.achievements || []).length;
    var n = 0;
    for (var k in got) if (NT.data.achievementById(k)) n++;
    return { unlocked: n, total: total };
  };

  ach.count = function (save) { return ach.progress(save).unlocked; };

  /* ---------------- 埋点 ---------------- */

  ach.recordHarvest = function (save, res) {
    var st = ach.ensureStats(save);
    st.harvestCount++;
    if (res && res.crop) st.cropsGrown[res.crop.id] = (st.cropsGrown[res.crop.id] || 0) + 1;
    (res && res.rare ? res.rare : []).forEach(function (r) {
      st.rareFound[r.id] = (st.rareFound[r.id] || 0) + 1;
    });
  };

  ach.recordChat = function (save) { ach.ensureStats(save).chats++; };
  ach.recordPoke = function (save) { ach.ensureStats(save).pokes++; };

  NT.achievements = ach;
})(typeof window !== 'undefined' ? window : this);
