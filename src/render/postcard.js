/* 纳西妲旅行 · 明信片合成管线
 * 图层顺序（自下而上）：
 *   背景 → 昼夜/天气调色 → 天气粒子 → 角色投影 → 角色立绘 → 贴纸
 *   → 飘浮物 → 统一调色 → 颗粒 → 暗角 → 画框 → 邮戳 → 手写短句 → 地点/日期
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  var U = NT.util, R = NT.rng, C = NT.config;
  var PH = NT.placeholder, FX = NT.effects, FR = NT.frames;

  var postcard = {};

  // 明信片上的手写短句。优先用自己放的 OFL 开源字体，找不到就回退到系统楷体/手写体。
  // 注意：这里列的**全是系统字体**，不打包任何字体文件 —— 开源项目零字体授权风险。
  var HAND_FONT = '"LXGW WenKai","霞鹜文楷",' +
    '"STKaiti","KaiTi","楷体","Kaiti SC","STKaitiSC",' +
    '"Hiragino Sans GB","Noto Serif CJK SC","Source Han Serif SC",' +
    '"Segoe Script","Bradley Hand","Comic Sans MS",cursive,sans-serif';
  var UI_FONT = '"Segoe UI","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",' +
    'system-ui,sans-serif';

  function fmtDate(ts) {
    var d = new Date(ts);
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '.' + (m < 10 ? '0' : '') + m + '.' + (day < 10 ? '0' : '') + day;
  }

  /**
   * 合成一张明信片。
   * @param fact 事实卡
   * @param opts {scale: 0..1, forThumbnail: bool}
   * @returns HTMLCanvasElement
   */
  postcard.render = function (fact, opts) {
    opts = opts || {};
    var scale = opts.scale || 1;
    var W = Math.round(C.POSTCARD_W * scale);
    var H = Math.round(C.POSTCARD_H * scale);

    var res = NT.trip.resolve(fact);
    var dest = res.destination;
    var pres = fact.presentation;
    var rand = R.mulberry32(R.hashSeed(fact.seed + ':render'));

    var final = FX.makeCanvas(W, H);
    var fctx = final.getContext('2d');

    // ---- 画框（先画，拿到可用区域） ----
    var frameInfo = FR.draw(fctx, W, H, pres.frameId, rand);
    var inset = frameInfo.inset;
    var IW = Math.round(inset.w), IH = Math.round(inset.h);

    // 照片会被放大一点点、再轻微倾斜（模拟"贴在卡纸上"）。
    // 场景直接按放大后的尺寸渲染，贴进画框时就是 1:1 ——
    // 否则这里会多一次 5% 的放大，整张照片都会发虚。
    var zoom = 1.045 * pres.bgZoom;
    var SW = Math.round(IW * zoom), SH = Math.round(IH * zoom);

    // ---- 场景画布（尺寸 = 可见区域 × zoom） ----
    var scene = FX.makeCanvas(SW, SH);
    var sctx = scene.getContext('2d');

    // 有真背景图就用真图，否则程序化画一张
    var A = NT.assets;
    var bgImg = A && A.bg(dest ? dest.id : null);
    if (!(bgImg && A.drawCover(sctx, bgImg, SW, SH, pres.bgPanX, 0, 1))) {
      PH.background(sctx, SW, SH, dest, res.timeOfDay, res.weather, fact.seed ^ 0x5bf03635);
    }

    // 昼夜 / 天气调色
    if (res.timeOfDay && res.timeOfDay.tint) FX.tint(scene, res.timeOfDay.tint);
    if (res.weather && res.weather.tint) FX.tint(scene, res.weather.tint);

    // 天气粒子（在角色之下）
    FX.weather(scene, res.weather ? res.weather.id : 'clear', rand,
      dest ? dest.anchorY : 0.72);
    // 落汤鸡：额外的雨与水痕
    if (res.soaked) FX.soaked(scene, rand);

    // ---- 角色 ----
    // 画框会裁掉场景四周各 (SW-IW)/2，所以安全边距必须把这一段算进去
    var cropMargin = (SW - IW) / 2;
    var safeL = cropMargin + SW * 0.018;
    var safeR = SW - cropMargin - SW * 0.018;

    var horizon = SH * (dest ? dest.anchorY : 0.72);
    var feetY = Math.min(SH * 0.95, horizon + SH * (1 - (dest ? dest.anchorY : 0.72)) * 0.55);
    var charH = SH * 0.44 * pres.charScale * (res.companion ? 0.88 : 1);

    // 角色可视线半宽（身体 + 手臂），用于摆放而非仅夹取单点
    var nhHalf = charH * 0.21;
    var cH = 0, cpHalf = 0;
    if (res.companion) {
      cH = charH * (0.84 + ((R.hashSeed(res.companion.id) % 100) / 100) * 0.22);
      cpHalf = cH * 0.21;
    }

    var dir = pres.charFlip ? -1 : 1;
    var gap = charH * 0.52;
    var charX = SW * pres.charX;
    var cX = charX + dir * gap;

    if (res.companion) {
      // 把两个人当作一个整体平移/收拢，避免各自夹取后被挤成一团
      var avail = safeR - safeL;
      var reach = function (g) {
        var x2 = charX + dir * g;
        return { l: Math.min(charX - nhHalf, x2 - cpHalf), r: Math.max(charX + nhHalf, x2 + cpHalf) };
      };
      var bb = reach(gap);
      if (bb.r - bb.l > avail) {
        // 安全区装不下 -> 按比例收紧间距
        gap *= Math.max(0.35, avail / (bb.r - bb.l));
        bb = reach(gap);
      }
      var shift = 0;
      if (bb.l < safeL) shift = safeL - bb.l;
      if (bb.r + shift > safeR) shift = safeR - bb.r;
      charX += shift;
      cX = charX + dir * gap;
    } else {
      charX = U.clamp(charX, safeL + nhHalf, safeR - nhHalf);
    }

    // 地面投影（统一方向、统一模糊半径 —— 洗画风的一部分）
    sctx.save();
    sctx.globalAlpha = 0.26;
    sctx.fillStyle = '#000000';
    sctx.filter = 'blur(' + (charH * 0.035).toFixed(1) + 'px)';
    sctx.beginPath();
    sctx.ellipse(charX + charH * 0.05, feetY, charH * 0.24, charH * 0.055, 0, 0, Math.PI * 2);
    sctx.fill();
    sctx.filter = 'none';
    sctx.restore();

    // 同伴（身高差异与位置已在上方统一算好）
    if (res.companion) {
      sctx.save();
      sctx.globalAlpha = 0.30;
      sctx.fillStyle = '#000';
      sctx.filter = 'blur(' + (cH * 0.035).toFixed(1) + 'px)';
      sctx.beginPath();
      sctx.ellipse(cX, feetY, cH * 0.22, cH * 0.05, 0, 0, Math.PI * 2);
      sctx.fill();
      sctx.restore();
      var cmpOk = A && A.drawCompanion(sctx, cX, feetY, cH, !pres.charFlip, res.companion.id);
      if (!cmpOk) {
        PH.chibi(sctx, cX, feetY, cH, res.companion.sprite, fact.moodId, !pres.charFlip);
      }
    }

    // 纳西妲（主角）
    var nahidaSprite = { hair: '#f4f2ea', dress: '#8ec96a', accent: '#f7fbe8', skin: '#ffe2cc', hat: 'leaf' };
    var nOk = A && A.drawNahida(sctx, charX, feetY, charH, pres.charFlip, fact.moodId);
    if (!nOk) {
      PH.chibi(sctx, charX, feetY, charH, nahidaSprite, fact.moodId, pres.charFlip);
    }

    // ---- 贴纸 ----
    var evs = fact.events || [];
    for (var i = 0; i < evs.length; i++) {
      var kind = evs[i].stickerId;
      var sx = U.range(rand, SW * 0.12, SW * 0.88);
      var sy = U.range(rand, SH * 0.14, SH * 0.62);
      // 避免压在角色脸上
      if (Math.abs(sx - charX) < charH * 0.45 && Math.abs(sy - (feetY - charH * 0.7)) < charH * 0.5) {
        sx = sx < charX ? SW * 0.10 : SW * 0.90;
      }
      var sSize = SW * U.range(rand, 0.075, 0.125);
      sctx.save();
      sctx.globalAlpha = 0.94;
      sctx.translate(sx, sy);
      sctx.rotate(U.range(rand, -0.28, 0.28));
      sctx.translate(-sx, -sy);
      if (!(A && A.drawSticker(sctx, sx, sy, sSize, kind))) {
        PH.sticker(sctx, kind, sx, sy, sSize, rand);
      }
      sctx.restore();
    }

    // ---- 飘浮物（按目的地气质） ----
    var tags = dest ? dest.tags : [];
    if (tags.indexOf('sakura') >= 0) FX.floaters(scene, 'petal', rand, 26);
    else if (tags.indexOf('rainforest') >= 0) FX.floaters(scene, 'leaf', rand, 14);
    else if (tags.indexOf('snow') >= 0) FX.floaters(scene, 'dot', rand, 18);

    // ---- 统一调色 / 颗粒 / 暗角（洗画风） ----
    var satMul = res.weather ? res.weather.satMul : 1;
    var brMul = (res.weather ? res.weather.brightMul : 1) * (res.timeOfDay ? res.timeOfDay.brightMul : 1);
    FX.grade(scene, {
      sat: U.clamp(pres.satAdj * satMul, 0.4, 1.6),
      bright: U.clamp(brMul, 0.5, 1.3),
      contrast: 1.03,
      temp: pres.tempAdj / 1000
    });
    FX.paper(scene, 0.10, fact.seed);
    FX.grain(scene, pres.grain, fact.seed);
    FX.vignette(scene, pres.vignette);

    // ---- 把场景放进画框（带轻微倾斜 + 放大避免露边） ----
    fctx.save();
    fctx.beginPath();
    fctx.rect(inset.x, inset.y, inset.w, inset.h);
    fctx.clip();
    fctx.translate(inset.x + inset.w / 2, inset.y + inset.h / 2);
    fctx.rotate(pres.tilt * Math.PI / 180);
    fctx.drawImage(scene, -SW / 2, -SH / 2);   // 1:1，不再二次缩放
    fctx.restore();

    // ---- 邮戳 ----
    if (!opts.forThumbnail) {
      var stampR = W * 0.075;
      FR.stamp(fctx,
        W * pres.stampX, H * pres.stampY,
        stampR, pres.stampRot, pres.stampOpacity,
        dest ? dest.stampHue : 210,
        dest ? dest.name.replace(/^[^·]*·/, '') : 'TRAVEL'
      );
      FR.dateStamp(fctx,
        W * (pres.stampX - 0.155), H * (pres.stampY - 0.008),
        W * 0.145, H * 0.024,
        pres.stampRot * 0.6, pres.stampOpacity * 0.9,
        fmtDate(fact.dueAt), dest ? dest.stampHue : 210);
    }

    // ---- 手写短句 + 地点标签 ----
    if (!opts.forThumbnail) {
      var hasBand = (pres.frameId === 'polaroid');
      var bandTop = inset.y + inset.h;
      var bandH = H - bandTop;
      // 无画框留白时，短句压在图片下缘；需要预留出这条带的高度，避免与地点标签重叠
      var stripH = hasBand ? 0 : H * 0.072;
      // 地点标签的落点：有留白 -> 落在留白区；无留白 -> 落在那条压边带的上方
      var tagBottomY = hasBand
        ? bandTop + bandH * 0.86
        : inset.y + inset.h - stripH - H * 0.016;

      fctx.save();
      if (hasBand) {
        fctx.fillStyle = 'rgba(70,55,45,0.95)';
        var capFont = (bandH * 0.28).toFixed(1);
        fctx.font = capFont + 'px ' + HAND_FONT;
        fctx.textAlign = 'center';
        fctx.textBaseline = 'middle';
        var capY = bandTop + bandH * 0.40;
        fctx.translate(W / 2, capY);
        fctx.rotate(pres.captionRot * Math.PI / 180);
        // 一行放不下就折成两行（最多两行），别直接截断
        var bl = wrapLines(fctx, fact.text.postcardBack, W * 0.84, 2);
        var lh = parseFloat(capFont) * 1.32;
        for (var bi = 0; bi < bl.length; bi++) {
          fctx.fillText(bl[bi], 0, (bi - (bl.length - 1) / 2) * lh);
        }
      } else {
        // 压在图片下缘的半透明纸条
        var sy2 = inset.y + inset.h - stripH;
        var grad = fctx.createLinearGradient(0, sy2, 0, inset.y + inset.h);
        grad.addColorStop(0, 'rgba(20,16,12,0)');
        grad.addColorStop(1, 'rgba(20,16,12,0.72)');
        fctx.fillStyle = grad;
        fctx.fillRect(inset.x, sy2, inset.w, stripH);
        fctx.fillStyle = 'rgba(255,252,245,0.96)';
        var sf = (stripH * 0.40).toFixed(1);
        fctx.font = sf + 'px ' + HAND_FONT;
        fctx.textAlign = 'center';
        fctx.textBaseline = 'middle';
        var sl = wrapLines(fctx, fact.text.postcardBack, inset.w * 0.86, 2);
        var slh = parseFloat(sf) * 1.30;
        var sBase = inset.y + inset.h - stripH * 0.45 - (sl.length - 1) * slh * 0.5;
        for (var si = 0; si < sl.length; si++) {
          fctx.fillText(sl[si], inset.x + inset.w / 2, sBase + si * slh);
        }
      }
      fctx.restore();

      // 地点 + 日期（与短句分开落位，绝不重叠）
      fctx.save();
      fctx.font = (W * 0.025).toFixed(1) + 'px ' + UI_FONT;
      fctx.textAlign = 'left';
      fctx.textBaseline = 'bottom';
      var tag = (dest ? dest.name : '') + '   ' + fmtDate(fact.dueAt);
      var tw = fctx.measureText(tag).width;
      var tx = inset.x + W * 0.022;
      var padX = W * 0.010, padY = W * 0.013;
      var boxH = W * 0.025 + padY * 2;
      var boxY = tagBottomY - boxH;
      fctx.fillStyle = hasBand ? 'rgba(120,104,84,0.16)' : 'rgba(18,14,10,0.50)';
      fctx.fillRect(tx - padX, boxY, tw + padX * 2, boxH);
      fctx.fillStyle = hasBand ? 'rgba(120,100,78,0.85)' : 'rgba(255,252,245,0.94)';
      fctx.fillText(tag, tx, tagBottomY - padY);
      fctx.restore();
    }

    final._meta = { inset: inset, width: W, height: H };
    return final;
  };

  function clip(ctx, text, maxW) {
    text = String(text || '');
    if (ctx.measureText(text).width <= maxW) return text;
    var out = text;
    while (out.length > 1 && ctx.measureText(out + '…').width > maxW) out = out.slice(0, -1);
    return out + '…';
  }

  /** 按宽度折行，最多 maxLines 行（超出的部分用 … 收尾） */
  function wrapLines(ctx, text, maxW, maxLines) {
    text = String(text || '').trim();
    if (!text) return [''];
    if (ctx.measureText(text).width <= maxW) return [text];
    var lines = [], cur = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ctx.measureText(cur + ch).width > maxW && cur.length) {
        lines.push(cur);
        cur = ch;
        if (lines.length === maxLines - 1) {
          // 最后一行：把剩下的全塞进去，塞不下就截断
          var rest = text.slice(i);
          lines.push(clip(ctx, rest, maxW));
          return lines;
        }
      } else {
        cur += ch;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  postcard.toDataURL = function (fact, opts) {
    var c = postcard.render(fact, opts);
    try {
      return c.toDataURL('image/jpeg', 0.88);
    } catch (e) {
      return null;
    }
  };

  /** 缩略图（图鉴用），返回 dataURL */
  postcard.thumbnail = function (fact) {
    return postcard.toDataURL(fact, { scale: 0.22, forThumbnail: true });
  };

  NT.postcard = postcard;
})(typeof window !== 'undefined' ? window : this);
