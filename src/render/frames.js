/* 纳西妲旅行 · 画框与邮戳（程序化绘制，不需要图片素材）
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  var U = NT.util;

  var frames = {};

  frames.ids = ['polaroid', 'film', 'postcard', 'kraft', 'clean'];

  /**
   * 在画布最上层画框。
   * @returns {{inset:{x,y,w,h}}} 内容可用区域，供文字排版使用
   */
  frames.draw = function (ctx, w, h, frameId, rand) {
    var inset;
    switch (frameId) {
      case 'polaroid': {
        var side = w * 0.055, top = w * 0.055, bottom = w * 0.215;
        ctx.save();
        ctx.fillStyle = '#fbf8f1';
        ctx.beginPath();
        frames._rectPath(ctx, 0, 0, w, h, 0);
        ctx.fill();
        // 内框投影，模拟照片压进纸里
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.22)';
        ctx.shadowBlur = w * 0.018;
        ctx.shadowOffsetY = w * 0.004;
        ctx.fillStyle = '#000';
        ctx.fillRect(side, top, w - side * 2, h - top - bottom);
        ctx.restore();
        ctx.restore();
        inset = { x: side, y: top, w: w - side * 2, h: h - top - bottom };
        break;
      }
      case 'film': {
        var b = w * 0.075, hole = w * 0.030;
        ctx.save();
        ctx.fillStyle = '#1c1c1e';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        // 齿孔
        ctx.save();
        ctx.fillStyle = '#f4f2ec';
        var count = 16;
        for (var i = 0; i < count; i++) {
          var y = b * 0.62 + (h - b * 1.24 - hole) * (i / (count - 1));
          frames._roundRect(ctx, b * 0.30, y, hole * 0.72, hole * 0.54, hole * 0.12);
          ctx.fill();
          frames._roundRect(ctx, w - b * 0.30 - hole * 0.72, y, hole * 0.72, hole * 0.54, hole * 0.12);
          ctx.fill();
        }
        ctx.restore();
        inset = { x: b, y: b * 1.15, w: w - b * 2, h: h - b * 2.3 };
        break;
      }
      case 'postcard': {
        var p = w * 0.038;
        ctx.save();
        ctx.fillStyle = '#fdfaf3';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(150,135,115,0.55)';
        ctx.lineWidth = Math.max(1, w * 0.0018);
        ctx.strokeRect(p * 0.45, p * 0.45, w - p * 0.9, h - p * 0.9);
        ctx.restore();
        inset = { x: p, y: p, w: w - p * 2, h: h - p * 2 };
        break;
      }
      case 'kraft': {
        var k = w * 0.046;
        ctx.save();
        ctx.fillStyle = '#c8a878';
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = '#7a5a34';
        for (var j = 0; j < 260; j++) {
          var x = rand() * w, y = rand() * h;
          ctx.fillRect(x, y, U.range(rand, 1, 5), U.range(rand, 1, 2));
        }
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = 'rgba(90,66,40,0.5)';
        ctx.setLineDash([w * 0.012, w * 0.008]);
        ctx.lineWidth = Math.max(1, w * 0.0022);
        ctx.strokeRect(k * 0.55, k * 0.55, w - k * 1.1, h - k * 1.1);
        ctx.restore();
        inset = { x: k, y: k, w: w - k * 2, h: h - k * 2 };
        break;
      }
      case 'clean':
      default: {
        var c = w * 0.022;
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        inset = { x: c, y: c, w: w - c * 2, h: h - c * 2 };
        break;
      }
    }
    // 轻微做旧：边缘压暗
    ctx.save();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(120,100,80,0.06)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(120,100,80,0.07)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return { inset: inset };
  };

  frames._rectPath = function (ctx, x, y, w, h, r) {
    if (!r) { ctx.rect(x, y, w, h); return; }
    frames._roundRect(ctx, x, y, w, h, r);
  };

  frames._roundRect = function (ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  /* ---------------- 邮戳 ---------------- */

  /**
   * 画一枚旅行邮戳。
   * @param text 例如 "MONDSTADT" / "璃月"
   */
  frames.stamp = function (ctx, cx, cy, size, rot, opacity, hue, text) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot * Math.PI / 180);
    ctx.globalAlpha = U.clamp(opacity, 0, 1);
    var col = 'hsl(' + (hue || 210) + ',58%,38%)';
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    var R = size;

    // 外圈（用短划线模拟磨损）
    ctx.lineWidth = Math.max(1.5, R * 0.075);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(1, R * 0.035);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.80, 0, Math.PI * 2); ctx.stroke();

    // 环形文字（上半）
    var label = String(text || 'TRAVEL').toUpperCase();
    var chars = label.split('');
    var arcR = R * 0.66;
    var span = Math.PI * 0.82;
    var start = -Math.PI / 2 - span / 2;
    var fs = Math.max(7, R * (chars.length > 10 ? 0.15 : 0.19));
    ctx.font = 'bold ' + fs.toFixed(1) + 'px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < chars.length; i++) {
      var a = start + (span * (chars.length <= 1 ? 0.5 : i / (chars.length - 1)));
      ctx.save();
      ctx.translate(Math.cos(a) * arcR, Math.sin(a) * arcR);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(chars[i], 0, 0);
      ctx.restore();
    }

    // 中央横线 + 日期
    ctx.lineWidth = Math.max(1, R * 0.035);
    ctx.beginPath();
    ctx.moveTo(-R * 0.46, R * 0.10); ctx.lineTo(R * 0.46, R * 0.10);
    ctx.moveTo(-R * 0.34, R * 0.34); ctx.lineTo(R * 0.34, R * 0.34);
    ctx.stroke();

    // 中心小星星
    ctx.beginPath();
    for (var s = 0; s < 10; s++) {
      var rr = s % 2 === 0 ? R * 0.20 : R * 0.085;
      var aa = (s / 10) * Math.PI * 2 - Math.PI / 2;
      var px = Math.cos(aa) * rr, py = Math.sin(aa) * rr - R * 0.26;
      if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  /** 日期戳（矩形，小） */
  frames.dateStamp = function (ctx, x, y, w, h, rot, opacity, text, hue) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot * Math.PI / 180);
    ctx.globalAlpha = U.clamp(opacity, 0, 1);
    ctx.strokeStyle = 'hsl(' + (hue || 210) + ',50%,42%)';
    ctx.lineWidth = Math.max(1, h * 0.10);
    ctx.strokeRect(0, 0, w, h);
    ctx.fillStyle = 'hsl(' + (hue || 210) + ',50%,36%)';
    ctx.font = 'bold ' + (h * 0.46).toFixed(1) + 'px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h * 0.54);
    ctx.restore();
  };

  NT.frames = frames;
})(typeof window !== 'undefined' ? window : this);
