/* 纳西妲旅行 · 种植系统
 * 两块田（旱田/水田），作物按真实时间生长，收获进食材背包，
 * 并有几率掉落稀有道具（只提升稀有明信片概率）。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  var U = NT.util, R = NT.rng, C = NT.config;

  var farm = {};

  farm.slot = function (save, fieldId) {
    save.farm = save.farm || {};
    if (!save.farm[fieldId]) save.farm[fieldId] = { cropId: null, plantedAt: 0, readyAt: 0 };
    return save.farm[fieldId];
  };

  farm.cropOf = function (save, fieldId) {
    var s = farm.slot(save, fieldId);
    return s.cropId ? NT.data.cropById(s.cropId) : null;
  };

  /** 0~1 生长进度 */
  farm.progress = function (save, fieldId, now) {
    var s = farm.slot(save, fieldId);
    if (!s.cropId) return 0;
    now = now || Date.now();
    var total = s.readyAt - s.plantedAt;
    if (total <= 0) return 1;
    return U.clamp((now - s.plantedAt) / total, 0, 1);
  };

  farm.status = function (save, fieldId, now) {
    now = now || Date.now();
    var s = farm.slot(save, fieldId);
    if (!s.cropId) return { state: 'empty', crop: null, progress: 0, remainMs: 0 };
    var crop = NT.data.cropById(s.cropId);
    var remain = Math.max(0, s.readyAt - now);
    return {
      state: remain <= 0 ? 'ready' : 'growing',
      crop: crop,
      progress: farm.progress(save, fieldId, now),
      remainMs: remain,
      plantedAt: s.plantedAt,
      readyAt: s.readyAt
    };
  };

  farm.plant = function (save, fieldId, cropId, now) {
    now = now || Date.now();
    var crop = NT.data.cropById(cropId);
    if (!crop || crop.field !== fieldId) return { ok: false, error: '这块地种不了这个' };
    var s = farm.slot(save, fieldId);
    if (s.cropId) return { ok: false, error: '这块地还种着东西' };
    s.cropId = cropId;
    s.plantedAt = now;
    s.readyAt = now + crop.growMs;
    return { ok: true, crop: crop };
  };

  /** 收获。返回 {ingredients, rare}；未成熟返回 null */
  farm.harvest = function (save, fieldId, now) {
    now = now || Date.now();
    var st = farm.status(save, fieldId, now);
    if (st.state !== 'ready') return null;

    var s = farm.slot(save, fieldId);
    var crop = st.crop;
    // 用"收获时刻 + 田地"播种随机，保证同一时刻结果稳定
    var rand = R.mulberry32(R.hashSeed(fieldId + ':' + s.plantedAt + ':' + s.readyAt));

    var qty = Math.floor(U.range(rand, crop.yieldMin, crop.yieldMax + 1));
    if (qty < 1) qty = 1;

    var inv = save.inventory;
    inv.ingredients[crop.yieldItem] = (inv.ingredients[crop.yieldItem] || 0) + qty;

    // 稀有道具掉落
    var drops = [];
    var rare = NT.data.rareDrops;
    for (var i = 0; i < rare.length; i++) {
      var chance = rare[i].dropChance * (C.farm.rareDropMul || 1);
      if (rand() < chance) {
        inv.rare[rare[i].id] = (inv.rare[rare[i].id] || 0) + 1;
        drops.push(rare[i]);
      }
    }

    s.cropId = null; s.plantedAt = 0; s.readyAt = 0;

    return {
      crop: crop,
      itemId: crop.yieldItem,
      itemName: NT.data.ingredientName(crop.yieldItem),
      qty: qty,
      rare: drops
    };
  };

  /** 一次性收集所有已成熟的田 */
  farm.harvestAll = function (save, now) {
    var out = [];
    var ids = C.farm.plots;
    for (var i = 0; i < ids.length; i++) {
      var r = farm.harvest(save, ids[i], now);
      if (r) { r.fieldId = ids[i]; out.push(r); }
    }
    return out;
  };

  farm.hasReady = function (save, now) {
    var ids = C.farm.plots;
    for (var i = 0; i < ids.length; i++) {
      if (farm.status(save, ids[i], now).state === 'ready') return true;
    }
    return false;
  };

  NT.farm = farm;
})(typeof window !== 'undefined' ? window : this);
