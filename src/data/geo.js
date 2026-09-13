/* 纳西妲旅行 · 地理与行程花费
 * 用真实经纬度算球面距离，再乘"偏远系数"得到行程花费（km 当量）。
 * 食物与道具提供预算，预算够不够决定她能不能走到目标。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});
  NT.data = NT.data || {};

  /** lat/lng 为近似值；remoteness 表示"路好不好走"，越高越难到 */
  NT.data.geo = {
    mohe:        { lat: 52.97, lng: 122.54, remoteness: 2.10 },  // 漠河：最北，最难
    harbin:      { lat: 45.80, lng: 126.53, remoteness: 1.15 },
    hulunbuir:   { lat: 49.22, lng: 119.77, remoteness: 1.35 },
    kanas:       { lat: 48.70, lng:  87.00, remoteness: 1.90 },  // 喀纳斯：西北角
    beijing:     { lat: 39.90, lng: 116.41, remoteness: 1.00 },
    xian:        { lat: 34.34, lng: 108.94, remoteness: 1.00 },
    chengdu:     { lat: 30.57, lng: 104.07, remoteness: 1.05 },
    zhangjiajie: { lat: 29.12, lng: 110.48, remoteness: 1.15 },
    dali:        { lat: 25.61, lng: 100.27, remoteness: 1.35 },
    nyingchi:    { lat: 29.65, lng:  94.36, remoteness: 1.70 },
    dunhuang:    { lat: 40.14, lng:  94.66, remoteness: 1.40 },
    turpan:      { lat: 42.95, lng:  89.19, remoteness: 1.45 },
    suzhou:      { lat: 31.30, lng: 120.58, remoteness: 1.00 },
    hangzhou:    { lat: 30.27, lng: 120.16, remoteness: 1.00 },
    xiamen:      { lat: 24.48, lng: 118.09, remoteness: 1.05 },
    guilin:      { lat: 25.27, lng: 110.29, remoteness: 1.15 },
    guangzhou:   { lat: 23.13, lng: 113.26, remoteness: 1.00 },
    sanya:       { lat: 18.25, lng: 109.51, remoteness: 1.20 }
  };

  /**
   * 取某个地方的坐标。
   * 查找顺序：
   *   1. 地区条目里**直接写的** lat/lng ——
   *      这样新增一个地区时，只要在 destinations.js 里那一行写上坐标就行，
   *      不用再回来改 geo 表
   *   2. geo 表（内置的 17 个目的地）
   *   3. homeCityGeo（额外的家乡候选城市）
   *   4. 兜底（不会崩，但位置会不准 —— 自检里会报出来）
   */
  NT.data.geoOf = function (id) {
    var dest = NT.data.destinationById ? NT.data.destinationById(id) : null;
    if (dest && typeof dest.lat === 'number' && typeof dest.lng === 'number') {
      return {
        lat: dest.lat,
        lng: dest.lng,
        remoteness: typeof dest.remoteness === 'number' ? dest.remoteness : 1.2,
        inline: true
      };
    }
    return NT.data.geo[id] || NT.data.homeCityGeo[id] || { lat: 35, lng: 110, remoteness: 1.2 };
  };

  /** 这个地方的坐标是"猜的"（没在 geo 表里、条目里也没写） */
  NT.data.hasRealGeo = function (id) {
    var dest = NT.data.destinationById ? NT.data.destinationById(id) : null;
    if (dest && typeof dest.lat === 'number' && typeof dest.lng === 'number') return true;
    return !!(NT.data.geo[id] || NT.data.homeCityGeo[id]);
  };

  /**
   * 额外的"家乡"候选城市。
   * 这些只用来当出发点（算距离/方向），不作为旅行目的地 —— 目的地的文案量很大，
   * 而家乡只需要一个坐标。所以这里可以放心多给。
   */
  NT.data.homeCityGeo = {
    shanghai:    { lat: 31.23, lng: 121.47, remoteness: 1 },
    tianjin:     { lat: 39.08, lng: 117.20, remoteness: 1 },
    chongqing:   { lat: 29.56, lng: 106.55, remoteness: 1.1 },
    nanjing:     { lat: 32.06, lng: 118.80, remoteness: 1 },
    wuhan:       { lat: 30.59, lng: 114.31, remoteness: 1 },
    changsha:    { lat: 28.23, lng: 112.94, remoteness: 1.05 },
    zhengzhou:   { lat: 34.75, lng: 113.63, remoteness: 1 },
    jinan:       { lat: 36.65, lng: 117.12, remoteness: 1 },
    qingdao:     { lat: 36.07, lng: 120.38, remoteness: 1 },
    shenyang:    { lat: 41.80, lng: 123.43, remoteness: 1.1 },
    changchun:   { lat: 43.82, lng: 125.32, remoteness: 1.15 },
    shijiazhuang:{ lat: 38.04, lng: 114.51, remoteness: 1 },
    taiyuan:     { lat: 37.87, lng: 112.55, remoteness: 1.05 },
    hefei:       { lat: 31.82, lng: 117.23, remoteness: 1 },
    nanchang:    { lat: 28.68, lng: 115.86, remoteness: 1.05 },
    fuzhou:      { lat: 26.07, lng: 119.30, remoteness: 1.05 },
    guiyang:     { lat: 26.65, lng: 106.63, remoteness: 1.2 },
    kunming:     { lat: 25.04, lng: 102.72, remoteness: 1.25 },
    lanzhou:     { lat: 36.06, lng: 103.83, remoteness: 1.2 },
    xining:      { lat: 36.62, lng: 101.78, remoteness: 1.3 },
    yinchuan:    { lat: 38.49, lng: 106.23, remoteness: 1.2 },
    huhehaote:   { lat: 40.84, lng: 111.75, remoteness: 1.15 },
    wulumuqi:    { lat: 43.83, lng:  87.62, remoteness: 1.6 },
    lasa:        { lat: 29.65, lng:  91.14, remoteness: 1.7 },
    nanning:     { lat: 22.82, lng: 108.37, remoteness: 1.1 },
    haikou:      { lat: 20.04, lng: 110.32, remoteness: 1.1 },
    ningbo:      { lat: 29.87, lng: 121.55, remoteness: 1 },
    wenzhou:     { lat: 28.00, lng: 120.70, remoteness: 1 },
    dongguan:    { lat: 23.02, lng: 113.75, remoteness: 1 },
    zhuhai:      { lat: 22.27, lng: 113.58, remoteness: 1 },
    luoyang:     { lat: 34.62, lng: 112.45, remoteness: 1 },
    kaifeng:     { lat: 34.80, lng: 114.31, remoteness: 1 },
    datong:      { lat: 40.09, lng: 113.30, remoteness: 1.1 },
    yanbian:     { lat: 42.90, lng: 129.51, remoteness: 1.35 }
  };

  /** 家乡候选 = 所有目的地 + 额外城市。惰性构建（geo.js 比 destinations.js 先加载） */
  var HOME_CITY_NAME = {
    shanghai: '上海', tianjin: '天津', chongqing: '重庆', nanjing: '南京', wuhan: '武汉',
    changsha: '长沙', zhengzhou: '郑州', jinan: '济南', qingdao: '青岛', shenyang: '沈阳',
    changchun: '长春', shijiazhuang: '石家庄', taiyuan: '太原', hefei: '合肥', nanchang: '南昌',
    fuzhou: '福州', guiyang: '贵阳', kunming: '昆明', lanzhou: '兰州', xining: '西宁',
    yinchuan: '银川', huhehaote: '呼和浩特', wulumuqi: '乌鲁木齐', lasa: '拉萨',
    nanning: '南宁', haikou: '海口', ningbo: '宁波', wenzhou: '温州', dongguan: '东莞',
    zhuhai: '珠海', luoyang: '洛阳', kaifeng: '开封', datong: '大同', yanbian: '延边'
  };

  var _homeCities = null;
  NT.data.homeCities = function () {
    if (_homeCities) return _homeCities;
    var out = [];
    var list = NT.data.destinations || [];
    for (var i = 0; i < list.length; i++) {
      out.push({ id: list[i].id, name: list[i].name, bearing: list[i].bearing, isDestination: true });
    }
    var extra = NT.data.homeCityGeo;
    var seen = {};
    for (var k in extra) {
      if (seen[k]) continue;
      seen[k] = 1;
      if (NT.data.geo[k]) continue;          // 已经是目的地，别重复
      out.push({ id: k, name: HOME_CITY_NAME[k] || k, bearing: 'c', isDestination: false });
    }
    _homeCities = out;
    return out;
  };

  NT.data.homeCityById = function (id) {
    var l = NT.data.homeCities();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  };

  /** 家乡显示名（可能是额外城市，不在 destinations 里） */
  NT.data.homeName = function (id) {
    var c = NT.data.homeCityById(id);
    return c ? c.name : id;
  };

  var R_EARTH = 6371;

  function rad(d) { return d * Math.PI / 180; }

  /** 球面距离（km） */
  NT.data.distanceKm = function (aId, bId) {
    var a = NT.data.geoOf(aId), b = NT.data.geoOf(bId);
    var dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h))));
  };

  /** 行程花费 = 距离 × 偏远系数。同城为 0。 */
  NT.data.travelCost = function (homeId, destId) {
    if (homeId === destId) return 0;
    var d = NT.data.distanceKm(homeId, destId);
    var rm = NT.data.geoOf(destId).remoteness;
    return Math.round(d * rm);
  };

  /** 线性插值出一个地理点（用于"半路折返"时判断她到了哪） */
  NT.data.lerpGeo = function (aId, bId, f) {
    var a = NT.data.geoOf(aId), b = NT.data.geoOf(bId);
    return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
  };

  /** 找出离某个坐标最近的地区（可排除几个 id） */
  NT.data.nearestDestination = function (point, excludeIds) {
    excludeIds = excludeIds || [];
    var best = null, bestD = Infinity;
    var list = NT.data.destinations;
    for (var i = 0; i < list.length; i++) {
      if (excludeIds.indexOf(list[i].id) >= 0) continue;
      var g = NT.data.geoOf(list[i].id);
      var dLat = rad(g.lat - point.lat), dLng = rad(g.lng - point.lng);
      var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(rad(point.lat)) * Math.cos(rad(g.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
      var d = 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
      if (d < bestD) { bestD = d; best = list[i]; }
    }
    return best;
  };

  /** 从任意经纬度找最近地区（供定位用） */
  NT.data.nearestToLatLng = function (lat, lng) {
    return NT.data.nearestDestination({ lat: lat, lng: lng });
  };

  /* ---------------- 行程时间 ---------------- */

  /** km 当量 -> 小时。同城固定 1 小时，上限 48 小时。 */
  NT.data.KM_PER_HOUR = 95;
  NT.data.MAX_HOURS = 48;
  NT.data.MIN_HOURS = 1;

  NT.data.hoursForCost = function (costKm) {
    if (costKm <= 0) return NT.data.MIN_HOURS;
    var h = 1 + costKm / NT.data.KM_PER_HOUR;
    return NT.data.clampHours(h);
  };

  NT.data.clampHours = function (h) {
    if (h < NT.data.MIN_HOURS) return NT.data.MIN_HOURS;
    if (h > NT.data.MAX_HOURS) return NT.data.MAX_HOURS;
    return Math.round(h * 10) / 10;
  };

  /** 距离分级，用于文案与排序 */
  NT.data.distanceTier = function (costKm) {
    if (costKm <= 0)   return { id: 'local',  name: '本市',   order: 0 };
    if (costKm <= 400) return { id: 'near',   name: '近郊',   order: 1 };
    if (costKm <= 1000) return { id: 'province', name: '邻省', order: 2 };
    if (costKm <= 1800) return { id: 'mid',   name: '中程',   order: 3 };
    if (costKm <= 2600) return { id: 'far',   name: '远程',   order: 4 };
    return { id: 'extreme', name: '极远', order: 5 };
  };
})(typeof window !== 'undefined' ? window : this);
