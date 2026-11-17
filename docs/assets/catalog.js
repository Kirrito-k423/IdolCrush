(function () {
  "use strict";

  const root = document.documentElement;
  const base = root.dataset.base;
  const artists = {
    wonyoung: {name: "张元英", roman: "WONYOUNG", lines: ["WON", "YOUNG"], group: "IVE", native: "장원영", color: "#e8a0c2", tint: "#291a32", search: "jang won young izone iz*one 张员瑛 張員瑛"},
    wonhee: {name: "李沅禧", roman: "WONHEE", lines: ["WON", "HEE"], group: "ILLIT", native: "원희", color: "#b7bbfa", tint: "#292742", search: "lee won hee 李原禧 李元熙 아일릿"},
    anna: {name: "田中杏奈", roman: "ANNA", lines: ["ANNA"], group: "MEOVV", native: "안나", color: "#8ed2ca", tint: "#173331", search: "tanaka anna 杏奈 田中アンナ 미야오"}
  };
  const categories = {stage: "打歌舞台", group: "团体综艺", brand: "品牌代言", solo: "个人节目"};
  const shapes = {
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    outward: '<path d="M5.5 18.5 18 6M6 6h12v12"/>',
    left: '<path d="m14.5 5-7 7 7 7"/>',
    right: '<path d="m9.5 5 7 7-7 7"/>',
    down: '<path d="m5.5 9 6.5 6.5L18.5 9"/>',
    up: '<path d="M12 20V4m-6.5 6.5L12 4l6.5 6.5"/>',
    play: '<path d="M8 4.8 19 12 8 19.2z" fill="currentColor" stroke-linejoin="round"/>',
    photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.4" cy="9" r="1.2"/><path d="m4 17 5-5 3 3 4-5 5 6"/>',
    expand: '<path d="M8.5 3.5h-5v5m12-5h5v5m0 7v5h-5m-7 0h-5v-5"/>',
    shrink: '<path d="M3 8h5V3m13 5h-5V3m5 13h-5v5M3 16h5v5"/>',
    close: '<path d="m5.5 5.5 13 13m0-13-13 13"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.2"/><path d="m15.2 15.2 5 5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7.5 3v4m9-4v4M3 10h18"/>',
    filter: '<path d="M3 7h18M6 12h12m-9 5h6"/>',
    album: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'
  };
  const icon = (name, size = 20) => `<svg class="icon" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${shapes[name] || ""}</svg>`;
  const mark = '<svg class="star-mark" aria-hidden="true" viewBox="0 0 48 48"><path fill="currentColor" d="m37 5-8 14 15-2-14 9 4 13-11-9-12 13 5-17-14 2 13-9-4-12 11 8z"/></svg>';
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[char]));
  const safeLink = value => {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? esc(url.href) : "";
    } catch {
      return "";
    }
  };
  const path = (id = "home", fragment = "") => {
    const directory = id === "home" ? "" : `${id}/`;
    return `${base}${directory}${location.protocol === "file:" ? "index.html" : ""}${fragment}`;
  };
  const photos = (id) => window.IC_PHOTOS?.[id] || [];
  const videos = (id) => window.IC_VIDEOS?.[id] || [];
  const feature = id => Math.max(0, videos(id).findIndex(video => video.featured));
  const photoUrl = item => `${base}assets/photos/${encodeURIComponent(item.file)}`;
  const thumbUrl = (item, id) => {
    if (item.thumb) return `${base}assets/thumbs/${encodeURIComponent(item.thumb)}`;
    if (item.youtube) return `https://i.ytimg.com/vi/${encodeURIComponent(item.youtube)}/hqdefault.jpg`;
    return photos(id)[0] ? photoUrl(photos(id)[0]) : "";
  };
  const pad = value => String(value).padStart(2, "0");
  const heading = (key, label, title, side = "") => `<div class="section-heading">
    <div><div class="eyebrow"><span class="slashes" aria-hidden="true"></span>${esc(label)}</div><h2 id="${key}-title">${esc(title)}</h2></div>${side}</div>`;
  const ext = 'target="_blank" rel="noopener noreferrer"';
  window.IC = {page: root.dataset.page, base, artists, categories, icon, mark, esc, safeLink, path, photos, videos, feature, photoUrl, thumbUrl, pad, heading, ext};
})();
