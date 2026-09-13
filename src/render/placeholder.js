/* 纳西妲旅行 · 程序化占位美术
 * 目的：在没有真实素材时也能跑通并评估合成效果。
 * 接入真实素材后，本模块可整体替换为图片加载。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  var U = NT.util;

  var ph = {};

  /* ---------------- 噪声工具 ---------------- */

  function makeNoise(rand, n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(rand());
    return a;
  }
  function sampleNoise(arr, t) {
    var n = arr.length;
    var x = ((t % 1) + 1) % 1 * n;
    var i = Math.floor(x), f = x - i;
    var a = arr[i % n], b = arr[(i + 1) % n];
    var u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  }
  function fbm(arrs, t) {
    var v = 0, amp = 0.5, tot = 0;
    for (var i = 0; i < arrs.length; i++) {
      v += sampleNoise(arrs[i], t * (i + 1)) * amp;
      tot += amp; amp *= 0.5;
    }
    return v / tot;
  }

  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }
  function rgbStr(rgb, a) {
    return a === undefined
      ? 'rgb(' + (rgb[0] | 0) + ',' + (rgb[1] | 0) + ',' + (rgb[2] | 0) + ')'
      : 'rgba(' + (rgb[0] | 0) + ',' + (rgb[1] | 0) + ',' + (rgb[2] | 0) + ',' + a + ')';
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function shade(rgb, f) { return [rgb[0] * f, rgb[1] * f, rgb[2] * f]; }

  ph.hexToRgb = hexToRgb; ph.rgbStr = rgbStr; ph.mix = mix; ph.shade = shade;
  ph.makeNoise = makeNoise; ph.sampleNoise = sampleNoise; ph.fbm = fbm;

  /* ---------------- 背景 ---------------- */

  /**
   * 画一张程序化风景。全部由 palette + seed 决定。
   * @param ctx 目标 2D context
   * @param w,h 画布尺寸
   * @param dest 目的地对象（含 palette / tags / anchorY）
   * @param timeOfDay / weather 对象
   * @param seed 数字种子
   */
  ph.background = function (ctx, w, h, dest, timeOfDay, weather, seed) {
    var rand = NT.rng.mulberry32(seed >>> 0);
    var pal = dest.palette;
    var tags = dest.tags || [];
    var horizon = h * (dest.anchorY || 0.72);

    var skyTop = hexToRgb(pal.sky[0]);
    var skyBot = hexToRgb(pal.sky[1]);
    var tKind = timeOfDay ? timeOfDay.id : 'day';

    // 夜晚把天空压暗
    if (tKind === 'night') {
      skyTop = mix(skyTop, [18, 24, 58], 0.72);
      skyBot = mix(skyBot, [40, 50, 90], 0.62);
    } else if (tKind === 'dusk') {
      skyTop = mix(skyTop, [120, 90, 140], 0.35);
      skyBot = mix(skyBot, [255, 170, 120], 0.42);
    } else if (tKind === 'dawn') {
      skyTop = mix(skyTop, [130, 150, 200], 0.25);
      skyBot = mix(skyBot, [255, 215, 170], 0.35);
    }

    // 1. 天空
    var g = ctx.createLinearGradient(0, 0, 0, horizon + h * 0.08);
    g.addColorStop(0, rgbStr(skyTop));
    g.addColorStop(1, rgbStr(skyBot));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 2. 星空
    if (timeOfDay && timeOfDay.starAlpha > 0) {
      ctx.save();
      for (var s = 0; s < 160; s++) {
        var sx = rand() * w, sy = rand() * horizon * 0.85;
        var sr = U.range(rand, 0.6, 2.1);
        ctx.globalAlpha = timeOfDay.starAlpha * U.range(rand, 0.25, 1);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // 3. 天体
    ctx.save();
    var isNight = tKind === 'night';
    var bodyX = U.range(rand, w * 0.15, w * 0.85);
    var bodyY = isNight ? U.range(rand, h * 0.08, h * 0.22) : U.range(rand, h * 0.10, h * 0.26);
    var bodyR = U.range(rand, w * 0.045, w * 0.075);
    var glow = ctx.createRadialGradient(bodyX, bodyY, bodyR * 0.4, bodyX, bodyY, bodyR * 4.2);
    var bodyCol = isNight ? [235, 240, 255] : (tKind === 'dusk' ? [255, 190, 130] : [255, 248, 220]);
    glow.addColorStop(0, rgbStr(bodyCol, 0.85));
    glow.addColorStop(1, rgbStr(bodyCol, 0));
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(bodyX, bodyY, bodyR * 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgbStr(bodyCol, 0.95);
    ctx.beginPath(); ctx.arc(bodyX, bodyY, bodyR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 4. 云（非雨雪）
    if (!weather || (weather.id !== 'rain' && weather.id !== 'snow')) {
      var cloudCount = 3 + Math.floor(rand() * 4);
      for (var c = 0; c < cloudCount; c++) {
        var cx = rand() * w, cy = U.range(rand, h * 0.06, h * 0.34);
        var cw = U.range(rand, w * 0.14, w * 0.34), ch = cw * U.range(rand, 0.20, 0.32);
        ctx.save();
        ctx.globalAlpha = tKind === 'night' ? 0.16 : 0.55;
        ctx.fillStyle = tKind === 'dusk' ? '#ffd9c0' : '#ffffff';
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw * 0.5, ch * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - cw * 0.26, cy + ch * 0.12, cw * 0.32, ch * 0.42, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + cw * 0.28, cy + ch * 0.10, cw * 0.30, ch * 0.40, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // 5. 远山（三层）
    var layers = [
      { col: hexToRgb(pal.far), amp: 0.13, base: horizon * 0.96, oct: 2 },
      { col: hexToRgb(pal.mid), amp: 0.10, base: horizon * 1.02, oct: 3 },
      { col: hexToRgb(pal.near), amp: 0.07, base: horizon * 1.08, oct: 4 }
    ];
    for (var L = 0; L < layers.length; L++) {
      var ly = layers[L];
      var arrs = [];
      for (var o = 0; o < ly.oct; o++) arrs.push(makeNoise(rand, 6 + o * 4));
      var col = ly.col;
      if (tKind === 'night') col = shade(col, 0.52);
      else if (tKind === 'dusk') col = mix(col, [150, 110, 120], 0.28);
      else col = shade(col, 1 - L * 0.06);
      ctx.fillStyle = rgbStr(col);
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (var x = 0; x <= w; x += 4) {
        var t = x / w;
        var y = ly.base - fbm(arrs, t) * h * ly.amp - h * (0.02 * L);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }

    // 6. 地面 / 水面
    var groundCol = hexToRgb(pal.ground);
    if (tKind === 'night') groundCol = shade(groundCol, 0.42);
    else if (tKind === 'dusk') groundCol = mix(groundCol, [140, 100, 90], 0.30);

    var hasWater = tags.indexOf('sea') >= 0 || tags.indexOf('city') >= 0;
    if (hasWater) {
      var wg = ctx.createLinearGradient(0, horizon, 0, h);
      wg.addColorStop(0, rgbStr(mix(groundCol, [255, 255, 255], 0.25)));
      wg.addColorStop(1, rgbStr(shade(groundCol, 0.86)));
      ctx.fillStyle = wg;
      ctx.fillRect(0, horizon, w, h - horizon);
      // 水面倒影横纹
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = '#ffffff';
      for (var r2 = 0; r2 < 26; r2++) {
        var ry = horizon + (h - horizon) * Math.pow(rand(), 0.7);
        var rw = U.range(rand, w * 0.05, w * 0.30);
        var rx = rand() * w;
        ctx.lineWidth = U.range(rand, 0.8, 2.4);
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + rw, ry); ctx.stroke();
      }
      ctx.restore();
    } else {
      var gg = ctx.createLinearGradient(0, horizon, 0, h);
      gg.addColorStop(0, rgbStr(shade(groundCol, 1.08)));
      gg.addColorStop(1, rgbStr(shade(groundCol, 0.88)));
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.moveTo(0, horizon + h * 0.02);
      var garrs = [makeNoise(rand, 5), makeNoise(rand, 9)];
      for (var gx = 0; gx <= w; gx += 6) {
        ctx.lineTo(gx, horizon + h * 0.02 - fbm(garrs, gx / w) * h * 0.02);
      }
      ctx.lineTo(w, h); ctx.lineTo(0, h);
      ctx.closePath(); ctx.fill();
    }

    // 7. 按 tag 加地标元素
    ph._landmarks(ctx, w, h, horizon, tags, pal, rand, tKind, seed);

    // 8. 前景剪影（增加层次）
    ctx.save();
    ctx.globalAlpha = 0.85;
    var fgArr = [makeNoise(rand, 4), makeNoise(rand, 8)];
    ctx.fillStyle = rgbStr(shade(hexToRgb(pal.near), tKind === 'night' ? 0.20 : 0.42));
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (var fx = 0; fx <= w; fx += 8) {
      ctx.lineTo(fx, h - fbm(fgArr, fx / w) * h * 0.045 - h * 0.005);
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    ctx.restore();

    return { horizon: horizon };
  };

  ph._landmarks = function (ctx, w, h, horizon, tags, pal, rand, tKind, seed) {
    var dark = tKind === 'night' ? 0.42 : (tKind === 'dusk' ? 0.68 : 1);

    function tree(x, baseY, size, col) {
      ctx.save();
      ctx.fillStyle = rgbStr(shade(col, dark));
      ctx.fillRect(x - size * 0.045, baseY - size * 0.38, size * 0.09, size * 0.38);
      for (var i = 0; i < 3; i++) {
        var r = size * (0.26 - i * 0.05);
        var cy = baseY - size * (0.38 + i * 0.17);
        ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    function pine(x, baseY, size, col) {
      ctx.save();
      ctx.fillStyle = rgbStr(shade(col, dark));
      ctx.fillRect(x - size * 0.035, baseY - size * 0.22, size * 0.07, size * 0.22);
      for (var i = 0; i < 3; i++) {
        var wdt = size * (0.34 - i * 0.08);
        var top = baseY - size * (0.22 + (i + 1) * 0.26);
        var bot = baseY - size * (0.22 + i * 0.26);
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x + wdt, bot);
        ctx.lineTo(x - wdt, bot);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    function rock(x, baseY, size, col) {
      ctx.save();
      ctx.fillStyle = rgbStr(shade(col, dark));
      ctx.beginPath();
      ctx.moveTo(x - size * 0.5, baseY);
      ctx.lineTo(x - size * 0.18, baseY - size * 0.78);
      ctx.lineTo(x + size * 0.22, baseY - size * 0.46);
      ctx.lineTo(x + size * 0.5, baseY);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    if (tags.indexOf('rainforest') >= 0) {
      // 远树线 + 近处大乔木，制造纵深
      for (var bg = 0; bg < 22; bg++) {
        tree(rand() * w, horizon - h * 0.03 + U.range(rand, -h * 0.01, h * 0.03), U.range(rand, h * 0.10, h * 0.18), hexToRgb(pal.mid));
      }
      for (var i = 0; i < 9; i++) {
        tree(rand() * w, horizon + U.range(rand, 0, h * 0.12), U.range(rand, h * 0.26, h * 0.48), hexToRgb(pal.near));
      }
    } else if (tags.indexOf('plain') >= 0) {
      for (var i2 = 0; i2 < 8; i2++) {
        tree(rand() * w, horizon + U.range(rand, 0, h * 0.04), U.range(rand, h * 0.08, h * 0.14), hexToRgb(pal.mid));
      }
      for (var j = 0; j < 5; j++) {
        tree(rand() * w, horizon + U.range(rand, h * 0.02, h * 0.11), U.range(rand, h * 0.20, h * 0.34), hexToRgb(pal.near));
      }
    } else if (tags.indexOf('snow') >= 0) {
      for (var s1 = 0; s1 < 10; s1++) {
        pine(rand() * w, horizon + U.range(rand, -h * 0.01, h * 0.05), U.range(rand, h * 0.14, h * 0.30), hexToRgb(pal.near));
      }
      for (var s2 = 0; s2 < 6; s2++) {
        rock(rand() * w, horizon + U.range(rand, 0, h * 0.12), U.range(rand, h * 0.08, h * 0.18), hexToRgb(pal.mid));
      }
    } else if (tags.indexOf('mountain') >= 0) {
      for (var k = 0; k < 12; k++) {
        rock(rand() * w, horizon + U.range(rand, -h * 0.01, h * 0.14), U.range(rand, h * 0.10, h * 0.26), hexToRgb(pal.near));
      }
      for (var k2 = 0; k2 < 7; k2++) {
        pine(rand() * w, horizon + U.range(rand, 0, h * 0.06), U.range(rand, h * 0.10, h * 0.20), hexToRgb(pal.mid));
      }
    } else if (tags.indexOf('city') >= 0) {
      for (var b = 0; b < 14; b++) {
        var bw = U.range(rand, w * 0.05, w * 0.11);
        var bh = U.range(rand, h * 0.10, h * 0.26);
        var bx = rand() * (w - bw);
        var by = horizon - bh + U.range(rand, 0, h * 0.03);
        ctx.save();
        ctx.fillStyle = rgbStr(shade(hexToRgb(pal.near), dark * 0.94));
        ctx.fillRect(bx, by, bw, bh + h * 0.05);
        // 窗
        ctx.fillStyle = rgbStr(shade([255, 235, 180], tKind === 'night' ? 1 : 0.85));
        ctx.globalAlpha = tKind === 'night' ? 0.85 : 0.35;
        for (var wy = 0; wy < Math.floor(bh / (h * 0.045)); wy++) {
          for (var wx = 0; wx < 2; wx++) {
            ctx.fillRect(bx + bw * (0.22 + wx * 0.34), by + h * 0.02 + wy * h * 0.045, bw * 0.16, h * 0.018);
          }
        }
        ctx.restore();
      }
    } else if (tags.indexOf('desert') >= 0) {
      ctx.save();
      ctx.globalAlpha = 0.45 * dark;
      ctx.strokeStyle = rgbStr(shade(hexToRgb(pal.mid), 0.78));
      for (var d = 0; d < 14; d++) {
        var dy = horizon + (h - horizon) * Math.pow(rand(), 0.8);
        ctx.lineWidth = U.range(rand, 1.2, 3.6);
        ctx.beginPath();
        ctx.moveTo(0, dy);
        ctx.bezierCurveTo(w * 0.3, dy - h * 0.035, w * 0.6, dy + h * 0.035, w, dy - h * 0.012);
        ctx.stroke();
      }
      ctx.restore();
      // 断柱
      for (var p = 0; p < 6; p++) {
        var px = rand() * w;
        var ph2 = U.range(rand, h * 0.10, h * 0.26);
        ctx.save();
        ctx.fillStyle = rgbStr(shade(hexToRgb(pal.mid), dark * 0.88));
        ctx.fillRect(px, horizon - ph2 + h * 0.04, w * (0.014 + rand() * 0.012), ph2);
        ctx.fillStyle = rgbStr(shade(hexToRgb(pal.mid), dark * 0.96));
        ctx.fillRect(px - w * 0.006, horizon - ph2 + h * 0.04, w * 0.030, h * 0.012);
        ctx.restore();
      }
    }

    // 樱花：远处樱树
    if (tags.indexOf('sakura') >= 0) {
      for (var s = 0; s < 9; s++) {
        var sx = rand() * w;
        var sy = horizon + U.range(rand, -h * 0.02, h * 0.10);
        var ss = U.range(rand, h * 0.20, h * 0.38);
        ctx.save();
        ctx.fillStyle = rgbStr(shade([238, 178, 208], dark));
        ctx.beginPath(); ctx.arc(sx, sy - ss * 0.58, ss * 0.36, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx - ss * 0.26, sy - ss * 0.44, ss * 0.26, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + ss * 0.26, sy - ss * 0.46, ss * 0.24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgbStr(shade([104, 76, 88], dark));
        ctx.fillRect(sx - ss * 0.04, sy - ss * 0.36, ss * 0.08, ss * 0.36);
        ctx.restore();
      }
    }
  };

  /* ---------------- Q 版小人 ---------------- */

  /**
   * 画一个 Q 版角色。
   * @param ctx 2D context
   * @param cx 脚底中心 x
   * @param baseY 脚底 y
   * @param height 总高（像素）
   * @param sprite {hair, dress, accent, skin, hat}
   * @param mood 'idle' | 'happy' | 'tired'
   * @param flip 是否左右镜像
   */
  ph.chibi = function (ctx, cx, baseY, height, sprite, mood, flip) {
    var H = height;
    var headR = H * 0.26;
    var bodyH = H * 0.34;
    var bodyW = H * 0.30;
    var legH = H * 0.20;

    ctx.save();
    if (flip) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }

    var hair = hexToRgb(sprite.hair || '#8fc46a');
    var dress = hexToRgb(sprite.dress || '#7fb85c');
    var accent = hexToRgb(sprite.accent || '#e8f0c0');
    var skin = hexToRgb(sprite.skin || '#ffe0c8');
    var line = 'rgba(60,50,45,0.85)';

    var headCY = baseY - legH - bodyH - headR * 0.92;

    // 腿
    ctx.fillStyle = rgbStr(shade(skin, 0.96));
    var legW = H * 0.055;
    ctx.beginPath(); ctx.roundRect ? null : null;
    ctx.fillRect(cx - bodyW * 0.30 - legW / 2, baseY - legH, legW, legH);
    ctx.fillRect(cx + bodyW * 0.30 - legW / 2, baseY - legH, legW, legH);

    // 鞋
    ctx.fillStyle = rgbStr(shade(dress, 0.65));
    ctx.beginPath();
    ctx.ellipse(cx - bodyW * 0.30, baseY - H * 0.012, legW * 0.95, H * 0.028, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + bodyW * 0.30, baseY - H * 0.012, legW * 0.95, H * 0.028, 0, 0, Math.PI * 2); ctx.fill();

    // 身体（裙）
    var bodyTop = baseY - legH - bodyH;
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.32, bodyTop);
    ctx.lineTo(cx + bodyW * 0.32, bodyTop);
    ctx.lineTo(cx + bodyW * 0.62, baseY - legH + H * 0.01);
    ctx.quadraticCurveTo(cx, baseY - legH + H * 0.05, cx - bodyW * 0.62, baseY - legH + H * 0.01);
    ctx.closePath();
    ctx.fillStyle = rgbStr(dress);
    ctx.fill();

    // 裙摆亮边
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.62, baseY - legH + H * 0.01);
    ctx.quadraticCurveTo(cx, baseY - legH + H * 0.05, cx + bodyW * 0.62, baseY - legH + H * 0.01);
    ctx.lineWidth = H * 0.016;
    ctx.strokeStyle = rgbStr(accent);
    ctx.stroke();

    // 手臂（自然下垂，开心时抬起）
    ctx.strokeStyle = rgbStr(shade(skin, 0.98));
    ctx.lineWidth = H * 0.052;
    ctx.lineCap = 'round';
    var armY = bodyTop + bodyH * 0.18;
    var armDrop = mood === 'happy' ? -H * 0.15 : (mood === 'tired' ? H * 0.02 : -H * 0.03);
    var armOut = bodyW * (mood === 'happy' ? 0.72 : 0.50);
    var armEnd = armY + bodyH * 0.62 + armDrop;
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.26, armY);
    ctx.quadraticCurveTo(cx - armOut, armY + bodyH * 0.30, cx - armOut * 0.84, armEnd);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + bodyW * 0.26, armY);
    ctx.quadraticCurveTo(cx + armOut, armY + bodyH * 0.30, cx + armOut * 0.84, armEnd);
    ctx.stroke();

    // 头
    ctx.beginPath();
    ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
    ctx.fillStyle = rgbStr(skin);
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, H * 0.006);
    ctx.strokeStyle = line;
    ctx.stroke();

    // 头发（后）
    ctx.beginPath();
    ctx.arc(cx, headCY - headR * 0.06, headR * 1.10, Math.PI * 1.02, Math.PI * 1.98);
    ctx.fillStyle = rgbStr(hair);
    ctx.fill();

    // 刘海
    ctx.beginPath();
    ctx.moveTo(cx - headR * 1.02, headCY - headR * 0.18);
    ctx.quadraticCurveTo(cx - headR * 0.6, headCY + headR * 0.42, cx - headR * 0.18, headCY - headR * 0.10);
    ctx.quadraticCurveTo(cx + headR * 0.10, headCY + headR * 0.30, cx + headR * 0.46, headCY - headR * 0.30);
    ctx.quadraticCurveTo(cx + headR * 0.86, headCY + headR * 0.10, cx + headR * 1.03, headCY - headR * 0.26);
    ctx.lineTo(cx + headR * 1.03, headCY - headR * 0.92);
    ctx.lineTo(cx - headR * 1.03, headCY - headR * 0.92);
    ctx.closePath();
    ctx.fillStyle = rgbStr(hair);
    ctx.fill();

    // 发际线描边（让浅色头发不至于糊成一顶帽子）
    ctx.strokeStyle = rgbStr(shade(hair, 0.78));
    ctx.lineWidth = Math.max(1, H * 0.0055);
    ctx.beginPath();
    ctx.arc(cx, headCY - headR * 0.05, headR * 1.045, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();

    // 眼睛
    var eyeY = headCY + headR * 0.16;
    var eyeDX = headR * 0.40;
    var eyeH = mood === 'happy' ? headR * 0.10 : headR * 0.22;
    var eyeW = headR * 0.16;
    ctx.fillStyle = 'rgba(50,42,38,0.92)';
    if (mood === 'happy') {
      ctx.lineWidth = Math.max(1.5, H * 0.010);
      ctx.strokeStyle = 'rgba(50,42,38,0.92)';
      ctx.beginPath(); ctx.arc(cx - eyeDX, eyeY, eyeW * 1.1, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + eyeDX, eyeY, eyeW * 1.1, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else if (mood === 'tired') {
      ctx.lineWidth = Math.max(1.5, H * 0.009);
      ctx.strokeStyle = 'rgba(50,42,38,0.8)';
      ctx.beginPath(); ctx.moveTo(cx - eyeDX - eyeW * 0.9, eyeY); ctx.lineTo(cx - eyeDX + eyeW * 0.9, eyeY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + eyeDX - eyeW * 0.9, eyeY); ctx.lineTo(cx + eyeDX + eyeW * 0.9, eyeY); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(cx - eyeDX, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + eyeDX, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(cx - eyeDX - eyeW * 0.3, eyeY - eyeH * 0.35, eyeW * 0.30, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + eyeDX - eyeW * 0.3, eyeY - eyeH * 0.35, eyeW * 0.30, 0, Math.PI * 2); ctx.fill();
    }

    // 嘴
    ctx.strokeStyle = 'rgba(70,55,50,0.75)';
    ctx.lineWidth = Math.max(1.2, H * 0.007);
    ctx.beginPath();
    if (mood === 'happy') {
      ctx.arc(cx, eyeY + headR * 0.30, headR * 0.14, Math.PI * 0.18, Math.PI * 0.82);
    } else {
      ctx.arc(cx, eyeY + headR * 0.24, headR * 0.10, Math.PI * 0.22, Math.PI * 0.78);
    }
    ctx.stroke();

    // 腮红
    ctx.fillStyle = 'rgba(255,150,150,0.30)';
    ctx.beginPath(); ctx.ellipse(cx - headR * 0.66, eyeY + headR * 0.20, headR * 0.17, headR * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + headR * 0.66, eyeY + headR * 0.20, headR * 0.17, headR * 0.11, 0, 0, Math.PI * 2); ctx.fill();

    // 帽子
    var hat = sprite.hat || 'none';
    if (hat === 'leaf') {
      // 纳西妲：叶片帽
      ctx.save();
      ctx.translate(cx, headCY - headR * 0.92);
      ctx.fillStyle = rgbStr(hexToRgb('#8ec96a'));
      for (var i = -2; i <= 2; i++) {
        ctx.save();
        ctx.rotate(i * 0.42);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(headR * 0.42, -headR * 0.62, 0, -headR * 1.05);
        ctx.quadraticCurveTo(-headR * 0.42, -headR * 0.62, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = rgbStr(hexToRgb('#f2f8dc'));
      ctx.beginPath(); ctx.arc(0, -headR * 0.18, headR * 0.20, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (hat === 'ear') {
      ctx.fillStyle = rgbStr(hair);
      ctx.beginPath();
      ctx.moveTo(cx - headR * 0.78, headCY - headR * 0.86);
      ctx.lineTo(cx - headR * 1.05, headCY - headR * 1.72);
      ctx.lineTo(cx - headR * 0.24, headCY - headR * 1.02);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + headR * 0.78, headCY - headR * 0.86);
      ctx.lineTo(cx + headR * 1.05, headCY - headR * 1.72);
      ctx.lineTo(cx + headR * 0.24, headCY - headR * 1.02);
      ctx.closePath(); ctx.fill();
    } else if (hat === 'cap') {
      ctx.fillStyle = rgbStr(shade(dress, 0.80));
      ctx.beginPath();
      ctx.ellipse(cx, headCY - headR * 0.78, headR * 1.06, headR * 0.42, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + headR * 0.55, headCY - headR * 0.76, headR * 0.72, headR * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 描边（统一画风的辅助）
    ctx.restore();
  };

  /* ---------------- 贴纸 ---------------- */

  ph.sticker = function (ctx, kind, cx, cy, size, rand) {
    var s = size;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, s * 0.055);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';

    function fillStroke(col) {
      ctx.fillStyle = col;
      ctx.fill();
      ctx.stroke();
    }
    function poly(pts) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    }

    switch (kind) {
      case 'flower':
        for (var p = 0; p < 5; p++) {
          var a = (p / 5) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * s * 0.20, Math.sin(a) * s * 0.20, s * 0.17, s * 0.11, a, 0, Math.PI * 2);
          fillStroke('#ffffff');
        }
        ctx.beginPath(); ctx.arc(0, 0, s * 0.13, 0, Math.PI * 2); fillStroke('#ffd166');
        break;
      case 'seed':
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.20, s * 0.28, 0.4, 0, Math.PI * 2); fillStroke('#a9743f');
        ctx.beginPath(); ctx.moveTo(0, -s * 0.26); ctx.lineTo(0, s * 0.26); ctx.strokeStyle = 'rgba(120,80,40,0.5)'; ctx.stroke();
        break;
      case 'map':
        poly([[-s * 0.34, -s * 0.24], [s * 0.34, -s * 0.30], [s * 0.34, s * 0.26], [-s * 0.34, s * 0.30]]);
        fillStroke('#f2e3c4');
        ctx.strokeStyle = '#c98d52';
        ctx.beginPath(); ctx.moveTo(-s * 0.34, -s * 0.24); ctx.lineTo(-s * 0.10, -s * 0.30);
        ctx.lineTo(-s * 0.10, s * 0.28); ctx.lineTo(-s * 0.34, s * 0.30); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.10, -s * 0.31); ctx.lineTo(s * 0.10, s * 0.27); ctx.stroke();
        break;
      case 'cup':
        poly([[-s * 0.22, -s * 0.18], [s * 0.22, -s * 0.18], [s * 0.16, s * 0.26], [-s * 0.16, s * 0.26]]);
        fillStroke('#f6f0e2');
        ctx.strokeStyle = '#c98d52';
        ctx.beginPath(); ctx.arc(s * 0.26, 0, s * 0.12, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
        break;
      case 'feather':
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.36);
        ctx.quadraticCurveTo(s * 0.26, 0, 0, s * 0.36);
        ctx.quadraticCurveTo(-s * 0.26, 0, 0, -s * 0.36);
        fillStroke('#dbe9f5');
        ctx.strokeStyle = 'rgba(120,150,180,0.7)';
        ctx.beginPath(); ctx.moveTo(0, -s * 0.34); ctx.lineTo(0, s * 0.34); ctx.stroke();
        break;
      case 'camera':
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-s * 0.32, -s * 0.22, s * 0.64, s * 0.46, s * 0.08) : ctx.rect(-s * 0.32, -s * 0.22, s * 0.64, s * 0.46);
        fillStroke('#4b5563');
        ctx.beginPath(); ctx.arc(0, s * 0.02, s * 0.15, 0, Math.PI * 2); fillStroke('#a8d8e8');
        break;
      case 'leaf':
        ctx.beginPath();
        ctx.moveTo(0, s * 0.34);
        ctx.quadraticCurveTo(s * 0.34, 0, 0, -s * 0.34);
        ctx.quadraticCurveTo(-s * 0.34, 0, 0, s * 0.34);
        fillStroke('#6aa84f');
        ctx.strokeStyle = 'rgba(40,80,30,0.6)';
        ctx.beginPath(); ctx.moveTo(0, s * 0.30); ctx.lineTo(0, -s * 0.30); ctx.stroke();
        break;
      case 'star':
        var pts = [];
        for (var i2 = 0; i2 < 10; i2++) {
          var rr = i2 % 2 === 0 ? s * 0.36 : s * 0.15;
          var aa = (i2 / 10) * Math.PI * 2 - Math.PI / 2;
          pts.push([Math.cos(aa) * rr, Math.sin(aa) * rr]);
        }
        poly(pts); fillStroke('#ffd166');
        break;
      case 'shell':
        ctx.beginPath(); ctx.arc(0, s * 0.10, s * 0.32, Math.PI, Math.PI * 2); fillStroke('#ffd8c8');
        ctx.strokeStyle = 'rgba(200,140,120,0.7)';
        for (var k2 = -2; k2 <= 2; k2++) {
          ctx.beginPath(); ctx.moveTo(0, s * 0.10);
          ctx.lineTo(k2 * s * 0.13, -s * 0.20); ctx.stroke();
        }
        break;
      case 'snowflake':
        ctx.strokeStyle = '#9ecdf0'; ctx.lineWidth = Math.max(1.5, s * 0.06);
        for (var q = 0; q < 6; q++) {
          ctx.save(); ctx.rotate((q / 6) * Math.PI * 2);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.34); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -s * 0.20); ctx.lineTo(s * 0.10, -s * 0.28); ctx.stroke();
          ctx.restore();
        }
        break;
      case 'sand':
        ctx.beginPath(); ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2); fillStroke('#e8c88a');
        ctx.fillStyle = 'rgba(180,140,90,0.55)';
        for (var d2 = 0; d2 < 14; d2++) {
          ctx.beginPath();
          ctx.arc((rand() - 0.5) * s * 0.5, (rand() - 0.5) * s * 0.5, s * 0.025, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'book':
        poly([[-s * 0.30, -s * 0.26], [s * 0.30, -s * 0.30], [s * 0.30, s * 0.28], [-s * 0.30, s * 0.30]]);
        fillStroke('#c96f5a');
        ctx.fillStyle = '#f6f0e2'; ctx.fillRect(-s * 0.24, -s * 0.20, s * 0.44, s * 0.42);
        break;
      case 'candy':
        ctx.beginPath(); ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2); fillStroke('#ff9ab5');
        poly([[-s * 0.22, -s * 0.10], [-s * 0.40, -s * 0.22], [-s * 0.40, s * 0.22], [-s * 0.22, s * 0.10]]); fillStroke('#ffd1dc');
        poly([[s * 0.22, -s * 0.10], [s * 0.40, -s * 0.22], [s * 0.40, s * 0.22], [s * 0.22, s * 0.10]]); fillStroke('#ffd1dc');
        break;
      case 'stone':
        poly([[-s * 0.34, s * 0.24], [-s * 0.16, -s * 0.28], [s * 0.14, -s * 0.20], [s * 0.34, s * 0.24]]);
        fillStroke('#9aa4b2');
        break;
      case 'lantern':
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.24, s * 0.30, 0, 0, Math.PI * 2); fillStroke('#f5a742');
        ctx.fillStyle = '#5b4636'; ctx.fillRect(-s * 0.10, -s * 0.38, s * 0.20, s * 0.08);
        ctx.fillStyle = 'rgba(255,240,180,0.75)';
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.10, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case 'bell':
        ctx.beginPath(); ctx.arc(0, s * 0.06, s * 0.26, Math.PI, Math.PI * 2); fillStroke('#e8c060');
        ctx.beginPath(); ctx.arc(0, s * 0.16, s * 0.06, 0, Math.PI * 2); fillStroke('#c9a04a');
        break;
      case 'mushroom':
        ctx.beginPath(); ctx.arc(0, -s * 0.04, s * 0.30, Math.PI, Math.PI * 2); fillStroke('#d95f5f');
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(-s * 0.12, -s * 0.14, s * 0.05, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.10, -s * 0.18, s * 0.04, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f2e3c4';
        ctx.fillRect(-s * 0.09, -s * 0.04, s * 0.18, s * 0.30);
        break;
      case 'fish':
        ctx.beginPath(); ctx.ellipse(-s * 0.05, 0, s * 0.28, s * 0.16, 0, 0, Math.PI * 2); fillStroke('#6fb8d8');
        poly([[s * 0.20, 0], [s * 0.40, -s * 0.16], [s * 0.40, s * 0.16]]); fillStroke('#4f9cbe');
        ctx.fillStyle = '#2f4358';
        ctx.beginPath(); ctx.arc(-s * 0.16, -s * 0.04, s * 0.035, 0, Math.PI * 2); ctx.fill();
        break;
      case 'petal':
        ctx.beginPath();
        ctx.moveTo(0, s * 0.26);
        ctx.quadraticCurveTo(s * 0.26, 0, 0, -s * 0.26);
        ctx.quadraticCurveTo(-s * 0.26, 0, 0, s * 0.26);
        fillStroke('#f7b8d4');
        break;
      case 'compass':
        ctx.beginPath(); ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2); fillStroke('#f2e3c4');
        ctx.fillStyle = '#d95f5f';
        poly([[0, -s * 0.22], [s * 0.09, 0], [0, s * 0.22], [-s * 0.09, 0]]); ctx.fill();
        break;
      case 'key':
        ctx.beginPath(); ctx.arc(0, -s * 0.16, s * 0.14, 0, Math.PI * 2); fillStroke('#c9a04a');
        ctx.fillStyle = '#c9a04a';
        ctx.fillRect(-s * 0.04, -s * 0.04, s * 0.08, s * 0.38);
        ctx.fillRect(-s * 0.04, s * 0.22, s * 0.18, s * 0.07);
        break;
      case 'butterfly':
        ctx.beginPath(); ctx.ellipse(-s * 0.16, -s * 0.04, s * 0.18, s * 0.13, -0.5, 0, Math.PI * 2); fillStroke('#b06bff');
        ctx.beginPath(); ctx.ellipse(s * 0.16, -s * 0.04, s * 0.18, s * 0.13, 0.5, 0, Math.PI * 2); fillStroke('#b06bff');
        ctx.fillStyle = '#3f3a52';
        ctx.fillRect(-s * 0.018, -s * 0.20, s * 0.036, s * 0.34);
        break;
      case 'aurora':
        for (var b2 = 0; b2 < 3; b2++) {
          ctx.save();
          ctx.globalAlpha = 0.75 - b2 * 0.18;
          ctx.strokeStyle = ['#7ef0c0', '#8fd4ff', '#d4a8ff'][b2];
          ctx.lineWidth = Math.max(2, s * 0.09);
          ctx.beginPath();
          ctx.moveTo(-s * 0.34, s * 0.20 - b2 * s * 0.10);
          ctx.quadraticCurveTo(0, -s * 0.34 - b2 * s * 0.06, s * 0.34, s * 0.14 - b2 * s * 0.10);
          ctx.stroke();
          ctx.restore();
        }
        break;
      case 'gift':
        ctx.fillStyle = '#d95f5f'; ctx.fillRect(-s * 0.26, -s * 0.18, s * 0.52, s * 0.42);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1.5, s * 0.05);
        ctx.strokeRect(-s * 0.26, -s * 0.18, s * 0.52, s * 0.42);
        ctx.fillStyle = '#f2c14e'; ctx.fillRect(-s * 0.05, -s * 0.18, s * 0.10, s * 0.42);
        ctx.fillRect(-s * 0.26, -s * 0.06, s * 0.52, s * 0.09);
        break;
      case 'pagoda':
        ctx.fillStyle = '#b8564e';
        for (var pg = 0; pg < 3; pg++) {
          var pw = s * (0.38 - pg * 0.09);
          var py = s * (0.28 - pg * 0.24);
          poly([[-pw, py], [pw, py], [pw * 0.72, py - s * 0.09], [-pw * 0.72, py - s * 0.09]]);
          fillStroke(pg === 0 ? '#b8564e' : '#c96a5c');
          ctx.fillStyle = '#8f6a4a';
          ctx.fillRect(-pw * 0.52, py - s * 0.20, pw * 1.04, s * 0.12);
        }
        break;
      case 'dumpling':
        ctx.beginPath(); ctx.arc(0, s * 0.08, s * 0.34, Math.PI, Math.PI * 2); fillStroke('#f6f0e0');
        ctx.strokeStyle = 'rgba(190,160,120,0.75)';
        ctx.lineWidth = Math.max(1, s * 0.035);
        for (var dp = -2; dp <= 2; dp++) {
          ctx.beginPath(); ctx.moveTo(0, -s * 0.26);
          ctx.lineTo(dp * s * 0.12, s * 0.08); ctx.stroke();
        }
        break;
      case 'bowl':
        poly([[-s * 0.36, -s * 0.02], [s * 0.36, -s * 0.02], [s * 0.24, s * 0.32], [-s * 0.24, s * 0.32]]);
        fillStroke('#f2ece0');
        ctx.fillStyle = '#e8c98a';
        ctx.beginPath(); ctx.ellipse(0, -s * 0.03, s * 0.34, s * 0.09, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = Math.max(1.2, s * 0.045);
        ctx.beginPath(); ctx.moveTo(s * 0.16, -s * 0.10); ctx.lineTo(s * 0.40, -s * 0.40); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.24, -s * 0.06); ctx.lineTo(s * 0.46, -s * 0.34); ctx.stroke();
        break;
      case 'kite':
        poly([[0, -s * 0.36], [s * 0.26, -s * 0.06], [0, s * 0.30], [-s * 0.26, -s * 0.06]]);
        fillStroke('#e05a4a');
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath(); ctx.moveTo(0, -s * 0.34); ctx.lineTo(0, s * 0.28); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-s * 0.24, -s * 0.06); ctx.lineTo(s * 0.24, -s * 0.06); ctx.stroke();
        ctx.strokeStyle = '#8a9aa8';
        ctx.beginPath(); ctx.moveTo(0, s * 0.30);
        ctx.quadraticCurveTo(s * 0.14, s * 0.42, -s * 0.04, s * 0.48); ctx.stroke();
        break;
      case 'tea':
        poly([[-s * 0.22, -s * 0.14], [s * 0.22, -s * 0.14], [s * 0.16, s * 0.28], [-s * 0.16, s * 0.28]]);
        fillStroke('#f4f0e4');
        ctx.strokeStyle = '#7aa86a'; ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath(); ctx.arc(s * 0.26, 0.03 * s, s * 0.11, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.moveTo(-s * 0.08, -s * 0.22);
        ctx.quadraticCurveTo(-s * 0.02, -s * 0.32, -s * 0.08, -s * 0.42); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.06, -s * 0.22);
        ctx.quadraticCurveTo(s * 0.12, -s * 0.32, s * 0.06, -s * 0.42); ctx.stroke();
        break;
      case 'grape':
        var gp = [[0, -s * 0.22], [-s * 0.16, -s * 0.10], [s * 0.16, -s * 0.10],
                  [-s * 0.08, s * 0.04], [s * 0.08, s * 0.04], [0, s * 0.18]];
        for (var gi = 0; gi < gp.length; gi++) {
          ctx.beginPath(); ctx.arc(gp[gi][0], gp[gi][1], s * 0.12, 0, Math.PI * 2);
          fillStroke('#8e5aa8');
        }
        ctx.strokeStyle = '#6a8a4a'; ctx.lineWidth = Math.max(1.2, s * 0.035);
        ctx.beginPath(); ctx.moveTo(0, -s * 0.30); ctx.lineTo(s * 0.06, -s * 0.42); ctx.stroke();
        break;
      case 'camel':
        ctx.fillStyle = '#d9a566'; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = Math.max(1.5, s * 0.05);
        ctx.beginPath();
        ctx.moveTo(-s * 0.34, s * 0.24);
        ctx.lineTo(-s * 0.30, -s * 0.04);
        ctx.quadraticCurveTo(-s * 0.18, -s * 0.26, -s * 0.06, -s * 0.04);
        ctx.quadraticCurveTo(s * 0.06, -s * 0.26, s * 0.18, -s * 0.04);
        ctx.lineTo(s * 0.22, s * 0.24);
        ctx.lineTo(s * 0.10, s * 0.24);
        ctx.lineTo(s * 0.08, s * 0.02);
        ctx.lineTo(-s * 0.18, s * 0.02);
        ctx.lineTo(-s * 0.20, s * 0.24);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-s * 0.30, -s * 0.06);
        ctx.quadraticCurveTo(-s * 0.44, -s * 0.14, -s * 0.40, -s * 0.32);
        ctx.lineWidth = Math.max(1.5, s * 0.08); ctx.strokeStyle = '#d9a566'; ctx.stroke();
        break;
      case 'peach':
        for (var pp = 0; pp < 5; pp++) {
          var pa = (pp / 5) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.ellipse(Math.cos(pa) * s * 0.17, Math.sin(pa) * s * 0.17,
            s * 0.15, s * 0.11, pa, 0, Math.PI * 2);
          fillStroke('#f7b8d4');
        }
        ctx.beginPath(); ctx.arc(0, 0, s * 0.09, 0, Math.PI * 2); fillStroke('#f2e0a0');
        break;
      case 'bamboo':
        for (var bi = -1; bi <= 1; bi++) {
          var bx = bi * s * 0.20;
          ctx.fillStyle = bi === 0 ? '#6aa84f' : '#86bf66';
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = Math.max(1.2, s * 0.04);
          ctx.beginPath();
          ctx.rect(bx - s * 0.07, -s * 0.38, s * 0.14, s * 0.76);
          ctx.fill(); ctx.stroke();
          ctx.strokeStyle = 'rgba(40,80,30,0.5)'; ctx.lineWidth = Math.max(1, s * 0.025);
          for (var seg = 0; seg < 3; seg++) {
            var sy = -s * 0.22 + seg * s * 0.24;
            ctx.beginPath(); ctx.moveTo(bx - s * 0.07, sy); ctx.lineTo(bx + s * 0.07, sy); ctx.stroke();
          }
        }
        break;
      case 'hotpot':
        poly([[-s * 0.34, -s * 0.06], [s * 0.34, -s * 0.06], [s * 0.26, s * 0.28], [-s * 0.26, s * 0.28]]);
        fillStroke('#b8564e');
        ctx.fillStyle = '#d97a5a';
        ctx.beginPath(); ctx.ellipse(0, -s * 0.07, s * 0.34, s * 0.10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1.2, s * 0.035);
        ctx.beginPath(); ctx.moveTo(-s * 0.14, -s * 0.16);
        ctx.quadraticCurveTo(-s * 0.06, -s * 0.28, -s * 0.14, -s * 0.42); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.14, -s * 0.16);
        ctx.quadraticCurveTo(s * 0.22, -s * 0.28, s * 0.14, -s * 0.42); ctx.stroke();
        break;
      case 'panda':
        ctx.beginPath(); ctx.arc(-s * 0.24, -s * 0.26, s * 0.12, 0, Math.PI * 2); fillStroke('#2f2f33');
        ctx.beginPath(); ctx.arc(s * 0.24, -s * 0.26, s * 0.12, 0, Math.PI * 2); fillStroke('#2f2f33');
        ctx.beginPath(); ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2); fillStroke('#fbfbf8');
        ctx.fillStyle = '#2f2f33';
        ctx.beginPath(); ctx.ellipse(-s * 0.12, -s * 0.03, s * 0.09, s * 0.11, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.12, -s * 0.03, s * 0.09, s * 0.11, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, s * 0.13, s * 0.05, 0, Math.PI * 2); ctx.fill();
        break;
      case 'mask':
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.36);
        ctx.quadraticCurveTo(s * 0.36, -s * 0.30, s * 0.30, s * 0.02);
        ctx.quadraticCurveTo(s * 0.24, s * 0.34, 0, s * 0.38);
        ctx.quadraticCurveTo(-s * 0.24, s * 0.34, -s * 0.30, s * 0.02);
        ctx.quadraticCurveTo(-s * 0.36, -s * 0.30, 0, -s * 0.36);
        fillStroke('#f2e3c4');
        ctx.fillStyle = '#b8564e';
        ctx.beginPath(); ctx.ellipse(-s * 0.12, -s * 0.08, s * 0.10, s * 0.06, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.12, -s * 0.08, s * 0.10, s * 0.06, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, s * 0.16, s * 0.14, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case 'bike':
        ctx.strokeStyle = '#4b5563'; ctx.lineWidth = Math.max(1.5, s * 0.05);
        ctx.beginPath(); ctx.arc(-s * 0.22, s * 0.18, s * 0.14, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(s * 0.22, s * 0.18, s * 0.14, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#c96a5c'; ctx.lineWidth = Math.max(1.5, s * 0.055);
        ctx.beginPath();
        ctx.moveTo(-s * 0.22, s * 0.18); ctx.lineTo(0, -s * 0.06);
        ctx.lineTo(s * 0.22, s * 0.18);
        ctx.moveTo(0, -s * 0.06); ctx.lineTo(s * 0.06, s * 0.18);
        ctx.moveTo(s * 0.22, s * 0.18); ctx.lineTo(s * 0.02, s * 0.18);
        ctx.stroke();
        ctx.strokeStyle = '#4b5563'; ctx.lineWidth = Math.max(1.2, s * 0.04);
        ctx.beginPath(); ctx.moveTo(0, -s * 0.06); ctx.lineTo(-s * 0.06, -s * 0.20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.22, s * 0.18); ctx.lineTo(s * 0.26, -s * 0.16); ctx.stroke();
        break;
      case 'boat':
        poly([[-s * 0.36, s * 0.06], [s * 0.36, s * 0.06], [s * 0.22, s * 0.30], [-s * 0.22, s * 0.30]]);
        fillStroke('#8a6a4a');
        ctx.fillStyle = '#f4f0e4'; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = Math.max(1.2, s * 0.04);
        ctx.beginPath();
        ctx.moveTo(0, s * 0.04); ctx.lineTo(0, -s * 0.38);
        ctx.lineTo(s * 0.26, s * 0.04); ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case 'icecream':
        poly([[-s * 0.18, s * 0.00], [s * 0.18, s * 0.00], [0, s * 0.40]]);
        fillStroke('#d9a566');
        ctx.beginPath(); ctx.arc(0, -s * 0.10, s * 0.20, 0, Math.PI * 2); fillStroke('#f7c8d8');
        ctx.beginPath(); ctx.arc(-s * 0.10, -s * 0.20, s * 0.13, 0, Math.PI * 2); fillStroke('#a8d8e8');
        break;
      default:
        ctx.beginPath(); ctx.arc(0, 0, s * 0.24, 0, Math.PI * 2); fillStroke('#c9d4e0');
    }
    ctx.restore();
  };

  /* ---------------- 家的场景 ---------------- */

  /**
   * 画一个家的场景（纯色块 + 简单几何，先替代真实素材）。
   * 返回可放置纳西妲与玩具的地面基准线。
   */
  ph.homeScene = function (ctx, w, h, scene, seed) {
    var rand = NT.rng.mulberry32(seed >>> 0);
    var pal = scene.palette;
    var wall = hexToRgb(pal.wall), wood = hexToRgb(pal.wood);
    var ground = hexToRgb(pal.ground);
    var floorY = h * 0.62;

    // 墙 / 天
    var g = ctx.createLinearGradient(0, 0, 0, floorY);
    g.addColorStop(0, pal.sky[0]);
    g.addColorStop(1, pal.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, floorY);

    ctx.fillStyle = rgbStr(wall);
    ctx.fillRect(0, floorY - h * 0.30, w, h * 0.30);

    // 地面
    var gg = ctx.createLinearGradient(0, floorY - h * 0.02, 0, h);
    gg.addColorStop(0, rgbStr(shade(ground, 1.06)));
    gg.addColorStop(1, rgbStr(shade(ground, 0.86)));
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.moveTo(0, floorY - h * 0.02);
    for (var x = 0; x <= w; x += 8) {
      ctx.lineTo(x, floorY - h * 0.02 + Math.sin(x / w * 6) * h * 0.006);
    }
    ctx.lineTo(w, h); ctx.lineTo(0, h);
    ctx.closePath(); ctx.fill();

    var sid = scene.id;

    if (sid === 'courtyard') {
      // 篱笆
      ctx.strokeStyle = rgbStr(shade(wood, 0.9));
      ctx.lineWidth = Math.max(1.5, w * 0.006);
      for (var i = 0; i < 14; i++) {
        var px = (i + 0.5) * (w / 14);
        ctx.beginPath();
        ctx.moveTo(px, floorY - h * 0.20);
        ctx.lineTo(px, floorY + h * 0.02);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, floorY - h * 0.15); ctx.lineTo(w, floorY - h * 0.15);
      ctx.moveTo(0, floorY - h * 0.06); ctx.lineTo(w, floorY - h * 0.06);
      ctx.stroke();
      // 两块田
      for (var f = 0; f < 2; f++) {
        var fx = w * (0.08 + f * 0.42), fy = floorY + h * 0.16;
        ctx.fillStyle = f === 0 ? rgbStr([132, 106, 72]) : rgbStr([96, 118, 96]);
        ctx.fillRect(fx, fy, w * 0.30, h * 0.13);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 1;
        for (var r = 1; r < 4; r++) {
          ctx.beginPath();
          ctx.moveTo(fx, fy + (h * 0.13) * r / 4);
          ctx.lineTo(fx + w * 0.30, fy + (h * 0.13) * r / 4);
          ctx.stroke();
        }
      }
    } else if (sid === 'room') {
      // 书架
      ctx.fillStyle = rgbStr(shade(wood, 0.92));
      ctx.fillRect(w * 0.06, floorY - h * 0.46, w * 0.26, h * 0.48);
      for (var sh = 0; sh < 3; sh++) {
        ctx.fillStyle = rgbStr(shade(wood, 1.10));
        ctx.fillRect(w * 0.06, floorY - h * 0.46 + sh * h * 0.16 + h * 0.15, w * 0.26, h * 0.012);
        for (var bk = 0; bk < 7; bk++) {
          ctx.fillStyle = rgbStr([160 + rand() * 70, 120 + rand() * 60, 90 + rand() * 60]);
          ctx.fillRect(w * (0.075 + bk * 0.033), floorY - h * 0.46 + sh * h * 0.16 + h * 0.05, w * 0.022, h * 0.10);
        }
      }
      // 窗
      ctx.fillStyle = 'rgba(200,225,240,0.85)';
      ctx.fillRect(w * 0.62, floorY - h * 0.52, w * 0.26, h * 0.26);
      ctx.strokeStyle = rgbStr(shade(wood, 0.8));
      ctx.lineWidth = Math.max(2, w * 0.008);
      ctx.strokeRect(w * 0.62, floorY - h * 0.52, w * 0.26, h * 0.26);
      ctx.beginPath();
      ctx.moveTo(w * 0.75, floorY - h * 0.52); ctx.lineTo(w * 0.75, floorY - h * 0.26);
      ctx.moveTo(w * 0.62, floorY - h * 0.39); ctx.lineTo(w * 0.88, floorY - h * 0.39);
      ctx.stroke();
    } else if (sid === 'garden') {
      for (var fl = 0; fl < 26; fl++) {
        var fx2 = rand() * w, fy2 = floorY + rand() * h * 0.30;
        var col = [[247, 184, 212], [255, 214, 140], [200, 170, 235], [255, 160, 150]][fl % 4];
        ctx.fillStyle = rgbStr(shade(col, 0.9 + rand() * 0.2));
        ctx.beginPath(); ctx.arc(fx2, fy2, w * (0.006 + rand() * 0.008), 0, Math.PI * 2); ctx.fill();
      }
      // 两棵树
      for (var tr = 0; tr < 2; tr++) {
        var tx = w * (0.16 + tr * 0.68);
        ctx.fillStyle = rgbStr(shade(wood, 0.86));
        ctx.fillRect(tx - w * 0.012, floorY - h * 0.10, w * 0.024, h * 0.34);
        ctx.fillStyle = rgbStr(shade(hexToRgb(pal.near), 1.0));
        ctx.beginPath(); ctx.arc(tx, floorY - h * 0.20, w * 0.11, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(tx - w * 0.07, floorY - h * 0.13, w * 0.075, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(tx + w * 0.07, floorY - h * 0.14, w * 0.07, 0, Math.PI * 2); ctx.fill();
      }
    } else if (sid === 'pond') {
      ctx.fillStyle = rgbStr(shade(hexToRgb(pal.mid), 1.0));
      ctx.beginPath();
      ctx.ellipse(w * 0.5, floorY + h * 0.20, w * 0.44, h * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.beginPath();
      ctx.ellipse(w * 0.42, floorY + h * 0.17, w * 0.14, h * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
      // 石头
      for (var st = 0; st < 5; st++) {
        var sx = w * (0.08 + st * 0.21), sy = floorY + h * (0.10 + rand() * 0.18);
        ctx.fillStyle = rgbStr(shade([150, 148, 140], 0.9 + rand() * 0.2));
        ctx.beginPath(); ctx.ellipse(sx, sy, w * 0.035, h * 0.022, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    return { floorY: floorY };
  };

  /* ---------------- 玩具 ---------------- */

  /** 玩具的落位锚点（相对场景宽高）
   *  中间一列留给纳西妲，玩具只放两侧和后方，避免压在她身上。 */
  ph.toyAnchors = [
    { x: 0.13, y: 0.90 }, { x: 0.87, y: 0.88 }, { x: 0.24, y: 0.71 },
    { x: 0.76, y: 0.70 }, { x: 0.93, y: 0.67 }, { x: 0.07, y: 0.67 }
  ];

  ph.toy = function (ctx, kind, cx, cy, size, rand) {
    var s = size;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.4, s * 0.055);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';

    function fillStroke(col) { ctx.fillStyle = col; ctx.fill(); ctx.stroke(); }
    function poly(pts) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    }

    switch (kind) {
      case 'swing':
        ctx.fillStyle = '#8a6a4a';
        poly([[-s * 0.40, 0], [-s * 0.30, -s * 0.80], [-s * 0.22, -s * 0.80], [-s * 0.30, 0]]); ctx.fill();
        poly([[s * 0.40, 0], [s * 0.30, -s * 0.80], [s * 0.22, -s * 0.80], [s * 0.30, 0]]); ctx.fill();
        ctx.fillRect(-s * 0.32, -s * 0.82, s * 0.64, s * 0.06);
        ctx.strokeStyle = '#c9b898'; ctx.lineWidth = Math.max(1.2, s * 0.045);
        ctx.beginPath(); ctx.moveTo(-s * 0.16, -s * 0.78); ctx.lineTo(-s * 0.16, -s * 0.20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.16, -s * 0.78); ctx.lineTo(s * 0.16, -s * 0.20); ctx.stroke();
        ctx.fillStyle = '#a8763f';
        ctx.fillRect(-s * 0.24, -s * 0.20, s * 0.48, s * 0.07);
        break;
      case 'trampoline':
        ctx.strokeStyle = '#4b5563'; ctx.lineWidth = Math.max(2, s * 0.08);
        ctx.beginPath(); ctx.moveTo(-s * 0.26, -s * 0.22); ctx.lineTo(-s * 0.36, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.26, -s * 0.22); ctx.lineTo(s * 0.36, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-s * 0.10, -s * 0.22); ctx.lineTo(-s * 0.14, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.10, -s * 0.22); ctx.lineTo(s * 0.14, 0); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, -s * 0.30, s * 0.40, s * 0.16, 0, 0, Math.PI * 2);
        fillStroke('#3f6ea8');
        ctx.beginPath(); ctx.ellipse(0, -s * 0.30, s * 0.30, s * 0.11, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#5b8fd0'; ctx.fill();
        break;
      case 'windmill':
        ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = Math.max(2, s * 0.06);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.80); ctx.stroke();
        for (var b = 0; b < 4; b++) {
          ctx.save();
          ctx.translate(0, -s * 0.80);
          ctx.rotate(b * Math.PI / 2 + 0.3);
          poly([[0, 0], [s * 0.30, -s * 0.10], [s * 0.30, s * 0.10]]);
          fillStroke(b % 2 ? '#e8c060' : '#e07a5a');
          ctx.restore();
        }
        ctx.beginPath(); ctx.arc(0, -s * 0.80, s * 0.06, 0, Math.PI * 2);
        fillStroke('#4b5563');
        break;
      case 'pool':
        ctx.beginPath(); ctx.ellipse(0, -s * 0.10, s * 0.44, s * 0.22, 0, 0, Math.PI * 2);
        fillStroke('#7fb8d8');
        ctx.beginPath(); ctx.ellipse(0, -s * 0.12, s * 0.34, s * 0.15, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
        poly([[-s * 0.14, -s * 0.16], [s * 0.14, -s * 0.16], [s * 0.08, -s * 0.06], [-s * 0.08, -s * 0.06]]);
        fillStroke('#a8763f');
        break;
      case 'lantern':
        ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = Math.max(1.5, s * 0.05);
        ctx.beginPath(); ctx.moveTo(-s * 0.30, -s * 0.86); ctx.lineTo(s * 0.30, -s * 0.86); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -s * 0.86); ctx.lineTo(0, -s * 0.62); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, -s * 0.36, s * 0.20, s * 0.26, 0, 0, Math.PI * 2);
        fillStroke('#e8a04a');
        ctx.beginPath(); ctx.ellipse(0, -s * 0.36, s * 0.09, s * 0.14, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,246,200,0.95)'; ctx.fill();
        break;
      case 'hammock':
        ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = Math.max(2, s * 0.07);
        ctx.beginPath(); ctx.moveTo(-s * 0.42, 0); ctx.lineTo(-s * 0.42, -s * 0.72); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.42, 0); ctx.lineTo(s * 0.42, -s * 0.72); ctx.stroke();
        ctx.strokeStyle = '#d8c8a8'; ctx.lineWidth = Math.max(1.2, s * 0.04);
        ctx.beginPath();
        ctx.moveTo(-s * 0.42, -s * 0.62);
        ctx.quadraticCurveTo(0, -s * 0.10, s * 0.42, -s * 0.62);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-s * 0.42, -s * 0.56);
        ctx.quadraticCurveTo(0, -s * 0.04, s * 0.42, -s * 0.56);
        ctx.stroke();
        break;
      case 'ball':
        ctx.beginPath(); ctx.arc(0, -s * 0.22, s * 0.24, 0, Math.PI * 2);
        fillStroke('#c9d8a8');
        ctx.strokeStyle = 'rgba(120,140,80,0.7)'; ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath(); ctx.ellipse(0, -s * 0.22, s * 0.24, s * 0.09, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, -s * 0.22, s * 0.09, s * 0.24, 0, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'sandbox':
        ctx.fillStyle = '#8a6a4a';
        ctx.fillRect(-s * 0.44, -s * 0.16, s * 0.88, s * 0.16);
        ctx.fillStyle = '#e0c48a';
        ctx.fillRect(-s * 0.38, -s * 0.20, s * 0.76, s * 0.10);
        ctx.strokeStyle = '#6a8a4a'; ctx.lineWidth = Math.max(2, s * 0.05);
        ctx.beginPath(); ctx.moveTo(s * 0.30, -s * 0.20); ctx.lineTo(s * 0.44, -s * 0.48); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(s * 0.46, -s * 0.50, s * 0.08, s * 0.06, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#a8c088'; ctx.fill();
        break;
      case 'rug':
        // 平铺在地上的地毯（透视压扁）
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.03, s * 0.46, s * 0.15, 0, 0, Math.PI * 2);
        fillStroke('#b8726a');
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.03, s * 0.32, s * 0.095, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#d8a08c'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(1, s * 0.025);
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.03, s * 0.20, s * 0.058, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'mobile':
        // 挂在窗边的转饰
        ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = Math.max(1.2, s * 0.035);
        ctx.beginPath(); ctx.moveTo(0, -s * 0.92); ctx.lineTo(0, -s * 0.62); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-s * 0.30, -s * 0.62); ctx.lineTo(s * 0.30, -s * 0.62); ctx.stroke();
        var hangCols = ['#e8c060', '#7fb2e0', '#e08a9a'];
        for (var mi = 0; mi < 3; mi++) {
          var mx = (mi - 1) * s * 0.28;
          var mlen = s * (0.30 - Math.abs(mi - 1) * 0.06);
          ctx.strokeStyle = 'rgba(160,150,130,0.8)'; ctx.lineWidth = Math.max(1, s * 0.018);
          ctx.beginPath(); ctx.moveTo(mx, -s * 0.62); ctx.lineTo(mx, -s * 0.62 + mlen); ctx.stroke();
          ctx.fillStyle = hangCols[mi]; ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = Math.max(1.2, s * 0.03);
          ctx.beginPath();
          ctx.arc(mx, -s * 0.62 + mlen + s * 0.07, s * 0.075, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        }
        break;
      default:
        ctx.beginPath(); ctx.arc(0, -s * 0.20, s * 0.20, 0, Math.PI * 2);
        fillStroke('#c9d4e0');
    }
    ctx.restore();
  };

  /* ---------------- 家的世界（16:9 全屏） ---------------- */

  /**
   * 画整个家：左边半截面屋子（能看见她在屋里做什么）、中间院子（两块田直接画在画面里）、
   * 右边花园与池塘。全部同屏。
   * @param opts { seed, fields:{dry,wet}, timeOfDay }
   */
  ph.homeWorld = function (ctx, W, H, opts) {
    opts = opts || {};
    var rand = NT.rng.mulberry32((opts.seed || 20240613) >>> 0);
    var SKY0 = '#a8cce4', SKY1 = '#e2eff7';
    var WALL = '#d9c9a8', WALL_D = '#bfae8c', WOOD = '#8a6a4a', WOOD_D = '#6d5238';
    var FLOOR2 = '#9c7f5c';
    var GRASS0 = '#7fa862', GRASS1 = '#5f8a4a';
    var SOIL = '#8a6a48', SOIL_D = '#6f5438';
    var WATER = '#7fb0a0';

    var horizon = H * 0.44;
    var groundY = H * 0.90;
    var houseFloorY = H * 0.88;
    var houseL = W * 0.02, houseR = W * 0.31;

    /* --- 天空 --- */
    var g = ctx.createLinearGradient(0, 0, 0, horizon + H * 0.06);
    g.addColorStop(0, SKY0); g.addColorStop(1, SKY1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, horizon + H * 0.10);

    // 云
    ctx.save();
    ctx.globalAlpha = 0.75; ctx.fillStyle = '#ffffff';
    for (var c = 0; c < 5; c++) {
      var cx = U.range(rand, 0, W), cy = U.range(rand, H * 0.05, H * 0.24);
      var cw = U.range(rand, W * 0.08, W * 0.17);
      ctx.beginPath(); ctx.ellipse(cx, cy, cw, cw * 0.30, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx - cw * 0.5, cy + cw * 0.06, cw * 0.6, cw * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + cw * 0.5, cy + cw * 0.05, cw * 0.55, cw * 0.20, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    /* --- 远山 --- */
    var far = [makeNoise(rand, 6), makeNoise(rand, 10)];
    ctx.fillStyle = '#9db8a4';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (var x = 0; x <= W; x += 10) {
      ctx.lineTo(x, horizon + H * 0.04 - fbm(far, x / W) * H * 0.10);
    }
    ctx.lineTo(W, groundY); ctx.closePath(); ctx.fill();

    /* --- 地 --- */
    var gg = ctx.createLinearGradient(0, horizon, 0, H);
    gg.addColorStop(0, GRASS0); gg.addColorStop(1, GRASS1);
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.moveTo(0, horizon + H * 0.06);
    for (var gx = 0; gx <= W; gx += 12) {
      ctx.lineTo(gx, horizon + H * 0.06 + Math.sin(gx / W * 5) * H * 0.008);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H);
    ctx.closePath(); ctx.fill();

    // 小路（从屋门口通向右边）
    ctx.save();
    ctx.strokeStyle = 'rgba(196,176,140,0.55)';
    ctx.lineWidth = H * 0.055;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(houseR - W * 0.01, houseFloorY + H * 0.02);
    ctx.quadraticCurveTo(W * 0.55, H * 0.97, W * 0.99, H * 0.94);
    ctx.stroke();
    ctx.restore();

    /* --- 半截面屋子 --- */
    (function drawHouse() {
      var wallTop = H * 0.30;
      var peak = H * 0.17;

      // 后墙
      ctx.fillStyle = WALL;
      ctx.fillRect(houseL, wallTop, houseR - houseL, houseFloorY - wallTop);
      // 地板
      ctx.fillStyle = FLOOR2;
      ctx.fillRect(houseL, houseFloorY, houseR - houseL, H * 0.055);
      // 地板缝
      ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 1;
      for (var f = 1; f < 6; f++) {
        var fy = houseFloorY + (H * 0.055) * f / 6;
        ctx.beginPath(); ctx.moveTo(houseL, fy); ctx.lineTo(houseR, fy); ctx.stroke();
      }

      // 屋顶
      ctx.fillStyle = WOOD_D;
      ctx.beginPath();
      ctx.moveTo(houseL - W * 0.012, wallTop);
      ctx.lineTo((houseL + houseR) / 2, peak);
      ctx.lineTo(houseR + W * 0.012, wallTop);
      ctx.lineTo(houseR + W * 0.012, wallTop + H * 0.022);
      ctx.lineTo((houseL + houseR) / 2, peak + H * 0.022);
      ctx.lineTo(houseL - W * 0.012, wallTop + H * 0.022);
      ctx.closePath(); ctx.fill();

      // 剖面边缘（加粗，强调"这是被切开的房子"）
      ctx.strokeStyle = WOOD_D;
      ctx.lineWidth = Math.max(2, W * 0.0045);
      ctx.beginPath();
      ctx.moveTo(houseL, wallTop); ctx.lineTo(houseL, houseFloorY + H * 0.055);
      ctx.moveTo(houseR, wallTop); ctx.lineTo(houseR, houseFloorY + H * 0.055);
      ctx.stroke();

      // 窗
      ctx.fillStyle = 'rgba(190,220,238,0.95)';
      ctx.fillRect(houseL + (houseR - houseL) * 0.70, wallTop + H * 0.045, (houseR - houseL) * 0.20, H * 0.085);
      ctx.strokeStyle = WOOD; ctx.lineWidth = Math.max(1.4, W * 0.0022);
      ctx.strokeRect(houseL + (houseR - houseL) * 0.70, wallTop + H * 0.045, (houseR - houseL) * 0.20, H * 0.085);
      ctx.beginPath();
      ctx.moveTo(houseL + (houseR - houseL) * 0.80, wallTop + H * 0.045);
      ctx.lineTo(houseL + (houseR - houseL) * 0.80, wallTop + H * 0.13);
      ctx.stroke();

      // 书架
      var shX = houseL + (houseR - houseL) * 0.03, shW = (houseR - houseL) * 0.13;
      var shY = wallTop + H * 0.05, shH = houseFloorY - shY;
      ctx.fillStyle = WOOD; ctx.fillRect(shX, shY, shW, shH);
      for (var s = 0; s < 3; s++) {
        var sy = shY + shH * (0.26 + s * 0.26);
        ctx.fillStyle = rgbStr(shade(hexToRgb(WOOD), 1.25));
        ctx.fillRect(shX, sy, shW, H * 0.008);
        for (var b = 0; b < 5; b++) {
          ctx.fillStyle = rgbStr([150 + rand() * 80, 110 + rand() * 60, 85 + rand() * 55]);
          ctx.fillRect(shX + shW * (0.06 + b * 0.18), sy - H * 0.055, shW * 0.12, H * 0.055);
        }
      }

      // 床（左边）
      var bedX = houseL + (houseR - houseL) * 0.20, bedW = (houseR - houseL) * 0.30;
      var bedY = houseFloorY - H * 0.055;
      ctx.fillStyle = WOOD; ctx.fillRect(bedX, bedY, bedW, H * 0.055);
      ctx.fillStyle = '#e8e2d2'; ctx.fillRect(bedX + W * 0.004, bedY - H * 0.030, bedW - W * 0.008, H * 0.034);
      ctx.fillStyle = '#cfd8e0'; ctx.fillRect(bedX + W * 0.006, bedY - H * 0.026, bedW * 0.28, H * 0.026);

      // 桌子 + 椅子（中间）
      var tbX = houseL + (houseR - houseL) * 0.56, tbW = (houseR - houseL) * 0.22;
      ctx.fillStyle = WOOD;
      ctx.fillRect(tbX, houseFloorY - H * 0.055, tbW, H * 0.014);
      ctx.fillRect(tbX + tbW * 0.08, houseFloorY - H * 0.041, W * 0.006, H * 0.041);
      ctx.fillRect(tbX + tbW * 0.84, houseFloorY - H * 0.041, W * 0.006, H * 0.041);

      // 灶台（右边）
      var stX = houseR - (houseR - houseL) * 0.16;
      ctx.fillStyle = '#9a8f80';
      ctx.fillRect(stX, houseFloorY - H * 0.070, W * 0.032, H * 0.070);
      ctx.fillStyle = '#6f665c';
      ctx.beginPath(); ctx.ellipse(stX + W * 0.016, houseFloorY - H * 0.070, W * 0.019, H * 0.011, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(230,230,235,0.55)';
      ctx.beginPath(); ctx.ellipse(stX + W * 0.016, houseFloorY - H * 0.105, W * 0.010, H * 0.020, 0, 0, Math.PI * 2); ctx.fill();

      // 地毯
      ctx.fillStyle = 'rgba(180,120,110,0.55)';
      ctx.beginPath();
      ctx.ellipse(houseL + (houseR - houseL) * 0.52, houseFloorY + H * 0.028, (houseR - houseL) * 0.26, H * 0.024, 0, 0, Math.PI * 2);
      ctx.fill();

      // 墙上的搁板与干草束，别让上半面墙空着
      var wsY = wallTop + H * 0.145;
      var wsX = houseL + (houseR - houseL) * 0.30, wsW = (houseR - houseL) * 0.42;
      ctx.fillStyle = rgbStr(shade(hexToRgb(WOOD), 1.15));
      ctx.fillRect(wsX, wsY, wsW, H * 0.010);
      for (var jj = 0; jj < 4; jj++) {
        var jx = wsX + wsW * (0.08 + jj * 0.24);
        ctx.fillStyle = rgbStr([150 + rand() * 70, 130 + rand() * 60, 100 + rand() * 50]);
        ctx.beginPath();
        ctx.ellipse(jx, wsY - H * 0.014, W * 0.006, H * 0.014, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(jx - W * 0.006, wsY - H * 0.014, W * 0.012, H * 0.014);
      }
      for (var hb = 0; hb < 3; hb++) {
        var hx = houseL + (houseR - houseL) * (0.10 + hb * 0.055);
        ctx.strokeStyle = 'rgb(196,172,96)';
        ctx.lineWidth = Math.max(1, W * 0.0016);
        for (var st3 = 0; st3 < 5; st3++) {
          ctx.beginPath();
          ctx.moveTo(hx, wallTop + H * 0.055);
          ctx.lineTo(hx + (st3 - 2) * W * 0.0035, wallTop + H * 0.115);
          ctx.stroke();
        }
      }
    })();

    /* --- 院子的两块田 --- */
    function drawField(fx, fw, fy, fh, info, wet) {
      // 田埂
      ctx.fillStyle = wet ? '#6f8a72' : SOIL;
      ctx.beginPath();
      ctx.moveTo(fx, fy + fh);
      ctx.lineTo(fx + fw * 0.04, fy);
      ctx.lineTo(fx + fw * 0.96, fy);
      ctx.lineTo(fx + fw, fy + fh);
      ctx.closePath(); ctx.fill();
      // 水
      if (wet) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = WATER;
        ctx.beginPath();
        ctx.moveTo(fx + fw * 0.04, fy + fh * 0.06);
        ctx.lineTo(fx + fw * 0.96, fy + fh * 0.06);
        ctx.lineTo(fx + fw * 0.99, fy + fh);
        ctx.lineTo(fx + fw * 0.01, fy + fh);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // 垄
      ctx.strokeStyle = wet ? 'rgba(60,90,80,0.35)' : 'rgba(60,40,20,0.30)';
      ctx.lineWidth = Math.max(1, fw * 0.006);
      var rows = 5;
      for (var r = 1; r < rows; r++) {
        var t = r / rows;
        ctx.beginPath();
        ctx.moveTo(U.lerp(fx + fw * 0.04, fx, t), U.lerp(fy, fy + fh, t));
        ctx.lineTo(U.lerp(fx + fw * 0.96, fx + fw, t), U.lerp(fy, fy + fh, t));
        ctx.stroke();
      }
      // 作物
      if (info && info.cropId) {
        var p = U.clamp(info.progress || 0, 0, 1);
        var n = 5;
        for (var i = 0; i < n; i++) {
          var t2 = (i + 0.5) / n;
          var px = U.lerp(fx + fw * 0.10, fx + fw * 0.90, t2);
          var py = U.lerp(fy + fh * 0.14, fy + fh * 0.92, t2);
          var hgt = fh * (0.18 + p * 0.70);
          ctx.strokeStyle = wet ? '#7fae6a' : '#8fbf6a';
          ctx.lineWidth = Math.max(1.4, fw * 0.008);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.sin(i * 2.1) * fw * 0.012, py - hgt);
          ctx.stroke();
          if (p > 0.75) {
            ctx.fillStyle = info.ripeColor || '#e2b25c';
            ctx.beginPath();
            ctx.arc(px, py - hgt, fw * 0.020 + fw * 0.012 * p, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    var fields = opts.fields || {};
    drawField(W * 0.345, W * 0.110, H * 0.778, H * 0.100, fields.dry, false);
    drawField(W * 0.470, W * 0.110, H * 0.768, H * 0.106, fields.wet, true);

    // 篱笆（院子后侧）
    ctx.strokeStyle = rgbStr(shade(hexToRgb(WOOD), 1.05));
    ctx.lineWidth = Math.max(1.6, W * 0.0035);
    for (var p2 = 0; p2 < 13; p2++) {
      var px2 = W * 0.325 + p2 * (W * 0.31 / 13);
      ctx.beginPath();
      ctx.moveTo(px2, horizon + H * 0.16);
      ctx.lineTo(px2, horizon + H * 0.30);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(W * 0.32, horizon + H * 0.20); ctx.lineTo(W * 0.65, horizon + H * 0.20);
    ctx.moveTo(W * 0.32, horizon + H * 0.27); ctx.lineTo(W * 0.65, horizon + H * 0.27);
    ctx.stroke();

    /* --- 花园 --- */
    // 两棵树
    for (var t3 = 0; t3 < 2; t3++) {
      var tx = W * (0.685 + t3 * 0.205);
      var th = H * (0.30 + t3 * 0.04);
      ctx.fillStyle = WOOD;
      ctx.fillRect(tx - W * 0.006, groundY - th * 0.52, W * 0.012, th * 0.55);
      ctx.fillStyle = '#6f9e56';
      ctx.beginPath(); ctx.arc(tx, groundY - th * 0.62, W * 0.045, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7fb062';
      ctx.beginPath(); ctx.arc(tx - W * 0.028, groundY - th * 0.50, W * 0.032, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(tx + W * 0.028, groundY - th * 0.51, W * 0.030, 0, Math.PI * 2); ctx.fill();
    }
    // 花丛
    var flowerCols = [[247, 184, 212], [255, 214, 140], [200, 170, 235], [255, 160, 150], [250, 250, 240]];
    for (var fl = 0; fl < 60; fl++) {
      var fx2 = W * 0.66 + rand() * W * 0.33;
      var fy2 = groundY + rand() * H * 0.075;
      var col = flowerCols[fl % flowerCols.length];
      ctx.fillStyle = rgbStr(shade(col, 0.9 + rand() * 0.2));
      ctx.beginPath(); ctx.arc(fx2, fy2, W * (0.0035 + rand() * 0.004), 0, Math.PI * 2); ctx.fill();
    }
    // 池塘
    ctx.fillStyle = '#6fa4b8';
    ctx.beginPath();
    ctx.ellipse(W * 0.930, groundY + H * 0.045, W * 0.055, H * 0.030, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.ellipse(W * 0.918, groundY + H * 0.036, W * 0.020, H * 0.008, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9aa0a8';
    for (var st2 = 0; st2 < 4; st2++) {
      var sx2 = W * (0.865 + st2 * 0.038);
      ctx.beginPath();
      ctx.ellipse(sx2, groundY + H * 0.052 + (st2 % 2) * H * 0.010, W * 0.010, H * 0.007, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    return { horizon: horizon, groundY: groundY, houseFloorY: houseFloorY };
  };

  NT.placeholder = ph;
})(typeof window !== 'undefined' ? window : this);
