/* 纳西妲旅行 · 界面层
 * 家是一个 16:9 的全屏世界：纳西妲在里面实时走动做事，两块田直接画在画面里，点一下就操作。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  var U = NT.util, C = NT.config;

  var app = {};
  NT.app = app;

  app.save = null;
  app.screen = 'home';
  app.viewing = null;
  app.outMode = 'random';
  app.outRegion = null;
  app.outBearing = 'any';
  app.outDish = 'none';
  app.outRares = [];
  app.chatLog = [];
  app.chatTopic = null;
  app.fieldSheet = null;
  app.modal = null;           // 画面内弹窗：kitchen/toys/chat/album/settings/outdoor/waiting/result
  app.toastTimer = null;
  app._pendingNote = null;
  app._anim = null;
  app._raf = null;
  app._bubble = null;         // { text, until } 人物旁边的气泡

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 启动 ---------------- */

  app.init = function () {
    app.save = NT.store.load();
    // 读档时纠正玩具摆放 —— 数据改过之后老存档的槽位可能已经失效
    NT.home.repair(app.save);
    if (app.save.settings.sound === undefined) app.save.settings.sound = true;
    NT.sfx.enabled = app.save.settings.sound !== false;
    NT.achievements.ensureStats(app.save);
    // 图片是异步加载的：加载完要重绘一次，否则第一次进游戏看到的还是占位图
    var assetRerender = null;
    NT.assets.onLoaded(function (group, id, img) {
      if (group === 'icon') {
        var link = document.querySelector('link[rel="icon"]');
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.href = img.src;
        return;
      }
      clearTimeout(assetRerender);
      assetRerender = setTimeout(function () {
        if (app.screen === 'home' && !app.save.activeTrip) app.render();
      }, 180);
    });
    NT.assets.init();
    app.settleIfDue();
    if (!app.save.homeChosen) app.screen = 'chooseHome';

    app.bindGlobal();
    app.render();
    // 每 20 秒检查一次她的状态（状态本身只持续 1.5~6 分钟，所以能看到她走动）
    setInterval(function () {
      if (app.screen !== 'home') return;
      var now = Date.now();
      // 她可能已经回来了 —— 必须定时结算，否则要刷新页面才有反应（这是个真 bug）
      if (app.settleIfDue(now)) { app.render(); return; }
      if (app.save.activeTrip) { app.render(); return; }   // 出门时只刷倒计时
      var moved = NT.home.tick(app.save, now);
      if (moved.stepped || moved.visitorChanged) { NT.store.save(app.save); app.render(); }
    }, 20000);

    // 倒计时条每 5 秒刷新一次，秒级跳动太吵，但也不能太慢
    setInterval(function () {
      if (app.screen !== 'home' || !app.save.activeTrip) return;
      var el = document.getElementById('home-countdown');
      if (el) el.innerHTML = app.countdownHTML();
    }, 5000);
  };

  /**
   * 检查她是不是已经回来了。回来了就：结算 → 打开明信片弹窗 → 存盘。
   * 抽成独立函数有两个原因：
   *   1. 启动时和每 20 秒的定时器都走同一条路径，不会出现"两处逻辑不一致"
   *   2. 自检可以直接调它，不用等真时间
   * @returns 完成的那趟行程，或者 null（还没到点）
   */
  app.settleIfDue = function (now) {
    var r = NT.clock.check(app.save, now || Date.now());
    if (!r.settled) return null;
    app.viewing = r.settled;
    app.modal = 'result';
    app.fieldSheet = null;
    if (r.missed) app._pendingNote = '你很久没有翻开本子了，她还是回来了。';
    NT.store.save(app.save);
    return r.settled;
  };

  /** 全局点击绑定。抽出来是为了能被自检直接调用（否则测试里点了没反应） */
  app.bindGlobal = function () {    if (app._bound) return;
    app._bound = true;
    document.addEventListener('click', function (e) {
      // 浏览器要求 AudioContext 在用户手势里创建
      if (!app._audioReady) { app._audioReady = true; NT.sfx.init(); }
      var el = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!el) return;
      app.action(el.getAttribute('data-act'), el.getAttribute('data-arg'));
    });

    /**
     * 视口变了要重画。
     *
     * 画布是按"挂载那一刻"的尺寸画的，横竖屏切换、进全屏、拉窗口之后
     * 尺寸就不对了 —— 轻则拉伸，重则整块是空的（手机上进全屏看到一片绿就是这个）。
     * resize 在手机上会因为地址栏收起/展开频繁触发，所以先比一下尺寸，
     * 真的变了才重排，并且加个防抖。
     */
    var lastW = -1, lastH = -1;
    var onViewportChange = function () {
      var st = document.getElementById('stage');
      if (!st) return;
      var r = st.getBoundingClientRect();
      // 第一次只记尺寸，不重排 —— 否则刚进页面就白白 render 一次，
      // 会把"建议横屏"那个只出一次的提示立刻顶掉
      if (lastW < 0) { lastW = r.width; lastH = r.height; return; }
      if (Math.abs(r.width - lastW) < 2 && Math.abs(r.height - lastH) < 2) return;
      lastW = r.width; lastH = r.height;
      clearTimeout(app._relayoutTimer);
      app._relayoutTimer = setTimeout(function () {
        if (app.screen === 'home' && !app.modal) app.render();
      }, 160);
    };
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    document.addEventListener('fullscreenchange', onViewportChange);
    document.addEventListener('webkitfullscreenchange', onViewportChange);
  };

  /**
   * 竖屏提示「建议横屏」—— 24 小时只出一次。
   *
   * 之前是写在 render 的 HTML 里，每 render 一次就重新插一个元素、CSS 动画跟着重播，
   * 结果每点一个按钮它就冒出来一次。
   * 但只加时间戳还不够 —— render 在启动时会被调用不止一次，元素刚插上就被下一次
   * render 顶掉了。所以干脆不走 render：这里直接往 body 塞一个，自己定时删。
   */
  var ROTATE_HINT_GAP = 24 * 60 * 60 * 1000;
  app.maybeShowRotateHint = function () {
    var s = app.save;
    if (!s.settings) s.settings = {};
    var now = Date.now();
    var last = s.settings.rotateHintAt || 0;
    if (last && now - last < ROTATE_HINT_GAP) return false;
    s.settings.rotateHintAt = now;
    NT.store.save(s);

    if (!window.matchMedia || !window.matchMedia('(max-width:899px) and (orientation:portrait)').matches) {
      return false;                      // 横屏 / 电脑上不显示，但时间戳已经记下
    }
    var d = document.createElement('div');
    d.className = 'rotate-hint show';
    d.textContent = '建议横屏';
    document.body.appendChild(d);
    app._rotateHintEl = d;
    setTimeout(function () {
      if (d.parentNode) d.parentNode.removeChild(d);
      if (app._rotateHintEl === d) app._rotateHintEl = null;
    }, 7000);
    return true;
  };

  /** 检查有没有新解锁的成就，有就弹提示 + 响一声 */
  app.checkAchievements = function () {
    var newly = NT.achievements.check(app.save);
    if (!newly.length) return;
    NT.store.save(app.save);
    newly.forEach(function (a, i) {
      setTimeout(function () {
        NT.sfx.play('achieve');
        app.toast('🏆 成就达成：' + a.name);
      }, i * 1100);
    });
    if (app.modal === 'achievements') app.render();
  };

  app.toast = function (msg) {
    var t = $('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(app.toastTimer);
    app.toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  };

  app.go = function (s) { app.screen = s; app.fieldSheet = null; app.render(); };

  /* ---------------- 点击她的实时反应 ---------------- */

  app._react = { at: 0, until: 0, kind: null, line: '' };

  /** 她说话的唯一出口：人物旁边的气泡。
   *  kind: 'ambient'（换状态时自动说）/ 'poke'（被戳之后的反应）
   *  立即写入 DOM（不依赖 rAF —— rAF 被节流时也要能看到），位置交给动画循环跟随。 */
  app.setBubble = function (text, ms, kind) {
    app._bubble = { text: text, until: Date.now() + (ms || 6000), kind: kind || 'ambient' };
    var bub = $('nahida-bubble');
    if (!bub) return;
    bub.textContent = text;
    bub.setAttribute('data-txt', text);
    var a = app._anim;
    if (a) {
      bub.style.left = (a.x * 100).toFixed(3) + '%';
      bub.style.top = '68%';
      bub.style.transform = a.x > 0.56 ? 'translate(-104%,-100%)' : 'translate(4%,-100%)';
      bub.classList.toggle('left', a.x > 0.56);
    }
    bub.classList.add('show');
    clearTimeout(app._bubbleTimer);
    app._bubbleTimer = setTimeout(function () {
      if (app._bubble && Date.now() >= app._bubble.until) {
        var b = $('nahida-bubble');
        if (b) b.classList.remove('show');
      }
    }, (ms || 6000) + 60);
  };

  /** 客人说话的气泡（和主角的分开两个元素） */
  app.setVBubble = function (text, ms, kind) {
    app._vbubble = { text: text, until: Date.now() + (ms || 6000), kind: kind || 'ambient' };
    var bub = $('visitor-bubble');
    if (!bub) return;
    bub.textContent = text;
    bub.setAttribute('data-txt', text);
    bub.classList.add('show');
  };

  app.poke = function () {
    var s = app.save;
    var now = Date.now();
    if (now < app._react.until) return;                  // 冷却：反应没结束就不再触发
    var st = NT.home.state(s);
    if (!st.poke) return;
    var r = NT.rng.mulberry32(NT.rng.hashSeed('poke:' + now));
    var line = U.pick(r, st.poke.lines);
    app._react = { at: now, until: now + 1800, kind: st.poke.anim, line: line };
    // 反应做成人物旁边的气泡，比底部那行显眼得多。
    NT.achievements.recordPoke(s);
    NT.sfx.play('poke');
    app.setBubble(line, 5200, 'poke');
  };

  /* ---------------- 聊天（可选 AI 角色扮演） ---------------- */

  app.chatPending = false;

  app.sendChat = function (playerText, presetReply) {
    app.chatLog.push({ me: true, text: playerText });
    NT.achievements.recordChat(app.save);
    var st = app.save.settings;
    if (!st.aiEnabled || !st.apiKey) {
      app.chatLog.push({ me: false, text: presetReply, source: 'preset' });
      app.render();
      return;
    }
    app.chatPending = true;
    app.render();
    // 历史里去掉刚 push 的这句
    var hist = app.chatLog.slice(0, -1);
    NT.text.ai.chat(app.save, playerText, hist, presetReply).then(function (r) {
      app.chatPending = false;
      app.chatLog.push({ me: false, text: r.text, source: r.source, error: r.error });
      app.render();
    });
  };

  /* ---------------- 行为 ---------------- */

  app.action = function (act, arg) {
    var s = app.save;
    switch (act) {
      case 'go': app.go(arg); break;
      case 'modal': app.modal = arg; app.fieldSheet = null; app.render(); break;
      case 'close-modal': app.modal = null; app.render(); break;
      case 'noop': break;
      case 'fullscreen': app.toggleFullscreen(); break;
      case 'toggle-bar': app.toggleBar(); break;
      case 'pick-home':
        s.homeId = arg; s.homeChosen = true;
        NT.store.save(s); app.screen = 'home'; app.render();
        break;
      case 'auto-locate': app.autoLocate(); break;

      /* 田地（在画面里点开） */
      case 'open-field': app.fieldSheet = arg; app.render(); break;
      case 'close-field': app.fieldSheet = null; app.render(); break;
      case 'plant': {
        var r1 = NT.farm.plant(s, app.fieldSheet, arg, Date.now());
        if (!r1.ok) app.toast(r1.error);
        NT.store.save(s); app.render(); break;
      }
      case 'harvest': {
        var r2 = NT.farm.harvest(s, arg, Date.now());
        if (r2) {
          NT.achievements.recordHarvest(s, r2);
          NT.sfx.play('harvest');
          var msg = '收获 ' + r2.itemName + ' ×' + r2.qty;
          if (r2.rare.length) {
            msg += '，掉出 ' + r2.rare.map(function (x) { return x.name; }).join('、');
            NT.sfx.play('rare');
          }
          app.toast(msg);
        }
        app.fieldSheet = null;
        NT.store.save(s); app.render(); break;
      }
      case 'harvest-all': {
        var rs = NT.farm.harvestAll(s, Date.now());
        if (!rs.length) { app.toast('还没有成熟的东西'); NT.sfx.play('error'); }
        else {
          var rares = [];
          rs.forEach(function (x) {
            NT.achievements.recordHarvest(s, x);
            x.rare.forEach(function (y) { rares.push(y.name); });
          });
          if (rares.length) NT.sfx.play('rare');
          app.toast('收获 ' + rs.map(function (x) { return x.itemName + '×' + x.qty; }).join('、') +
            (rares.length ? '，掉落 ' + rares.join('、') : ''));
        }
        NT.store.save(s); app.render(); break;
      }

      /* 厨房 */
      case 'cook': {
        var dish = NT.data.dishById(arg);
        if (!dish || !NT.data.canCook(dish, s.inventory.ingredients)) { app.toast('食材不够'); break; }
        for (var k in dish.need) {
          s.inventory.ingredients[k] -= dish.need[k];
          if (s.inventory.ingredients[k] <= 0) delete s.inventory.ingredients[k];
        }
        s.inventory.dishes[dish.id] = (s.inventory.dishes[dish.id] || 0) + 1;
        NT.store.save(s); app.toast('做好了：' + dish.name); app.render(); break;
      }

      /* 玩具 */
      case 'place-toy': {
        var rp = NT.home.placeToy(s, arg);
        app.toast(rp.ok ? '摆好了' : rp.error);
        NT.store.save(s); app.render(); break;
      }
      case 'take-toy':
        NT.home.removeToy(s, arg); NT.store.save(s); app.render(); break;

      /* 交流 */
      case 'topic': app.chatTopic = arg; app.chatLog = []; app.render(); break;
      case 'say': {
        var idx = parseInt(arg, 10);
        var line = NT.home.chat(s, app.chatTopic, idx, Date.now() + ':' + app.chatLog.length);
        if (line) app.sendChat(line.player, line.reply);
        break;
      }
      case 'send-free': {
        var inp = $('chat-input');
        var txt = ((inp && inp.value) || '').trim();
        if (!txt) break;
        if (inp) inp.value = '';
        var st0 = NT.home.state(s);
        var r0 = NT.rng.mulberry32(NT.rng.hashSeed('free:' + Date.now()));
        app.sendChat(txt, U.pick(r0, st0.lines));
        break;
      }
      case 'chat-back': app.chatTopic = null; app.chatLog = []; app.render(); break;

      /* 戳她一下 */
      case 'poke': app.poke(); break;

      /* 出门 */
      case 'out-mode': app.outMode = arg; app.render(); break;
      case 'out-region': app.outRegion = arg; app.render(); break;
      case 'out-bearing': app.outBearing = arg; app.render(); break;
      case 'out-dish': app.outDish = arg; app.render(); break;
      case 'out-rare': {
        var ri = app.outRares.indexOf(arg);
        if (ri >= 0) app.outRares.splice(ri, 1);
        else if (app.outRares.length >= 2) { app.toast('最多带两件'); break; }
        else app.outRares.push(arg);
        app.render(); break;
      }
      case 'depart': app.depart(); break;

      /* 其他 */
      case 'view': app.viewTrip(arg); break;
      case 'save-settings': app.saveSettings(); break;
      case 'test-api': app.testApi(); break;
      case 'reset': if (confirm('确定要清空所有记录吗？此操作不可撤销。')) app.resetAll(); break;
      case 'export': app.exportSave(); break;
    }
  };

  /* ---------------- 音效映射 ---------------- */

  var ACT_SOUND = {
    modal: 'open', 'close-modal': 'close',
    plant: 'plant', cook: 'cook', 'place-toy': 'toy', 'take-toy': 'blip',
    topic: 'blip', say: 'blip', 'send-free': 'blip',
    depart: 'depart', 'harvest-all': 'harvest',
    scene: 'blip', 'pick-home': 'blip', 'save-settings': 'blip',
    'out-mode': 'blip', 'out-region': 'blip', 'out-bearing': 'blip',
    'out-dish': 'blip', 'out-rare': 'blip'
  };
  function sfxFor(act) {
    var n = ACT_SOUND[act];
    if (n) NT.sfx.play(n);
  }

  /** 包装一层：响音效 + 动作结束后检查成就 */
  var _rawAction = app.action;
  app.action = function (act, arg) {
    sfxFor(act);
    _rawAction.call(app, act, arg);
    app.checkAchievements();
  };

  /**
   * 收起 / 展开下面那一排按钮。
   *
   * 铺满整屏之后底部那排按钮会压住画面（横屏竖屏都一样），收起来就能看全景。
   * 右上角的按钮文字会跟着变：展开时显示"收起"，收起后显示"菜单"。
   */
  app.barHidden = false;
  app.toggleBar = function () {
    app.barHidden = !app.barHidden;
    app.render();
  };

  /**
   * 全屏 / 横屏按钮 —— 三态循环切换，不是"锁死"按钮。
   *
   *   普通（非全屏） --点--> 全屏 --点--> 全屏 + 横屏 --点--> 回到普通
   *
   * 按钮上的字就是"下一戳会干什么"：全屏 / 横屏 / 退出。
   *
   * 为什么非得要这个按钮：网页没有资格自己转屏。浏览器规定只有**已经进入全屏**
   * 才允许锁方向（screen.orientation.lock），而且必须由用户亲手点一下触发。
   * 所以「转手机自动变横屏」在网页里做不到（除非手机自己开着自动旋转），
   * 只能让玩家点两下：一下进全屏、一下锁横屏。
   *
   * 锁不上也不算失败（iOS Safari 不支持锁方向）—— 提示玩家自己把手机横过来。
   */
  app.fsStage = 0;                     // 0=普通  1=全屏  2=全屏+横屏
  app.fsLabels = ['全屏', '横屏', '退出'];

  app.syncFsBtn = function () {
    var b = document.querySelector('.stage-fsbtn');
    if (b) {
      b.textContent = app.fsLabels[app.fsStage] || app.fsLabels[0];
      b.setAttribute('title', '当前：' + (app.fsStage === 0 ? '普通' :
        (app.fsStage === 1 ? '全屏' : '全屏横屏')) + '　点一下切到下一步');
    }
  };

  app.toggleFullscreen = function () {
    var d = document, root = d.documentElement;
    var inFs = !!(d.fullscreenElement || d.webkitFullscreenElement);

    // 玩家用 Esc / 返回手势退出了全屏，状态要跟着归零，否则会错位
    if (!inFs && app.fsStage !== 0) { app.fsStage = 0; app.syncFsBtn(); }

    // ---- 第 1 态：普通 -> 进全屏 ----
    if (app.fsStage === 0) {
      var req = root.requestFullscreen || root.webkitRequestFullscreen;
      if (!req) { app.toast('这个浏览器不支持全屏，把手机横过来就行'); return; }
      var ok1 = function () { app.fsStage = 1; app.syncFsBtn(); };
      var bad1 = function () { app.toast('全屏没打开，把手机横过来'); };
      try {
        var p = req.call(root);
        if (p && p.then) p.then(ok1, bad1); else setTimeout(ok1, 250);
      } catch (e) { bad1(); }
      return;
    }

    // ---- 第 2 态：全屏 -> 再锁横屏 ----
    if (app.fsStage === 1) {
      var o = screen.orientation || screen.mozOrientation;
      if (o && o.lock) {
        try {
          var q = o.lock('landscape');
          var ok2 = function () { app.fsStage = 2; app.syncFsBtn(); };
          var bad2 = function () { app.toast('这个浏览器不给锁方向，把手机横过来'); };
          if (q && q.then) q.then(ok2, bad2); else ok2();
          return;
        } catch (e) { /* 落到下面给提示 */ }
      }
      app.toast('把手机横过来');
      return;
    }

    // ---- 第 3 态：全屏横屏 -> 全退回普通 ----
    var exit = d.exitFullscreen || d.webkitExitFullscreen;
    if (exit) { try { exit.call(d); } catch (e) { } }
    app.fsStage = 0;
    app.syncFsBtn();
  };

  // 系统手势 / Esc 退出全屏时，把状态和按钮文字一起同步回来
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (ev) {
    document.addEventListener(ev, function () {
      var inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (!inFs && app.fsStage !== 0) { app.fsStage = 0; app.syncFsBtn(); }
    });
  });

  app.autoLocate = function () {
    var el = $('locate-result');
    if (el) { el.textContent = '定位中…'; el.className = 'test-result'; }
    NT.geo.detect().then(function (r) {
      var o = $('locate-result');
      if (r && r.error) {
        if (o) { o.textContent = r.error; o.className = 'test-result bad'; }
        return;
      }
      app.save.homeId = r.regionId;
      app.save.homeChosen = true;
      NT.store.save(app.save);
      app.toast('家乡设为：' + r.regionName + (r.source === 'ip' ? '（IP 定位）' : '（浏览器定位）'));
      app.screen = 'home';
      app.render();
    });
  };

  app.depart = function () {
    var s = app.save;
    var opts = { mode: app.outMode, dishId: app.outDish, rareItemIds: app.outRares, now: Date.now() };
    if (app.outMode === 'region') {
      if (!app.outRegion) { app.toast('先选一个地区'); return; }
      opts.regionId = app.outRegion;
    }
    if (app.outMode === 'bearing') opts.bearingId = app.outBearing;
    var r = NT.clock.depart(s, opts);
    if (!r.ok) { app.toast(r.error); return; }
    app.outRares = []; app.outDish = 'none';
    NT.store.save(s);
    app.modal = 'waiting';     // 出发时自动打开一次；关掉之后靠顶部倒计时条随时点回来
    app.render();
  };

  /* 说明：以前这里有个 completeNow（"立即完成旅行"调试按钮）。
     调试完成后已经移除，界面上不再有任何调试入口。 */

  app.viewTrip = function (id) {
    var list = app.save.album;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { app.viewing = list[i]; app.modal = 'result'; app.render(); return; }
    }
  };

  app.saveSettings = function () {
    var s = app.save.settings;
    s.apiKey = (($('api-key') || {}).value || '').trim();
    s.aiEnabled = !!($('ai-enabled') || {}).checked;
    var snd = $('sound-enabled');
    if (snd) { s.sound = !!snd.checked; NT.sfx.setEnabled(s.sound); }
    var vs = $('visitor-stay');
    if (vs) s.visitorStay = vs.value;
    var hs = $('home-select');
    if (hs && hs.value) { app.save.homeId = hs.value; app.save.homeChosen = true; }
    NT.store.save(app.save); app.toast('设置已保存'); app.render();
  };

  app.testApi = function () {
    var key = (($('api-key') || {}).value || '').trim();
    var out = $('api-test-result');
    if (!key) { app.toast('请先填入 API Key'); return; }
    if (out) { out.textContent = '测试中…'; out.className = 'test-result'; }
    NT.text.ai.test({ apiKey: key, model: app.save.settings.model, baseURL: app.save.settings.baseURL })
      .then(function (r) {
        var o = $('api-test-result'); if (!o) return;
        if (r.ok) { o.textContent = '连接成功，Key 可用。'; o.className = 'test-result ok'; }
        else {
          o.textContent = '连接失败：' + r.error + '（若是浏览器跨域限制，需要走本地代理或打包成 App）';
          o.className = 'test-result bad';
        }
      });
  };

  app.resetAll = function () {
    app.save = NT.store.reset();
    app.screen = 'chooseHome'; app.viewing = null; app.render(); app.toast('已清空');
  };

  app.exportSave = function () {
    var blob = new Blob([NT.store.exportJSON(app.save)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nahida-travel-save.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 800);
  };

  /* ---------------- 渲染 ---------------- */

  app.render = function () {
    if (app._raf) { cancelAnimationFrame(app._raf); app._raf = null; }
    var rootEl = $('screen'); if (!rootEl) return;
    var fn = (app.screen === 'chooseHome') ? app.viewChooseHome : app.viewHome;
    // 渲染函数一旦抛异常，innerHTML 就什么都不会被写入 —— 表现是"点了没反应"。
    // 所以这里必须捕获并把错误显示出来，否则问题完全静默。
    var html;
    try {
      html = fn.call(app);
    } catch (e) {
      html = app.renderError(e);
    }
    rootEl.innerHTML = html;
    rootEl.className = 'screen screen-' + app.screen;
    try {
      app.mount();
    } catch (e2) {
      var box = document.createElement('div');
      box.className = 'render-error';
      box.textContent = '渲染出错：' + (e2 && e2.message ? e2.message : e2);
      rootEl.appendChild(box);
    }
  };

  /** 渲染失败时的可见兜底（不要再让错误静默消失） */
  app.renderError = function (e) {
    var msg = (e && e.stack) ? e.stack : String(e);
    return '<div class="stage-wrap"><div class="stage-box">' +
      '<div class="stage" style="background:#1b1915;display:flex;align-items:center;' +
      'justify-content:center">' +
      '<div style="color:#d98b7a;font-size:14px;max-width:78%;max-height:70%;overflow:auto;' +
      'text-align:left">' +
      '<b>这个页面出错了</b>' +
      '<pre style="white-space:pre-wrap;font-size:11.5px;margin:.8em 0;color:#a49c8c">' +
      esc(msg) + '</pre>' +
      '<button class="sbtn" data-act="close-modal">回到家里</button>' +
      '</div></div></div></div>';
  };

  /** 当前应该显示的弹窗。
   *  注意：她出门时**不再强制接管** —— 以前这里的 return 'waiting' 会把她出门后的
   *  所有界面都锁死（弹窗关不掉、别的界面进不去）。现在只在出发那一刻自动打开一次，
   *  关掉之后靠常驻的倒计时条随时点回来。 */
  app.activeModal = function () {
    return app.modal;
  };

  /** 画面内的半透明弹窗 */
  app.renderModalLayer = function () {
    var id = app.activeModal();
    if (!id) return '';
    var M = {
      kitchen: { title: '厨房', body: app.viewKitchen },
      toys: { title: '玩具箱', body: app.viewToys },
      chat: { title: app.chatTopic ? (NT.home.topicById(app.chatTopic) || {}).label || '聊聊' : '和纳西妲说说话', body: app.viewChat },
      album: { title: '明信片册', body: app.viewAlbum },
      settings: { title: '设置', body: app.viewSettings },
      outdoor: { title: '出门', body: app.viewOutdoor },
      store: { title: '仓库', body: app.viewStore },
      achievements: { title: '成就', body: app.viewAchievements },
      waiting: { title: '旅途中', body: app.viewWaiting },
      result: { title: '明信片到了', body: app.viewResult }
    }[id];
    if (!M) return '';
    var closable = true;   // 所有弹窗都能关，包括"旅途中"
    return '<div class="modal-layer" data-act="close-modal">' +
      '<div class="modal" data-act="noop">' +
      '<div class="modal-head"><b>' + esc(M.title) + '</b>' +
      (closable ? '<button class="sbtn small" data-act="close-modal">关闭</button>' : '') +
      '</div>' +
      '<div class="modal-body" id="modal-body">' + M.body.call(app) + '</div>' +
      '</div></div>';
  };

  app.mount = function () {
    if (app.screen === 'chooseHome') return;
    app.mountHome();
    var m = app.activeModal();
    if (m === 'result' && app.viewing) app.mountResult();
    if (m === 'album') app.mountAlbum();
    if (m === 'toys') app.mountToys();
    if (m === 'chat') app.mountChat();
    if (m === 'waiting') app.mountWaiting();
  };

  /** 顶栏：所有页面现在都装在画面内的弹窗里，标题由弹窗自己画，这里不再需要 */
  app.header = function () { return ''; };

  /* ---------------- 首次选家乡 ---------------- */

  app.viewChooseHome = function () {
    var cities = NT.data.homeCities();
    var list = cities.map(function (d) {
      return '<button class="chip' + (app.save.homeId === d.id ? ' on' : '') +
        '" data-act="pick-home" data-arg="' + d.id + '">' + d.name +
        '<small>' + (d.isDestination ? dirName(d.bearing) : '城市') + '</small></button>';
    }).join('');
    return '<div class="pad choose">' +
      '<h2>她住在哪里？</h2>' +
      '<div class="hint" style="margin-top:0">家乡决定"走多远"和"往哪个方向"。' +
      '选一个离你近的，或者点下面的自动定位。共 ' + cities.length + ' 个可选。</div>' +
      '<button class="btn-ghost" data-act="auto-locate" style="width:100%;margin-top:14px">自动定位</button>' +
      '<div class="test-result" id="locate-result"></div>' +
      '<div class="label">选一个家乡</div>' +
      '<div class="chips regions">' + list + '</div>' +
      '<div class="hint">这个选择之后可以在设置里改。</div>' +
      '</div>';
  };

  function dirName(b) {
    return ({ n: '北方', s: '南方', e: '东部', w: '西部', c: '中部' })[b] || '';
  }

  /* ---------------- 家 ---------------- */

  app.viewHome = function () {
    var s = app.save;

    var st = NT.home.state(s);
    var toy = NT.home.playingToy(s);
    var line = toy ? NT.home.toyLine(s, toy) : NT.home.stateLine(s);
    var spot = NT.home.spot(s);
    var ready = NT.farm.hasReady(s, Date.now());
    var cookable = NT.data.cookableDishes(s.inventory.ingredients).length;
    // 来访的同伴（可能没有）
    var visitor = (function () {
      var c = NT.home.visitorCompanion(s);
      var st2 = NT.home.visitorState(s);
      return (c && st2) ? { comp: c, vst: st2 } : null;
    })();

    function badge(n) { return n ? '<i>' + n + '</i>' : ''; }

    return '<div class="stage-wrap">' +
      '<div class="stage-box">' +
      // 手机上这一层负责横向滚动（宽屏上 display:contents，等于不存在）
      '<div class="stage-scroll">' +
      '<div class="stage" id="stage">' +
      '<canvas id="world-bg"></canvas>' +
      '<canvas id="world-fg"></canvas>' +
      '<div class="stage-top">' +
      (s.activeTrip
        ? '<span class="state-badge away">旅途中</span><span class="state-spot">她不在家</span>'
        : '<span class="state-badge">' + st.name + '</span>' +
          '<span class="state-spot">在' + esc(spot ? spot.label : '') + '</span>') +
      (visitor ? '<span class="visitor-chip">' + esc(visitor.comp.name) + '来串门 · ' +
        esc(visitor.vst.name) + '</span>' : '') +
      '</div>' +
      // 右上角一组按钮。用 flex 排，别各自算 right，省得改一个就要动一串
      // 右上角就两个：全屏/横屏（手机才有）和设置。
      // 要收的是**底边那排按钮**，所以收起按钮在下面，不在这儿。
      '<div class="stage-tools">' +
      '<button class="stage-gear w stage-fsbtn" data-act="fullscreen" title="全屏 / 横屏">全屏</button>' +
      '<button class="stage-gear" data-act="modal" data-arg="settings" title="设置">⚙</button>' +
      '</div>' +
      '<div class="bubble" id="nahida-bubble"></div>' +
      '<div class="bubble visitor" id="visitor-bubble"></div>' +
      // 她在家 -> 淡出的提示；她出门了 -> 常驻的回家倒计时（独立元素，不继承提示的淡出动画）
      (s.activeTrip
        ? '<div class="stage-countdown" id="home-countdown" data-act="modal" data-arg="waiting"' +
          ' title="查看旅途详情">' + app.countdownHTML() + '</div>'
        : '<div class="stage-hint">点她一下试试</div>') +
      (app.fieldSheet ? app.viewFieldSheet(app.fieldSheet) : '') +
      '</div>' +
      '</div>' +                       // 收掉 .stage-scroll
      // 「建议横屏」不写在这里 —— 它不参与 render，由 maybeShowRotateHint 单独插
      '<div class="home-controls' + (app.barHidden ? ' bar-hidden' : '') + '">' +
      '<div class="stage-bar">' +
      // 她出门了就把按钮换成"旅途中"，点它打开旅途面板，而不是又送一次
      (s.activeTrip
        ? '<button class="sbtn busy" data-act="modal" data-arg="waiting">旅途中…</button>'
        : '<button class="sbtn go" data-act="modal" data-arg="outdoor">送她出门</button>') +
      '<button class="sbtn' + (ready ? ' hot' : '') + '" data-act="harvest-all">收全部</button>' +
      '<button class="sbtn" data-act="modal" data-arg="kitchen">厨房' + badge(cookable) + '</button>' +
      '<button class="sbtn" data-act="modal" data-arg="toys">玩具' + badge((s.toys || []).length) + '</button>' +
      '<button class="sbtn" data-act="modal" data-arg="store">仓库' + badge(storeCount(s)) + '</button>' +
      '<button class="sbtn" data-act="modal" data-arg="achievements">成就' +
      badge(NT.achievements.count(s)) + '</button>' +
      '<button class="sbtn" data-act="modal" data-arg="chat">聊聊</button>' +
      '<button class="sbtn" data-act="modal" data-arg="album">明信片' + badge((s.album || []).length) + '</button>' +
      '</div>' +
      '</div>' +
      // 收起/展开底边那排按钮。**必须放在 .home-controls 外面**，
      // 否则它自己也跟着收起来，就再也点不开了。
      '<button class="bar-toggle' + (app.barHidden ? ' up' : '') + '" data-act="toggle-bar"' +
        ' title="收起 / 展开下面的菜单">' + (app.barHidden ? '菜单 ▲' : '收起 ▼') + '</button>' +
      app.renderModalLayer() +
      '</div>' +
      '</div>';
  };

  /** 田地就地操作面板（浮在画面里） */
  app.viewFieldSheet = function (fieldId) {
    var s = app.save;
    var now = Date.now();
    var field = NT.data.fieldById(fieldId);
    var st = NT.farm.status(s, fieldId, now);
    var body;
    if (st.state === 'empty') {
      var crops = NT.data.cropsForField(fieldId).map(function (c) {
        return '<button class="chip" data-act="plant" data-arg="' + c.id + '">' + c.name +
          '<small>' + fmtDur(c.growMs) + '</small></button>';
      }).join('');
      body = '<div class="label">种什么？</div><div class="chips">' + crops + '</div>';
    } else {
      body = '<div class="grow">' +
        '<div class="grow-name">' + st.crop.name + '</div>' +
        '<div class="bar"><i style="width:' + Math.round(st.progress * 100) + '%"></i></div>' +
        '<div class="grow-sub">' + (st.state === 'ready' ? '已经熟了' : '还要 ' + U.humanMs(st.remainMs)) + '</div>' +
        (st.state === 'ready' ? '<button class="sbtn go" data-act="harvest" data-arg="' + fieldId + '">收获</button>' : '') +
        '</div>';
    }
    return '<div class="stage-sheet">' +
      '<div class="sheet-head"><b>' + field.name + '</b>' +
      '<button class="sbtn small" data-act="close-field">关闭</button></div>' +
      '<div class="sheet-body">' + body + '</div>' +
      '</div>';
  };

  /** 仓库里一共有多少件东西（食材 + 料理 + 稀有道具） */
  function storeCount(s) {
    var n = 0, k;
    for (k in s.inventory.ingredients) n += s.inventory.ingredients[k];
    for (k in s.inventory.dishes) n += s.inventory.dishes[k];
    for (k in s.inventory.rare) n += s.inventory.rare[k];
    return n;
  }

  /** 仓库：食材 / 料理 / 稀有道具，以及"稀有道具从哪来" */
  app.viewStore = function () {
    var s = app.save;
    var inv = s.inventory;

    /* --- 食材 --- */
    var ingIds = Object.keys(inv.ingredients);
    var ingHtml = ingIds.length
      ? '<div class="pills">' + ingIds.map(function (k) {
          return '<span class="pill">' + NT.data.ingredientName(k) + ' ×' + inv.ingredients[k] + '</span>';
        }).join('') + '</div>'
      : '<div class="muted">还没有食材。去院子里的两块田种点什么。</div>';

    /* --- 料理 --- */
    var dishIds = Object.keys(inv.dishes);
    var dishHtml = dishIds.length
      ? '<div class="pills">' + dishIds.map(function (k) {
          var d = NT.data.dishById(k);
          return '<span class="pill">' + (d ? d.name : k) + ' ×' + inv.dishes[k] + '</span>';
        }).join('') + '</div>'
      : '<div class="muted">还没有做好的食物。去厨房用食材做。</div>';

    /* --- 稀有道具（含来源与效果） --- */
    var dropHtml = NT.data.rareDrops.map(function (r) {
      var own = inv.rare[r.id] || 0;
      return '<div class="drop' + (own ? ' own' : '') + '">' +
        '<div class="drop-head"><b>' + r.name + '</b>' +
        (own ? '<span class="drop-own">持有 ×' + own + '</span>' : '<span class="drop-none">还没有</span>') +
        '</div>' +
        '<div class="drop-desc">' + esc(r.desc) + '</div>' +
        '<div class="drop-eff">出门带上它：行程 +' + r.foodKm + 'km' +
        (r.scoreBonus ? '　稀有度 +' + r.scoreBonus : '') +
        (r.meetBonus ? '　遇同伴 +' + Math.round(r.meetBonus * 100) + '%' : '') +
        '</div>' +
        '<div class="drop-src">获得方式：收获作物时 ' + (r.dropChance * 100).toFixed(1) + '% 几率掉落</div>' +
        '</div>';
    }).join('');

    return '<div class="label" style="margin-top:0">食材</div>' + ingHtml +
      '<div class="label">料理</div>' + dishHtml +
      '<div class="label">稀有道具</div>' +
      '<div class="hint" style="margin:0 0 .7em">' +
      '它们不影响明信片内容，只提高"走多远"和"拿到稀有明信片的概率"。种地收获时随机掉，' +
      '出门时可以带上（最多两件，会消耗掉）。</div>' +
      '<div class="drops">' + dropHtml + '</div>';
  };

  /** 成就 */
  app.viewAchievements = function () {
    var s = app.save;
    var p = NT.achievements.progress(s);
    var all = NT.achievements.list(s);
    var groups = NT.data.achievementGroups.map(function (g) {
      var items = all.filter(function (x) { return x.def.group === g.id; });
      if (!items.length) return '';
      var got = items.filter(function (x) { return x.unlocked; }).length;
      return '<div class="ach-group">' +
        '<div class="ach-group-head"><b>' + g.name + '</b>' +
        '<span>' + got + ' / ' + items.length + '</span></div>' +
        '<div class="achs">' + items.map(function (x) {
          return '<div class="ach' + (x.unlocked ? ' on' : '') + '">' +
            '<span class="ach-icon">' + x.def.icon + '</span>' +
            '<div class="ach-body"><b>' + esc(x.def.name) + '</b>' +
            '<span>' + esc(x.def.desc) + '</span></div>' +
            (x.unlocked ? '<span class="ach-yes">✓</span>' : '') +
            '</div>';
        }).join('') + '</div></div>';
    }).join('');
    return '<div class="ach-total">已解锁 <b>' + p.unlocked + ' / ' + p.total + '</b>' +
      (p.unlocked === p.total ? '　全部达成 🎉' : '') + '</div>' + groups;
  };

  /* ---- 家的实时绘制 ---- */

  app.mountHome = function () {
    var bg = $('world-bg'), fg = $('world-fg'), stage = $('stage');
    if (!bg || !fg || !stage) return;

    // 手机上画面比屏幕宽、靠 .stage-wrap 横向拖。render 会重建 DOM，
    // 滚动位置会被清零 —— 手感就是"怎么滑都滑不过去"。所以位置要跨渲染保住。
    // 注意：mountHome 是在 innerHTML 之后同步跑的，这时还没布局，
    // 直接设 scrollLeft 会被丢掉，所以下一帧再补一次。
    var wrap = document.querySelector('.stage-wrap');
    if (wrap) {
      wrap.onscroll = function () { app._stageScroll = wrap.scrollLeft; };
      var wantX = app._stageScroll || 0;
      if (wantX) {
        wrap.scrollLeft = wantX;
        requestAnimationFrame(function () { wrap.scrollLeft = wantX; });
      }
    }

    // 竖屏提示只在本次会话里尝试一次（它自己按 24 小时判断要不要真显示）
    if (!app._rotateHintTried) { app._rotateHintTried = true; app.maybeShowRotateHint(); }

    // --- 画布按实际显示尺寸渲染，保证清晰；比例全部是相对的，所以尺寸可以随便换 ---
    var rect = stage.getBoundingClientRect();
    var dpr = Math.min(root.devicePixelRatio || 1, 2);
    var W = Math.max(640, Math.round(rect.width * dpr));
    var H = Math.max(360, Math.round(rect.height * dpr));
    if (!rect.width) { W = NT.data.HOME_W; H = NT.data.HOME_H; }
    bg.width = W; bg.height = H;
    fg.width = W; fg.height = H;

    // 浮层字号跟着舞台缩放。
    // 窄屏（手机）要把下限抬到 16px：手机舞台只有 600 上下宽，按宽/62 算出来是 10px，
    // 而徽章、气泡这些浮层都是 .72em / .76em —— 实际只有 7px 左右，根本看不清。
    var cssW = rect.width || NT.data.HOME_W;
    var baseMin = root.innerWidth <= 899 ? 16 : 9;
    stage.style.fontSize = U.clamp(cssW / 62, baseMin, 20).toFixed(2) + 'px';

    // 全屏/横屏按钮上的字要跟着当前状态走（全屏 -> 横屏 -> 退出 循环）
    if (app.syncFsBtn) app.syncFsBtn();

    var s = app.save;
    var now = Date.now();

    // 纳西妲的内容高度。0.22 是照着家里家具的比例定的（约为门高的一半、比桌高一头）
    var chH = H * 0.25;

    // --- 背景层（含田与玩具） ---
    var fields = {};
    ['dry', 'wet'].forEach(function (f) {
      var st = NT.farm.status(s, f, now);
      fields[f] = {
        cropId: st.crop ? st.crop.id : null,
        progress: st.progress,
        ripeColor: st.crop && st.crop.field === 'wet' ? '#d8e0a0' : '#e2b25c'
      };
    });

    // --- 背景层（家的底图 + 玩具） ---
    // 抽成函数是因为：图片是异步加载的，加载完必须重画一次，
    // 否则第一次进游戏看到的永远是代码画的占位图。
    var bctx = bg.getContext('2d');
    var bgEpoch = -1;
    function drawStageBg() {
      bgEpoch = NT.assets ? NT.assets.epoch() : 0;
      var homeImg = NT.assets && NT.assets.home();
      if (!(homeImg && NT.assets.drawCover(bctx, homeImg, W, H))) {
        NT.placeholder.homeWorld(bctx, W, H,
          { seed: NT.rng.hashSeed('home:' + s.homeId), fields: fields });
      }
      // 玩具：尺寸按"相对纳西妲身高的倍数"来（见 data/home.js 的 toySizeRatio）
      (s.home.placed || []).forEach(function (p, i) {
        var slot = NT.data.toySlots[p.slot];
        if (!slot) return;
        var th = chH * NT.data.toySize(p.toyId);
        var okImg = NT.assets && NT.assets.drawToy(bctx, W * slot.x, H * slot.y, th, p.toyId);
        if (!okImg) {
          NT.placeholder.toy(bctx, p.toyId, W * slot.x, H * slot.y, th,
            NT.rng.mulberry32(i + 11));
        }
      });
    }
    drawStageBg();

    // --- 前景层（纳西妲），每帧重画 ---
    var target = NT.home.spot(s);
    if (!app._anim) {
      app._anim = { x: target.x, y: target.y, facing: 1, phase: 0, last: now };
    }
    var anim = app._anim;

    var fctx = fg.getContext('2d');
    var st = NT.home.state(s);
    var sprite = { hair: '#f4f2ea', dress: '#8ec96a', accent: '#f7fbe8', skin: '#ffe2cc', hat: 'leaf' };

    /** 被戳之后的短动画：返回 {rot,sx,sy,dx,dy,flip} */
    function reaction(now2) {
      var r = app._react;
      if (!r.kind || now2 > r.until) return null;
      var p = U.clamp((now2 - r.at) / 1500, 0, 1);
      var e = Math.sin(p * Math.PI);                    // 0→1→0
      var out = { rot: 0, sx: 1, sy: 1, dx: 0, dy: 0, flip: null };
      switch (r.kind) {
        case 'roll':   out.rot = -Math.PI * 2 * (p < 0.5 ? p * 2 * 0.5 : (1 - p) * 2 * 0.5 + 0.5); break;
        case 'bounce': out.dy = -H * 0.035 * Math.abs(Math.sin(p * Math.PI * 3));
                       out.sy = 1 + 0.10 * Math.abs(Math.sin(p * Math.PI * 3));
                       out.sx = 1 - 0.06 * Math.abs(Math.sin(p * Math.PI * 3)); break;
        case 'perk':   out.sy = 1 + 0.06 * e; out.sx = 1 + 0.04 * e; out.dy = -H * 0.008 * e; break;
        case 'lookup': out.dy = -H * 0.008 * e; break;
        case 'wave':   out.rot = Math.sin(p * Math.PI * 5) * 0.09 * e; break;
        case 'stir':   out.dx = W * 0.008 * Math.sin(p * Math.PI * 5); break;
        case 'shy':    out.sx = 1 + 0.07 * e; out.sy = 1 - 0.07 * e; break;
        case 'turn':   out.flip = p > 0.45; out.rot = Math.sin(p * Math.PI) * 0.05; break;
        case 'offer':  out.dx = W * 0.010 * e; out.sy = 1 - 0.03 * e; break;
      }
      return out;
    }

    /** 走路时脚下的小尘土（左右脚各一下） */
    var dust = [];
    function spawnDust(x, y, dir) {
      dust.push({ x: x, y: y, life: 0, max: 0.5, dir: dir });
    }

    function drawNahida(t) {
      // dt 必须夹在 [0, 0.1]：标签页切回来时 rAF 时间戳会跳，负数 dt 会让动画倒退
      var dt = U.clamp((t - anim.last) / 1000, 0, 0.1);
      anim.last = t;

      // 素材是异步加载的：只要有新图加载完就重画一次背景层。
      // 这样"图片加载好了但画面还是占位图"在结构上不可能发生 ——
      // 不依赖 app.render() 被谁调用、也不受 screen / activeTrip 状态影响。
      if (NT.assets && NT.assets.epoch() !== bgEpoch) drawStageBg();

      // 她出门了 —— 家里没人，但**客人还是可能来**，所以循环不能停：
      // 清掉她的图层，只画客人。
      if (s.activeTrip) {
        fctx.clearRect(0, 0, W, H);
        var bubAway = $('nahida-bubble');
        if (bubAway) bubAway.classList.remove('show');
        drawVisitor(t, dt);
        app._raf = requestAnimationFrame(drawNahida);
        return;
      }

      var dx = target.x - anim.x, dy = target.y - anim.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var walking = dist > 0.004;
      if (walking) {
        var speed = 0.11;                        // 每秒走场景宽度的比例
        var step = Math.min(dist, speed * dt);
        anim.x += dx / dist * step;
        anim.y += dy / dist * step;
        if (Math.abs(dx) > 0.001) anim.facing = dx > 0 ? 1 : -1;
        var prevPhase = anim.phase;
        anim.phase += dt * 8.5;
        // 每半个周期（= 一步）扬一次土
        if (Math.floor(anim.phase / Math.PI) !== Math.floor(prevPhase / Math.PI)) {
          spawnDust(W * anim.x, H * anim.y, anim.facing);
        }
      } else {
        anim.x = target.x; anim.y = target.y;
        anim.phase += dt * 1.6;
        dust.length = 0;
      }

      fctx.clearRect(0, 0, W, H);

      var cx = W * anim.x;
      var mood = walking ? 'idle' : st.mood;
      var faceLeft = anim.facing < 0;

      // --- 走路：上下起伏 + 左右轻微摇摆 + 前倾 ---
      var bob = 0, sway = 0, lean = 0, squashX = 1, squashY = 1;
      if (walking) {
        bob = Math.abs(Math.sin(anim.phase)) * chH * 0.045;      // 每步一次起伏
        sway = Math.sin(anim.phase) * chH * 0.012;               // 身体左右晃
        lean = anim.facing * 0.045;                              // 前倾一点点
        squashX = 1 - Math.abs(Math.sin(anim.phase)) * 0.03;
        squashY = 1 + Math.abs(Math.sin(anim.phase)) * 0.03;
      } else {
        bob = Math.sin(anim.phase) * chH * 0.012;                // 站着时的呼吸感
      }
      var feetY = H * anim.y - bob;

      var rx = reaction(t);

      // --- 气泡跟着她走 ---
      var bub = $('nahida-bubble');
      if (bub) {
        var bb = app._bubble;
        if (bb && t < bb.until) {
          if (bub.getAttribute('data-txt') !== bb.text) {
            bub.textContent = bb.text;
            bub.setAttribute('data-txt', bb.text);
          }
          var pxp = cx / W;
          var bside = pxp > 0.56 ? -1 : 1;
          bub.style.left = (pxp * 100).toFixed(3) + '%';
          bub.style.top = (((feetY - chH * 0.98) / H) * 100).toFixed(3) + '%';
          bub.style.transform = bside < 0 ? 'translate(-104%,-100%)' : 'translate(4%,-100%)';
          bub.classList.toggle('left', bside < 0);
          if (!bub.classList.contains('show')) bub.classList.add('show');
        } else if (bub.classList.contains('show')) {
          bub.classList.remove('show');
        }
      }

      // 影子
      fctx.save();
      fctx.globalAlpha = 0.22;
      fctx.fillStyle = '#000';
      fctx.beginPath();
      fctx.ellipse(cx + W * 0.004, H * anim.y + H * 0.004, chH * 0.26, chH * 0.07, 0, 0, Math.PI * 2);
      fctx.fill();
      fctx.restore();

      // 尘土
      if (dust.length) {
        fctx.save();
        for (var di = dust.length - 1; di >= 0; di--) {
          var d = dust[di];
          d.life += dt;
          if (d.life >= d.max) { dust.splice(di, 1); continue; }
          var dp = d.life / d.max;
          fctx.globalAlpha = 0.30 * (1 - dp);
          fctx.fillStyle = '#f0e6d0';
          fctx.beginPath();
          fctx.ellipse(d.x - d.dir * dp * W * 0.020, d.y - dp * H * 0.006,
            W * 0.006 * (1 + dp * 1.6), H * 0.004 * (1 + dp * 1.6), 0, 0, Math.PI * 2);
          fctx.fill();
        }
        fctx.restore();
      }

      fctx.save();
      // 走路：左右摇摆 + 前倾 + 轻微挤压
      if (sway || lean) {
        fctx.translate(cx, feetY);
        if (lean) fctx.rotate(lean);
        fctx.translate(-cx, -feetY);
      }
      if (squashX !== 1 || squashY !== 1) {
        fctx.translate(cx, feetY);
        fctx.scale(squashX, squashY);
        fctx.translate(-cx, -feetY);
      }
      if (rx) {
        fctx.translate(cx + rx.dx, feetY + rx.dy);
        if (rx.rot) fctx.rotate(rx.rot);
        fctx.scale(rx.sx, rx.sy);
        fctx.translate(-cx, -feetY);
        if (rx.flip !== null) faceLeft = rx.flip;
      }
      // 躺着只在"已经走到床上"之后才生效。
      // 走路途中保持站着，否则她会横着飘过去 —— 这是之前的 bug。
      var lying = st.lie && !walking;
      if (lying) {
        fctx.translate(cx, feetY);
        fctx.rotate(-Math.PI / 2 * 0.86);
        fctx.translate(-cx, -feetY);
      }
      var nOk = NT.assets && NT.assets.drawNahida(fctx, cx, feetY, chH, faceLeft,
        lying ? 'tired' : mood);
      if (!nOk) {
        NT.placeholder.chibi(fctx, cx, feetY, chH, sprite, st.lie ? 'tired' : mood, faceLeft);
      }

      // 玩耍时手里的那个玩具。如果她已经站到那件玩具旁边了就不再画（会重复）
      if (st.useToy && !NT.home.atToy(s)) {
        var toy = NT.home.playingToy(s);
        if (toy) {
          var th2 = chH * NT.data.toySize(toy.id) * 0.45;
          if (!(NT.assets && NT.assets.drawToy(fctx, cx + chH * 0.42, feetY, th2, toy.id))) {
            NT.placeholder.toy(fctx, toy.id, cx + chH * 0.42, feetY, th2,
              NT.rng.mulberry32(77));
          }
        }
      }
      fctx.restore();

      // 来访的同伴（画在同一层，但走了自己的一套位置和动画）
      drawVisitor(t, dt);

      app._raf = requestAnimationFrame(drawNahida);
    }

    /**
     * 画来访的同伴。
     * 位置由 home.visitorSpot 给出 —— 那边已经保证了 TA 和主角分在画面两侧。
     */
    function drawVisitor(t, dt) {
      var v = NT.home.visitor(s);
      var vb = $('visitor-bubble');
      if (!v) {
        app._vanim = null;
        if (vb && vb.classList.contains('show')) vb.classList.remove('show');
        return;
      }
      var comp = NT.home.visitorCompanion(s);
      var vst = NT.home.visitorState(s);
      var target = NT.home.visitorSpot(s);
      if (!comp || !vst || !target) return;

      if (!app._vanim) {
        app._vanim = { x: target.x, y: target.y, facing: -1, phase: 0, last: t };
      }
      var va = app._vanim;
      va.last = t;

      var vdx = target.x - va.x, vdy = target.y - va.y;
      var vdist = Math.sqrt(vdx * vdx + vdy * vdy);
      var vwalking = vdist > 0.004;
      if (vwalking) {
        var vstep = Math.min(vdist, 0.11 * (dt || 0.016));
        va.x += vdx / vdist * vstep;
        va.y += vdy / vdist * vstep;
        if (Math.abs(vdx) > 0.001) va.facing = vdx > 0 ? 1 : -1;
        va.phase += (dt || 0.016) * 8.5;
      } else {
        va.x = target.x; va.y = target.y;
        va.phase += (dt || 0.016) * 1.6;
      }

      var vcx = W * va.x;
      var vchH = chH * 0.94;                       // 客人比主人略矮一点点
      var vH = vchH * (0.84 + ((NT.rng.hashSeed(comp.id) % 100) / 100) * 0.22);
      var vbob = vwalking ? Math.abs(Math.sin(va.phase)) * vH * 0.045
                          : Math.sin(va.phase) * vH * 0.012;
      var vfeetY = H * va.y - vbob;
      var vflip = va.facing < 0;

      // 影子
      fctx.save();
      fctx.globalAlpha = 0.20;
      fctx.fillStyle = '#000';
      fctx.beginPath();
      fctx.ellipse(vcx, H * va.y + H * 0.004, vH * 0.24, vH * 0.065, 0, 0, Math.PI * 2);
      fctx.fill();
      fctx.restore();

      // 本体：有真立绘就用真立绘，否则程序化。
      // 注意：访客的活动池里**没有"睡觉"** —— 访客只有一张睁眼立绘、身高还各不相同，
      // 躺下必然违和。所以这里不处理躺姿，也不需要。
      fctx.save();
      if (vwalking) {
        fctx.translate(vcx, vfeetY);
        fctx.rotate(va.facing * 0.04);
        fctx.translate(-vcx, -vfeetY);
      }
      var vOk = NT.assets && NT.assets.drawCompanion(fctx, vcx, vfeetY, vH, vflip, comp.id);
      if (!vOk) {
        NT.placeholder.chibi(fctx, vcx, vfeetY, vH, comp.sprite, vst.mood, vflip);
      }
      fctx.restore();

      // 气泡跟着 TA 走
      if (vb) {
        var vbb = app._vbubble;
        if (vbb && t < vbb.until) {
          if (vb.getAttribute('data-txt') !== vbb.text) {
            vb.textContent = vbb.text;
            vb.setAttribute('data-txt', vbb.text);
          }
          var vpxp = vcx / W;
          var vside = vpxp > 0.62 ? -1 : 1;
          vb.style.left = (vpxp * 100).toFixed(3) + '%';
          vb.style.top = (((vfeetY - vH * 0.98) / H) * 100).toFixed(3) + '%';
          vb.style.transform = vside < 0 ? 'translate(-104%,-100%)' : 'translate(4%,-100%)';
          vb.classList.toggle('left', vside < 0);
          if (!vb.classList.contains('show')) vb.classList.add('show');
        } else if (vb.classList.contains('show')) {
          vb.classList.remove('show');
        }
      }
    }
    // 她换状态时，用气泡开口说一句 —— 她的台词只从气泡出，底部不再重复一行
    var playingNow = NT.home.playingToy(s);
    var stKey = st.id + ':' + s.home.nahida.since + ':' + (playingNow ? playingNow.id : '');
    if (app._lastStateKey !== stKey) {
      app._lastStateKey = stKey;
      var amb = playingNow ? NT.home.toyLine(s, playingNow) : NT.home.stateLine(s);
      // 状态变了就换台词；但如果是"戳她"的反应气泡还没消失，就别打断它
      if (!app._bubble || app._bubble.kind !== 'poke' || now > app._bubble.until) {
        app.setBubble(amb, 7000, 'ambient');
      }
    }

    // ---- 来访同伴：来了 / 换活动 / 走了 ----
    var vNow = NT.home.visitor(s);
    var vKey = vNow ? (vNow.companionId + ':' + vNow.stateId + ':' + vNow.since) : '';
    if (app._lastVisitorKey !== vKey) {
      app._lastVisitorKey = vKey;
      if (vNow) {
        var vTag = vNow.companionId + ':' + vNow.arrivedAt;
        if (app._vSeen !== vTag) {
          app._vSeen = vTag;                     // 刚到，说一句"打扰了"
          app.setVBubble(NT.home.visitorArriveLine(s), 7000, 'ambient');
        } else {
          app.setVBubble(NT.home.visitorLine(s), 7000, 'ambient');
        }
      }
    }
    // 走的时候用 toast 提示，因为气泡是挂在人身上的，人走了气泡也没了
    if (app._vWasHere && !vNow) {
      var lastComp = NT.data.companionById((s.home.lastVisitor || {}).companionId) ||
        { name: '客人' };
      app.toast(lastComp.name + '走了：' + NT.home.visitorLeaveLine(s));
    }
    app._vWasHere = !!vNow;
    if (vNow) s.home.lastVisitor = { companionId: vNow.companionId };

    // ---- 打招呼：主角在发呆、家里有客人，就聊一句（一次来访只触发一次）----
    var greet = NT.home.visitorGreeting(s);
    if (greet) {
      app.setBubble(greet.nahida, 7000, 'ambient');
      var gLine = greet.visitor;
      setTimeout(function () { app.setVBubble(gLine, 7000, 'ambient'); }, 1900);
      NT.store.save(s);
    }

    // 动画循环一直跑（她出门时也要画来访的客人）
    app._raf = requestAnimationFrame(drawNahida);

    // --- 点击：先判田，再判她 ---
    stage.onclick = function (ev) {
      var r = stage.getBoundingClientRect();
      var nx = (ev.clientX - r.left) / r.width;
      var ny = (ev.clientY - r.top) / r.height;

      if (app.fieldSheet) { app.fieldSheet = null; app.render(); return; }  // 面板开着就先关

      // 点击区域按家-全景.png 里那四小块田的实际位置量出来的
      // （上面两块 = 旱田，下面两块 = 水田）
      var fdefs = [
        { id: 'dry', x0: 0.468, x1: 0.652, y0: 0.536, y1: 0.642 },
        { id: 'wet', x0: 0.462, x1: 0.672, y0: 0.650, y1: 0.762 }
      ];
      for (var i = 0; i < fdefs.length; i++) {
        var f = fdefs[i];
        if (nx >= f.x0 && nx <= f.x1 && ny >= f.y0 && ny <= f.y1) {
          app.fieldSheet = f.id; app.render(); return;
        }
      }
      var dxn = nx - anim.x, dyn = ny - anim.y;
      if (Math.sqrt(dxn * dxn + dyn * dyn) < 0.10) app.poke();
    };
  };

  /* ---------------- 厨房 ---------------- */

  app.viewKitchen = function () {
    var s = app.save, inv = s.inventory.ingredients;
    var list = NT.data.dishes.filter(function (d) { return d.id !== 'none'; });
    var cards = list.map(function (d) {
      var can = NT.data.canCook(d, inv);
      var need = Object.keys(d.need).map(function (k) {
        var have = inv[k] || 0, want = d.need[k];
        return '<span class="' + (have >= want ? 'ok' : 'lack') + '">' +
          NT.data.ingredientName(k) + ' ' + have + '/' + want + '</span>';
      }).join(' ');
      var have = s.inventory.dishes[d.id] || 0;
      return '<div class="dish' + (can ? ' can' : '') + '">' +
        '<div class="dish-head"><b>' + d.name + '</b>' +
        (have ? '<span class="own">已有 ' + have + '</span>' : '') + '</div>' +
        '<div class="dish-desc">' + esc(d.desc) + '</div>' +
        '<div class="dish-need">' + need + '</div>' +
        '<div class="dish-eff">能走 ' + d.foodKm + ' 公里　·　' + effectText(d.effect) + '</div>' +
        '<button class="btn-ghost" data-act="cook" data-arg="' + d.id + '"' + (can ? '' : ' disabled') + '>' +
        (can ? '做一份' : '食材不够') + '</button></div>';
    }).join('');
    return app.header('厨房', 'home') + '<div class="pad"><div class="dishes">' + cards + '</div></div>';
  };

  function effectText(e) {
    var out = [];
    if (e.scoreBonus) out.push('稀有度 +' + e.scoreBonus);
    if (e.meetBonus) out.push('遇到同伴 +' + Math.round(e.meetBonus * 100) + '%');
    if (e.luck) out.push('好运');
    if (e.weatherBias) out.push('偏好' + e.weatherBias.map(function (w) {
      var x = NT.data.weatherById(w); return x ? x.name : w;
    }).join('/'));
    return out.length ? out.join(' · ') : '没有额外效果';
  }

  /* ---------------- 玩具 ---------------- */

  app.viewToys = function () {
    var s = app.save;
    var owned = s.toys || [];
    var slots = NT.data.toySlots || [];
    var placedCount = (s.home.placed || []).length;
    // 按 place 分别统计空位（现在内置玩具全是室外的，但规则保留着）
    var places = ['indoor', 'outdoor'];
    var free = {};
    places.forEach(function (pl) {
      var total = slots.filter(function (x) { return x.place === pl; }).length;
      var used = (s.home.placed || []).filter(function (p) {
        return NT.data.toySlots[p.slot] && NT.data.toySlots[p.slot].place === pl;
      }).length;
      free[pl] = total - used;
    });
    var isFull = placedCount >= slots.length;

    var head = '<div class="cap-bar">' +
      '<span>摆放位置 <b>' + placedCount + ' / ' + slots.length + '</b>　都在右边的院子里</span>' +
      (isFull ? '<span class="cap-full">满了，要摆新的得先收回一件</span>' : '') +
      '</div>';

    if (!owned.length) {
      return app.header('玩具箱', 'home') + head +
        '<div class="pad empty">还没有玩具。<br>她旅行回来的时候，偶尔会带一个。</div>';
    }

    var cards = owned.map(function (id) {
      var t = NT.data.toyById(id);
      if (!t) return '';
      var placed = NT.home.isPlaced(s, id);
      var left = free[t.place] || 0;
      var blocked = !placed && left <= 0;
      var act;
      if (placed) {
        act = '<button class="btn-ghost" data-act="take-toy" data-arg="' + id + '">收回</button>';
      } else if (blocked) {
        act = '<button class="btn-ghost" disabled>没空位了</button>';
      } else {
        act = '<button class="btn-ghost" data-act="place-toy" data-arg="' + id + '">摆出来</button>';
      }
      return '<div class="toy' + (blocked ? ' toy-blocked' : '') + '">' +
        '<div class="toy-canvas" data-toy="' + id + '"></div>' +
        '<div class="toy-body"><b>' + t.name + '</b>' +
        '<span class="toy-desc">' + esc(t.desc) + '</span>' +
        '<span class="toy-line">「' + esc(t.playLines[0]) + '」</span>' +
        (placed ? '<span class="toy-on">已摆出来</span>'
                : '<span class="muted small">' +
                  (blocked ? '没空位了' : '还有 ' + left + ' 个位置') + '</span>') +
        '</div>' +
        '<div class="toy-act">' + act + '</div></div>';
    }).join('');

    return app.header('玩具箱', 'home') + head +
      '<div class="pad"><div class="hint" style="margin:0 0 12px">' +
      '玩具都摆在右边的院子里。摆好的玩具会出现在家里，她玩耍时会走过去玩。' +
      '位置有限，<b>最多同时摆 ' + slots.length + ' 件</b>。' +
      '</div>' + cards + '</div>';
  };

  app.mountToys = function (retried) {
    var slots = document.querySelectorAll('[data-toy]');
    var anyMissing = false;
    for (var i = 0; i < slots.length; i++) {
      var id = slots[i].getAttribute('data-toy');
      var c = document.createElement('canvas');
      c.width = 160; c.height = 140;
      var tctx = c.getContext('2d');
      // 有真素材就用真的 —— 和摆在家里看到的同一张图。
      // 以前这里无条件调 placeholder.toy，所以玩具箱里全是代码画的图标。
      if (!(NT.assets && NT.assets.drawToy(tctx, 80, 118, 96, id))) {
        NT.placeholder.toy(tctx, id, 80, 118, 96, NT.rng.mulberry32(i + 3));
        anyMissing = true;
      }
      c.style.width = '100%'; c.style.height = 'auto';
      slots[i].innerHTML = '';      // 重画时先清掉旧的，免得叠加
      slots[i].appendChild(c);
    }
    if (anyMissing && !retried && NT.assets && NT.assets.onSettled) {
      NT.assets.onSettled(function () { app.mountToys(true); });
    }
  };

  /* ---------------- 交流 ---------------- */

  /**
   * 聊天面板顶上那张插图：**家里的真实画面**（背景 + 摆出来的玩具 + 她本人）。
   *
   * 以前这里是无条件调 NT.placeholder.homeWorld / chibi 的 ——
   * 所以不管素材装没装，看到的永远是代码画的占位图。
   * 现在和主舞台一个规矩：有真素材就用真的，缺哪张才用占位图补哪张。
   *
   * 素材是异步加载的，第一次画很可能还没加载完，所以没画到真图时
   * 等 onSettled 再补画一次（retried 防止加载失败时无限递归）。
   */
  function drawChatArt(el, s, st, retried) {
    var W = 1280, H = 720, chH = H * 0.25;   // 和主舞台同一个比例
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    var A = NT.assets;

    var fields = {};
    ['dry', 'wet'].forEach(function (f) {
      var sst = NT.farm.status(s, f, Date.now());
      fields[f] = { cropId: sst.crop ? sst.crop.id : null, progress: sst.progress, ripeColor: '#e2b25c' };
    });

    var homeImg = A && A.home();
    var bgOk = !!(homeImg && A.drawCover(ctx, homeImg, W, H));
    if (!bgOk) NT.placeholder.homeWorld(ctx, W, H, { seed: 4242, fields: fields });

    // 摆出来的玩具，和家里看到的一致
    (s.home.placed || []).forEach(function (p, i) {
      var slot = NT.data.toySlots[p.slot];
      if (!slot) return;
      var th = chH * NT.data.toySize(p.toyId);
      if (!(A && A.drawToy(ctx, W * slot.x, H * slot.y, th, p.toyId))) {
        NT.placeholder.toy(ctx, p.toyId, W * slot.x, H * slot.y, th, NT.rng.mulberry32(i + 11));
      }
    });

    // 她本人：画在她此刻站的地方
    var spot = NT.home.spot(s);
    var sprite = { hair: '#f4f2ea', dress: '#8ec96a', accent: '#f7fbe8', skin: '#ffe2cc', hat: 'leaf' };
    var mood = st.lie ? 'tired' : st.mood;
    if (!(A && A.drawNahida(ctx, W * spot.x, H * spot.y, chH, false, mood))) {
      NT.placeholder.chibi(ctx, W * spot.x, H * spot.y, chH, sprite, mood, false);
    }

    c.style.width = '100%'; c.style.height = 'auto'; c.style.borderRadius = '12px';
    el.innerHTML = ''; el.appendChild(c);

    if (!bgOk && !retried && A && A.onSettled) {
      A.onSettled(function () { drawChatArt(el, s, st, true); });
    }
  }

  app.viewChat = function () {
    var s = app.save;
    var aiOn = !!(s.settings.aiEnabled && s.settings.apiKey);
    if (!app.chatTopic) {
      var topics = NT.data.chatTopics.map(function (t) {
        return '<button class="topic" data-act="topic" data-arg="' + t.id + '">' + t.label + '</button>';
      }).join('');
      return app.header('和纳西妲说说话', 'home') +
        '<div class="pad">' +
        '<div class="chat-stage" id="chat-stage"></div>' +
        '<div class="say-bubble">' + esc(NT.home.hello(s, s.home.nahida.since)) + '</div>' +
        '<div class="label">聊点什么</div><div class="topics">' + topics + '</div>' +
        '<div class="hint">' + (aiOn
          ? '已接入 AI —— 她会按自己的人设回应你，也会记得刚才聊了什么。'
          : '现在是预设对话。在设置里接入 API 之后，她会由 AI 扮演，回应跟着内容走。') +
        '</div></div>';
    }
    var aiOn2 = !!(s.settings.aiEnabled && s.settings.apiKey);
    var topic = NT.home.topicById(app.chatTopic);
    var log = app.chatLog.map(function (m) {
      return '<div class="msg ' + (m.me ? 'me' : 'her') + '">' + esc(m.text) +
        (!m.me && m.source === 'ai' ? '<span class="ai-tag">AI</span>' : '') + '</div>';
    }).join('');
    var pending = app.chatPending ? '<div class="msg her pending">……</div>' : '';
    var opts = topic.options.map(function (o, i) {
      return '<button class="say-opt" data-act="say" data-arg="' + i + '">' + esc(o.text) + '</button>';
    }).join('');
    return app.header(topic.label, 'home') +
      '<div class="pad">' +
      '<div class="chat-log" id="chat-log">' + log + pending + '</div>' +
      '<div class="label">你要说</div><div class="say-opts">' + opts + '</div>' +
      (aiOn2
        ? '<div class="free-row"><input class="input" id="chat-input" maxlength="60" ' +
          'placeholder="或者自己打一句，回车发送"><button class="sbtn go" data-act="send-free">说</button></div>'
        : '') +
      '<button class="btn-ghost" style="margin-top:14px" data-act="chat-back">换个话题</button></div>';
  };

  app.mountChat = function () {
    var el = $('chat-stage');
    var s = app.save, st = NT.home.state(s);
    if (el) drawChatArt(el, s, st, false);
    var log = $('chat-log');
    if (log) log.scrollTop = log.scrollHeight;
    var inp = $('chat-input');
    if (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); app.action('send-free'); }
      });
      if (app.chatLog.length) inp.focus();
    }
  };

  /* ---------------- 出门 ---------------- */

  app.viewOutdoor = function () {
    var s = app.save;
    var homeName = NT.data.homeName(s.homeId);
    var modes = NT.data.travelModes.map(function (m) {
      return '<button class="chip' + (app.outMode === m.id ? ' on' : '') +
        '" data-act="out-mode" data-arg="' + m.id + '">' + m.name + '<small>' + m.desc + '</small></button>';
    }).join('');

    var detail = '';
    if (app.outMode === 'region') {
      detail = '<div class="label">去哪个地区</div><div class="chips regions">' +
        NT.data.destinations.filter(function (d) { return d.id !== s.homeId; }).map(function (d) {
          var cost = NT.data.travelCost(s.homeId, d.id);
          var tier = NT.data.distanceTier(cost);
          return '<button class="chip' + (app.outRegion === d.id ? ' on' : '') +
            '" data-act="out-region" data-arg="' + d.id + '">' + d.name +
            '<small>' + tier.name + ' · ' + cost + 'km</small></button>';
        }).join('') + '</div>';
    } else if (app.outMode === 'bearing') {
      detail = '<div class="label">往哪边走</div><div class="chips">' +
        C.directions.map(function (d) {
          return '<button class="chip' + (app.outBearing === d.id ? ' on' : '') +
            '" data-act="out-bearing" data-arg="' + d.id + '">' + d.name +
            '<small>' + d.desc + '</small></button>';
        }).join('') + '</div>' +
        '<div class="hint" style="margin-top:10px">方向只决定她一开始往哪走。路上可能被同伴邀请、看到宣传画而改道。</div>';
    } else {
      detail = '<div class="hint" style="margin-top:16px">不指定方向和地方，走到哪算哪。</div>';
    }

    var dishIds = ['none'].concat(Object.keys(s.inventory.dishes));
    var dishes = dishIds.map(function (id) {
      var d = NT.data.dishById(id);
      var have = id === 'none' ? '∞' : ('×' + s.inventory.dishes[id]);
      return '<button class="chip' + (app.outDish === id ? ' on' : '') +
        '" data-act="out-dish" data-arg="' + id + '">' + d.name +
        '<small>' + have + ' · 能走 ' + d.foodKm + 'km</small></button>';
    }).join('');

    var rareIds = Object.keys(s.inventory.rare);
    var rares = rareIds.length
      ? rareIds.map(function (id) {
        var r = NT.data.rareDropById(id);
        return '<button class="chip' + (app.outRares.indexOf(id) >= 0 ? ' on' : '') +
          '" data-act="out-rare" data-arg="' + id + '">' + r.name +
          '<small>×' + s.inventory.rare[id] + ' · +' + r.foodKm + 'km</small></button>';
      }).join('')
      : '<span class="muted">还没有稀有道具。它们是<b>收获作物时随机掉落</b>的，' +
        '先去院子里的田种点东西。「仓库」里能看到详细的掉落和效果。</span>';

    var totalKm = NT.data.dishById(app.outDish).foodKm;
    app.outRares.forEach(function (id) { totalKm += NT.data.rareDropById(id).foodKm; });

    return app.header('出门', 'home') + '<div class="pad">' +
      '<div class="hint" style="margin:0 0 14px">家乡：<b>' + esc(homeName) + '</b>　' +
      '这次能走 <b>' + totalKm + '</b> 公里（' + NT.data.distanceTier(totalKm).name + '）</div>' +
      '<div class="label">怎么走</div><div class="chips">' + modes + '</div>' + detail +
      '<div class="label">带什么吃的</div><div class="chips">' + dishes + '</div>' +
      '<div class="label">带上道具（最多两件）</div><div class="chips">' + rares + '</div>' +
      '<button class="btn btn-primary" style="margin-top:20px" data-act="depart">出发</button>' +
      '<div class="hint">食物决定她能走多远。不够就会半路折返；路上也可能遇到补给或意外。' +
      '最长 48 小时一定回家。</div></div>';
  };

  /* ---------------- 等待 ---------------- */

  /**
   * 画面顶部那条常驻状态条。
   *   · 她在家   -> "点她一下试试"
   *   · 她出门了 -> 回家倒计时，点一下能重新打开旅途面板
   */
  app.countdownHTML = function () {
    var t = app.save && app.save.activeTrip;
    if (!t) return '点她一下试试';
    var remain = NT.clock.remaining(t, Date.now());
    return '<span class="cd-dot"></span>她还有 <b>' + U.humanMs(remain) + '</b> 回来' +
      '<span class="cd-eta">约 ' + U.clockTime(t.dueAt) + '</span>' +
      '<span class="cd-more">查看旅途 ›</span>';
  };

  app.viewWaiting = function () {
    var t = app.save.activeTrip;
    if (!t) { app.screen = 'home'; app.modal = null; return app.viewHome(); }
    var now = Date.now();
    var remain = NT.clock.remaining(t, now);
    var res = NT.trip.resolve(t);
    var revealed = NT.journey.revealedSteps(t, now);

    var log = revealed.length
      ? revealed.map(function (s) {
        return '<div class="step' + (s.kind ? ' k-' + s.kind : '') + '">' +
          '<span class="step-name">' + esc(s.name) + '</span>' +
          '<span class="step-text">' + esc(s.text) + '</span></div>';
      }).join('')
      : '<div class="muted small">还没有消息。</div>';

    // 明确给出"还要多久 / 大概几点回来" —— 这样关掉网页去干别的也心里有数
    var eta = U.clockTime(t.dueAt);
    var sameDay = new Date(t.dueAt).toDateString() === new Date(now).toDateString();

    return app.header('旅途中') + '<div class="pad waiting">' +
      '<div class="wait-art" id="wait-art"></div>' +
      '<div class="wait-eta">' +
      '<div class="wait-eta-main">还要 <b>' + U.humanMs(remain) + '</b></div>' +
      '<div class="wait-eta-sub">' + (sameDay ? '大约今天 ' : '大约明天 ') + esc(eta) +
      ' 回来　·　关掉网页也算数，到点回来看就好</div>' +
      '</div>' +
      '<div class="wait-status">' + U.vagueWait(remain, t.durationMs) + '</div>' +
      '<div class="wait-detail">带的 ' + esc(t.dishName) + ' · 能走 ' + t.journey.budgetKm + ' 公里　' +
      '目标 ' + esc(res.target ? res.target.name : '') + '（' + t.journey.costKm + 'km）</div>' +
      '<div class="label" style="text-align:left">路上（已经发生的）</div>' +
      '<div class="steps">' + log + '</div>' +
      '<div class="btn-row">' +
      '<button class="btn-ghost" data-act="close-modal">回家里等</button>' +
      '<button class="btn-ghost" data-act="modal" data-arg="album">明信片册</button>' +
      '</div></div>';
  };

  app.mountWaiting = function (retried) {
    var el = $('wait-art'); if (!el) return;
    var t = app.save.activeTrip; if (!t) return;
    var res = NT.trip.resolve(t);
    var c = document.createElement('canvas');
    c.width = 480; c.height = 270;
    var ctx = c.getContext('2d');
    // 这个地区有真背景图就用真的 —— 以前无条件画占位图，所以旅途中看到的是假风景
    var A = NT.assets;
    var bgImg = A && A.bg(res.destination ? res.destination.id : null);
    var ok = !!(bgImg && A.drawCover(ctx, bgImg, 480, 270));
    if (!ok) {
      NT.placeholder.background(ctx, 480, 270, res.destination, res.timeOfDay, res.weather, t.seed ^ 0x1234);
    }
    NT.effects.tint(c, res.timeOfDay ? res.timeOfDay.tint : null);
    c.style.width = '100%'; c.style.height = 'auto'; c.style.borderRadius = '12px';
    el.innerHTML = ''; el.appendChild(c);
    if (!ok && !retried && A && A.onSettled) {
      A.onSettled(function () { app.mountWaiting(true); });
    }
  };

  /* ---------------- 结果 ---------------- */

  app.viewResult = function () {
    var t = app.viewing;
    if (!t) { app.screen = 'home'; return app.viewHome(); }
    var res = NT.trip.resolve(t);
    var rar = C.rarity[t.rarity] || C.rarity.N;
    var j = t.journey || {};
    var note = app._pendingNote ? '<div class="note">' + esc(app._pendingNote) + '</div>' : '';
    app._pendingNote = null;

    var outcome = j.soaked ? '落汤鸡'
      : (!j.reached ? '半路折返' : (j.redirected ? '中途改道' : '到达'));

    var steps = (j.steps || []).map(function (s) {
      return '<div class="step k-' + (s.kind || 'none') + '">' +
        '<span class="step-name">' + esc(s.name) + '</span>' +
        '<span class="step-text">' + esc(s.text) + '</span>' +
        (s.delta ? '<span class="step-delta">' + (s.delta > 0 ? '+' : '') + s.delta + 'km</span>' : '') +
        '</div>';
    }).join('');

    var toyHtml = res.toy
      ? '<div class="toy-gain">带回了一个 <b>' + res.toy.name + '</b>　「' + esc(res.toy.playLines[0]) + '」</div>' : '';
    var rareHtml = (t.rareItemNames && t.rareItemNames.length)
      ? '<div class="used">用掉了：' + t.rareItemNames.join('、') + '</div>' : '';

    return app.header('明信片到了') + note +
      '<div class="pad result">' +
      '<div class="card-wrap"><canvas id="postcard-canvas"></canvas></div>' +
      '<div class="meta">' +
      '<span class="rarity" style="--c:' + rar.color + '">' + rar.label + '</span>' +
      '<span class="outcome o-' + (j.soaked ? 'bad' : j.reached ? 'ok' : 'warn') + '">' + outcome + '</span>' +
      '<span class="dest">' + esc(res.destination ? res.destination.fullName : '') + '</span>' +
      '</div>' +
      '<div class="journey-stat">走了 ' + (j.traveledKm || 0) + ' km / 预算 ' + (j.budgetKm || 0) +
      ' km　·　' + (t.durationMs / 3600e3).toFixed(1) + ' 小时</div>' +
      toyHtml + rareHtml +
      '<div class="diary" id="diary-text">' + esc(t.text.diary) + '</div>' +
      '<div class="src" id="text-src"></div>' +
      '<div class="companion">' + (res.companion
        ? '同行：<b>' + res.companion.name + '</b>　「' + esc(res.companion.catchphrases[0] || '') + '」'
        : '独自一人') + '</div>' +
      '<div class="label" style="text-align:left">旅途日志</div>' +
      '<div class="steps">' + (steps || '<div class="muted small">这次没走远。</div>') + '</div>' +
      '<div class="label" style="text-align:left">明信片内容</div>' +
      '<div class="events">' + res.events.map(function (e) {
        return '<div class="event"><span class="ev-cat">' + (e.categoryLabel || '') + '</span>' +
          '<span class="ev-name">' + esc(e.name) + '</span>' +
          '<span class="ev-desc">' + esc(e.desc) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="btn-row">' +
      '<button class="btn btn-primary" data-act="close-modal">继续</button>' +
      '<button class="btn-ghost" data-act="modal" data-arg="album">明信片册</button>' +
      '</div></div>';
  };

  app.mountResult = function () {
    var t = app.viewing;
    // 明信片到家的音效（同一张只响一次）
    if (t && app._arriveFor !== t.id) {
      app._arriveFor = t.id;
      NT.sfx.play('arrive');
    }
    var canvas = $('postcard-canvas');
    if (canvas) {
      var dpr = Math.min(root.devicePixelRatio || 1, 3);
      // 明信片尽量画大一点：屏幕越宽给得越大，最多 620 CSS 像素宽
      var stageW = (($('stage') || {}).clientWidth) || window.innerWidth;
      var cap = Math.max(360, Math.min(620, Math.round(stageW * 0.66)));
      var maxW = Math.min(window.innerWidth - 48, cap);
      var cssH = Math.round(C.POSTCARD_H * (maxW / C.POSTCARD_W));

      // 画布分辨率 = 显示尺寸 × 设备像素比 × 超采样系数。
      // 多渲染 20% 再让浏览器缩小，边缘会更干净（相当于抗锯齿超采样）。
      var SS = 1.2;
      var pxW = Math.round(maxW * dpr * SS);
      canvas.style.width = maxW + 'px';
      canvas.style.height = cssH + 'px';
      var rendered = NT.postcard.render(t, { scale: pxW / C.POSTCARD_W });
      canvas.width = rendered.width;
      canvas.height = rendered.height;
      var pctx = canvas.getContext('2d');
      pctx.imageSmoothingEnabled = true;
      pctx.imageSmoothingQuality = 'high';
      pctx.drawImage(rendered, 0, 0);
    }
    var srcEl = $('text-src');
    if (srcEl) {
      srcEl.textContent = t.text.source === 'deepseek' ? '文案：AI 生成' : '文案：本地模板';
      srcEl.className = 'src ' + (t.text.source === 'deepseek' ? 'src-ai' : '');
    }
    var st = app.save.settings;
    if (st.aiEnabled && st.apiKey && t.text.source !== 'deepseek') {
      var diaryEl = $('diary-text'); if (!diaryEl) return;
      diaryEl.classList.add('loading');
      NT.text.ai.render(t, st, t.text).then(function (out) {
        t.text = { source: out.source, diary: out.diary, postcardBack: out.postcardBack };
        NT.store.save(app.save);
        if (diaryEl && app.viewing === t) {
          diaryEl.textContent = out.diary;
          diaryEl.classList.remove('loading');
          var s2 = $('text-src');
          if (s2) {
            s2.textContent = out.source === 'deepseek' ? '文案：AI 生成'
              : '文案：本地模板' + (out.error ? '（AI 失败，已回退）' : '');
            s2.className = 'src ' + (out.source === 'deepseek' ? 'src-ai' : '');
          }
          var cv = $('postcard-canvas');
          if (cv) {
            var r2 = NT.postcard.render(t, { scale: Math.max(0.35, cv.width / C.POSTCARD_W) });
            cv.getContext('2d').drawImage(r2, 0, 0);
          }
        }
      });
    }
  };

  /* ---------------- 明信片册 ---------------- */

  app.viewAlbum = function () {
    var list = (app.save.album || []).slice().reverse();
    if (!list.length) {
      return app.header('明信片册', 'home') + '<div class="pad empty">还没有明信片。<br>先送她出门吧。</div>';
    }
    return app.header('明信片册 (' + list.length + ')', 'home') +
      '<div class="pad"><div class="album" id="album-grid">' +
      list.map(function (t) {
        var rar = C.rarity[t.rarity] || C.rarity.N;
        var d = NT.data.destinationById(t.destinationId);
        var j = t.journey || {};
        return '<button class="album-item" data-act="view" data-arg="' + t.id + '">' +
          '<span class="album-thumb"></span>' +
          '<span class="album-rarity" style="--c:' + rar.color + '">' + rar.label + '</span>' +
          '<span class="album-name">' + esc(d ? d.name : '') +
          (j.soaked ? ' · 落水' : (!j.reached ? ' · 折返' : '')) + '</span></button>';
      }).join('') + '</div></div>';
  };

  app.mountAlbum = function () {
    var slots = document.querySelectorAll('.album-thumb');
    if (!slots.length) return;
    var list = (app.save.album || []).slice().reverse();
    var dpr = Math.min(root.devicePixelRatio || 1, 2);
    // 缩略图也要按设备像素比渲染，不然高分屏上会糊
    var thumbScale = U.clamp(0.13 * dpr, 0.13, 0.26);
    var i = 0;
    function step() {
      var t0 = Date.now();
      while (i < slots.length && Date.now() - t0 < 14) {
        var el = slots[i], fact = list[i]; i++;
        if (!fact) continue;
        try {
          var c = NT.postcard.render(fact, { scale: thumbScale, forThumbnail: true });
          c.style.width = '100%'; c.style.height = 'auto'; c.style.display = 'block';
          el.innerHTML = ''; el.appendChild(c);
        } catch (e) { }
      }
      if (i < slots.length) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  /* ---------------- 设置 ---------------- */

  app.viewSettings = function () {
    var st = app.save.settings;
    var sizeKb = (NT.store.sizeOf(app.save) / 1024).toFixed(1);
    var homes = NT.data.homeCities().map(function (d) {
      return '<option value="' + d.id + '"' + (app.save.homeId === d.id ? ' selected' : '') + '>' + d.name + '</option>';
    }).join('');
    return app.header('设置', 'home') + '<div class="pad">' +
      '<div class="group"><div class="label">家乡</div>' +
      '<div class="hint">决定"走多远"和方向。换家乡会改变所有行程距离。</div>' +
      '<select class="input" id="home-select">' + homes + '</select>' +
      '<button class="btn-ghost" data-act="auto-locate" style="width:100%">自动定位</button>' +
      '<div class="test-result" id="locate-result"></div></div>' +
      '<div class="group"><div class="label">音效</div>' +
      '<div class="hint">音效是用 Web Audio 现场合成的，不需要任何音频素材文件。</div>' +
      '<label class="switch"><input type="checkbox" id="sound-enabled"' +
      (st.sound !== false ? ' checked' : '') + '><span>开启音效</span></label></div>' +
      '<div class="group"><div class="label">来访同伴</div>' +
      '<div class="hint">同伴会自己跑来家里待一会儿。她在家的日子会来，' +
      '她出门旅行的时候也可能来。最多同时 1 位。</div>' +
      '<div class="label" style="margin-top:.7em">每次待多久</div>' +
      '<select class="input" id="visitor-stay">' +
      Object.keys(NT.config.VISIT_STAY).map(function (k) {
        return '<option value="' + k + '"' +
          ((st.visitorStay || 'normal') === k ? ' selected' : '') + '>' +
          esc(NT.config.VISIT_STAY[k].label) + '</option>';
      }).join('') +
      '</select></div>' +
      '<div class="group"><div class="label">图片素材</div>' +
      '<div class="hint">素材用的是通用文件名（主角-*、场景-*、配角-*），' +
      '换成别的角色或地图只要替换图片，不用改代码。' +
      '标准和尺寸见「图片素材」文件夹里的 素材标准.txt。' +
      '没做的会继续用代码画的占位图。</div>' +
      (function () {
        var a = NT.assets.status();
        var names = NT.assets.loadedNames();
        return '<div class="asset-stat">已加载 <b>' + a.ready + ' / ' + a.total + '</b>' +
          (a.ready === 0 ? '　（全部还是占位图）' : '') + '</div>' +
          (names.length ? '<div class="asset-names">已生效：' + esc(names.join('、')) + '</div>' : '');
      })() +
      '</div>' +
      // 素材体检：只在真的对不上时才出现，正常玩家看不到
      (function () {
        if (!NT.assets.syncFromManifest) return '';
        var rep;
        try { rep = NT.assets.syncFromManifest(); } catch (e) { return ''; }
        var lines = [];
        if (rep.addedCompanions && rep.addedCompanions.length) {
          lines.push('配角清单里多出来的（已自动收录，会正常出现）：' +
            rep.addedCompanions.join('、'));
        }
        if (rep.orphanDestinations && rep.orphanDestinations.length) {
          lines.push('有图、但还没在 destinations.js 里定义的地区：' +
            rep.orphanDestinations.map(function (x) { return x.name; }).join('、') +
            '（这些不会出现在旅行目的地里）');
        }
        if (rep.missingImages && rep.missingImages.length) {
          lines.push('还没配图的：' + rep.missingImages.join('、') + '（这些会用代码画的占位图）');
        }
        if (rep.noGeo && rep.noGeo.length) {
          lines.push('缺坐标的：' + rep.noGeo.join('、') +
            '（在 destinations.js 里给它们写上 lat / lng 才会算对距离）');
        }
        if (!lines.length) return '';
        return '<div class="group"><div class="label">素材体检</div>' +
          lines.map(function (t) {
            return '<div class="hint warn-line">· ' + esc(t) + '</div>';
          }).join('') + '</div>';
      })() +
      '<div class="group"><div class="label">AI 文案（可选）</div>' +
      '<div class="hint">不填也能玩。Key 只保存在你自己的浏览器里，不会上传到任何服务器。</div>' +
      '<label class="switch"><input type="checkbox" id="ai-enabled"' + (st.aiEnabled ? ' checked' : '') + '>' +
      '<span>启用 AI 文案</span></label>' +
      '<input class="input" id="api-key" type="password" placeholder="DeepSeek API Key (sk-...)" value="' +
      esc(st.apiKey) + '">' +
      '<div class="row"><button class="btn-ghost" data-act="test-api">测试连接</button>' +
      '<button class="btn btn-primary" data-act="save-settings">保存</button></div>' +
      '<div class="test-result" id="api-test-result"></div></div>' +
      '<div class="group"><div class="label">数据</div>' +
      '<div class="hint">明信片 ' + app.save.album.length + ' 张 · 玩具 ' + (app.save.toys || []).length +
      ' 件 · 存档 ' + sizeKb + ' KB' +
      (NT.store.isMemoryOnly() ? '<br>浏览器不允许本地存储，本次进度不会被保存' : '') + '</div>' +
      '<div class="row"><button class="btn-ghost" data-act="export">导出存档</button>' +
      '<button class="btn-ghost danger" data-act="reset">清空全部</button></div></div>' +
      '<div class="group about"><div class="label">关于</div>' +
      '<div class="hint">非商业同人作品。角色来自《原神》，版权归米哈游所有。' +
      '本项目仅供学习交流，不作任何商业用途。</div></div></div>';
  };

  /* ---------------- 试玩注入 ---------------- */

  app.demoSeed = function () {
    var s = app.save;
    s.homeChosen = true;
    s.inventory.ingredients = { potato: 4, wheat: 3, soybean: 5, rice: 6, lotus: 2, waterchestnut: 3, corn: 2, tomato: 2, wildrice: 1, watercaltrop: 1 };
    s.inventory.dishes = { riceball: 2, potatocake: 1, lotus_soup: 1, harvest: 1 };
    s.inventory.rare = { clover4: 2, windchime: 1, moonstone: 1, luckycoin: 1 };
    s.toys = ['windmill', 'lantern', 'ball', 'trampoline', 'rug', 'mobile'];
    // 走正规入口摆放，槽位会自动匹配室内/室外（不要直接写 slot，否则可能摆错地方）
    s.home.placed = [];
    ['rug', 'mobile', 'lantern', 'windmill', 'ball', 'trampoline'].forEach(function (id) {
      NT.home.placeToy(s, id);
    });
    var now = Date.now();
    NT.farm.plant(s, 'dry', 'tomato', now - 3600e3);
    NT.farm.plant(s, 'wet', 'rice', now - 7200e3);
    var seeds = [11, 202, 3003, 40004, 555, 66, 777];
    for (var i = 0; i < seeds.length; i++) {
      var d = NT.clock.depart(s, {
        mode: i % 3 === 0 ? 'region' : 'random',
        regionId: i % 3 === 0 ? NT.data.destinations[(i + 3) % NT.data.destinations.length].id : undefined,
        now: now - (i + 1) * 86400e3, seed: seeds[i],
        dishId: i === 0 ? 'harvest' : (i === 3 ? 'riceball' : 'none'),
        rareItemIds: i === 1 ? ['luckycoin'] : []
      });
      if (d.ok) NT.clock.check(s, d.trip.dueAt + 1000);
    }
    s.home.nahida.stateId = 'play';
    s.home.nahida.until = 0;
    app.save = s;
    NT.store.save(s);
  };

  /* ---------------- 工具 ---------------- */

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtDur(ms) {
    var h = ms / 3600e3;
    return h >= 1 ? h + ' 小时' : Math.round(ms / 60000) + ' 分';
  }
  app.esc = esc;

})(typeof window !== 'undefined' ? window : this);
