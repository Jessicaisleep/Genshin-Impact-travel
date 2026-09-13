/* 纳西妲旅行 · L1 模板文本渲染（保底层，永不失败）
 * 文本要反映旅途结果：到了 / 半路折返 / 落汤鸡 / 中途改道。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  var U = NT.util, R = NT.rng;

  var text = (NT.text = NT.text || {});

  function fill(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, function (m, k) {
      return (vars[k] === undefined || vars[k] === null) ? '' : String(vars[k]);
    });
  }

  /** 从旅途段落里挑出"值得写进日记"的，最多 n 条 */
  function pickHighlights(steps, rand, n) {
    var interesting = (steps || []).filter(function (s) {
      return s.kind === 'refill' || s.kind === 'setback' ||
             s.kind === 'redirect' || s.kind === 'companion';
    });
    if (!interesting.length) return [];
    // 优先包含有实际影响的
    interesting.sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
    var head = interesting.slice(0, n);
    // 保持时间顺序
    head.sort(function (a, b) { return a.index - b.index; });
    return head;
  }

  text.templateRender = function (fact) {
    var res = NT.trip.resolve(fact);
    var T = NT.data.templates;
    var rand = R.mulberry32(R.hashSeed(fact.seed + ':text'));

    var vars = {
      dest: res.destination ? res.destination.name : '某个地方',
      destDesc: res.destination ? res.destination.desc : '',
      actual: res.destination ? res.destination.name : '某个地方',
      target: res.target ? res.target.name : '',
      home: res.home ? res.home.name : '',
      companion: res.companion ? res.companion.name : '',
      call: res.companion ? res.companion.callNahida : '',
      weather: res.weather ? res.weather.name : '',
      timeOfDay: res.timeOfDay ? res.timeOfDay.name : ''
    };

    var parts = [];

    /* ---- 开场：按旅途结果分流 ---- */
    if (res.soaked) {
      parts.push(fill(U.pick(rand, T.soakedOpen), vars));
    } else if (!res.reached) {
      parts.push(fill(U.pick(rand, T.turnedBackOpen), vars));
    } else if (res.redirected) {
      parts.push(fill(U.pick(rand, T.redirectedOpen), vars));
    } else if (res.destination && res.destination.arriveLines && rand() < 0.55) {
      parts.push(U.pick(rand, res.destination.arriveLines));
    } else {
      parts.push(fill(U.pick(rand, T.open), vars));
    }

    /* ---- 同伴 / 独行 ---- */
    if (res.companion) {
      var lines = [].concat(res.companion.meetLines || [], res.companion.affinityLines || []);
      parts.push(U.pick(rand, lines));
    } else {
      parts.push(U.pick(rand, T.alone));
    }

    /* ---- 旅途事件 ---- */
    var hl = pickHighlights(res.steps, rand, 2);
    if (hl.length) {
      parts.push(U.pick(rand, T.journeyLead));
      for (var i = 0; i < hl.length; i++) {
        parts.push(hl[i].text);
      }
    }

    /* ---- 到了之后看到/吃到/玩到的 ---- */
    var evTexts = [];
    for (var e = 0; e < res.events.length; e++) evTexts.push(res.events[e].desc);
    if (evTexts.length) {
      parts.push(U.pick(rand, T.eventLead) + evTexts.join(''));
    }

    /* ---- 收尾 ---- */
    if (res.soaked) parts.push(U.pick(rand, T.soakedClose));
    else if (!res.reached) parts.push(U.pick(rand, T.turnedBackClose));
    else parts.push(U.pick(rand, T.close));

    var diary = parts.filter(function (p) { return p && p.length; }).join('');

    /* ---- 背面短句 ---- */
    var back;
    if (res.soaked) back = U.pick(rand, T.soakedBack);
    else if (!res.reached) back = U.pick(rand, T.turnedBackBack);
    else if (res.redirected) back = U.pick(rand, T.redirectedBack);
    else back = U.pick(rand, T.postcardBack);

    return { source: 'template', diary: diary, postcardBack: back };
  };

  NT.text.fill = fill;
})(typeof window !== 'undefined' ? window : this);
