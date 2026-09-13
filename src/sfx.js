/* 纳西妲旅行 · 音效
 * 全部用 Web Audio 现场合成 —— 不需要任何音频素材文件，也不占体积。
 * AudioContext 必须在用户手势之后创建，所以第一次点击时才初始化。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});

  var sfx = {};
  sfx.enabled = true;
  sfx.ctx = null;
  sfx.master = null;

  /** 单个音符：{f 频率, d 时长(秒), t 波形, g 音量, delay 延迟, slide 滑到哪个频率} */
  var SOUNDS = {
    click:  [{ f: 520, d: 0.06, t: 'triangle', g: 0.06 }],
    open:   [{ f: 440, d: 0.07, t: 'sine', g: 0.06 },
             { f: 660, d: 0.09, t: 'sine', g: 0.06, delay: 0.06 }],
    close:  [{ f: 520, d: 0.06, t: 'sine', g: 0.05 },
             { f: 330, d: 0.09, t: 'sine', g: 0.05, delay: 0.05 }],
    plant:  [{ f: 400, d: 0.08, t: 'sine', g: 0.07 },
             { f: 560, d: 0.10, t: 'sine', g: 0.07, delay: 0.07 }],
    harvest:[{ f: 660, d: 0.09, t: 'triangle', g: 0.08 },
             { f: 880, d: 0.10, t: 'triangle', g: 0.08, delay: 0.08 },
             { f: 1180, d: 0.16, t: 'triangle', g: 0.07, delay: 0.16 }],
    rare:   [{ f: 1046, d: 0.08, t: 'sine', g: 0.08 },
             { f: 1318, d: 0.08, t: 'sine', g: 0.08, delay: 0.07 },
             { f: 1568, d: 0.20, t: 'sine', g: 0.09, delay: 0.14 }],
    cook:   [{ f: 360, d: 0.10, t: 'sawtooth', g: 0.04 },
             { f: 520, d: 0.14, t: 'sawtooth', g: 0.04, delay: 0.09 }],
    depart: [{ f: 280, d: 0.40, t: 'sine', g: 0.08, slide: 760 }],
    arrive: [{ f: 523, d: 0.12, t: 'triangle', g: 0.08 },
             { f: 659, d: 0.12, t: 'triangle', g: 0.08, delay: 0.11 },
             { f: 784, d: 0.12, t: 'triangle', g: 0.08, delay: 0.22 },
             { f: 1046, d: 0.34, t: 'triangle', g: 0.09, delay: 0.33 }],
    achieve:[{ f: 784, d: 0.10, t: 'square', g: 0.05 },
             { f: 1046, d: 0.10, t: 'square', g: 0.05, delay: 0.09 },
             { f: 1318, d: 0.10, t: 'square', g: 0.05, delay: 0.18 },
             { f: 1568, d: 0.38, t: 'square', g: 0.06, delay: 0.27 }],
    blip:   [{ f: 880, d: 0.05, t: 'sine', g: 0.05 }],
    poke:   [{ f: 600, d: 0.09, t: 'sine', g: 0.06, slide: 950 }],
    toy:    [{ f: 700, d: 0.07, t: 'triangle', g: 0.06 },
             { f: 950, d: 0.10, t: 'triangle', g: 0.06, delay: 0.06 }],
    error:  [{ f: 190, d: 0.14, t: 'square', g: 0.05 },
             { f: 145, d: 0.18, t: 'square', g: 0.05, delay: 0.12 }]
  };

  sfx.supported = function () {
    return !!(root.AudioContext || root.webkitAudioContext);
  };

  /** 必须在用户手势里调用（浏览器要求） */
  sfx.init = function () {
    if (sfx.ctx) return sfx.ctx;
    if (!sfx.supported()) return null;
    try {
      var AC = root.AudioContext || root.webkitAudioContext;
      sfx.ctx = new AC();
      sfx.master = sfx.ctx.createGain();
      sfx.master.gain.value = 0.5;
      sfx.master.connect(sfx.ctx.destination);
    } catch (e) {
      sfx.ctx = null;
    }
    return sfx.ctx;
  };

  function playNote(ctx, spec, t0) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = spec.t || 'sine';
    var f0 = spec.f, f1 = spec.slide || spec.f;
    osc.frequency.setValueAtTime(f0, t0);
    if (spec.slide) {
      try { osc.frequency.exponentialRampToValueAtTime(f1, t0 + spec.d); } catch (e) { }
    }
    var peak = spec.g || 0.07;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.010);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.d);
    osc.connect(g);
    g.connect(sfx.master || ctx.destination);
    osc.start(t0);
    osc.stop(t0 + spec.d + 0.03);
  }

  sfx.play = function (name) {
    if (!sfx.enabled) return;
    var seq = SOUNDS[name];
    if (!seq) return;
    var ctx = sfx.ctx || sfx.init();
    if (!ctx) return;
    if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) { } }
    var t0 = ctx.currentTime + 0.012;
    for (var i = 0; i < seq.length; i++) {
      playNote(ctx, seq[i], t0 + (seq[i].delay || 0));
    }
  };

  sfx.setEnabled = function (on) {
    sfx.enabled = !!on;
    if (sfx.enabled) { sfx.init(); sfx.play('blip'); }
  };

  sfx.names = function () { return Object.keys(SOUNDS); };

  NT.sfx = sfx;
})(typeof window !== 'undefined' ? window : this);
