/* 纳西妲旅行 · 图像后处理
 * 这一层是"洗画风"的核心：无论素材来自哪里，统一过一遍同样的处理，
 * 成品就会看起来像同一套东西。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  var U = NT.util;

  var fx = {};

  fx.makeCanvas = function (w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };

  /** 把 canvas 的内容过一遍 CSS filter（浏览器原生，很快） */
  fx.applyFilter = function (canvas, filterStr) {
    if (!filterStr || filterStr === 'none') return;
    var ctx = canvas.getContext('2d');
    var tmp = fx.makeCanvas(canvas.width, canvas.height);
    tmp.getContext('2d').drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.filter = filterStr;
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
    ctx.filter = 'none';
  };

  /** 统一调色：饱和度 + 亮度 + 色温 */
  fx.grade = function (canvas, o) {
    o = o || {};
    var parts = [];
    if (o.sat !== undefined) parts.push('saturate(' + o.sat.toFixed(3) + ')');
    if (o.bright !== undefined) parts.push('brightness(' + o.bright.toFixed(3) + ')');
    if (o.contrast !== undefined) parts.push('contrast(' + o.contrast.toFixed(3) + ')');
    fx.applyFilter(canvas, parts.join(' '));

    // 色温：暖色 soft-light 叠加 / 冷色
    if (o.temp) {
      var ctx = canvas.getContext('2d');
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      var warm = o.temp > 0;
      ctx.fillStyle = warm
        ? 'rgba(255,190,120,' + Math.min(0.5, Math.abs(o.temp)).toFixed(3) + ')'
        : 'rgba(130,180,255,' + Math.min(0.5, Math.abs(o.temp)).toFixed(3) + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  };

  /** 颜色叠加（用于昼夜/天气）
   *  tint: [r,g,b,alpha] 或 [r,g,b,alpha,mode]
   *  压暗/降温用 multiply；加暖用 soft-light（源叠加会把画面洗成灰橄榄色）。
   */
  fx.tint = function (canvas, tint) {
    if (!tint) return;
    var ctx = canvas.getContext('2d');
    var mode = tint[4] || (tint[3] > 0.3 ? 'multiply' : 'source-over');
    ctx.save();
    ctx.fillStyle = 'rgba(' + tint[0] + ',' + tint[1] + ',' + tint[2] + ',' + tint[3] + ')';
    ctx.globalCompositeOperation = mode;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  };

  /** 统一颗粒（胶片感）：先做一张噪声贴图，再用 pattern 铺 */
  var _grainTile = null;
  fx._grainTileFor = function (seed) {
    if (_grainTile && _grainTile.seed === seed) return _grainTile.tile;
    var N = 256;
    var c = fx.makeCanvas(N, N);
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(N, N);
    var rand = NT.rng.mulberry32(seed >>> 0);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = 128 + (rand() - 0.5) * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    _grainTile = { seed: seed, tile: c };
    return c;
  };

  fx.grain = function (canvas, amount, seed) {
    if (!amount || amount <= 0) return;
    var ctx = canvas.getContext('2d');
    var tile = fx._grainTileFor(seed || 1);
    var pat = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = U.clamp(amount, 0, 0.5);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  };

  /** 纸质纤维纹（比颗粒更粗，用于明信片质感） */
  fx.paper = function (canvas, amount, seed) {
    if (!amount || amount <= 0) return;
    var N = 512;
    var c = fx.makeCanvas(N, N);
    var ctx = c.getContext('2d');
    var rand = NT.rng.mulberry32((seed >>> 0) ^ 0x9e3779b9);
    ctx.fillStyle = 'rgba(255,255,255,0)';
    ctx.fillRect(0, 0, N, N);
    for (var i = 0; i < 900; i++) {
      var x = rand() * N, y = rand() * N, len = U.range(rand, 4, 26), a = rand() * Math.PI;
      ctx.strokeStyle = 'rgba(' + (rand() < 0.5 ? '255,255,255' : '120,110,100') + ',' + U.range(rand, 0.03, 0.10).toFixed(3) + ')';
      ctx.lineWidth = U.range(rand, 0.5, 1.6);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    var pat = canvas.getContext('2d').createPattern(c, 'repeat');
    var m = canvas.getContext('2d');
    m.save();
    m.globalCompositeOperation = 'overlay';
    m.globalAlpha = U.clamp(amount, 0, 0.6);
    m.fillStyle = pat;
    m.fillRect(0, 0, canvas.width, canvas.height);
    m.restore();
  };

  /** 暗角 */
  fx.vignette = function (canvas, strength) {
    if (!strength || strength <= 0) return;
    var w = canvas.width, h = canvas.height;
    var ctx = canvas.getContext('2d');
    var g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + U.clamp(strength, 0, 0.6).toFixed(3) + ')');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };

  /** 天气粒子层（画在背景之上、角色之下） */
  fx.weather = function (canvas, weatherId, rand, horizonRatio) {
    if (!weatherId || weatherId === 'clear') return;
    var w = canvas.width, h = canvas.height;
    var ctx = canvas.getContext('2d');
    var bottom = h * (horizonRatio === undefined ? 1 : Math.max(horizonRatio, 0.35));
    var i, x, y;

    if (weatherId === 'rain') {
      ctx.save();
      ctx.strokeStyle = 'rgba(200,220,245,0.45)';
      ctx.lineWidth = 1.6;
      for (i = 0; i < 320; i++) {
        x = rand() * w;
        y = rand() * bottom;
        var len = U.range(rand, h * 0.020, h * 0.052);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * 0.28, y + len);
        ctx.stroke();
      }
      ctx.restore();
      // 地面湿光
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#cfe0f0';
      ctx.fillRect(0, h * 0.78, w, h * 0.22);
      ctx.restore();
    } else if (weatherId === 'snow') {
      ctx.save();
      for (i = 0; i < 260; i++) {
        x = rand() * w;
        y = rand() * h;
        var r = U.range(rand, 1.2, 4.2);
        ctx.globalAlpha = U.range(rand, 0.35, 0.95);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } else if (weatherId === 'wind') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.30)';
      for (i = 0; i < 40; i++) {
        x = rand() * w; y = rand() * h * 0.8;
        var wl = U.range(rand, w * 0.05, w * 0.20);
        ctx.lineWidth = U.range(rand, 0.8, 2.2);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + wl * 0.5, y - h * 0.012, x + wl, y);
        ctx.stroke();
      }
      ctx.restore();
    } else if (weatherId === 'cloudy') {
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#b8c4d0';
      for (i = 0; i < 6; i++) {
        x = rand() * w; y = rand() * h * 0.3;
        ctx.beginPath();
        ctx.ellipse(x, y, U.range(rand, w * 0.14, w * 0.30), U.range(rand, h * 0.02, h * 0.05), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  /** 樱花/落叶等飘浮物（画在最上层，增加纵深） */
  fx.floaters = function (canvas, kind, rand, count) {
    var w = canvas.width, h = canvas.height;
    var ctx = canvas.getContext('2d');
    var n = count || 30;
    ctx.save();
    for (var i = 0; i < n; i++) {
      var x = rand() * w, y = rand() * h;
      var s = U.range(rand, w * 0.006, w * 0.016);
      var rot = rand() * Math.PI * 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = U.range(rand, 0.4, 0.9);
      if (kind === 'petal') {
        ctx.fillStyle = '#f7b8d4';
        ctx.beginPath();
        ctx.moveTo(0, s);
        ctx.quadraticCurveTo(s, 0, 0, -s);
        ctx.quadraticCurveTo(-s, 0, 0, s);
        ctx.fill();
      } else if (kind === 'leaf') {
        ctx.fillStyle = '#8fbf7a';
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 1.3, s * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  };

  /** 落汤鸡：更密的雨 + 镜头上的水珠 + 边缘水渍 */
  fx.soaked = function (canvas, rand) {
    var w = canvas.width, h = canvas.height;
    var ctx = canvas.getContext('2d');
    var i, x, y;

    // 更密的雨
    ctx.save();
    ctx.strokeStyle = 'rgba(210,228,248,0.55)';
    ctx.lineWidth = 1.8;
    for (i = 0; i < 420; i++) {
      x = rand() * w; y = rand() * h * 0.95;
      var len = U.range(rand, h * 0.03, h * 0.075);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * 0.32, y + len);
      ctx.stroke();
    }
    ctx.restore();

    // 镜头上的水珠
    ctx.save();
    for (i = 0; i < 34; i++) {
      x = rand() * w; y = rand() * h;
      var r = U.range(rand, w * 0.006, w * 0.020);
      var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.6, 'rgba(220,235,250,0.20)');
      g.addColorStop(1, 'rgba(200,220,240,0.05)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // 边缘水渍
    ctx.save();
    var vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.30, w / 2, h / 2, Math.max(w, h) * 0.72);
    vg.addColorStop(0, 'rgba(90,120,150,0)');
    vg.addColorStop(1, 'rgba(70,100,135,0.28)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };

  NT.effects = fx;
})(typeof window !== 'undefined' ? window : this);
