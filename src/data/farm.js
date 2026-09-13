/* 纳西妲旅行 · 种植系统数据
 * 两块田：旱田 + 水田。作物按真实时间生长，收获后进食材背包，
 * 并有几率掉落稀有道具（只提升稀有明信片概率，不直接给明信片）。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  NT.data = NT.data || {};

  NT.HOUR = 3600e3;

  /** 田地 */
  NT.data.fields = [
    {
      id: 'dry', name: '旱田', desc: '土是松的，一脚踩下去会陷一点。'
    },
    {
      id: 'wet', name: '水田', desc: '浅浅一层水，能看见底下的泥。'
    }
  ];

  NT.data.fieldById = function (id) {
    var l = NT.data.fields;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  };

  /** 作物。growMs 为真实时间；yield 为收获的食材数量区间 */
  NT.data.crops = [
    /* ---- 旱田 ---- */
    { id: 'potato', name: '土豆', field: 'dry', growMs: 2 * NT.HOUR, icon: 'stone',
      yieldItem: 'potato', yieldMin: 2, yieldMax: 4, desc: '埋在土里，看不出来熟了没有。' },
    { id: 'wheat', name: '小麦', field: 'dry', growMs: 4 * NT.HOUR, icon: 'leaf',
      yieldItem: 'wheat', yieldMin: 2, yieldMax: 3, desc: '一片一片地倒向同一边。' },
    { id: 'soybean', name: '大豆', field: 'dry', growMs: 3 * NT.HOUR, icon: 'seed',
      yieldItem: 'soybean', yieldMin: 2, yieldMax: 4, desc: '豆荚鼓鼓的，捏一下有响声。' },
    { id: 'tomato', name: '番茄', field: 'dry', growMs: 5 * NT.HOUR, icon: 'flower',
      yieldItem: 'tomato', yieldMin: 2, yieldMax: 3, desc: '红得很快，前一天还是青的。' },
    { id: 'corn', name: '玉米', field: 'dry', growMs: 6 * NT.HOUR, icon: 'leaf',
      yieldItem: 'corn', yieldMin: 1, yieldMax: 3, desc: '长得比人还高，叶子会划手。' },

    /* ---- 水田 ---- */
    { id: 'wildrice', name: '茭白', field: 'wet', growMs: 3 * NT.HOUR, icon: 'bamboo',
      yieldItem: 'wildrice', yieldMin: 2, yieldMax: 4, desc: '站在水里，叶子又长又直。' },
    { id: 'waterchestnut', name: '荸荠', field: 'wet', growMs: 4 * NT.HOUR, icon: 'stone',
      yieldItem: 'waterchestnut', yieldMin: 2, yieldMax: 5, desc: '要伸手到泥里去摸。' },
    { id: 'rice', name: '水稻', field: 'wet', growMs: 6 * NT.HOUR, icon: 'leaf',
      yieldItem: 'rice', yieldMin: 3, yieldMax: 5, desc: '水面上能看见天的倒影。' },
    { id: 'watercaltrop', name: '菱角', field: 'wet', growMs: 5 * NT.HOUR, icon: 'star',
      yieldItem: 'watercaltrop', yieldMin: 2, yieldMax: 4, desc: '浮在水上，翻过来是尖的。' },
    { id: 'lotus', name: '莲藕', field: 'wet', growMs: 8 * NT.HOUR, icon: 'flower',
      yieldItem: 'lotus', yieldMin: 1, yieldMax: 3, desc: '花开了很久，底下才慢慢长起来。' }
  ];

  NT.data.cropById = function (id) {
    var l = NT.data.crops;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  };
  NT.data.cropsForField = function (fieldId) {
    return NT.data.crops.filter(function (c) { return c.field === fieldId; });
  };

  /** 食材显示名 */
  NT.data.ingredients = {
    potato: '土豆', wheat: '小麦', soybean: '大豆', tomato: '番茄', corn: '玉米',
    wildrice: '茭白', waterchestnut: '荸荠', rice: '稻米', watercaltrop: '菱角', lotus: '莲藕'
  };
  NT.data.ingredientName = function (id) { return NT.data.ingredients[id] || id; };

  /** 稀有道具：只提升稀有明信片概率与好运，不直接产出明信片 */
  NT.data.rareDrops = [
    { id: 'clover4', name: '四叶草', icon: 'leaf', dropChance: 0.070, foodKm: 120, scoreBonus: 1, meetBonus: 0.05,
      desc: '运气会好一点。' },
    { id: 'moonstone', name: '月光石', icon: 'star', dropChance: 0.040, foodKm: 150, scoreBonus: 1, meetBonus: 0,
      desc: '夜里会有一点亮。' },
    { id: 'windchime', name: '风铃', icon: 'bell', dropChance: 0.045, foodKm: 100, scoreBonus: 0, meetBonus: 0.12,
      desc: '响的时候，好像有人要来。' },
    { id: 'luckycoin', name: '幸运币', icon: 'key', dropChance: 0.022, foodKm: 250, scoreBonus: 2, meetBonus: 0.05,
      desc: '边缘被磨得很圆。' },
    { id: 'ancientseed', name: '古老种子', icon: 'seed', dropChance: 0.012, foodKm: 300, scoreBonus: 2, meetBonus: 0.08,
      desc: '不知道会长出什么。' }
  ];

  NT.data.rareDropById = function (id) {
    var l = NT.data.rareDrops;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  };
})(typeof window !== 'undefined' ? window : this);
