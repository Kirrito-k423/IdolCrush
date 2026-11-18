(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ICAnalytics = factory();
})(globalThis, function () {
  "use strict";

  // The archive can contain a curated entry with both a Bilibili part and a
  // YouTube ID. Treat those identifiers as the same entry, without guessing
  // from similar titles. Different Bilibili parts remain distinct.
  function videoKeys(video, fallback) {
    const keys = [];
    const bvid = video.bilibili || video.bvid;
    if (/^BV[A-Za-z0-9]{10}$/.test(bvid || "")) {
      const part = Number(video.bilibiliPage) || 1;
      keys.push(`bili:${bvid}:${part}`);
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(video.youtube || "")) keys.push(`youtube:${video.youtube}`);
    if (!keys.length && /^https?:\/\//i.test(video.source || "")) keys.push(`url:${video.source}`);
    return keys.length ? keys : [`row:${fallback}`];
  }

  function collect(artistIds, library) {
    const rows = [];
    for (const id of artistIds) {
      library(id).forEach((video, index) => rows.push({video, artist: id, key: `${id}:${index}`}));
    }
    library("home").forEach((video, index) => rows.push({video, artist: null, key: `home:${index}`}));

    const parents = rows.map((_, index) => index);
    const byKey = new Map();
    function find(index) {
      while (parents[index] !== index) {
        parents[index] = parents[parents[index]];
        index = parents[index];
      }
      return index;
    }
    function join(a, b) {
      const left = find(a), right = find(b);
      if (left !== right) parents[right] = left;
    }
    rows.forEach((row, index) => {
      for (const key of videoKeys(row.video, row.key)) {
        if (byKey.has(key)) join(index, byKey.get(key));
        else byKey.set(key, index);
      }
    });

    const components = new Map();
    // Prefer an explicitly curated record over an automatically indexed one.
    const priority = video => video.bvid ? 0 : 1;
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index], root = find(index);
      if (!components.has(root)) components.set(root, {video: row.video, artists: new Map()});
      const component = components.get(root);
      if (priority(row.video) > priority(component.video)) component.video = row.video;
      if (row.artist) {
        const prior = component.artists.get(row.artist);
        if (!prior || priority(row.video) > priority(prior)) component.artists.set(row.artist, row.video);
      }
    }
    const artists = Object.fromEntries(artistIds.map(id => [id, []]));
    const all = [];
    for (const component of components.values()) {
      all.push(component.video);
      for (const [id, video] of component.artists) artists[id].push(video);
    }
    return {all, artists};
  }

  function summarize(videos, categories) {
    const types = new Map(), years = new Map();
    for (const video of videos) {
      const category = Object.hasOwn(categories, video.category) ? video.category : "other";
      types.set(category, (types.get(category) || 0) + 1);
      const year = String(video.date || "").slice(0, 4);
      if (/^20\d{2}$/.test(year)) years.set(year, (years.get(year) || 0) + 1);
    }
    return {total: videos.length,
      categories: [...types].map(([id, value]) => ({id, name: categories[id] || id, value}))
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "zh-CN")),
      years: [...years].map(([year, value]) => ({year, value})).sort((a, b) => a.year.localeCompare(b.year))};
  }
  return {videoKeys, collect, summarize};
});
