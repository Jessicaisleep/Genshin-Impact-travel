/* 纳西妲旅行 · 家的系统
 * 一个 16:9 的全屏世界：她被看到在做什么、走到哪里；玩具摆在哪里；交流。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  var U = NT.util, R = NT.rng, C = NT.config;

  var home = {};

  function hash() {
    var a = [];
    for (var i = 0; i < arguments.length; i++) a.push(String(arguments[i]));
    return R.hashSeed(a.join(':'));
  }

  /* ---------------- 纳西妲的状态机 ---------------- */

  function stateDurationMs(state, seed) {
    var r = R.mulberry32(hash('dur', state.id, seed));
    return Math.round(state.dwell * 60000 * U.range(r, 0.7, 1.35));
  }

  function nextStateId(currentId, rand) {
    var pool = [];
    var list = NT.data.nahidaStates;
    for (var i = 0; i < list.length; i++) {
      var w = list[i].weight;
      if (list[i].id === currentId) w *= 0.2;   // 避免连续同一个状态
      pool.push({ s: list[i], weight: w });
    }
    var chosen = R.weighted(rand, pool);
    return chosen ? chosen.s.id : 'idle';
  }

  /** 她现在的落点 id（water 状态会在两块田之间轮换） */
  home._spotIdOf = function (save, stateId) {
    var st = NT.data.nahidaStateById(stateId);
    if (st.altSpot) {
      var r = R.mulberry32(hash('spot', save.home.nahida.since, stateId));
      return r() < 0.5 ? st.spot : st.altSpot;
    }
    return st.spot;
  };

  /**
   * 推进状态。放置很久后最多推进 maxStateSteps 次，避免一次打开连跳十几次。
   */
  home.tick = function (save, now) {
    now = now || Date.now();
    var h = save.home.nahida;
    if (!h.stateId) {
      h.stateId = 'idle';
      h.since = now;
      h.prevSpotId = home._spotIdOf(save, h.stateId);
      h.until = now + stateDurationMs(NT.data.nahidaStateById(h.stateId), save.createdAt);
      return { stepped: 0, moved: false };
    }
    if (!h.until) h.until = h.since + stateDurationMs(NT.data.nahidaStateById(h.stateId), save.createdAt);

    var stepped = 0, moved = false;
    while (now >= h.until && stepped < C.home.maxStateSteps) {
      var fromSpot = home._spotIdOf(save, h.stateId);
      h.since = h.until;
      h.stateId = nextStateId(h.stateId, R.mulberry32(hash('next', h.since, save.createdAt)));
      h.until = h.since + stateDurationMs(NT.data.nahidaStateById(h.stateId), save.createdAt);
      var toSpot = home._spotIdOf(save, h.stateId);
      h.prevSpotId = fromSpot;
      if (toSpot !== fromSpot) moved = true;
      stepped++;
    }
    if (now >= h.until) {
      h.prevSpotId = home._spotIdOf(save, h.stateId);
      h.since = now;
      h.stateId = nextStateId(h.stateId, R.mulberry32(hash('next', now, save.createdAt)));
      h.until = now + stateDurationMs(NT.data.nahidaStateById(h.stateId), save.createdAt);
      moved = true;
      stepped++;
    }

    // 她每换一次状态，顺手推进一下家里的客人
    var vres = visitorTick(save, now, stepped > 0);
    return { stepped: stepped, moved: moved, visitorChanged: vres.changed };
  };

  home.state = function (save) {
    return NT.data.nahidaStateById(save.home.nahida.stateId);
  };

  /** 她此刻应该站在哪里。玩耍时会走到那件玩具旁边，而不是站在原地玩。 */
  home.spot = function (save) {
    var st = home.state(save);
    if (st.useToy) {
      var t = home.playingToy(save);
      if (t) {
        var placed = home.placed(save).filter(function (p) { return p.toyId === t.id; })[0];
        if (placed) {
          // 站位交给 playSpot：它会挑一个不会压到别件玩具的位置
          var ps = home.playSpot(save, placed.slot, t.id, 1);
          if (ps) {
            return {
              x: ps.x, y: ps.y, area: ps.area,
              label: t.name + '边', toy: t.id
            };
          }
        }
      }
    }
    var id = home._spotIdOf(save, save.home.nahida.stateId);
    return NT.data.spotById(id) || NT.data.homeSpots.yard;
  };

  /** 她正站在哪件玩具旁边（有的话） */
  home.atToy = function (save) {
    return home.spot(save).toy || null;
  };

  home.prevSpot = function (save) {
    var id = save.home.nahida.prevSpotId;
    return id ? (NT.data.spotById(id) || null) : null;
  };

  home.stateLine = function (save) {
    var st = home.state(save);
    var r = R.mulberry32(hash('line', save.home.nahida.since, st.id));
    return U.pick(r, st.lines);
  };

  /* ---------------- 玩具 ---------------- */

  home.hasToy = function (save, toyId) {
    return (save.toys || []).indexOf(toyId) >= 0;
  };

  home.addToy = function (save, toyId) {
    if (!NT.data.toyById(toyId)) return false;
    save.toys = save.toys || [];
    if (save.toys.indexOf(toyId) >= 0) return false;   // 已经有了
    save.toys.push(toyId);
    return true;
  };

  home.placed = function (save) { return save.home.placed || []; };

  home.isPlaced = function (save, toyId) {
    return home.placed(save).some(function (p) { return p.toyId === toyId; });
  };

  home.toyAtSlot = function (save, slot) {
    var p = home.placed(save).filter(function (x) { return x.slot === slot; })[0];
    return p ? NT.data.toyById(p.toyId) : null;
  };

  home.placeToy = function (save, toyId, slot) {
    var toy = NT.data.toyById(toyId);
    if (!toy) return { ok: false, error: '没有这个玩具' };
    if (!home.hasToy(save, toyId)) return { ok: false, error: '还没有这个玩具' };

    save.home.placed = home.placed(save).filter(function (p) { return p.toyId !== toyId; });

    var used = {};
    save.home.placed.forEach(function (p) { used[p.slot] = 1; });
    if (slot === undefined || slot === null || used[slot] || !NT.data.toyFitsSlot(toyId, slot)) {
      slot = -1;
      for (var i = 0; i < NT.data.toySlots.length; i++) {
        if (!used[i] && NT.data.toyFitsSlot(toyId, i)) { slot = i; break; }
      }
      if (slot < 0) {
        return {
          ok: false,
          error: (toy.place === 'indoor' ? '屋里' : '院子和花园') + '的位置满了' +
            '（最多同时摆 ' + NT.data.toySlots.length + ' 件，先收回一件）'
        };
      }
    }
    save.home.placed.push({ toyId: toyId, slot: slot });
    return { ok: true, slot: slot };
  };

  home.removeToy = function (save, toyId) {
    save.home.placed = home.placed(save).filter(function (p) { return p.toyId !== toyId; });
  };

  /**
   * 读档时修正玩具摆放。
   * 为什么需要：游戏数据改了之后（某件玩具被删掉、或从室内改成室外），
   * 老存档里记的还是旧槽位编号，不会自动跟着变 —— 结果就是"灯笼还在屋里"。
   * 这里统一纠正：删掉失效的、把放错地方的挪到合法空位、去掉重复。
   * @returns 被纠正的条数
   */
  home.repair = function (save) {
    if (!save.home) save.home = { placed: [], nahida: {} };
    if (!Array.isArray(save.home.placed)) save.home.placed = [];
    if (!Array.isArray(save.toys)) save.toys = [];

    var owned = save.toys;
    var kept = [];
    var used = {};
    var seenToy = {};
    var changed = 0;

    save.home.placed.forEach(function (p) {
      var toy = NT.data.toyById(p.toyId);
      var slot = NT.data.toySlots[p.slot];
      if (!toy || owned.indexOf(p.toyId) < 0 || !slot ||
          slot.place !== toy.place || used[p.slot] || seenToy[p.toyId]) {
        changed++;
        return;
      }
      used[p.slot] = 1;
      seenToy[p.toyId] = 1;
      kept.push({ toyId: p.toyId, slot: p.slot });
    });

    // 有玩具但没摆出来的，只要还有合适的空位就自动补上
    owned.forEach(function (id) {
      if (kept.some(function (p) { return p.toyId === id; })) return;
      var toy = NT.data.toyById(id);
      if (!toy) return;
      var slot = -1;
      for (var i = 0; i < NT.data.toySlots.length; i++) {
        if (!used[i] && NT.data.toySlots[i].place === toy.place) { slot = i; break; }
      }
      if (slot < 0) return;
      used[slot] = 1;
      kept.push({ toyId: id, slot: slot });
      changed++;
    });

    save.home.placed = kept;
    return changed;
  };

  /** 她正在玩的玩具（只有 play 状态才有） */
  home.playingToy = function (save) {
    var st = home.state(save);
    if (!st.useToy) return null;
    var placed = home.placed(save);
    if (!placed.length) return null;
    var outdoor = placed.filter(function (p) {
      var t = NT.data.toyById(p.toyId);
      return t && t.place === 'outdoor';
    });
    var pool = (outdoor.length ? outdoor : placed).map(function (p) { return p.toyId; });

    // 尽量别连着玩同一件 —— 上次玩过的先排除掉（只剩一件时就还是它）
    var last = save.home.lastToyId;
    if (pool.length > 1 && last) {
      var filtered = pool.filter(function (id) { return id !== last; });
      if (filtered.length) pool = filtered;
    }

    var r = R.mulberry32(hash('toy', save.home.nahida.since));
    var id = pool[Math.min(pool.length - 1, Math.floor(r() * pool.length))];
    save.home.lastToyId = id;
    return NT.data.toyById(id);
  };

  home.toyLine = function (save, toy) {
    if (!toy) return '';
    var r = R.mulberry32(hash('toyline', save.home.nahida.since, toy.id));
    return U.pick(r, toy.playLines);
  };

  /* ---------------- 站在玩具旁边 ---------------- */

  /**
   * 她的身体半宽（归一化到画面宽）。0.19 个身高，换算到宽度要乘 9/16。
   * 取 0.24 是为了把**来访同伴**也算进去 —— 同伴立绘的身高和主角差不多，
   * 但不同角色的身体比例不一样，有些（比如带大帽子的）横向会更宽。
   */
  var HER_HALF_W = 0.24 * 0.25 * (9 / 16);

  /**
   * 一件玩具的横向半径（归一化到画面宽）。
   * 素材基本是方的，但有几件特别宽（吊床约 1.55:1、沙坑 1.6:1），
   * 这里统一按 1.55 估 —— 宁可估宽，免得算漏了重叠。
   */
  function toyHalfW(toyId) {
    return NT.data.toySize(toyId) * 0.25 * 1.55 * (9 / 16) / 2;
  }

  /**
   * 这个位置和"除 excludeToy 之外"的玩具之间还剩多少横向余量。
   * >= 0 表示不重叠；负数表示压上去了。
   *
   * 判定用"地盘"模型：她踩在一件玩具上，指的是**脚落在那件玩具的占地里**。
   * 这个视角是从斜上方看的，玩具在地上的占地是一条扁扁的椭圆 ——
   * 所以纵向只要差开一点点（站到它前面或后面）就不算踩上去，
   * 并不是"纵向重叠就算"。不这样理解的话，院子里根本站不下人。
   */
  home.clearanceAt = function (save, x, y, excludeToyId) {
    var worst = 999;
    home.placed(save).forEach(function (p) {
      if (p.toyId === excludeToyId) return;
      var s2 = NT.data.toySlots[p.slot];
      if (!s2) return;
      if (Math.abs(y - s2.y) >= 0.042) return;        // 站到它前后去了，不算踩
      var need = HER_HALF_W + toyHalfW(p.toyId);
      worst = Math.min(worst, Math.abs(x - s2.x) - need);
    });
    return worst;
  };

  /**
   * 玩某件玩具时该站哪。
   *
   * **不能简单地"站玩具右边"** —— 旁边可能还摆着别的玩具，站过去就压上了。
   * 所以按优先级试几个候选位置，挑第一个不和别的玩具重叠的：
   *   偏好的那一侧 → 另一侧 → 正前方（更靠近镜头）→ 再往外挪
   *
   * @param preferSign +1 优先站右边，-1 优先站左边
   */
  home.playSpot = function (save, slotIndex, toyId, preferSign) {
    var slot = NT.data.toySlots[slotIndex];
    if (!slot) return null;
    var sign = preferSign < 0 ? -1 : 1;
    var dx = NT.data.toySize(toyId) * 0.070 + 0.035;
    var cands = [
      { x: slot.x + sign * dx, y: slot.y + 0.014 },
      { x: slot.x - sign * dx, y: slot.y + 0.014 },
      { x: slot.x, y: slot.y + 0.066 },                    // 站到玩具正前方
      { x: slot.x + sign * dx * 1.5, y: slot.y + 0.05 },
      { x: slot.x - sign * dx * 1.5, y: slot.y + 0.05 }
    ];
    var best = null, bestScore = -9999;
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (c.x < 0.04 || c.x > 0.96 || c.y > 0.97) continue;
      var sc = home.clearanceAt(save, c.x, c.y, toyId);
      if (sc >= 0) return { x: c.x, y: c.y, area: slot.area, slot: slot };
      if (sc > bestScore) { bestScore = sc; best = c; }
    }
    if (best) return { x: best.x, y: best.y, area: slot.area, slot: slot };
    return { x: slot.x, y: slot.y + 0.014, area: slot.area, slot: slot };
  };

  /* ==================== 来访的同伴 ====================
   * 同伴自己跑来家里待一会儿，最多同时 1 位，每个人出现概率相同。
   * 她出门旅行时、在家时都可能来。
   *
   * **核心约束：同伴永远和主角分在画面两侧。**
   *   主角在左侧（吃饭/看书/发呆/睡觉…）-> 同伴只在右侧玩玩具
   *   主角在右侧（玩玩具）              -> 同伴只做左侧的活动
   *   主角出门了（家里没人）            -> 同伴随便
   * 这样两个人的位置永远不会撞上，省掉一堆图层叠加的麻烦。
   */

  /** 院子里一件玩具都没摆时，同伴在这儿待着（刻意避开主角所有落点） */
  var VISITOR_IDLE_SPOT = { x: 0.620, y: 0.862, area: 'garden', label: '院子里' };

  /** 主角现在在画面哪一侧：玩玩具 = 右边，其它 = 左边 */
  home.nahidaSide = function (save) {
    return home.state(save).useToy ? 'right' : 'left';
  };

  /** 当前来访的同伴（已经走了就返回 null）。
   *  now 可传，方便自检用固定时间点测；不传就是现在。 */
  home.visitor = function (save, now) {
    var v = save.home && save.home.visitor;
    if (!v) return null;
    if ((now || Date.now()) >= v.until) return null;
    return v;
  };

  home.visitorCompanion = function (save, now) {
    var v = home.visitor(save, now);
    return v ? NT.data.companionById(v.companionId) : null;
  };

  home.visitorState = function (save, now) {
    var v = home.visitor(save, now);
    return v ? NT.data.visitorById(v.stateId) : null;
  };

  /** 同伴这次玩哪件玩具（没有摆出来的户外玩具就返回 null） */
  home.visitorToy = function (save, now) {
    var v = home.visitor(save, now);
    if (!v) return null;
    var outdoor = home.placed(save).filter(function (p) {
      var t = NT.data.toyById(p.toyId);
      return t && t.place === 'outdoor';
    });
    if (!outdoor.length) return null;
    var r = R.mulberry32(hash('vtoy', v.since || v.arrivedAt));
    return NT.data.toyById(U.pick(r, outdoor).toyId);
  };

  /** 同伴此刻站在哪里 */
  home.visitorSpot = function (save, now) {
    var v = home.visitor(save, now);
    if (!v) return null;
    var st = NT.data.visitorById(v.stateId);

    if (st.useToy) {
      var toy = home.visitorToy(save, now);
      if (toy) {
        var placed = home.placed(save).filter(function (p) { return p.toyId === toy.id; })[0];
        if (placed) {
          // 和主角同一套逻辑：在玩具周围找一块不会压到别件玩具的位置
          var ps = home.playSpot(save, placed.slot, toy.id, -1);
          if (ps) {
            return {
              x: ps.x, y: ps.y, area: ps.area,
              label: toy.name + '边', toy: toy.id
            };
          }
        }
      }
      // 院子里一件玩具都没摆 —— 退回自己在院子里找个地方待着。
      // 注意**不能用 gate**：主角"望着路口"就站在那儿，会叠上。
      return VISITOR_IDLE_SPOT;
    }
    return NT.data.spotById(st.spot) || VISITOR_IDLE_SPOT;
  };

  /** 同伴自己嘀咕一句 */
  home.visitorLine = function (save, now) {
    var v = home.visitor(save, now);
    if (!v) return '';
    var st = NT.data.visitorById(v.stateId);
    var c = home.visitorCompanion(save, now);
    var r = R.mulberry32(hash('vline', v.since || v.arrivedAt, v.stateId));
    // 偶尔用一句这个角色自己的口头禅，其余用通用的"客人"台词
    if (c && c.catchphrases && c.catchphrases.length && r() < 0.3) {
      return U.pick(r, c.catchphrases);
    }
    return U.pick(r, st.lines);
  };

  home.visitorArriveLine = function (save, now) {
    var v = home.visitor(save, now);
    if (!v) return '';
    var r = R.mulberry32(hash('varrive', v.arrivedAt));
    return U.pick(r, NT.data.visitorArrive);
  };

  home.visitorLeaveLine = function (save) {
    var r = R.mulberry32(hash('vleave', save.home.lastVisitorAt || 0));
    return U.pick(r, NT.data.visitorLeave);
  };

  /**
   * 主角和客人的打招呼。只在主角「发呆」时触发，一次来访只打一次。
   * @returns {nahida, visitor} 或 null
   */
  home.visitorGreeting = function (save, now) {
    var v = home.visitor(save, now);
    if (!v || v.greeted) return null;
    if (home.state(save).id !== 'idle') return null;
    var r = R.mulberry32(hash('vgreet', v.arrivedAt, save.createdAt));
    var pair = U.pick(r, NT.data.visitorGreet);
    v.greeted = true;
    return pair ? { nahida: pair[0], visitor: pair[1] } : null;
  };

  /* ---------------- 同伴的推进逻辑（内部） ---------------- */

  /** 这次来访待多久（「设置」里可调） */
  function visitorStayMs(save) {
    var key = (save.settings && save.settings.visitorStay) || 'normal';
    var conf = (NT.config.VISIT_STAY || {})[key] || { min: 10, max: 20 };
    var r = R.mulberry32(hash('vstay', Date.now(), save.createdAt));
    return Math.round(U.range(r, conf.min, conf.max) * 60000);
  }

  /** 同伴多久换一次活动 */
  function visitorDwellMs(save, now) {
    var r = R.mulberry32(hash('vdwell', now, save.createdAt));
    return Math.round(U.range(r, 1.6, 3.2) * 60000);
  }

  /**
   * 同伴干什么。侧别约束见本段开头的说明。
   */
  function pickVisitorState(save, now) {
    var pool;
    if (save.activeTrip) {
      pool = NT.data.visitorStates;                       // 家里没人，随便
    } else {
      var want = home.nahidaSide(save) === 'right' ? 'left' : 'right';
      pool = NT.data.visitorStatesOn(want);
    }
    if (!pool || !pool.length) pool = NT.data.visitorStates;
    var r = R.mulberry32(hash('vstate', now, save.createdAt));
    var chosen = R.weighted(r, pool.map(function (s) { return { s: s, weight: s.weight }; }));
    return chosen ? chosen.s.id : 'idle';
  }

  /**
   * 推进同伴。
   * @returns {changed, arrived, left}
   */
  function visitorTick(save, now, stateChanged) {
    var H = save.home;
    var VC = (NT.config.home && NT.config.home.visitor) || {};
    var out = { changed: false, arrived: false, left: false };
    if (!H) return out;
    if (H.visitor === undefined) H.visitor = null;

    // 1) 到点了 -> 走
    if (H.visitor && now >= H.visitor.until) {
      H.visitor = null;
      H.lastVisitorAt = now;
      out.changed = true; out.left = true;
      return out;
    }

    // 2) 家里有客人 -> 推进客人自己的活动
    if (H.visitor) {
      var v = H.visitor;
      if (!v.nextStateAt) v.nextStateAt = now + visitorDwellMs(save, now);

      // 主角刚换了状态 -> 客人的侧别可能就不对了，**必须立刻重选**。
      // 不这么做的话会出现"两个人都在右侧"（主角跑去玩玩具，客人还在玩）。
      var want = save.activeTrip ? null
        : (home.nahidaSide(save) === 'right' ? 'left' : 'right');
      var cur = NT.data.visitorById(v.stateId).side;
      var desync = !!(stateChanged && want && cur !== want);

      if (desync || now >= v.nextStateAt) {
        v.stateId = pickVisitorState(save, now);
        v.since = now;
        v.nextStateAt = now + visitorDwellMs(save, now);
        out.changed = true;
      }
      return out;
    }

    // 3) 家里没客人 -> 主角换状态时掷一次骰子
    if (!VC.enabled || !stateChanged) return out;
    if (!save.homeChosen) return out;
    if (now - (H.lastVisitorAt || 0) < (VC.cooldownMs || 0)) return out;

    var r = R.mulberry32(hash('visit', now, save.createdAt));
    if (r() >= (VC.chance || 0.24)) return out;

    var list = NT.data.companions || [];
    if (!list.length) return out;
    var comp = list[Math.floor(r() * list.length) % list.length];

    H.visitor = {
      companionId: comp.id,
      stateId: pickVisitorState(save, now),
      arrivedAt: now,
      since: now,
      until: now + visitorStayMs(save),
      nextStateAt: now + visitorDwellMs(save, now),
      greeted: false
    };
    out.changed = true; out.arrived = true;
    return out;
  }

  /** 让自检和调试能手动放一位客人进来 */
  home.debugAddVisitor = function (save, companionId, now) {
    now = now || Date.now();
    var list = NT.data.companions || [];
    if (!list.length) return null;
    var comp = companionId ? NT.data.companionById(companionId) : list[0];
    if (!comp) return null;
    save.home.visitor = {
      companionId: comp.id,
      stateId: pickVisitorState(save, now),
      arrivedAt: now,
      since: now,
      until: now + visitorStayMs(save),
      nextStateAt: now + visitorDwellMs(save, now),
      greeted: false
    };
    return save.home.visitor;
  };

  /* ---------------- 交流 ---------------- */

  home.topicById = function (id) { return NT.data.chatTopicById(id); };

  home.chat = function (save, topicId, optionIndex, seedStr) {
    var topic = home.topicById(topicId);
    if (!topic) return null;
    var opt = topic.options[optionIndex];
    if (!opt) return null;
    var r = R.mulberry32(hash('chat', seedStr || Date.now()));
    return { player: opt.text, reply: U.pick(r, opt.replies), topicId: topicId, optionIndex: optionIndex };
  };

  home.hello = function (save, seedStr) {
    var st = home.state(save);
    var r = R.mulberry32(hash('hello', seedStr || Date.now()));
    return U.pick(r, st.lines);
  };

  NT.home = home;
})(typeof window !== 'undefined' ? window : this);
