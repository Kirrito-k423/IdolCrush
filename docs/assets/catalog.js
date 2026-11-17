(function () {
  "use strict";

  const root = document.documentElement;
  const base = root.dataset.base;
  const artists = globalThis.IC_ARTISTS;
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
  const page = root.dataset.page;
  const view = root.dataset.view;
  const path = (id = "home", section = "", suffix = "") => {
    const directory = [id === "home" ? "" : id, section].filter(Boolean).map(part => part + "/").join("");
    return `${base}${directory}${location.protocol === "file:" ? "index.html" : ""}${suffix}`;
  };
  const photos = id => (window.IC_PHOTOS?.[id] || []).filter(photo =>
    Math.max(photo.width, photo.height) >= 3840 && Math.min(photo.width, photo.height) >= 2160);
  const videos = (id) => window.IC_VIDEOS?.[id] || [];
  const feature = id => Math.max(0, videos(id).findIndex(video => video.featured));
  const photoUrl = item => item.file ? `${base}assets/photos/${encodeURIComponent(item.file)}` : item.originalUrl;
  const previewUrl = item => item.preview ? `${base}assets/photos/${encodeURIComponent(item.preview)}` : item.previewUrl || photoUrl(item);
  const responsivePhoto = (item, sizes) => {
    const preview = esc(previewUrl(item)), full = esc(photoUrl(item));
    if (!item.previewWidth || preview === full) return `src="${full}"`;
    return `src="${preview}" srcset="${preview} ${item.previewWidth}w, ${full} ${item.width}w" sizes="${sizes}"`;
  };
  const periods = id => window.IC_PERIODS?.[id] || [];
  const periodLabel = {comeback: "回归期", tour: "巡演期"};
  const periodName = period => period.debut ? "出道期" : periodLabel[period.type];
  const includesDate = (period, date) => period.start <= date && date <= period.end;
  const today = new Intl.DateTimeFormat("sv-SE", {timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date());
  const thumbUrl = (item, id) => {
    if (item.thumb) return `${base}assets/thumbs/${encodeURIComponent(item.thumb)}`;
    if (item.youtube) return `https://i.ytimg.com/vi/${encodeURIComponent(item.youtube)}/hqdefault.jpg`;
    return photos(id)[0] ? previewUrl(photos(id)[0]) : "";
  };
  const pad = value => String(value).padStart(2, "0");
  const heading = (key, label, title, side = "") => `<div class="section-heading">
    <div><div class="eyebrow"><span class="slashes" aria-hidden="true"></span>${esc(label)}</div><h2 id="${key}-title">${esc(title)}</h2></div>${side}</div>`;
  const ext = 'target="_blank" rel="noopener noreferrer"';
  const rememberQuery = params => {
    const next = new URL(location.href);
    next.search = params.toString();
    if (next.href !== location.href && location.protocol !== "file:") history.replaceState(null, "", next);
  };
  window.IC = {page, view, base, artists, categories, icon, mark, esc, safeLink, path, photos, videos, feature, photoUrl, previewUrl, responsivePhoto, thumbUrl, periods, periodLabel, periodName, includesDate, today, rememberQuery, pad, heading, ext};

  function routeOldBookmark() {
    if (view !== "home" && view !== "artist") return;
    const old = {"#calendar": "calendar", "#archive": "videos", "#gallery": "gallery"};
    const target = old[location.hash];
    if (target && (page !== "home" || target === "calendar")) location.replace(path(page, target, location.search));
  }
  routeOldBookmark();
  window.addEventListener("hashchange", routeOldBookmark);
})();
