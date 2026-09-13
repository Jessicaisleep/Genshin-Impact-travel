/* 纳西妲旅行 · 通用工具
 * 经典脚本（非 ESM），file:// 下可直接 <script src> 加载。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});

  var util = {};

  util.clamp = function (v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  };

  util.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  /** [min,max] 区间随机，使用外部注入的 rng 函数 */
  util.range = function (rng, min, max) {
    return min + (max - min) * rng();
  };

  /** 从数组随机取一个 */
  util.pick = function (rng, arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(rng() * arr.length) % arr.length];
  };

  /** 洗牌（不改原数组） */
  util.shuffle = function (rng, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  util.uniq = function (arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) {
      var k = String(arr[i]);
      if (!seen[k]) { seen[k] = 1; out.push(arr[i]); }
    }
    return out;
  };

  /** 深拷贝（仅处理 JSON 安全结构） */
  util.clone = function (o) {
    return o == null ? o : JSON.parse(JSON.stringify(o));
  };

  util.uid = function (rng) {
    var s = '';
    var abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < 4; i++) s += abc[Math.floor(rng() * abc.length)];
    return s;
  };

  /** 毫秒 -> 人类可读时长（用于调试面板） */
  util.humanMs = function (ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600);  s -= h * 3600;
    var m = Math.floor(s / 60);
    if (d > 0) return d + '天' + h + '小时';
    if (h > 0) return h + '小时' + m + '分';
    return m + '分';
  };

  /** 模糊化的等待描述：复刻原版神秘感，不给准确倒计时 */
  util.vagueWait = function (remainMs, totalMs) {
    var p = totalMs > 0 ? 1 - remainMs / totalMs : 1;
    if (p < 0.15) return '她刚刚出发';
    if (p < 0.4) return '她还在路上';
    if (p < 0.7) return '走了有一阵子了';
    if (p < 0.9) return '应该快回来了';
    return '就快到家了';
  };

  /** 把时间点格式化成 24 小时的 HH:MM（用来告诉她大概几点回来） */
  util.clockTime = function (ts) {
    var d = new Date(ts);
    var h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  };

  /** 安全 JSON 解析 */
  util.tryJSON = function (s, fallback) {
    try { return JSON.parse(s); } catch (e) { return fallback; }
  };

  /** 从模型输出里抠出 JSON（容忍 ```json 包裹和前后废话） */
  util.extractJSON = function (s) {
    if (!s) return null;
    var t = String(s).trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    var direct = util.tryJSON(t, undefined);
    if (direct !== undefined) return direct;
    var i = t.indexOf('{'), j = t.lastIndexOf('}');
    if (i >= 0 && j > i) return util.tryJSON(t.slice(i, j + 1), null);
    return null;
  };

  NT.util = util;
})(typeof window !== 'undefined' ? window : this);
