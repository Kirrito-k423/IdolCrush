(function () {
  "use strict";

  const {page, artists, icon, esc, safeLink, ext, path, photos, videos, feature, previewUrl, responsivePhoto, thumbUrl, pad, heading, openViewer, today} = window.IC;
  const ids = Object.keys(artists);
  const home = page === "home";
  const cover = document.querySelector("#cover");

  let artistIndex = home ? 0 : ids.indexOf(page);
  let photoIndex = 0;
  function renderCover() {
    const id = ids[artistIndex];
    const artist = artists[id];
    const picture = photos(id)[photoIndex];
    const idx = home ? artistIndex : photoIndex;
    const total = home ? ids.length : photos(id).length;
    const focused = cover.contains(document.activeElement) ? document.activeElement.dataset.cover : "";
    cover.style.setProperty("--tint", artist.tint);
    cover.dataset.artist = id;
    const title = artist.lines.map((line, i) => `<span class="title-line ${i === artist.lines.length - 1 ? "last" : ""}">${line}${i === artist.lines.length - 1 ? '<i class="title-dot">.</i>' : ""}</span>`).join("");
    cover.innerHTML = `<div class="cover-art" aria-hidden="true">${picture ? `<img class="cover-photo" ${responsivePhoto(picture, "(max-width: 680px) 100vw, 73vw")} alt="" fetchpriority="high" style="--focus:${esc(picture.heroPosition || picture.position)};--mobile-focus:${esc(picture.mobilePosition || picture.heroPosition || picture.position)}">` : ""}</div>
      <div class="cover-shade"></div><div class="cover-inner wrap">
      <div class="cover-story"><div class="cover-label"><span class="label-dot"></span>${home ? "ON THE COVER" : "ARTIST ARCHIVE"}<span class="label-divider"></span><span lang="zh-CN">${home ? "封面人物" : "艺人档案"}</span></div>
      <h1 class="display-name ${artist.lines.length === 1 ? "one-line" : ""}" aria-label="${artist.roman} ${artist.name}">${title}</h1>
      <div class="cover-person"><strong>${artist.name}</strong><span class="person-divider"></span><span>${artist.group}</span><span class="native-name">${artist.native}</span></div>
      <div class="cover-actions">${home ? `<a class="primary" href="${path(id)}">进入艺人主页 ${icon("outward", 17)}</a>` : `<a class="primary" href="${path(id, "gallery")}">进入高清画廊 ${icon("outward", 17)}</a>`}
      ${videos(id).length ? `<button type="button" class="play-link" data-cover="video"><span>${icon("play", 13)}</span>播放精选</button>` : ""}</div></div>
      ${picture ? `<button type="button" class="photo-open" data-cover="photo" aria-label="全屏欣赏${artist.name}的封面照片">${icon("expand", 16)}<span>全屏看图</span></button>` : ""}
      <div class="cover-foot">${picture ? `<a class="cover-caption" href="${safeLink(picture.source)}" ${ext}>${icon("photo", 13)}<span>${esc(picture.title)}</span>${icon("outward", 11)}</a>` : "<span></span>"}
      <div class="pager" aria-label="${home ? "切换封面人物" : "切换精选照片"}"><span class="pager-count"><b>${pad(idx + 1)}</b><i></i>${pad(total)}</span>
      <button type="button" class="circle" data-cover="prev" aria-label="${home ? "上一位封面艺人" : "上一张精选照片"}">${icon("left", 18)}</button>
      <button type="button" class="circle" data-cover="next" aria-label="${home ? "下一位封面艺人" : "下一张精选照片"}">${icon("right", 18)}</button></div></div></div>`;
    if (focused) cover.querySelector(`[data-cover="${focused}"]`)?.focus({preventScroll: true});
  }
  function turnCover(amount) {
    if (home) {
      artistIndex = (artistIndex + amount + ids.length) % ids.length;
      photoIndex = 0;
    } else {
      const total = photos(page).length;
      if (!total) return;
      photoIndex = (photoIndex + amount + total) % total;
    }
    renderCover();
  }
  cover.addEventListener("click", event => {
    const action = event.target.closest("[data-cover]")?.dataset.cover;
    const id = ids[artistIndex];
    if (action === "next" || action === "prev") turnCover(action === "next" ? 1 : -1);
    if (action === "photo") openViewer(id, "photo", photoIndex);
    if (action === "video") openViewer(id, "video", feature(id));
  });
  let startX, startY;
  cover.addEventListener("touchstart", event => {
    if (event.touches.length !== 1) { startX = undefined; return; }
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  }, {passive: true});
  cover.addEventListener("touchend", event => {
    if (startX === undefined) return;
    const dx = event.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 65 && Math.abs(event.changedTouches[0].clientY - startY) < Math.abs(dx) * .55) turnCover(dx < 0 ? 1 : -1);
    startX = undefined;
  }, {passive: true});
  renderCover();

  if (home) {
    const count = `<span class="section-count"><b>${pad(ids.length)}</b> 位艺人</span>`;
    document.querySelector("#artists").innerHTML = `${heading("lineup", "THE LINEUP", "艺人索引", count)}
      <div class="artist-grid">${ids.map(id => {
        const a = artists[id];
        const photo = photos(id)[1] || photos(id)[0];
        return `<a class="artist-card" href="${path(id)}" style="--tint:${a.tint}">${photo ? `<img ${responsivePhoto(photo, "(max-width: 680px) 50vw, 31vw")} alt="${esc(photo.alt)}" width="${photo.previewWidth || photo.width}" height="${photo.previewHeight || photo.height}" style="object-position:${esc(photo.cardPosition || photo.position)}">` : ""}
          <span class="artist-scrim"></span><span class="artist-tag"><i style="background:${a.color}"></i>${a.group}</span>
          <div class="artist-caption"><div><h3>${a.roman}</h3><p>${a.name} <span>${a.native}</span></p></div><span class="card-arrow">${icon("outward", 19)}</span></div></a>`;
      }).join("")}</div>`;

    const future = (window.IC_CALENDAR?.events || []).filter(e => e.date >= today).slice(0, 4);
    const link = `<a class="text-link" href="${path("home", "calendar")}">查看全年 ${icon("arrow", 16)}</a>`;
    document.querySelector("#upcoming").innerHTML = heading("upcoming", "UP NEXT", "近期公开行程", link) +
      (future.length ? `<div class="upcoming-list">${future.map(event => `<a href="${path(event.artist, "calendar", "?date=" + event.date)}"><time>${event.date.slice(5).replace("-", ".")}</time><span>${esc(event.title)}<small>${artists[event.artist].name} · ${esc(event.kind)}</small></span>${icon("outward", 17)}</a>`).join("")}</div>` : '<p class="empty-note">暂未收录新的公开日期。</p>');
  } else {
    const photo = photos(page)[0];
    const video = videos(page)[feature(page)];
    const upcoming = (window.IC_CALENDAR?.events || []).find(e => e.artist === page && e.date >= today);
    const sections = [
      {id: "gallery", title: "高清画廊", info: `${photos(page).length} 幅 4K+ 写真 · TOP 视频`, image: photo ? previewUrl(photo) : "", focus: photo?.position},
      {id: "calendar", title: "行程日历", info: upcoming ? upcoming.title : "年度行程与活动时段", date: upcoming?.date},
      {id: "videos", title: "视频档案", info: `${videos(page).length} 部舞台、节目与品牌影像`, image: video ? thumbUrl(video, page) : ""}
    ];
    document.querySelector("#chapters").innerHTML = `${heading("chapters", "ARTIST DIRECTORY", "档案目录")}<div class="chapter-grid">${sections.map(section =>
      `<a class="chapter-door door-${section.id}" href="${path(page, section.id)}">
      ${section.image ? `<img src="${esc(section.image)}" alt="" referrerpolicy="no-referrer" style="object-position:${esc(section.focus || "50% 38%")}">` : ""}
      ${section.id === "calendar" ? `<span class="door-date">${section.date ? esc(section.date.slice(5).replace("-", ".")) : today.slice(0, 4)}</span>` : ""}
      <div><h3>${section.title}</h3><p>${esc(section.info)}</p></div><span class="card-arrow">${icon("outward", 17)}</span></a>`).join("")}</div>`;
  }
})();
