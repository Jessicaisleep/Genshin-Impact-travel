/* 纳西妲旅行 · 存档
 * 存档里不存图片：明信片由事实卡确定性重绘。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  var C = NT.config;

  var store = {};
  var memory = {};
  var usingMemory = false;

  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { root.localStorage.removeItem(k); return true; } catch (e) { return false; } }

  store.defaultSave = function () {
    return {
      version: 2,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),

      /** 家乡：行程距离与方向的基准 */
      homeId: 'beijing',
      /** 是否已经选过家乡 */
      homeChosen: false,

      activeTrip: null,
      album: [],
      companionAffinity: {},
      stats: { tripCount: 0, byDestination: {}, byCompanion: {} },

      /** 田地：每块地一个槽位 */
      farm: {
        dry: { cropId: null, plantedAt: 0, readyAt: 0 },
        wet: { cropId: null, plantedAt: 0, readyAt: 0 }
      },

      /** 背包 */
      inventory: {
        ingredients: {},   // 食材 id -> 数量
        dishes: {},        // 料理 id -> 数量
        rare: {}           // 稀有道具 id -> 数量
      },

      /** 玩具：已拥有的 id 列表 */
      toys: [],

      /** 家：一个 16:9 的全屏世界，玩具摆在固定槽位上 */
      home: {
        placed: [],        // [{toyId, slot}]
        nahida: { stateId: 'idle', since: Date.now(), until: 0, prevSpotId: 'yard' },
        /** 来访的同伴。null = 家里没客人 */
        visitor: null,     // { companionId, stateId, since, until, arrivedAt, greeted }
        /** 上一个客人走的时间，用来做冷却 */
        lastVisitorAt: 0
      },

      settings: {
        aiEnabled: false,
        apiKey: '',
        model: 'deepseek-chat',
        baseURL: 'https://api.deepseek.com',
        sound: true,
        /** 同伴来访时长：short / normal / long */
        visitorStay: 'normal'
      },

      seenIntro: false
    };
  };

  function deepDefaults(target, defaults) {
    for (var k in defaults) {
      if (!(k in target) || target[k] === null || target[k] === undefined) {
        target[k] = NT.util.clone(defaults[k]);
      } else if (typeof defaults[k] === 'object' && !Array.isArray(defaults[k]) && typeof target[k] === 'object') {
        deepDefaults(target[k], defaults[k]);
      }
    }
    return target;
  }

  store.load = function () {
    var raw = usingMemory ? memory[C.SAVE_KEY] : lsGet(C.SAVE_KEY);
    if (!raw) return store.defaultSave();
    var s = NT.util.tryJSON(raw, null);
    if (!s || typeof s !== 'object') return store.defaultSave();
    deepDefaults(s, store.defaultSave());
    if (!Array.isArray(s.album)) s.album = [];
    if (!Array.isArray(s.toys)) s.toys = [];
    if (!Array.isArray(s.home.placed)) s.home.placed = [];
    return s;
  };

  store.save = function (s) {
    var raw = JSON.stringify(s);
    if (usingMemory) { memory[C.SAVE_KEY] = raw; return true; }
    if (!lsSet(C.SAVE_KEY, raw)) {
      usingMemory = true;
      memory[C.SAVE_KEY] = raw;
      return false;
    }
    return true;
  };

  store.reset = function () {
    if (usingMemory) delete memory[C.SAVE_KEY]; else lsDel(C.SAVE_KEY);
    return store.defaultSave();
  };

  store.isMemoryOnly = function () { return usingMemory; };
  store.exportJSON = function (s) { return JSON.stringify(s, null, 2); };

  /** 存档体积（字节），用于确认"不存图"的效果 */
  store.sizeOf = function (s) { return JSON.stringify(s).length; };

  NT.store = store;
})(typeof window !== 'undefined' ? window : this);
