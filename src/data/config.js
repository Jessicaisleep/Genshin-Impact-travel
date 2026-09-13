/* 纳西妲旅行 · 全局配置（所有可调数值集中在这里）
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  var HOUR = 3600e3;

  NT.config = {
    ENGINE_VERSION: 2,
    SAVE_KEY: 'nahida-travel/save/v2',
    POSTCARD_W: 1200,
    POSTCARD_H: 1800,

    /** 旅行时长权重（毫秒） */
    durations: [
      { id: 'short',  min: 2  * HOUR, max: 8   * HOUR, weight: 45 },
      { id: 'medium', min: 8  * HOUR, max: 24  * HOUR, weight: 33 },
      { id: 'long',   min: 24 * HOUR, max: 60  * HOUR, weight: 17 },
      { id: 'epic',   min: 60 * HOUR, max: 144 * HOUR, weight:  5 }
    ],

    /** 稀有度 */
    rarity: {
      N:   { label: '普通',  color: '#9aa4b2', weight: 60 },
      R:   { label: '少见',  color: '#57a5ff', weight: 27 },
      SR:  { label: '稀有',  color: '#b06bff', weight: 10 },
      SSR: { label: '极稀有', color: '#ffb340', weight: 3 }
    },

    /** 旅途方向：按地区的实际方位筛选 */
    directions: [
      { id: 'n',   name: '向北',  desc: '更冷、更远的地方' },
      { id: 's',   name: '向南',  desc: '更暖、更湿的地方' },
      { id: 'e',   name: '向东',  desc: '靠海、靠水的地方' },
      { id: 'w',   name: '向西',  desc: '山多、路长的地方' },
      { id: 'c',   name: '居中',  desc: '不算南也不算北' },
      { id: 'any', name: '随它去', desc: '不指定方向' }
    ],

    /** 连续出行的保底 */
    pity: {
      companionGap: 3,
      destinationRepeatLimit: 2,
      /** 连续 N 次没带回玩具，则必带 */
      toyGap: 4
    },

    /** 种植 */
    farm: {
      plots: ['dry', 'wet'],
      /** 收获时掉落稀有道具的全局倍率 */
      rareDropMul: 1.0
    },

    /** 家 */
    home: {
      /** 纳西妲多久换一次状态（毫秒） */
      stateChangeMs: 25 * 60e3,
      /** 每次打开游戏最多推进几次状态，防止放置过久刷爆 */
      maxStateSteps: 4,

      /**
       * 来访同伴。
       * 同伴自己跑来家里待一会儿，最多同时 1 位，每个人出现概率相同。
       * 待多久由「设置」里的"同伴来访时长"决定（见 VISIT_STAY）。
       */
      visitor: {
        enabled: true,
        /** 她每换一次状态就掷一次骰子：来客的概率 */
        chance: 0.24,
        /** 上一个走了之后，至少隔这么久才可能再来 */
        cooldownMs: 4 * 60e3
      }
    },

    /** 「设置」里可选的同伴来访时长（分钟） */
    VISIT_STAY: {
      short:  { label: '短　5~10 分钟',  min: 5,  max: 10 },
      normal: { label: '中　10~20 分钟', min: 10, max: 20 },
      long:   { label: '长　20~40 分钟', min: 20, max: 40 }
    },

    /** 玩具掉落的稀有度权重 */
    toyRarityWeight: { N: 46, R: 34, SR: 16, SSR: 4 },

    /** 时间回拨检测容差 */
    clockToleranceMs: 5 * 60e3,
    /** 离线一次最多结算的旅行数 */
    maxCatchUp: 1
  };

  NT.HOUR = HOUR;
})(typeof window !== 'undefined' ? window : this);
