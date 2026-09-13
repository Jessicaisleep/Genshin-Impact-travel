/* 纳西妲旅行 · 同伴角色池
 * sprite 字段供占位美术画 Q 版小人使用（真实立绘接入后可忽略）。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  NT.data = NT.data || {};

  NT.data.companions = [
    {
      id: 'paimon', name: '派蒙', rarity: 'N', weight: 14,
      callNahida: '小纳西妲',
      traits: ['话多', '爱吃', '黏人'],
      catchphrases: ['这个好好吃！', '派蒙才不是应急食品！'],
      meetLines: [
        '还没走多远就听见有人在喊饿，回头一看是派蒙。',
        '她从天上飘下来，第一句话是问这里有没有吃的。'
      ],
      affinityLines: [
        '我们分吃了一块饼，她坚持说自己只吃了一口。',
        '她讲了一路的话，我听着听着就走到地方了。'
      ],
      tags: ['plain', 'city', 'sea'],
      sprite: { hair: '#f2e6c8', dress: '#e8e2f0', accent: '#f5c451', skin: '#ffe0c8', hat: 'none' }
    },
    {
      id: 'collei', name: '柯莱', rarity: 'N', weight: 13,
      callNahida: '纳西妲大人',
      traits: ['认真', '容易紧张', '努力'],
      catchphrases: ['我、我可以的！', '这个我记下来了。'],
      meetLines: [
        '在路口碰到柯莱，她抱着一摞笔记，正对着一棵树发愁。',
        '她远远看见我，先鞠了个躬，然后才想起来要说话。'
      ],
      affinityLines: [
        '她把今天的见闻全记进了本子，字写得很小很密。',
        '她问我植物的事，我问一句她记一句，比我还认真。'
      ],
      tags: ['rainforest', 'plain'],
      sprite: { hair: '#7fae5c', dress: '#4f7a4a', accent: '#c8e08a', skin: '#ffe0c8', hat: 'none' }
    },
    {
      id: 'tighnari', name: '提纳里', rarity: 'R', weight: 11,
      callNahida: '纳西妲',
      traits: ['严谨', '嘴硬心软', '博学'],
      catchphrases: ['别乱碰，那个有毒。', '……我说了别乱碰。'],
      meetLines: [
        '在林子边上遇到提纳里，他正在数一种我没见过的花。',
        '他先皱了皱眉，然后还是把水囊递了过来。'
      ],
      affinityLines: [
        '他讲了一路雨林里的植物，讲到一半自己先笑了。',
        '他嘴上说我走得慢，脚下却一直没走快。'
      ],
      tags: ['rainforest', 'desert'],
      sprite: { hair: '#4f6f4a', dress: '#7a9a5c', accent: '#d8e8a0', skin: '#ffe0c8', hat: 'ear' }
    },
    {
      id: 'cyno', name: '赛诺', rarity: 'R', weight: 9,
      callNahida: '小吉祥草王',
      traits: ['严肃', '冷幽默', '执着'],
      catchphrases: ['我讲个笑话。', '……不好笑吗。'],
      meetLines: [
        '赛诺站在沙丘上，说了一句很冷的笑话，风把它吹散了。',
        '他走过来，先说正事，然后才想起来该打个招呼。'
      ],
      affinityLines: [
        '他讲了个笑话，我没听懂，他解释了三遍。',
        '他一路都在警惕四周，其实这里什么都没有。'
      ],
      tags: ['desert', 'mountain'],
      sprite: { hair: '#e8e2d0', dress: '#3f4a6a', accent: '#d4b45c', skin: '#d9b090', hat: 'ear' }
    },
    {
      id: 'nilou', name: '妮露', rarity: 'R', weight: 10,
      callNahida: '纳西妲',
      traits: ['温柔', '爱跳舞', '容易害羞'],
      catchphrases: ['要看看我新编的舞吗？', '啊、我不是那个意思……'],
      meetLines: [
        '妮露在水边练舞，看见我之后手忙脚乱地停了下来。',
        '她在城门口转圈，转到我面前才停下。'
      ],
      affinityLines: [
        '她跳了一段给我看，水花溅到了裙子上。',
        '她说跳舞的时候，脑子里什么都不用想。'
      ],
      tags: ['city', 'sea', 'plain'],
      sprite: { hair: '#e07a9a', dress: '#5f8fc4', accent: '#f0d0e0', skin: '#ffe0c8', hat: 'none' }
    },
    {
      id: 'dehya', name: '迪希雅', rarity: 'R', weight: 9,
      callNahida: '小家伙',
      traits: ['豪爽', '可靠', '护短'],
      catchphrases: ['跟紧我。', '这点路算什么。'],
      meetLines: [
        '迪希雅从沙里站起来，拍了拍身上的土，说正好顺路。',
        '她把我往身后一挡，然后才看清前面什么都没有。'
      ],
      affinityLines: [
        '她一路都在我外侧走，说是习惯。',
        '她把水囊塞给我，自己一口都没喝。'
      ],
      tags: ['desert', 'mountain'],
      sprite: { hair: '#e8a04a', dress: '#a04a3a', accent: '#e8c060', skin: '#c9906a', hat: 'none' }
    },
    {
      id: 'klee', name: '可莉', rarity: 'SR', weight: 7,
      callNahida: '草神姐姐',
      traits: ['精力过剩', '天真', '危险'],
      catchphrases: ['可莉是乖孩子！', '轰——！'],
      meetLines: [
        '听见一声闷响，循着声音过去，就看见可莉站在一个坑旁边。',
        '她从草丛里跳出来，把我吓了一跳，她自己也被吓了一跳。'
      ],
      affinityLines: [
        '她说要送我一颗"不危险"的炸弹，我婉拒了。',
        '她捡了一兜石头，说每一颗都有名字。'
      ],
      tags: ['plain', 'sea'],
      sprite: { hair: '#f0d070', dress: '#e05a4a', accent: '#f8f0e0', skin: '#ffe0c8', hat: 'cap' }
    },
    {
      id: 'qiqi', name: '七七', rarity: 'SR', weight: 7,
      callNahida: '草、草神大人',
      traits: ['慢', '记性差', '认真'],
      catchphrases: ['七七……记住了。', '……忘了。'],
      meetLines: [
        '七七站在原地，好像在想事情，又好像什么都没在想。',
        '她从背后走过来，我回头的时候她已经站了一会儿了。'
      ],
      affinityLines: [
        '她把我说的话记在小本子上，写完就忘了刚才写了什么。',
        '她走得很慢，所以我也走得慢，路反而看得更清楚。'
      ],
      tags: ['snow', 'mountain'],
      sprite: { hair: '#a8b8d8', dress: '#4a5a7a', accent: '#e0e8f0', skin: '#e8d8e0', hat: 'cap' }
    }
  ];

  NT.data.companionById = function (id) {
    var list = NT.data.companions;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };
})(typeof window !== 'undefined' ? window : this);
