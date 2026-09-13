/* 纳西妲旅行 · 定位（可选）
 * 优先浏览器定位，其次 IP 定位。两者都可能失败（权限 / 跨域 / 离线），
 * 失败就退回让玩家手动选家乡 —— 绝不阻塞游戏。
 */
(function (root) {
  'use strict';
  var NT = (root.NT = root.NT || {});

  var geo = {};

  function fromLatLng(lat, lng, source) {
    var d = NT.data.nearestToLatLng(lat, lng);
    if (!d) return null;
    var exact = NT.data.distanceKm(d.id, d.id);
    return { regionId: d.id, regionName: d.name, source: source, lat: lat, lng: lng };
  }

  function byBrowser() {
    return new Promise(function (resolve) {
      if (!root.navigator || !navigator.geolocation) return resolve(null);
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; resolve(null); } }, 9000);
      try {
        navigator.geolocation.getCurrentPosition(function (pos) {
          if (done) return;
          done = true; clearTimeout(timer);
          resolve(fromLatLng(pos.coords.latitude, pos.coords.longitude, 'browser'));
        }, function () {
          if (done) return;
          done = true; clearTimeout(timer);
          resolve(null);
        }, { timeout: 8000, maximumAge: 600000 });
      } catch (e) {
        if (!done) { done = true; clearTimeout(timer); resolve(null); }
      }
    });
  }

  function byIP() {
    var endpoints = [
      { url: 'https://ipapi.co/json/', pick: function (j) { return [j.latitude, j.longitude]; } },
      { url: 'https://ipwho.is/', pick: function (j) { return [j.latitude, j.longitude]; } }
    ];
    var i = 0;
    function next() {
      if (i >= endpoints.length) return Promise.resolve(null);
      var ep = endpoints[i++];
      return fetch(ep.url, { method: 'GET' }).then(function (r) {
        return r.json();
      }).then(function (j) {
        var ll = ep.pick(j);
        if (ll && typeof ll[0] === 'number' && typeof ll[1] === 'number') {
          return fromLatLng(ll[0], ll[1], 'ip');
        }
        return next();
      }).catch(function () { return next(); });
    }
    return next();
  }

  /**
   * @returns Promise<{regionId, regionName, source} | {error:string}>
   */
  geo.detect = function () {
    if (typeof fetch !== 'function') {
      return Promise.resolve({ error: '这个浏览器不支持网络定位' });
    }
    return byBrowser().then(function (r) {
      if (r) return r;
      return byIP();
    }).then(function (r) {
      if (r) return r;
      return { error: '定位失败（可能是权限被拒、跨域限制或没联网）。手动选一个就好。' };
    }).catch(function (e) {
      return { error: '定位出错：' + (e && e.message ? e.message : e) };
    });
  };

  NT.geo = geo;
})(typeof window !== 'undefined' ? window : this);
