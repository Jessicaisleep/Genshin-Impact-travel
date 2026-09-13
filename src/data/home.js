/* 纳西妲旅行 · 家的数据
 * 家是一个 16:9 的全屏世界：左边是半截面的屋子（能看见她在屋里做什么），
 * 中间是院子（两块田直接画在画面里），右边是花园和池塘。全部同屏，不需要切场景。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  NT.data = NT.data || {};

  /* ---------------- 布局 ---------------- */

  NT.data.HOME_W = 1280;
  NT.data.HOME_H = 720;

  /** 三个区域，纯用于摆放与描述 */
  NT.data.homeAreas = [
    { id: 'house',  name: '屋里', x: [0.02, 0.31] },
    { id: 'yard',   name: '院子', x: [0.32, 0.63] },
    { id: 'garden', name: '花园', x: [0.64, 0.99] }
  ];

  /**
   * 纳西妲会去的位置。坐标是按家-全景.png 实际量出来的（斜俯视玩偶屋视角）。
   * y 是脚底基准。field 为真的位置，她在那里就是在照看那块田。
   * 布局原则：屋里的事（看书/做饭/吃饭/发呆）在左侧，玩玩具在右侧；
   * 落点要避开树、水池、田地和玩具。
   */
  NT.data.homeSpots = {
    /* ---- 屋里（可走动的地板带大约 y 0.70~0.81） ---- */
    // 睡觉：脚在床尾、身体朝床头躺下（床的长轴是横的，床头在左边、书架下面）
    bed:     { x: 0.184, y: 0.598, area: 'house',  label: '床上', onBed: true },
    // 看书：床头、书架下面
    shelf:   { x: 0.082, y: 0.754, area: 'house',  label: '床头' },
    desk:    { x: 0.256, y: 0.742, area: 'house',  label: '桌边' },
    stove:   { x: 0.392, y: 0.694, area: 'house',  label: '灶台边' },
    door:    { x: 0.208, y: 0.808, area: 'house',  label: '门口' },

    /* ---- 院子（屋子右边的草地，两块田在 x 0.47~0.66 / y 0.55~0.75） ---- */
    dry:     { x: 0.448, y: 0.614, area: 'yard',   label: '菜地边', field: 'dry' },
    wet:     { x: 0.512, y: 0.800, area: 'yard',   label: '水田边', field: 'wet' },
    yard:    { x: 0.258, y: 0.904, area: 'yard',   label: '院子里' },
    gate:    { x: 0.168, y: 0.966, area: 'yard',   label: '草地边上' },

    /* ---- 花园（右侧草地；树和喷泉在 x 0.62~0.80 / y 0.25~0.48，所以都放在 y 0.75 以下） ---- */
    lawn:    { x: 0.480, y: 0.870, area: 'garden', label: '草地上' }
  };

  NT.data.spotById = function (id) { return NT.data.homeSpots[id]; };

  /**
   * 玩具落位槽。全部在右侧草地，**一共 5 个**。
   *
   * 为什么是 5 个（不是 8 个）：
   *   · 主角要站到玩具旁边玩，来访的同伴也要玩 —— 院子里同时有人有玩具
   *   · 同伴的立绘有些比主角宽，需要的空档更大
   *   · 摆太满就会出问题：她站到别的玩具上、玩具互相压住
   *   5 个槽位能把行距拉到 0.2，上面这些问题就都不存在了。
   *
   * 避开的区域：树（x 0.655~0.78 / y 0.25~0.42）、
   *             喷泉（x 0.62~0.72 / y 0.40~0.48）、
   *             田地（x 0.47~0.66 / y 0.54~0.75）。
   * 另外 y 不能超过 ~0.90 —— 她玩最下面那件时要能站到它**前面**（画面更下方），
   * 再往下就出画了。左上那个位置空着也是这个原因（吊床摆那儿会压到喷泉）。
   */
  NT.data.toySlots = [
    { x: 0.690, y: 0.895, area: 'garden', place: 'outdoor' },
    { x: 0.790, y: 0.700, area: 'garden', place: 'outdoor' },
    { x: 0.790, y: 0.895, area: 'garden', place: 'outdoor' },
    { x: 0.885, y: 0.720, area: 'garden', place: 'outdoor' },
    { x: 0.885, y: 0.900, area: 'garden', place: 'outdoor' }
  ];

  /* ---------------- 纳西妲的居家状态 ---------------- */

  /**
   * spot 决定她会走到哪里；dwell 是停留时长（分钟）；mood 决定立绘姿态。
   * poke 是"被点一下"时的反应：anim 是小动作，lines 是反应台词。
   */
  NT.data.nahidaStates = [
    { id: 'idle', name: '发呆', mood: 'idle', weight: 13, spot: 'yard', dwell: 2.5,
      lines: ['……啊，你来了。', '我在想一件事，想到一半忘了。', '刚才那片云变成了一只兔子，现在散了。'],
      poke: { anim: 'perk', lines: ['……嗯？', '你来了。', '我刚才在想事情，被你打断了。', '（慢慢抬起头）'] } },

    { id: 'sleep', name: '睡觉', mood: 'tired', weight: 7, spot: 'bed', dwell: 6, lie: true,
      lines: ['（她睡着了，呼吸很轻）', '（翻了个身，没有醒）', '……再五分钟……'],
      poke: { anim: 'roll', lines: ['（翻了个身，把脸埋进枕头）', '……唔。', '（含糊地说了句什么，没听清）', '（把被子往上拉了拉）'] } },

    { id: 'eat', name: '吃饭', mood: 'happy', weight: 11, spot: 'desk', dwell: 2.5,
      lines: ['刚做好的，还热。你要不要尝一口？', '这个比上次做得好，我记下来了。', '吃东西的时候脑子会停下来，这样很好。'],
      poke: { anim: 'offer', lines: ['你要不要尝一口？', '（把碗往你那边推了推）', '等我把这口咽下去。', '还没做好吃的样子，别看了。'] } },

    { id: 'play', name: '玩耍', mood: 'happy', weight: 25, spot: 'lawn', dwell: 2.5, useToy: true,
      lines: ['一起玩吗？', '刚才那个差点飞出去了。', '再来一次，这次我一定能接住。'],
      poke: { anim: 'bounce', lines: ['一起！', '刚才那个你看到了吗？', '再来一次！', '（原地蹦了一下）'] } },

    { id: 'read', name: '看书', mood: 'idle', weight: 10, spot: 'shelf', dwell: 3,
      lines: ['这一页我读了三遍，每次理解得都不太一样。', '书里说的事情，和外面看到的对不上。', '你先坐，我看完这段。'],
      poke: { anim: 'lookup', lines: ['……等一下，这段看完。', '（从书上面看了你一眼）', '你也想看？这本有点难。', '别挡住光。'] } },

    { id: 'water', name: '浇水', mood: 'idle', weight: 11, spot: 'dry', dwell: 2, altSpot: 'wet',
      lines: ['土还是湿的，今天不用浇了。', '这棵长得比昨天高了一点，真的。', '水要慢慢浇，一下子倒下去根会松。'],
      poke: { anim: 'wave', lines: ['水壶有点重。', '小心，别站太近。', '这棵今天已经喝饱了。', '（往旁边挪了半步，让开水）'] } },

    { id: 'cook', name: '做饭', mood: 'happy', weight: 9, spot: 'stove', dwell: 2.5,
      lines: ['火候比上次好。', '你闻到没有？', '等一下就好，别急。'],
      poke: { anim: 'stir', lines: ['别急，还没好。', '火有点大。', '你来尝尝咸淡？', '（一边说一边搅了两下）'] } },

    { id: 'stretch', name: '伸懒腰', mood: 'happy', weight: 5, spot: 'door', dwell: 1.5,
      lines: ['唔——坐太久了。', '你也起来动一动吧。', '肩膀有点僵。'],
      poke: { anim: 'shy', lines: ['……别看我。', '啊，你什么时候来的。', '（把手臂放了下来）', '就是……坐太久了。'] } },

    { id: 'lookout', name: '望着路口', mood: 'idle', weight: 9, spot: 'gate', dwell: 2.5,
      lines: ['……没什么，就是看看。', '我在等风把门吹响。', '门口那条路，一直通向很远的地方。'],
      poke: { anim: 'turn', lines: ['……没什么。', '（转过身来）你回来了。', '我只是看看。', '（把视线收回来）'] } }
  ];

  NT.data.nahidaStateById = function (id) {
    var l = NT.data.nahidaStates;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return l[0];
  };

  /* ---------------- 玩具 ---------------- */

  /** place: indoor 只能摆屋里，outdoor 只能摆院子/花园 */
  NT.data.toys = [
    { id: 'trampoline', name: '蹦床', icon: 'star', rarity: 'R', place: 'outdoor',
      desc: '绷得很紧的一块布，边上有弹簧。',
      playLines: ['一下比一下高！', '落下来的时候肚子有点痒。', '你看，我能碰到那片叶子。'] },
    { id: 'windmill', name: '小风车', icon: 'compass', rarity: 'N', place: 'outdoor',
      desc: '插在土里，有风就转。',
      playLines: ['它转得比我数得还快。', '风停了，它也停了。', '如果是反着转的呢？'] },
    { id: 'pool', name: '小水池', icon: 'fish', rarity: 'R', place: 'outdoor',
      desc: '浅浅的一池水，边上放着小木船。',
      playLines: ['船沉了。它本来就不是用来浮的。', '水是凉的，手放进去很舒服。', '我给它搭了个码头。'] },
    { id: 'lantern', name: '小灯笼', icon: 'lantern', rarity: 'N', place: 'outdoor',
      desc: '天一黑就自己亮起来。',
      playLines: ['里面那点火，其实不烫。', '挂高一点，这样远处也能看见。', '晚上的时候，它是这里最亮的东西。'] },
    { id: 'hammock', name: '吊床', icon: 'feather', rarity: 'SR', place: 'outdoor',
      desc: '绑在两棵树中间，躺上去会晃。',
      playLines: ['晃着晃着就困了。', '你别推太快，我会掉下去。', '从下面看，树叶的缝隙是碎的。'] },
    { id: 'ball', name: '藤球', icon: 'star', rarity: 'N', place: 'outdoor',
      desc: '用藤条编的，很轻。',
      playLines: ['踢起来没什么声音。', '接住！……没接住。', '它滚到田里去了。'] },
    { id: 'sandbox', name: '沙坑', icon: 'sand', rarity: 'N', place: 'outdoor',
      desc: '一小块沙地，边上摆着木铲。',
      playLines: ['我堆了一个塔，有两层。', '沙子下面还是沙子。', '这个形状像不像一座山？'] },
    { id: 'rug', name: '地毯', icon: 'mask', rarity: 'N', place: 'outdoor',
      desc: '织着看不懂的花纹，踩上去很软。',
      playLines: ['花纹从这边看是一个样子，从那边看又是一个样子。', '坐在这里最舒服。', '我把书都堆在边上了。'] },
    { id: 'mobile', name: '小挂饰', icon: 'star', rarity: 'R', place: 'outdoor',
      desc: '挂在窗边，有风就会转，还会响。',
      playLines: ['它响的时候很轻，要安静才听得见。', '转起来的时候，影子也在转。', '声音像有人在很远的地方敲东西。'] }
  ];

  /**
   * 每件玩具相对纳西妲身高的显示尺寸（倍数）。
   * 含义是"图片内容高度 / 纳西妲身高"，按各自的真实物理大小估的：
   * 秋千和吊床是人能坐进去的尺寸，藤球和沙坑是矮的。
   * 换素材之后想调大小，改这里就行。
   */
  NT.data.toySizeRatio = {
    trampoline: 0.55, windmill: 0.75, pool: 0.44, lantern: 0.44,
    hammock: 0.95, ball: 0.37, sandbox: 0.42, rug: 0.48, mobile: 0.35
  };

  NT.data.toySize = function (id) {
    var r = NT.data.toySizeRatio[id];
    return (typeof r === 'number') ? r : 0.6;
  };

  NT.data.toyById = function (id) {
    var l = NT.data.toys;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  };

  /** 某个槽位是否适合这件玩具 */
  NT.data.toyFitsSlot = function (toyId, slotIndex) {
    var toy = NT.data.toyById(toyId);
    var slot = NT.data.toySlots[slotIndex];
    if (!toy || !slot) return false;
    return toy.place === slot.place;
  };

  /* ---------------- 交流 ---------------- */

  NT.data.chatTopics = [
    {
      id: 'trip', label: '聊聊旅途',
      options: [
        { text: '这次去了哪里？', replies: [
          '走了很远。路上碰到了一点事，我写在明信片背面了。',
          '本来想去一个地方，后来去了另一个。这样也不错。',
          '一个风很大的地方。我站在那里，帽子差点飞走。'
        ] },
        { text: '路上累不累？', replies: [
          '累的。但是坐下来歇一会儿就好了。',
          '有一段挺难的。不过看到好看的东西就忘了。',
          '还好。走得慢一点就不太累。'
        ] },
        { text: '带的吃的够吗？', replies: [
          '刚好够。差一点就要半路回来了。',
          '有剩的。下次可以少带一点。',
          '不够。路上有人分了我一些，不然走不到。'
        ] }
      ]
    },
    {
      id: 'today', label: '问问她今天',
      options: [
        { text: '今天在做什么？', replies: [
          '在数院子里有多少种叶子。数到第七种就乱了。',
          '什么也没做。什么也不做其实挺难的。',
          '把书重新排了一遍，按厚度。'
        ] },
        { text: '睡得好吗？', replies: [
          '很好。梦到自己在很高的地方，但是一点也不怕。',
          '还行。半夜醒了一次，听见外面有虫子在叫。',
          '不太好。想事情想到很晚。'
        ] },
        { text: '有没有想我？', replies: [
          '……这种问题。',
          '门口那条路，我看了好几次。',
          '嗯。不过我不会一直看，那样太浪费时间了。'
        ] }
      ]
    },
    {
      id: 'farm', label: '说说田里的事',
      options: [
        { text: '田里长得怎么样？', replies: [
          '旱田那边挺好的，水田的水位要再看一下。',
          '有一棵长得特别快，我怀疑是它偷偷多喝了水。',
          '土有点干。今天得浇一次。'
        ] },
        { text: '需要我帮忙吗？', replies: [
          '不用。你坐着就好。',
          '那……帮我把那边的工具递一下。',
          '你要是想帮忙，就去看看水田。我总怕水太多。'
        ] },
        { text: '种什么比较好？', replies: [
          '种你喜欢的。反正都会长。',
          '土豆最省事，埋下去就不用管了。',
          '水稻要看着水。如果你没空，就先种旱田的。'
        ] }
      ]
    },
    {
      id: 'home', label: '说说家里',
      options: [
        { text: '这个屋子是你自己盖的吗？', replies: [
          '不是。我来的时候它就在这儿了，我只是把里面收拾了一下。',
          '墙有一面塌了，我用木头撑住了。',
          '屋顶漏过一次雨。后来补好了。'
        ] },
        { text: '玩具好玩吗？', replies: [
          '很好玩。尤其是那个的。……我说不上来是哪个最好。',
          '有一个我怎么都玩不好，但是我不想说。',
          '你要不要也试试？'
        ] },
        { text: '喜欢这里吗？', replies: [
          '喜欢。这里安静，而且能看到很远。',
          '嗯。有田，有书，还有一条路通向外边。',
          '挺好的。就是有时候风有点大。'
        ] }
      ]
    },
    {
      id: 'small', label: '随便聊聊',
      options: [
        { text: '你在想什么？', replies: [
          '在想一个问题：为什么影子总是比东西本身长一点。',
          '在想明天。明天和今天大概差不多，但也不是完全一样。',
          '在想你刚才那句问题该怎么回答。'
        ] },
        { text: '给你讲个事', replies: [
          '好，我听着。',
          '嗯。你慢慢说。',
          '我坐下了，你说吧。'
        ] },
        { text: '摸摸头', replies: [
          '……唔。',
          '喂。',
          '这样会乱的。……不过算了。'
        ] }
      ]
    }
  ];

  NT.data.chatTopicById = function (id) {
    var l = NT.data.chatTopics;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  };

  /* ---------------- 出门方式 ---------------- */

  NT.data.travelModes = [
    { id: 'region',  name: '选地区', desc: '指定一个省市' },
    { id: 'bearing', name: '选方向', desc: '往东南西北走' },
    { id: 'random',  name: '随它去', desc: '去哪都行' }
  ];
})(typeof window !== 'undefined' ? window : this);
