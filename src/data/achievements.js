/* 纳西妲旅行 · 成就定义
 * 每条成就一个 test(stats, save) 判定；判定为真且尚未解锁就解锁。
 * icon 用 emoji，不需要图片素材。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  NT.data = NT.data || {};

  /** 统计里有几类地区 / 同伴 / 作物 / 道具 */
  function countKeys(obj) {
    var n = 0;
    for (var k in obj) if (obj[k] > 0) n++;
    return n;
  }

  NT.data.achievementGroups = [
    { id: 'travel', name: '旅行' },
    { id: 'card',   name: '明信片' },
    { id: 'farm',   name: '种植' },
    { id: 'friend', name: '同伴' },
    { id: 'home',   name: '家' },
    { id: 'special', name: '特殊' }
  ];

  NT.data.achievements = [
    /* ---------- 旅行 ---------- */
    { id: 'trip_1',  group: 'travel', icon: '🎒', name: '初次远行',
      desc: '第一次送她出门。', test: function (s) { return s.tripCount >= 1; } },
    { id: 'trip_10', group: 'travel', icon: '👣', name: '走过十次',
      desc: '累计出门 10 次。', test: function (s) { return s.tripCount >= 10; } },
    { id: 'trip_50', group: 'travel', icon: '🧭', name: '老练的旅人',
      desc: '累计出门 50 次。', test: function (s) { return s.tripCount >= 50; } },
    { id: 'local_1', group: 'travel', icon: '🏠', name: '就在家门口',
      desc: '选自己的家乡出门一次（1 小时的行程）。',
      test: function (s) { return s.localTrips >= 1; } },
    { id: 'region_5', group: 'travel', icon: '🗺️', name: '五方',
      desc: '去过 5 个不同的地区。', test: function (s) { return countKeys(s.byDestination) >= 5; } },
    { id: 'region_all', group: 'travel', icon: '🌏', name: '走遍全国',
      desc: '把所有地区都走一遍。',
      test: function (s) { return countKeys(s.byDestination) >= (NT.data.destinations || []).length; } },
    { id: 'km_1000', group: 'travel', icon: '🚶', name: '千里之行',
      desc: '单次行程走满 1000 公里。', test: function (s) { return s.maxTravelKm >= 1000; } },
    { id: 'km_2500', group: 'travel', icon: '🏔️', name: '长途跋涉',
      desc: '单次行程走满 2500 公里。', test: function (s) { return s.maxTravelKm >= 2500; } },
    { id: 'reach_mohe', group: 'travel', icon: '❄️', name: '抵达最北',
      desc: '走到漠河。', test: function (s) { return (s.byDestination.mohe || 0) > 0; } },
    { id: 'reach_kanas', group: 'travel', icon: '🐟', name: '西北角',
      desc: '走到喀纳斯。', test: function (s) { return (s.byDestination.kanas || 0) > 0; } },
    { id: 'reach_three', group: 'travel', icon: '🧳', name: '天涯海角',
      desc: '漠河、喀纳斯、三亚都去过。',
      test: function (s) {
        return (s.byDestination.mohe || 0) > 0 && (s.byDestination.kanas || 0) > 0 &&
               (s.byDestination.sanya || 0) > 0;
      } },

    /* ---------- 明信片 ---------- */
    { id: 'card_1',  group: 'card', icon: '💌', name: '第一张明信片',
      desc: '收到第一张明信片。', test: function (s) { return s.cards >= 1; } },
    { id: 'card_20', group: 'card', icon: '📬', name: '二十张',
      desc: '累计收到 20 张明信片。', test: function (s) { return s.cards >= 20; } },
    { id: 'card_50', group: 'card', icon: '📮', name: '五十张',
      desc: '累计收到 50 张明信片。', test: function (s) { return s.cards >= 50; } },
    { id: 'sr_1',  group: 'card', icon: '💠', name: '稀有的一页',
      desc: '拿到第一张「稀有」明信片。', test: function (s) { return (s.rarity.SR + s.rarity.SSR) >= 1; } },
    { id: 'ssr_1', group: 'card', icon: '🌟', name: '极稀有',
      desc: '拿到第一张「极稀有」明信片。', test: function (s) { return s.rarity.SSR >= 1; } },
    { id: 'ssr_5', group: 'card', icon: '✨', name: '五张极稀有',
      desc: '拿到 5 张「极稀有」明信片。', test: function (s) { return s.rarity.SSR >= 5; } },

    /* ---------- 种植 ---------- */
    { id: 'harvest_1',  group: 'farm', icon: '🌱', name: '第一次收获',
      desc: '从田里收获一次。', test: function (s) { return s.harvestCount >= 1; } },
    { id: 'harvest_20', group: 'farm', icon: '🌾', name: '收获二十次',
      desc: '累计收获 20 次。', test: function (s) { return s.harvestCount >= 20; } },
    { id: 'crop_all', group: 'farm', icon: '🧺', name: '五谷丰登',
      desc: '把 10 种作物都种过一遍。',
      test: function (s) { return countKeys(s.cropsGrown) >= (NT.data.crops || []).length; } },
    { id: 'lake', group: 'farm', icon: '🪷', name: '水田里的东西',
      desc: '种过水田的全部 5 种作物。',
      test: function (s) {
        var wet = (NT.data.crops || []).filter(function (c) { return c.field === 'wet'; });
        return wet.length > 0 && wet.every(function (c) { return (s.cropsGrown[c.id] || 0) > 0; });
      } },
    { id: 'rare_1', group: 'farm', icon: '🍀', name: '第一件稀有道具',
      desc: '收获时掉落一件稀有道具。', test: function (s) { return countKeys(s.rareFound) >= 1; } },
    { id: 'rare_all', group: 'farm', icon: '💎', name: '收藏家',
      desc: '5 种稀有道具都拿到过。',
      test: function (s) { return countKeys(s.rareFound) >= (NT.data.rareDrops || []).length; } },

    /* ---------- 同伴 ---------- */
    { id: 'friend_1', group: 'friend', icon: '🤝', name: '同行',
      desc: '第一次有同伴一起旅行。', test: function (s) { return countKeys(s.byCompanion) >= 1; } },
    { id: 'friend_5', group: 'friend', icon: '👥', name: '五位同行',
      desc: '和 5 个不同的同伴一起旅行过。', test: function (s) { return countKeys(s.byCompanion) >= 5; } },
    { id: 'friend_all', group: 'friend', icon: '🎊', name: '全员同行',
      desc: '和所有同伴都同行过。',
      test: function (s) { return countKeys(s.byCompanion) >= (NT.data.companions || []).length; } },

    /* ---------- 家 ---------- */
    { id: 'toy_1', group: 'home', icon: '🧸', name: '第一件玩具',
      desc: '旅行带回一件玩具。', test: function (s) { return s.toys >= 1; } },
    { id: 'toy_all', group: 'home', icon: '🎠', name: '满屋玩具',
      desc: '收集全部 10 件玩具。',
      test: function (s) { return s.toys >= (NT.data.toys || []).length; } },
    { id: 'chat_1',  group: 'home', icon: '💬', name: '说说话',
      desc: '第一次和她聊天。', test: function (s) { return s.chats >= 1; } },
    { id: 'chat_20', group: 'home', icon: '🫖', name: '聊了二十次',
      desc: '累计聊天 20 次。', test: function (s) { return s.chats >= 20; } },
    { id: 'poke_30', group: 'home', icon: '👉', name: '别戳了',
      desc: '戳她 30 次。', test: function (s) { return s.pokes >= 30; } },

    /* ---------- 特殊 ---------- */
    { id: 'soaked_1', group: 'special', icon: '🌧️', name: '落汤鸡',
      desc: '掉进河里，食物被冲光。', test: function (s) { return s.soaked >= 1; } },
    { id: 'redirect_1', group: 'special', icon: '🪧', name: '计划外的地方',
      desc: '旅途中途改了目的地。', test: function (s) { return s.redirected >= 1; } },
    { id: 'turnback_1', group: 'special', icon: '↩️', name: '半路折返',
      desc: '食物不够，没能走到目的地。', test: function (s) { return s.turnedBack >= 1; } },
    { id: 'refill_3', group: 'special', icon: '🍱', name: '一路有人帮',
      desc: '单次行程里吃到 3 次以上补给。', test: function (s) { return s.maxRefillInTrip >= 3; } },
    { id: 'all_rarity', group: 'special', icon: '🎖️', name: '四档齐全',
      desc: '普通/少见/稀有/极稀有都拿到过。',
      test: function (s) { return s.rarity.N > 0 && s.rarity.R > 0 && s.rarity.SR > 0 && s.rarity.SSR > 0; } }
  ];

  NT.data.achievementById = function (id) {
    var l = NT.data.achievements;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  };
})(typeof window !== 'undefined' ? window : this);
