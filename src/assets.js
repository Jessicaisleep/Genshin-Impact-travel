/* 纳西妲旅行 · 图片加载
 * 清单里填了路径就加载，加载好就用真图；没填、没加载完、或加载失败，
 * 一律回退到程序化占位图 —— 所以永远不会有"图挂了整个画面就没了"的情况。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});

  var assets = {};
  var store = {};        // key -> { img, state: 'loading'|'ready'|'error' }
  var stats = { total: 0, ready: 0, error: 0 };
  /**
   * 每成功加载一张图就 +1。
   * 画面每帧拿它和自己上次绘制时用的值比一下，不一样就重画背景 ——
   * 这样"图加载完了但画面还是占位图"在结构上就不可能发生，
   * 不依赖任何外部调用 app.render()。
   */
  var epoch = 0;

  function key(group, id) { return group + '/' + id; }

  /** 清单里可以写全名（带后缀），也可以不写后缀 —— 不写就依次试这些 */
  var EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

  function hasExt(p) { return /\.(png|jpe?g|webp|gif)$/i.test(p); }

  /**
   * 素材文件夹在哪一层？**自动探测**，不用手动配。
   * 默认的摆法是「图片素材」就在 开始游戏.html 旁边：
   *
   *   nahida-travel/
   *   ├── 开始游戏.html
   *   └── 图片素材/
   *
   * 所以按"同层 → 上一层 → 上两层"的顺序试，第一个能加载的就定下来。
   * 把整个文件夹挪到别处也不会失效。
   */
  function buildBases(dir) {
    return [dir + '/', '../' + dir + '/', '../../' + dir + '/'];
  }
  var BASES = buildBases('图片素材');
  var baseIdx = -1;          // -1 表示还没确定

  /** 工具页（tools/ 比 开始游戏.html 深一层）可以手动指定，跳过探测 */
  assets.setBase = function (prefix) {
    if (!prefix) return;
    BASES = [prefix.charAt(prefix.length - 1) === '/' ? prefix : prefix + '/'];
    baseIdx = 0;
  };

  assets.bases = function () { return BASES.slice(); };
  assets.resolvedBase = function () { return baseIdx >= 0 ? BASES[baseIdx] : null; };

  function register(group, id, name) {
    if (!name) return;
    var k = key(group, id);
    if (store[k]) return;
    var rec = { img: null, state: 'loading', trim: null };
    store[k] = rec;
    stats.total++;

    // 已经知道素材夹在哪 -> 只试那一个；还不知道 -> 挨个试
    var useBases = baseIdx >= 0 ? [BASES[baseIdx]] : BASES;
    var candidates = [];
    useBases.forEach(function (b) {
      if (hasExt(name)) candidates.push(b + name);
      else EXTS.forEach(function (e) { candidates.push(b + name + e); });
    });

    var i = 0;
    var img = new root.Image();
    rec.img = img;
    img.onload = function () {
      rec.state = 'ready';
      rec.src = img.src;
      // 这一次试成功了，就把素材夹的位置定下来，后面所有素材直接用
      if (baseIdx < 0) {
        var hit = candidates[i] || '';
        for (var bi = 0; bi < BASES.length; bi++) {
          if (hit.indexOf(BASES[bi]) === 0) { baseIdx = bi; break; }
        }
      }
      // 透明立绘/玩具自动裁掉四周空白 —— 否则按整张图缩放会显得又小又浮空
      if (group === 'nahida' || group === 'companion' || group === 'toy') {
        rec.trim = computeTrim(img);
      }
      stats.ready++;
      epoch++;
      try { onLoaded && onLoaded(group, id, img); } catch (e) { }
      fireSettled();
    };
    img.onerror = function () {
      i++;
      if (i < candidates.length) {
        img.src = candidates[i];          // 换下一个后缀/位置继续试
      } else {
        rec.state = 'error';
        stats.error++;
        fireSettled();
      }
    };
    img.src = candidates[0];
  }

  /**
   * 找出图片里非透明内容的边界（在缩略图上扫，很快）。
   * @returns {x0,y0,x1,y1} 归一化比例，或 null
   */
  function computeTrim(img) {
    try {
      var W = 128;
      var H = Math.max(1, Math.min(256, Math.round(128 * img.naturalHeight / img.naturalWidth)));
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);
      var d = ctx.getImageData(0, 0, W, H).data;
      var minX = W, minY = H, maxX = -1, maxY = -1;
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          if (d[(y * W + x) * 4 + 3] > 12) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0 || maxY < 0) return null;
      var padX = 1 / W, padY = 1 / H;   // 留一点边，别把描边切掉
      return {
        x0: Math.max(0, minX / W - padX),
        y0: Math.max(0, minY / H - padY),
        x1: Math.min(1, (maxX + 1) / W + padX),
        y1: Math.min(1, (maxY + 1) / H + padY)
      };
    } catch (e) {
      return null;    // 读不到像素时退回整张图
    }
  }

  /** 取某张图的裁边信息 */
  function trimOf(group, id) {
    var rec = store[key(group, id)];
    return rec ? rec.trim : null;
  }

  /** 加载成功时的回调（用来动态设置网页图标之类） */
  var onLoaded = null;
  assets.onLoaded = function (fn) { onLoaded = fn; };

  /* 全部结束（成功的 + 失败的）时触发一次 —— 用来决定"什么时候可以画第一帧" */
  var settledCbs = [];
  var settledFired = false;
  function fireSettled() {
    if (settledFired) return;
    if (stats.total === 0) { settledFired = true; return; }
    if (stats.ready + stats.error < stats.total) return;
    settledFired = true;
    var cbs = settledCbs; settledCbs = [];
    cbs.forEach(function (f) { try { f(); } catch (e) { } });
  }
  assets.onSettled = function (fn) {
    if (settledFired || (stats.total > 0 && stats.ready + stats.error >= stats.total)) {
      fn(); return;
    }
    settledCbs.push(fn);
  };

  /** 开始加载清单里声明过的所有图片 */
  assets.init = function () {
    var m = NT.assetManifest || {};
    // 先把"清单里有、数据表里没有"的配角补进数据表 —— 否则图会加载但游戏里永远不出现
    if (typeof assets.syncFromManifest === 'function') {
      try { assets.syncFromManifest(); } catch (e) { }
    }
    // 清单里可以改素材文件夹的名字（一般不用动）
    if (m.dir && baseIdx < 0) BASES = buildBases(m.dir);
    var k;
    for (k in (m.backgrounds || {})) register('bg', k, m.backgrounds[k]);
    for (k in (m.nahida || {})) register('nahida', k, m.nahida[k]);
    for (k in (m.companions || {})) register('companion', k, m.companions[k]);
    for (k in (m.toys || {})) register('toy', k, m.toys[k]);
    for (k in (m.stickers || {})) register('sticker', k, m.stickers[k]);
    if (m.home) register('home', 'home', m.home);
    for (k in (m.icons || {})) register('icon', k, m.icons[k]);
    return stats.total;
  };

  function ready(group, id) {
    if (!id) return null;
    var rec = store[key(group, id)];
    if (rec && rec.state === 'ready' && rec.img && rec.img.naturalWidth) return rec.img;
    return null;
  }

  /** 该组是否有任何一张图在清单里（用于决定要不要禁用程序化绘制） */
  function declared(group, id) {
    return !!store[key(group, id)];
  }

  assets.bg = function (destId) { return ready('bg', destId); };
  assets.home = function () { return ready('home', 'home'); };
  assets.nahida = function (mood) { return ready('nahida', mood); };
  /** 纳西妲任意一张可用立绘（优先指定姿态） */
  assets.nahidaAny = function (mood) {
    return ready('nahida', mood) || ready('nahida', 'idle') ||
           ready('nahida', 'happy') || ready('nahida', 'tired');
  };
  assets.companion = function (id) { return ready('companion', id); };
  assets.toy = function (id) { return ready('toy', id); };
  assets.sticker = function (id) { return ready('sticker', id); };

  assets.hasBackgrounds = function () { return !!NT.assetManifest && !!NT.assetManifest.backgrounds &&
    Object.keys(NT.assetManifest.backgrounds).length > 0; };

  assets.status = function () {
    return { total: stats.total, ready: stats.ready, error: stats.error, epoch: epoch };
  };

  /** 素材版本号：每加载完一张就变。画面用它判断"背景是不是该重画了" */
  assets.epoch = function () { return epoch; };

  /** 哪些还没加载好（用于设置页提示） */
  assets.missing = function () {
    var out = [];
    for (var k in store) {
      if (store[k].state === 'error') out.push(k);
    }
    return out;
  };

  /** 已加载好的（group/id 列表） */
  assets.loaded = function () {
    var out = [];
    for (var k in store) {
      if (store[k].state === 'ready') out.push(k);
    }
    return out;
  };

  /** 给人看的名字（取出清单路径里的文件名） */
  assets.displayName = function (group, id) {
    var m = NT.assetManifest || {};
    if (group === 'home') {
      return String(m.home || '家-全景').replace(/^.*\//, '');
    }
    var map = {
      bg: m.backgrounds, nahida: m.nahida, companion: m.companions,
      toy: m.toys, icon: m.icons, sticker: m.stickers
    };
    var g = map[group];
    if (!g || !g[id]) return id;
    return String(g[id]).replace(/^.*\//, '');
  };

  /** 已经生效的素材名字（给人看） */
  assets.loadedNames = function () {
    return assets.loaded().map(function (k) {
      var i = k.indexOf('/');
      return assets.displayName(k.slice(0, i), k.slice(i + 1));
    });
  };

  assets.anyDeclared = function () { return stats.total > 0; };

  /* ==================== 让素材真正"动态生效" ====================
   *
   * 之前的状况：清单里加一条、图片放进去，图会加载，但**游戏里永远不会出现** ——
   * 因为游戏逻辑读的是 src/data/companions.js 里那张写死的角色表。
   *
   * 现在这里做一次同步：
   *   · 配角  —— 清单里有、数据表里没有的，**自动补一条通用角色**（名字取文件名）
   *   · 地区  —— 需要经纬度才能算距离，没法凭空造，所以只报告不自动加
   * 同步是幂等的，调多少次结果都一样。
   */

  /** 从文件名里取出中文名：'配角-新角色' -> '新角色' */
  function nameFromFile(file) {
    var s = String(file || '');
    s = s.replace(/^.*\//, '');                       // 去掉目录
    s = s.replace(/\.(png|jpe?g|webp|gif)$/i, '');    // 去掉后缀
    s = s.replace(/^[^-_]{1,6}[-_]/, '');             // 去掉 '配角-' 这样的前缀
    return s || String(file || '');
  }

  /** 由 id 稳定地生成一组配色，让自动加的角色在占位图下也能区分开 */
  function autoSprite(id) {
    var r = NT.rng.mulberry32(NT.rng.hashSeed('auto-sprite:' + id));
    var h = Math.floor(r() * 360);
    var h2 = (h + 30 + Math.floor(r() * 40)) % 360;
    return {
      hair: 'hsl(' + h2 + ',32%,78%)',
      dress: 'hsl(' + h + ',38%,46%)',
      accent: 'hsl(' + ((h + 180) % 360) + ',45%,72%)',
      skin: '#ffe0c8',
      hat: 'none'
    };
  }

  var AUTO_MEET = [
    '路上碰见一个人，看着面生，聊了两句发现是顺路的。',
    '在岔路口遇见一位，问了问路，就一起走了一段。',
    '有人从后面赶上来，打了个招呼，脚步就慢下来了。'
  ];
  var AUTO_AFFINITY = [
    '我们没说什么话，但走在一起不别扭。',
    '分开的时候互相点了下头。',
    '临走前把水让给了我。'
  ];

  /** 清单里有、数据表里没有的配角 -> 自动补一条 */
  function autoCompanion(id, file) {
    return {
      id: id,
      name: nameFromFile(file) || id,
      rarity: 'N',
      weight: 10,
      auto: true,                      // 标记：这条是从素材清单自动生成的
      callNahida: '纳西妲',
      traits: ['路过的'],
      catchphrases: ['你好。', '……嗯。'],
      meetLines: AUTO_MEET,
      affinityLines: AUTO_AFFINITY,
      tags: [],
      sprite: autoSprite(id)
    };
  }

  /**
   * 把素材清单和数据表对齐。幂等。
   * @returns {addedCompanions, orphanDestinations, missingImages}
   */
  assets.syncFromManifest = function () {
    var m = NT.assetManifest || {};
    var d = NT.data || {};
    var report = { addedCompanions: [], orphanDestinations: [], missingImages: [] };

    // ---- 配角：清单里有、数据表里没有的，自动补上 ----
    if (m.companions && Array.isArray(d.companions)) {
      var known = {};
      d.companions.forEach(function (c) { known[c.id] = 1; });
      Object.keys(m.companions).forEach(function (id) {
        if (known[id]) return;
        var auto = autoCompanion(id, m.companions[id]);
        d.companions.push(auto);
        known[id] = 1;
        report.addedCompanions.push(auto.name);
      });
    }

    // ---- 地区：清单里有、数据表里没有的 —— 缺经纬度，只能报告 ----
    if (m.backgrounds && Array.isArray(d.destinations)) {
      var haveDest = {};
      d.destinations.forEach(function (x) { haveDest[x.id] = 1; });
      Object.keys(m.backgrounds).forEach(function (id) {
        if (!haveDest[id]) {
          report.orphanDestinations.push({
            id: id, name: nameFromFile(m.backgrounds[id])
          });
        }
      });
      // 有地区但坐标是猜的（既不在 geo 表里、条目里也没写 lat/lng）
      if (NT.data.hasRealGeo) {
        d.destinations.forEach(function (x) {
          if (!NT.data.hasRealGeo(x.id)) report.noGeo = (report.noGeo || []).concat([x.name || x.id]);
        });
      }
    }

    // ---- 数据表里有、但没图的 ----
    var groups = [
      { list: NT.data.destinations, map: m.backgrounds, label: '地区' },
      { list: NT.data.companions, map: m.companions, label: '配角' },
      { list: NT.data.toys, map: m.toys, label: '玩具' }
    ];
    groups.forEach(function (g) {
      if (!Array.isArray(g.list) || !g.map) return;
      g.list.forEach(function (item) {
        if (!g.map[item.id]) {
          report.missingImages.push(g.label + '：' + (item.name || item.id));
        }
      });
    });

    return report;
  };


  /* ---------------- 绘制辅助 ---------------- */

  /** 等比铺满（相当于 CSS 的 object-fit: cover） */
  assets.drawCover = function (ctx, img, w, h, panX, panY, zoom) {
    if (!img) return false;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return false;
    zoom = zoom || 1;
    var scale = Math.max(w / iw, h / ih) * zoom;
    var dw = iw * scale, dh = ih * scale;
    var dx = (w - dw) / 2 + (panX || 0) * w;
    var dy = (h - dh) / 2 + (panY || 0) * h;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';   // 大幅缩小时低质量采样会明显发糊
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
    return true;
  };

  /**
   * 把立画/玩具画在"底边中心对齐 (cx, baseY)、内容高度 = height"的位置。
   * 会自动用裁边信息，所以图片四周留白多少都不影响位置和大小。
   */
  assets.drawSprite = function (ctx, img, cx, baseY, height, flip, trim) {
    if (!img) return false;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return false;

    var t = trim || { x0: 0, y0: 0, x1: 1, y1: 1 };
    var sx = t.x0 * iw, sy = t.y0 * ih;
    var sw = Math.max(1, (t.x1 - t.x0) * iw);
    var sh = Math.max(1, (t.y1 - t.y0) * ih);

    var scale = height / sh;
    var dw = sw * scale, dh = sh * scale;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (flip) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
    ctx.drawImage(img, sx, sy, sw, sh, cx - dw / 2, baseY - dh, dw, dh);
    ctx.restore();
    return true;
  };

  /** 取裁边信息（给调用方用） */
  assets.trimOf = function (group, id) { return trimOf(group, id); };

  /* ---- 带裁边的便捷绘制 ---- */

  assets.nahidaIdFor = function (mood) {
    if (ready('nahida', mood)) return mood;
    if (ready('nahida', 'idle')) return 'idle';
    if (ready('nahida', 'happy')) return 'happy';
    if (ready('nahida', 'tired')) return 'tired';
    return null;
  };

  assets.drawNahida = function (ctx, cx, baseY, h, flip, mood) {
    var id = assets.nahidaIdFor(mood);
    if (!id) return false;
    return assets.drawSprite(ctx, ready('nahida', id), cx, baseY, h, flip, trimOf('nahida', id));
  };

  assets.drawCompanion = function (ctx, cx, baseY, h, flip, id) {
    var img = assets.companion(id);
    if (!img) return false;
    return assets.drawSprite(ctx, img, cx, baseY, h, flip, trimOf('companion', id));
  };

  assets.drawToy = function (ctx, cx, baseY, h, id) {
    var img = assets.toy(id);
    if (!img) return false;
    return assets.drawSprite(ctx, img, cx, baseY, h, false, trimOf('toy', id));
  };

  assets.drawSticker = function (ctx, cx, cy, h, id) {
    var img = assets.sticker(id);
    if (!img) return false;
    return assets.drawSprite(ctx, img, cx, cy + h / 2, h, false, trimOf('sticker', id));
  };

  NT.assets = assets;
})(typeof window !== 'undefined' ? window : this);
