/* 纳西妲旅行 · 厨房 / 料理
 * 收获的食材在这里合成"出门带的食物"，食物决定旅行的倾向。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  NT.data = NT.data || {};

  /**
   * need: {食材id: 数量}
   * effect:
   *   durationBias  偏好时长档位 short/medium/long/epic
   *   weatherBias   提高某些天气出现概率
   *   meetBonus     提高遇到同伴的概率
   *   scoreBonus    提高稀有度评分（直接影响 SR/SSR 概率）
   *   luck          额外好运
   */
  NT.data.dishes = [
    {
      id: 'none', name: '什么都不带', need: {}, effect: {}, foodKm: 320,
      desc: '空着手出门。', tier: 0
    },
    {
      id: 'riceball', name: '白饭团', need: { rice: 1 }, tier: 1, foodKm: 550,
      effect: { durationBias: 'short' },
      desc: '捏得很紧，凉了也好吃。'
    },
    {
      id: 'potatocake', name: '土豆饼', need: { potato: 2 }, tier: 1, foodKm: 680,
      effect: { durationBias: 'medium' },
      desc: '外面焦，里面软。'
    },
    {
      id: 'cornsoup', name: '玉米浓汤', need: { corn: 1, potato: 1 }, tier: 2, foodKm: 780,
      effect: { durationBias: 'medium', meetBonus: 0.06 },
      desc: '热的时候最好喝，凉了就有点稠。'
    },
    {
      id: 'soybowl', name: '茭白炒豆', need: { wildrice: 1, soybean: 1 }, tier: 2, foodKm: 720,
      effect: { meetBonus: 0.14 },
      desc: '清清爽爽的，路上吃不会腻。'
    },
    {
      id: 'chestnutcake', name: '荸荠糕', need: { waterchestnut: 3 }, tier: 2, foodKm: 640,
      effect: { luck: true, meetBonus: 0.05 },
      desc: '半透明的，能看见里面嵌着的小块。'
    },
    {
      id: 'caltrop_rice', name: '菱角饭', need: { watercaltrop: 1, rice: 1 }, tier: 2, foodKm: 920,
      effect: { scoreBonus: 1 },
      desc: '菱角剥起来费劲，但是值得。'
    },
    {
      id: 'lotus_soup', name: '莲藕汤', need: { lotus: 1, potato: 1 }, tier: 3, foodKm: 1150,
      effect: { durationBias: 'long', scoreBonus: 1 },
      desc: '炖了很久，切开能看见里面的孔。'
    },
    {
      id: 'tricolor', name: '三色便当', need: { rice: 1, tomato: 1, corn: 1 }, tier: 3, foodKm: 1350,
      effect: { durationBias: 'long', meetBonus: 0.08, scoreBonus: 1 },
      desc: '摆得整整齐齐，打开的时候会亮一下。'
    },
    {
      id: 'lotus_rice', name: '荷叶饭', need: { rice: 2, lotus: 1 }, tier: 4, foodKm: 1750,
      effect: { scoreBonus: 2, durationBias: 'epic' },
      desc: '用叶子包着蒸的，打开有一股清香。'
    },
    {
      id: 'harvest', name: '五谷丰登', need: { wheat: 1, soybean: 1, potato: 1, rice: 1, corn: 1 }, tier: 4, foodKm: 1950,
      effect: { scoreBonus: 2, meetBonus: 0.16, durationBias: 'long' },
      desc: '把田里能收的都放进去了。'
    }
  ];

  NT.data.dishById = function (id) {
    var l = NT.data.dishes;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  };

  /** 判断食材是否够做某道菜 */
  NT.data.canCook = function (dish, inv) {
    if (!dish || !dish.need) return false;
    for (var k in dish.need) {
      if ((inv[k] || 0) < dish.need[k]) return false;
    }
    return true;
  };

  /** 列出当前能做的菜 */
  NT.data.cookableDishes = function (inv) {
    return NT.data.dishes.filter(function (d) {
      return d.id !== 'none' && NT.data.canCook(d, inv);
    });
  };
})(typeof window !== 'undefined' ? window : this);
