/* 纳西妲旅行 · 旅途事件
 * 旅途被切成若干"段"，每段消耗食物前进，并有一次事件判定。
 * 事件会补充食物（走更远）、夺走食物（提前回家）、改变目的地、或遇到同伴。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  NT.data = NT.data || {};

  /** 同伴的家乡，用于"被邀请去 ta 家乡"的改道事件 */
  NT.data.companionHome = {
    paimon: 'beijing', collei: 'chengdu', tighnari: 'zhangjiajie', cyno: 'dunhuang',
    nilou: 'hangzhou', dehya: 'turpan', wanderer: 'nyingchi', klee: 'harbin',
    qiqi: 'mohe', alhaitham: 'suzhou'
  };

  /**
   * kind:
   *   refill   补充食物 -> 能走更远
   *   setback  损失食物 / 强制回家
   *   redirect 改变目的地
   *   companion 遇到同伴
   *   sight    只是沿途见闻（不改变行程）
   */
  NT.data.journeyEvents = [
    /* ---------- 补给 ---------- */
    { id: 'ref_lift', kind: 'refill', weight: 9, km: [640, 980],
      name: '搭了一段顺风车',
      text: '一个开货车的师傅停下来问我去哪，说正好顺路。' },
    { id: 'ref_orchard', kind: 'refill', weight: 9, km: [470, 750],
      name: '果园主人给了些果子',
      text: '路过一片果园，主人家让我随便摘，还说路上吃不了可以带着。' },
    { id: 'ref_share', kind: 'refill', weight: 9, km: [680, 1050], needCompanion: true,
      name: '同伴把干粮分了一半',
      text: '{companion}把包里的东西分成两份，说一个人吃不完。' },
    { id: 'ref_market', kind: 'refill', weight: 9, km: [520, 840],
      name: '在集市帮了半天工',
      text: '帮人看了半天摊子，走的时候人家塞给我一包吃的。' },
    { id: 'ref_noodle', kind: 'refill', weight: 9, km: [500, 800],
      name: '面馆老板多添了一碗',
      text: '老板说我看着像走了很远的路，没收钱，还添了一碗。' },
    { id: 'ref_eggs', kind: 'refill', weight: 9, km: [430, 690],
      name: '老奶奶塞了两个煮鸡蛋',
      text: '在门口歇脚的时候，屋里的老奶奶出来，把两个鸡蛋放在我手里。' },

    /* ---------- 挫折 ---------- */
    { id: 'set_river', kind: 'setback', weight: 4, km: [0, 0], forceReturn: true, soaked: true,
      name: '掉进河里了',
      text: '过河的时候脚下一滑。人是爬上来了，包里的吃的全被水冲走了。' },
    { id: 'set_bag', kind: 'setback', weight: 7, km: [220, 420],
      name: '包被小动物翻开了',
      text: '停下来休息的时候，不知从哪儿来了一只小东西，等我发现已经少了一半。' },
    { id: 'set_wrongway', kind: 'setback', weight: 7, km: [180, 380],
      name: '走错了路',
      text: '走出很远才发现方向不对，只能退回去。' },
    { id: 'set_rain', kind: 'setback', weight: 6, km: [150, 320],
      name: '被雨困住了',
      text: '雨下得很大，在屋檐下等了很久，等雨停的时候天已经黑了。' },
    { id: 'set_shoe', kind: 'setback', weight: 5, km: [200, 400],
      name: '鞋子磨破了',
      text: '鞋底开了一道口，只能走得很慢。' },

    /* ---------- 改道 ---------- */
    { id: 'red_invite', kind: 'redirect', weight: 4, needCompanion: true, useCompanionHome: true,
      name: '被邀请去了别处',
      text: '{companion}说，既然都到这儿了，不如去我家那边看看。我想了想，就答应了。' },
    { id: 'red_poster', kind: 'redirect', weight: 4, randomNearby: true,
      name: '看到一张宣传画',
      text: '路边的墙上贴着一张画，上面的地方看起来很好。我站在那儿看了一会儿，然后换了方向。' },
    { id: 'red_road', kind: 'redirect', weight: 3, randomNearby: true,
      name: '前面封路了',
      text: '前面在修路，过不去。旁边的人说可以绕，绕过去就是另一个地方了。' },
    { id: 'red_letter', kind: 'redirect', weight: 3, randomAny: true,
      name: '收到一封信',
      text: '在邮局歇脚的时候，顺手翻到一封没寄出去的信，上面的地址我记住了。' },

    /* ---------- 遭遇同伴 ---------- */
    { id: 'meet_1', kind: 'companion', weight: 18,
      name: '遇到了同伴',
      text: '路上碰到了{companion}。{companion}说也是随便走走，那就一起走一段吧。' },

    /* ---------- 沿途见闻 ---------- */
    { id: 'see_lights', kind: 'sight', weight: 8,
      name: '远处的灯', text: '天快黑的时候，远远看见一片灯亮起来。' },
    { id: 'see_field', kind: 'sight', weight: 8,
      name: '路边的田', text: '路两边全是田，风一过就一片一片地倒。' },
    { id: 'see_bridge', kind: 'sight', weight: 7,
      name: '过了一座桥', text: '桥很长，走到中间的时候我停下来看了一会儿水。' },
    { id: 'see_market', kind: 'sight', weight: 7,
      name: '路过一个集市', text: '集市上很吵，卖什么的都有，我什么都没买。' },
    { id: 'see_hill', kind: 'sight', weight: 7,
      name: '翻过一座山', text: '翻过去之后回头看了一眼，来时的路弯弯曲曲的。' },
    { id: 'see_star', kind: 'sight', weight: 6,
      name: '停下来看星星', text: '走累了就躺下歇一会儿。天上一颗一颗地亮起来。' }
  ];

  NT.data.journeyEventById = function (id) {
    var l = NT.data.journeyEvents;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  };

  NT.data.journeyEventsByKind = function (kind) {
    return NT.data.journeyEvents.filter(function (e) { return e.kind === kind; });
  };
})(typeof window !== 'undefined' ? window : this);
