/* 纳西妲旅行 · 事件池
 * fitsTags 为空表示通用事件；非空则只在目的地包含对应 tag 时出现。
 * sticker 指向程序化绘制的贴纸类型（render/stickers.js）。
 * mood 决定用哪张立绘（idle/happy/tired）。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  NT.data = NT.data || {};

  NT.data.events = [
    { id: 'found_flower', name: '发现一朵花', desc: '路边开着一朵没见过的花，花瓣边上有一圈很淡的蓝。', rarity: 'N', weight: 12, sticker: 'flower', mood: 'happy', fitsTags: [] },
    { id: 'picked_seed', name: '捡到种子', desc: '有一颗种子掉在石缝里，我把它捡起来放进了口袋。', rarity: 'N', weight: 10, sticker: 'seed', mood: 'idle', fitsTags: [] },
    { id: 'long_walk', name: '走了很久的路', desc: '路比想象中长，走到后面腿有点沉了。', rarity: 'N', weight: 12, sticker: 'map', mood: 'tired', fitsTags: [] },
    { id: 'shared_meal', name: '分吃了一顿饭', desc: '把带来的东西分成两份，坐在地上吃完了。', rarity: 'N', weight: 11, sticker: 'cup', mood: 'happy', fitsTags: [] },
    { id: 'found_feather', name: '捡到一根羽毛', desc: '羽毛是温的，像是刚从谁身上掉下来不久。', rarity: 'N', weight: 9, sticker: 'feather', mood: 'idle', fitsTags: [] },
    { id: 'took_photo', name: '留了一张影', desc: '按快门的时候正好有风，照片可能会有点糊。', rarity: 'N', weight: 10, sticker: 'camera', mood: 'happy', fitsTags: [] },
    { id: 'shelter_rain', name: '躲了一场雨', desc: '雨来得很快，两个人挤在同一片叶子下面。', rarity: 'R', weight: 8, sticker: 'leaf', mood: 'idle', fitsTags: ['rainforest', 'plain'] },
    { id: 'night_stars', name: '看了很久的星星', desc: '躺下来的时候才发现，星星比白天看到的云还多。', rarity: 'R', weight: 8, sticker: 'star', mood: 'idle', fitsTags: [] },
    { id: 'shell_on_beach', name: '捡到一只贝壳', desc: '贝壳贴着耳朵能听见声音，虽然这里离海很远。', rarity: 'R', weight: 7, sticker: 'shell', mood: 'happy', fitsTags: ['sea'] },
    { id: 'snow_crystal', name: '接住一片雪', desc: '雪花落在手套上，还没来得及看清楚就化掉了。', rarity: 'R', weight: 7, sticker: 'snowflake', mood: 'idle', fitsTags: ['snow'] },
    { id: 'desert_mirage', name: '看见了幻影', desc: '远处好像有水，走过去只有更多的沙。', rarity: 'R', weight: 6, sticker: 'sand', mood: 'tired', fitsTags: ['desert'] },
    { id: 'old_book', name: '翻到一本旧书', desc: '书页很脆，翻的时候得小心一点。里面夹着一片干掉的叶子。', rarity: 'R', weight: 7, sticker: 'book', mood: 'idle', fitsTags: ['city', 'home'] },
    { id: 'street_food', name: '尝了当地的东西', desc: '摊主说这个要趁热吃，确实很好吃，就是有点烫。', rarity: 'R', weight: 8, sticker: 'candy', mood: 'happy', fitsTags: ['city'] },
    { id: 'climb_peak', name: '爬到了最高处', desc: '上来花了很久，但从这里能看见很远的地方。', rarity: 'R', weight: 7, sticker: 'stone', mood: 'tired', fitsTags: ['mountain', 'snow'] },
    { id: 'found_lantern', name: '点亮了一盏灯', desc: '天黑得比预想中快，好在包里还有一盏。', rarity: 'R', weight: 6, sticker: 'lantern', mood: 'idle', fitsTags: [] },
    { id: 'met_traveler', name: '遇见另一个旅人', desc: '对方只是点了点头就走了，但那一下让人安心。', rarity: 'R', weight: 6, sticker: 'bell', mood: 'happy', fitsTags: [] },
    { id: 'found_mushroom', name: '发现一丛蘑菇', desc: '颜色很鲜艳。提纳里说过，鲜艳的一般都不能吃。', rarity: 'R', weight: 6, sticker: 'mushroom', mood: 'idle', fitsTags: ['rainforest'] },
    { id: 'fish_jumped', name: '鱼跳出了水面', desc: '只看见一下，水面就恢复了原样，像什么都没发生过。', rarity: 'R', weight: 6, sticker: 'fish', mood: 'happy', fitsTags: ['sea', 'city'] },
    { id: 'petal_rain', name: '花瓣落了一身', desc: '风停的时候，帽子里已经攒了一小捧花瓣。', rarity: 'R', weight: 7, sticker: 'petal', mood: 'happy', fitsTags: ['sakura'] },
    { id: 'lost_way', name: '走错了路', desc: '地图上明明有这条路，走了半天才发现是岔了。不过风景还不错。', rarity: 'R', weight: 7, sticker: 'compass', mood: 'tired', fitsTags: [] },
    { id: 'ancient_ruin', name: '发现一处遗迹', desc: '石头上刻着看不懂的字，摸上去已经磨得很平了。', rarity: 'SR', weight: 3, sticker: 'key', mood: 'idle', fitsTags: ['desert', 'mountain'] },
    { id: 'rare_butterfly', name: '见到一只罕见的蝴蝶', desc: '翅膀的颜色会变。它停了大概三秒，然后就飞走了。', rarity: 'SR', weight: 3, sticker: 'butterfly', mood: 'happy', fitsTags: ['rainforest', 'plain'] },
    { id: 'aurora', name: '看见了极光', desc: '天上一层一层地亮起来，谁都没有说话。', rarity: 'SSR', weight: 1, sticker: 'aurora', mood: 'idle', fitsTags: ['snow'] },
    { id: 'old_friend_gift', name: '收到一件旧礼物', desc: '是很久以前给出去的东西，居然又回到了手上。', rarity: 'SSR', weight: 1, sticker: 'gift', mood: 'happy', fitsTags: [] }
  ];

  NT.data.eventById = function (id) {
    var list = NT.data.events;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  /** 天气
   *  tint: [r,g,b,alpha,mode]  mode 省略时按 alpha 自动选择
   *  multiply 用于"压暗/降温"，soft-light 用于"加暖"，源叠加会洗成灰橄榄色，不用。
   */
  NT.data.weathers = [
    { id: 'clear',  name: '晴',   weight: 40, satMul: 1.00, brightMul: 1.00, tint: null },
    { id: 'cloudy', name: '多云', weight: 25, satMul: 0.94, brightMul: 0.97, tint: [205, 210, 220, 0.30, 'multiply'] },
    { id: 'rain',   name: '雨',   weight: 18, satMul: 0.88, brightMul: 0.90, tint: [110, 135, 175, 0.30, 'multiply'] },
    { id: 'snow',   name: '雪',   weight: 10, satMul: 0.84, brightMul: 1.04, tint: [225, 235, 250, 0.34, 'multiply'] },
    { id: 'wind',   name: '风',   weight:  7, satMul: 1.03, brightMul: 1.02, tint: null }
  ];

  NT.data.weatherById = function (id) {
    var list = NT.data.weathers;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  /** 时段 */
  NT.data.timesOfDay = [
    { id: 'dawn',  name: '清晨', weight: 20, brightMul: 0.97, tint: [255, 205, 150, 0.55, 'soft-light'], starAlpha: 0 },
    { id: 'day',   name: '白天', weight: 38, brightMul: 1.00, tint: null, starAlpha: 0 },
    { id: 'dusk',  name: '黄昏', weight: 24, brightMul: 0.90, tint: [255, 155, 115, 0.60, 'soft-light'], starAlpha: 0 },
    { id: 'night', name: '夜晚', weight: 18, brightMul: 0.72, tint: [72, 95, 175, 0.34, 'multiply'], starAlpha: 0.9 }
  ];

  NT.data.timeOfDayById = function (id) {
    var list = NT.data.timesOfDay;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };
})(typeof window !== 'undefined' ? window : this);
