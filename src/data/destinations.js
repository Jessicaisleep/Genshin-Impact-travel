/* 纳西妲旅行 · 目的地 = 中国各地区
 * 每个地区带三类内容：景观 / 美食 / 游玩，旅行时从中抽取，组成明信片内容。
 * bearing 用于"方向"选择（n/s/e/w/c），tags 驱动程序化地标绘制。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  NT.data = NT.data || {};

  NT.data.destinations = [
    {
      id: 'beijing', name: '北京', fullName: '北京·胡同与城墙',
      bearing: 'n', desc: '灰墙一直延伸到看不见的地方。风把树影吹得晃来晃去。',
      tags: ['city', 'ancient'], rarity: 'N', weight: 12,
      weatherCompat: ['clear', 'cloudy', 'wind'], anchorY: 0.74, depthScale: 1.00, stampHue: 0,
      palette: { sky: ['#c9d8e8', '#eaf1f7'], far: '#9aa8b8', mid: '#7d848e', near: '#5a5f68', ground: '#8d8478' },
      arriveLines: [
        '灰墙一直延伸到看不见的地方，墙根蹲着一只晒太阳的猫。',
        '胡同很窄，两边门墩上的狮子被摸得发亮。',
        '风把树影吹得晃来晃去，我在墙根站了一会儿。'
      ],
      scenery: [
        { name: '红墙根下', desc: '墙是那种暗红，被雨淋过的地方颜色更深一些。', sticker: 'pagoda' },
        { name: '城墙上的风', desc: '站在上面，风很大，能看见很远的地方。', sticker: 'map' }
      ],
      food: [
        { name: '吃了烤鸭', desc: '皮很脆，卷上薄饼和葱丝，一口下去有点烫。', sticker: 'dumpling' },
        { name: '喝了一碗豆汁', desc: '味道很怪。喝第二口的时候好像明白了一点。', sticker: 'bowl' }
      ],
      play: [
        { name: '放了一只风筝', desc: '线绷得很紧，抬头看久了脖子会酸。', sticker: 'kite' },
        { name: '逛了半天胡同', desc: '没什么目的，只是走。走着走着天就黑了。', sticker: 'compass' }
      ]
    },
    {
      id: 'harbin', name: '哈尔滨', fullName: '哈尔滨·冰城',
      bearing: 'n', desc: '冷得说话都会冒白气。屋顶积了厚厚一层雪，边缘圆圆的。',
      tags: ['snow', 'city'], rarity: 'R', weight: 10,
      weatherCompat: ['snow', 'cloudy', 'clear'], anchorY: 0.72, depthScale: 1.02, stampHue: 205,
      palette: { sky: ['#c6dcf0', '#eef5fc'], far: '#a8c0d6', mid: '#8098b0', near: '#5b7288', ground: '#e8f0f8' },
      arriveLines: [
        '冷得说话都会冒白气，我把围巾往上拉了拉。',
        '屋顶积了厚厚一层雪，边缘圆圆的，像盖了糖霜。',
        '江面冻住了，有人在上面走出了一条路。'
      ],
      scenery: [
        { name: '结了冰的江', desc: '冰面底下有气泡，一层一层的，像被冻住的时间。', sticker: 'snowflake' },
        { name: '雪里的屋顶', desc: '一排屋顶全是白的，烟囱冒出的气也是白的。', sticker: 'snowflake' }
      ],
      food: [
        { name: '吃了一份锅包肉', desc: '外壳是酸的，咬开之后里面很烫。', sticker: 'bowl' },
        { name: '啃了一根冰棍', desc: '越冷越想吃，这个道理我到现在也没想明白。', sticker: 'icecream' }
      ],
      play: [
        { name: '看了冰灯', desc: '冰里冻着灯，光是透出来的，不是照出来的。', sticker: 'lantern' },
        { name: '摔了一跤', desc: '不疼，但是站起来的时候有点不好意思。', sticker: 'star' }
      ]
    },
    {
      id: 'hulunbuir', name: '呼伦贝尔', fullName: '呼伦贝尔·草原',
      bearing: 'n', desc: '草一直铺到天边。云在天上跑，影子在草上跑。',
      tags: ['plain', 'wind'], rarity: 'R', weight: 10,
      weatherCompat: ['clear', 'cloudy', 'wind'], anchorY: 0.70, depthScale: 0.98, stampHue: 120,
      palette: { sky: ['#a8d8f0', '#dff0fa'], far: '#a8c8b0', mid: '#7fae6a', near: '#5c8a4a', ground: '#6f9a55' },
      arriveLines: [
        '草一直铺到天边，云在天上跑，影子就在草上跑。',
        '走了很久景色都没变，回头一看，帐篷已经很小了。',
        '这里的风是整片的，不是一阵一阵的。'
      ],
      scenery: [
        { name: '白桦林', desc: '树干是白的，上面有黑色的疤，像谁随手点的。', sticker: 'leaf' },
        { name: '草原上的日落', desc: '太阳是慢慢沉到草里去的，不是落到山后面。', sticker: 'star' }
      ],
      food: [
        { name: '喝了咸奶茶', desc: '第一口不习惯，第二口就停不下来了。', sticker: 'tea' },
        { name: '吃了手把肉', desc: '用刀自己割着吃，吃完手上全是油。', sticker: 'bowl' }
      ],
      play: [
        { name: '骑了一小段马', desc: '颠得厉害，但是风从耳朵边过的时候很舒服。', sticker: 'compass' },
        { name: '躺下看星星', desc: '躺平之后天变得特别大，星星多得数不过来。', sticker: 'star' }
      ]
    },
    {
      id: 'turpan', name: '吐鲁番', fullName: '吐鲁番·火焰山',
      bearing: 'w', desc: '热气从地面上冒起来，远处的路像化了。葡萄架下是唯一凉快的地方。',
      tags: ['desert'], rarity: 'SR', weight: 7,
      weatherCompat: ['clear', 'cloudy'], anchorY: 0.71, depthScale: 1.02, stampHue: 35,
      palette: { sky: ['#ffd9a0', '#ffeccc'], far: '#e0ac6b', mid: '#c98d52', near: '#9c6a3a', ground: '#c69457' },
      arriveLines: [
        '热气从地面上冒起来，远处的路看起来像化掉了。',
        '山是红的，被太阳晒得发亮，我看了好久才敢走近。',
        '葡萄架下面是唯一凉快的地方，我坐在那儿不想走。'
      ],
      scenery: [
        { name: '红色的山', desc: '一层一层的纹路，像被谁用手指划过。', sticker: 'stone' },
        { name: '坎儿井的水', desc: '地底下居然有水，凉的，摸一下手都精神了。', sticker: 'bowl' }
      ],
      food: [
        { name: '吃了一串葡萄', desc: '甜得不讲道理。籽很小，可以一起咽下去。', sticker: 'grape' },
        { name: '买了烤包子', desc: '皮是脆的，里面的汁差点滴到衣服上。', sticker: 'dumpling' }
      ],
      play: [
        { name: '骑着骆驼走了一段', desc: '起来和坐下的时候最吓人，中间其实很稳。', sticker: 'camel' },
        { name: '摘了一筐葡萄', desc: '剪刀不太会用，还是园主帮我剪的。', sticker: 'grape' }
      ]
    },
    {
      id: 'dunhuang', name: '敦煌', fullName: '敦煌·鸣沙山',
      bearing: 'w', desc: '沙山是软的，走一步陷半步。山下有一小片水，弯弯的。',
      tags: ['desert', 'ancient'], rarity: 'SR', weight: 7,
      weatherCompat: ['clear', 'cloudy'], anchorY: 0.70, depthScale: 1.02, stampHue: 40,
      palette: { sky: ['#ffd2a0', '#ffe8c8'], far: '#d9a468', mid: '#bb8348', near: '#8f6234', ground: '#cf9c5e' },
      arriveLines: [
        '沙山是软的，走一步陷半步，最后干脆坐下来滑下去。',
        '山下有一小片水，弯弯的，风再大也没把它埋掉。',
        '傍晚的时候沙子会变颜色，一层金一层红。'
      ],
      scenery: [
        { name: '洞窟里的画', desc: '颜色比想象中沉，人物很多，每一个都不太一样。', sticker: 'pagoda' },
        { name: '月牙形的湖', desc: '周围全是沙，只有这一小块水，安静得奇怪。', sticker: 'fish' }
      ],
      food: [
        { name: '喝了一杯杏皮水', desc: '酸甜的，凉的，喝下去整个人都醒过来了。', sticker: 'tea' },
        { name: '吃了一碗面', desc: '面很宽，浇头不多，但是很香。', sticker: 'bowl' }
      ],
      play: [
        { name: '从沙坡上滑下来', desc: '沙子会跟着一起滑，声音闷闷的，像在响。', sticker: 'sand' },
        { name: '看了很久的壁画', desc: '有些地方掉了色，但剩下的还是很清楚。', sticker: 'book' }
      ]
    },
    {
      id: 'nyingchi', name: '林芝', fullName: '林芝·桃花沟',
      bearing: 'w', desc: '雪山在远处，近处全是桃花。风一过，花瓣落得比雪还慢。',
      tags: ['mountain', 'snow', 'sakura'], rarity: 'SR', weight: 6,
      weatherCompat: ['clear', 'cloudy', 'snow'], anchorY: 0.68, depthScale: 1.05, stampHue: 330,
      palette: { sky: ['#cfe0f5', '#f2f6fc'], far: '#b8c8dc', mid: '#94a8c0', near: '#6d8098', ground: '#e0d8e8' },
      arriveLines: [
        '雪山在远处，近处全是桃花，风一过花瓣落得比雪还慢。',
        '云在半山腰挂着，山尖露在外面，白得晃眼。',
        '这里的空气很薄，走快两步就得停下来喘。'
      ],
      scenery: [
        { name: '桃花开满山谷', desc: '一整条沟都是粉的，中间夹着几棵绿树。', sticker: 'peach' },
        { name: '远处的雪山', desc: '太阳照到山顶的时候，整座山会亮一下。', sticker: 'snowflake' }
      ],
      food: [
        { name: '喝了酥油茶', desc: '咸的，油花浮在上面，喝完身上暖起来。', sticker: 'tea' },
        { name: '捏了一团糌粑', desc: '捏得不太好看，但是蘸着茶吃还不错。', sticker: 'dumpling' }
      ],
      play: [
        { name: '跟着转了一段经', desc: '不知道要转多少圈，跟着转就是了。', sticker: 'bell' },
        { name: '在桃树下坐了一下午', desc: '什么也没做。花瓣落到本子上了。', sticker: 'peach' }
      ]
    },
    {
      id: 'chengdu', name: '成都', fullName: '成都·巷子与竹林',
      bearing: 'w', desc: '竹椅摆在门口，茶盖一掀，一坐就是半天。',
      tags: ['city', 'rainforest'], rarity: 'N', weight: 12,
      weatherCompat: ['clear', 'cloudy', 'rain'], anchorY: 0.75, depthScale: 0.98, stampHue: 140,
      palette: { sky: ['#cfe6d8', '#eaf5ee'], far: '#a8c4b0', mid: '#7ea888', near: '#567a5e', ground: '#6f9276' },
      arriveLines: [
        '竹椅摆在门口，茶盖一掀，一坐就是半天。',
        '巷子绕来绕去，走着走着就不知道自己在哪了。',
        '这里的人说话慢慢的，我听着也就慢下来了。'
      ],
      scenery: [
        { name: '一片竹林', desc: '风过的时候整片都在响，但是看不到风在哪。', sticker: 'bamboo' },
        { name: '老茶馆', desc: '椅子是竹子的，坐久了会有印子留在腿上。', sticker: 'tea' }
      ],
      food: [
        { name: '吃了一次火锅', desc: '辣得直吸气，但是手一直没停。', sticker: 'hotpot' },
        { name: '吃了一碗担担面', desc: '面不多，拌匀之后每一根都裹着酱。', sticker: 'bowl' }
      ],
      play: [
        { name: '去看了一次熊猫', desc: '它一直在吃，偶尔抬头看一眼，然后又低头吃。', sticker: 'panda' },
        { name: '在茶馆坐了一下午', desc: '没人赶我走，续了好几次水。', sticker: 'tea' }
      ]
    },
    {
      id: 'xian', name: '西安', fullName: '西安·城墙内',
      bearing: 'c', desc: '城墙是方的，围住了一整座城。灯亮起来的时候，砖缝里都是暖的。',
      tags: ['city', 'ancient'], rarity: 'N', weight: 12,
      weatherCompat: ['clear', 'cloudy', 'rain'], anchorY: 0.73, depthScale: 1.00, stampHue: 25,
      palette: { sky: ['#e0d0b8', '#f4ebdc'], far: '#c0a884', mid: '#9a8058', near: '#6e5a3c', ground: '#9c8460' },
      arriveLines: [
        '城墙是方的，围住了一整座城，站在上面能看见两头。',
        '灯亮起来的时候，砖缝里都是暖的。',
        '街上人很多，但是大家都走得不快。'
      ],
      scenery: [
        { name: '城墙上的砖', desc: '每一块都不太一样，有的上面还刻着字。', sticker: 'stone' },
        { name: '一排陶俑', desc: '站得整整齐齐，脸一个和一个都不一样。', sticker: 'mask' }
      ],
      food: [
        { name: '吃了一个肉夹馍', desc: '饼是脆的，肉汁顺着手指往下流。', sticker: 'dumpling' },
        { name: '掰了一碗泡馍', desc: '要自己掰，掰得越小越好吃。手有点酸。', sticker: 'bowl' }
      ],
      play: [
        { name: '骑车绕了一圈城墙', desc: '路很颠，屁股有点疼，但是风很好。', sticker: 'bike' },
        { name: '看了一场灯', desc: '人挤人，我只能踮着脚看。', sticker: 'lantern' }
      ]
    },
    {
      id: 'zhangjiajie', name: '张家界', fullName: '张家界·峰林',
      bearing: 'c', desc: '石柱一根根从雾里立起来，看不到底。',
      tags: ['mountain', 'rainforest'], rarity: 'R', weight: 9,
      weatherCompat: ['clear', 'cloudy', 'rain'], anchorY: 0.68, depthScale: 1.06, stampHue: 155,
      palette: { sky: ['#c8dcd0', '#e8f2ec'], far: '#a0b8a8', mid: '#78948a', near: '#4e6a62', ground: '#5f7a70' },
      arriveLines: [
        '石柱一根根从雾里立起来，看不到底。',
        '雾散了一下，又合上，像有人把帘子拉开又放下。',
        '台阶很多，数到两百多就放弃了。'
      ],
      scenery: [
        { name: '雾里的峰林', desc: '只露出上半截，下面全是白的。', sticker: 'stone' },
        { name: '一条溪', desc: '水很浅，能看见底下每一块石头。', sticker: 'fish' }
      ],
      food: [
        { name: '吃了一碗米粉', desc: '汤是红的，其实不太辣，就是香。', sticker: 'bowl' },
        { name: '点了一份三下锅', desc: '什么都有，吃着吃着就分不清是什么了。', sticker: 'hotpot' }
      ],
      play: [
        { name: '走了玻璃栈道', desc: '我尽量不看脚下，只看前面。', sticker: 'compass' },
        { name: '坐了很长的索道', desc: '缆车晃了一下，我抓紧了扶手。', sticker: 'map' }
      ]
    },
    {
      id: 'suzhou', name: '苏州', fullName: '苏州·水巷',
      bearing: 'e', desc: '白墙黑瓦，河从屋子底下过。船摇过来的时候，水会拍到石阶上。',
      tags: ['city', 'water'], rarity: 'R', weight: 9,
      weatherCompat: ['clear', 'cloudy', 'rain'], anchorY: 0.74, depthScale: 0.98, stampHue: 190,
      palette: { sky: ['#d8e4e8', '#f0f6f8'], far: '#a8b8c0', mid: '#84949e', near: '#5c6a74', ground: '#8fa8ae' },
      arriveLines: [
        '白墙黑瓦，河从屋子底下过，船摇过来的时候水会拍到石阶上。',
        '门很小，进去之后院子却很大。',
        '雨下得很细，伞可打可不打，我就没打。'
      ],
      scenery: [
        { name: '一座园林', desc: '窗子是空的，每个窗框看出去都是一幅画。', sticker: 'pagoda' },
        { name: '水巷里的桥', desc: '桥不高，但是拱得很圆，下面的影子也是一个圆。', sticker: 'boat' }
      ],
      food: [
        { name: '吃了一碗汤面', desc: '汤很清，面很细，上面的浇头只有一点点。', sticker: 'bowl' },
        { name: '喝了一碗糖粥', desc: '甜得很老实，就是米和糖的味道。', sticker: 'candy' }
      ],
      play: [
        { name: '坐了一趟小船', desc: '船夫一边摇一边讲话，我一句也没听懂。', sticker: 'boat' },
        { name: '听了一段评弹', desc: '听不懂词，但是调子很好听，听着听着就困了。', sticker: 'bell' }
      ]
    },
    {
      id: 'hangzhou', name: '杭州', fullName: '杭州·西湖边',
      bearing: 'e', desc: '湖面上有一层薄薄的雾。柳条垂到水里，被风吹得画圈。',
      tags: ['plain', 'water'], rarity: 'N', weight: 11,
      weatherCompat: ['clear', 'cloudy', 'rain'], anchorY: 0.72, depthScale: 0.98, stampHue: 165,
      palette: { sky: ['#d4e8e0', '#eef7f2'], far: '#a8c4b8', mid: '#82a894', near: '#5c8272', ground: '#7fa892' },
      arriveLines: [
        '湖面上有一层薄薄的雾，远处的东西都变得不真切。',
        '柳条垂到水里，被风吹得画圈。',
        '绕湖走了一段，走走停停，也没走到头。'
      ],
      scenery: [
        { name: '一片茶园', desc: '一行一行的，修剪得很整齐，闻起来是清的。', sticker: 'leaf' },
        { name: '湖心的岛', desc: '要坐船过去，岛上比岸上安静得多。', sticker: 'boat' }
      ],
      food: [
        { name: '吃了一块定胜糕', desc: '粉粉的，甜的，一口就没了。', sticker: 'candy' },
        { name: '喝了一杯龙井', desc: '叶子在水里慢慢展开，我看了很久。', sticker: 'tea' }
      ],
      play: [
        { name: '划了一会儿船', desc: '桨比我以为的重，划了半天还在原地附近。', sticker: 'boat' },
        { name: '在茶园里走了一圈', desc: '采茶的人手指很快，我看不清是怎么弄的。', sticker: 'leaf' }
      ]
    },
    {
      id: 'xiamen', name: '厦门', fullName: '厦门·海岛',
      bearing: 's', desc: '海就在路边。风是咸的，树叶子是硬的。',
      tags: ['sea', 'city'], rarity: 'R', weight: 10,
      weatherCompat: ['clear', 'cloudy', 'rain'], anchorY: 0.66, depthScale: 0.96, stampHue: 200,
      palette: { sky: ['#b8dff0', '#e6f5fc'], far: '#8cc0d8', mid: '#5f9ec4', near: '#3d7aa0', ground: '#e0d4b0' },
      arriveLines: [
        '海就在路边，走几步就得停下来看一眼。',
        '风是咸的，树叶子是硬的，摸上去有点像塑料。',
        '岛上没有车，只有脚步声和很远的船鸣。'
      ],
      scenery: [
        { name: '老别墅', desc: '墙是红的，窗是拱的，院子里有棵很大的树。', sticker: 'pagoda' },
        { name: '海边的礁石', desc: '退潮之后能走下去，石头缝里全是小东西。', sticker: 'shell' }
      ],
      food: [
        { name: '吃了一碗沙茶面', desc: '汤稠稠的，味道说不上来，但是想再喝一口。', sticker: 'bowl' },
        { name: '尝了一份海蛎煎', desc: '外面脆里面软，蘸了酱更好吃。', sticker: 'fish' }
      ],
      play: [
        { name: '沿海骑了车', desc: '一路都是海，骑到后面腿酸了也不想停。', sticker: 'bike' },
        { name: '在沙滩上走了一段', desc: '沙子是温的，鞋里进了不少。', sticker: 'shell' }
      ]
    },
    {
      id: 'guilin', name: '桂林', fullName: '桂林·山水',
      bearing: 's', desc: '山是一个一个独立的小包，圆圆的。水从中间绕过去。',
      tags: ['mountain', 'water'], rarity: 'R', weight: 10,
      weatherCompat: ['clear', 'cloudy', 'rain'], anchorY: 0.70, depthScale: 1.02, stampHue: 130,
      palette: { sky: ['#cfe4d8', '#ecf6f0'], far: '#a4c0ac', mid: '#7a9c86', near: '#547862', ground: '#86a890' },
      arriveLines: [
        '山是一个一个独立的小包，圆圆的，像是随便摆在那里的。',
        '水从山中间绕过去，船走得很慢，正好够我看完两边。',
        '雾一起来，山就只剩一个淡淡的影子。'
      ],
      scenery: [
        { name: '江上的山影', desc: '水里的山比真的那座还要完整一点。', sticker: 'stone' },
        { name: '一个山洞', desc: '里面很凉，石头上有水在滴，一下一下的。', sticker: 'key' }
      ],
      food: [
        { name: '吃了一碗桂林米粉', desc: '粉是圆的，卤水很香，我加了两勺。', sticker: 'bowl' },
        { name: '点了一条啤酒鱼', desc: '鱼很鲜，就是刺有点多，吃得慢。', sticker: 'fish' }
      ],
      play: [
        { name: '坐了竹筏', desc: '水会从竹缝里冒上来，鞋有点湿。', sticker: 'boat' },
        { name: '在江边坐了很久', desc: '什么也没做，就看着水往一个方向走。', sticker: 'feather' }
      ]
    },
    {
      id: 'dali', name: '大理', fullName: '大理·洱海边',
      bearing: 's', desc: '湖很大，对面是山。云压得很低，像要碰到水面。',
      tags: ['mountain', 'water'], rarity: 'R', weight: 9,
      weatherCompat: ['clear', 'cloudy', 'wind'], anchorY: 0.69, depthScale: 1.00, stampHue: 210,
      palette: { sky: ['#bcd8ec', '#e8f2fa'], far: '#94b0cc', mid: '#6e8cae', near: '#48607e', ground: '#8fa8c0' },
      arriveLines: [
        '湖很大，对面是山。云压得很低，像要碰到水面。',
        '风一直在吹，头发一直糊在脸上。',
        '白墙的屋子一间挨一间，屋顶上晒着东西。'
      ],
      scenery: [
        { name: '苍山的云', desc: '云卡在半山腰，一整天都没挪地方。', sticker: 'star' },
        { name: '洱海边的树', desc: '几棵树直接长在水里，影子被水拉得很长。', sticker: 'leaf' }
      ],
      food: [
        { name: '吃了一块乳扇', desc: '烤过之后有点韧，甜的，越嚼越香。', sticker: 'candy' },
        { name: '吃了一碗饵丝', desc: '比面要软，汤是清的，早上吃很合适。', sticker: 'bowl' }
      ],
      play: [
        { name: '绕湖骑了一段', desc: '路很平，但是风一直顶着，骑得很慢。', sticker: 'bike' },
        { name: '在古城里转了转', desc: '卖什么的都有，我最后只买了一张明信片。', sticker: 'camera' }
      ]
    },
    {
      id: 'sanya', name: '三亚', fullName: '三亚·海边',
      bearing: 's', desc: '水是那种很浅的绿，能看到底下。椰子树歪歪地长着。',
      tags: ['sea', 'plain'], rarity: 'R', weight: 10,
      weatherCompat: ['clear', 'cloudy', 'rain'], anchorY: 0.65, depthScale: 0.96, stampHue: 175,
      palette: { sky: ['#a8e0e8', '#dff5f8'], far: '#7fc8d4', mid: '#4fa8bc', near: '#2f8298', ground: '#e8dcc0' },
      arriveLines: [
        '水是那种很浅的绿，能看到底下，也能看到自己的脚。',
        '椰子树歪歪地长着，像是被风吹了很多年。',
        '太阳很晒，走几步就得找一片影子。'
      ],
      scenery: [
        { name: '一片椰林', desc: '掉下来的椰子堆在树根那儿，没人捡。', sticker: 'leaf' },
        { name: '退潮后的滩', desc: '露出一大片湿的沙，上面全是小洞。', sticker: 'shell' }
      ],
      food: [
        { name: '喝了一碗清补凉', desc: '里面什么都有，冰冰的，一下就凉快了。', sticker: 'icecream' },
        { name: '吃了一顿海鲜', desc: '壳比肉多，但是很新鲜。', sticker: 'fish' }
      ],
      play: [
        { name: '下水浮了一会儿', desc: '水很暖，飘着不用使劲，差点睡着。', sticker: 'fish' },
        { name: '捡了一堆贝壳', desc: '挑了半天，最后发现最好看的那个是碎的。', sticker: 'shell' }
      ]
    },
    {
      id: 'guangzhou', name: '广州', fullName: '广州·骑楼与早茶',
      bearing: 's', desc: '骑楼把太阳挡在外面，走在底下凉凉的。',
      tags: ['city', 'rainforest'], rarity: 'N', weight: 11,
      weatherCompat: ['clear', 'cloudy', 'rain'], anchorY: 0.74, depthScale: 1.00, stampHue: 15,
      palette: { sky: ['#e0dcc0', '#f4f2e0'], far: '#bcc0a0', mid: '#94987c', near: '#6c7058', ground: '#9c9c78' },
      arriveLines: [
        '骑楼把太阳挡在外面，走在底下凉凉的。',
        '街上一直很吵，但是不烦，听着听着就习惯了。',
        '这里的树很大，垂下来的须子会碰到头。'
      ],
      scenery: [
        { name: '一排骑楼', desc: '柱子是一根一根的，走过去的时候影子会一段一段地变。', sticker: 'pagoda' },
        { name: '一棵大榕树', desc: '须子垂下来扎进土里，又长成了新的树干。', sticker: 'leaf' }
      ],
      food: [
        { name: '吃了一顿早茶', desc: '一笼一笼地上来，吃到最后我都记不清吃了什么。', sticker: 'dumpling' },
        { name: '吃了一碟肠粉', desc: '很滑，酱是甜的，两口就没了。', sticker: 'bowl' }
      ],
      play: [
        { name: '逛了夜市', desc: '灯很亮，人很多，我跟着人流走。', sticker: 'lantern' },
        { name: '在江边看了一会儿', desc: '对岸的灯倒在水里，被船搅散了又合起来。', sticker: 'boat' }
      ]
    },
    {
      id: 'mohe', name: '漠河', fullName: '漠河·北极村',
      bearing: 'n', desc: '冷到睫毛上会结霜。晚上十点天还亮着，北边的天有时会亮起来。',
      tags: ['snow', 'mountain'], rarity: 'SSR', weight: 2,
      weatherCompat: ['snow', 'cloudy', 'clear'], anchorY: 0.70, depthScale: 1.04, stampHue: 215,
      palette: { sky: ['#b8d0e8', '#e8f2fb'], far: '#9db4cc', mid: '#7a92ac', near: '#57697e', ground: '#e4eef8' },
      arriveLines: [
        '冷到睫毛上会结霜，我把围巾一直拉到眼睛下面。',
        '晚上十点天还亮着，我坐在那儿等天黑，等着等着就睡着了。',
        '北边的天有时候会亮起来，绿色的，一层一层地动。'
      ],
      scenery: [
        { name: '最北的邮局', desc: '从这里寄出的信，会盖一个特别的戳。', sticker: 'pagoda' },
        { name: '江的源头', desc: '水很浅，能看见底下的石头，凉得刺手。', sticker: 'fish' }
      ],
      food: [
        { name: '吃了一锅冷水鱼', desc: '汤是白的，鱼肉很紧，喝完整个人都暖了。', sticker: 'bowl' },
        { name: '抓了一把蓝莓', desc: '野生的，很小，酸的比甜的多。', sticker: 'grape' }
      ],
      play: [
        { name: '找到了最北的那块碑', desc: '排队拍照的人很多，我等到最后才过去。', sticker: 'stone' },
        { name: '坐了一趟雪橇', desc: '狗跑得比我想的快，风把帽子吹掉了。', sticker: 'snowflake' }
      ]
    }
  ];

  NT.data.destinationById = function (id) {
    var list = NT.data.destinations;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  /** 方位 -> 该方位的地区列表 */
  NT.data.destinationsByBearing = function (bearing) {
    return NT.data.destinations.filter(function (d) {
      return !bearing || bearing === 'any' || d.bearing === bearing;
    });
  };
})(typeof window !== 'undefined' ? window : this);
