(function () {
  "use strict";

  const {page, artists, categories, icon, mark, esc, safeLink, ext, path, photos, videos, feature, photoUrl, thumbUrl, pad, heading, openViewer} = window.IC;
  const ids = Object.keys(artists);
  const home = page === "home";
  const header = document.querySelector(".masthead");
  const cover = document.querySelector("#cover");
  const logo = `<span class="brand-symbol">${mark}</span><span class="brand-name">IDOL<span>CRUSH</span></span>`;
  const navItems = home
    ? [["#top", "首页"], ["#artists", "艺人索引"], ["#calendar", "行程日历"]]
    : [[path("home", "#artists"), "艺人索引"], ["#cover", "影像精选"], ["#calendar", "行程日历"], ["#archive", "视频档案"]];
  header.innerHTML = `<div class="mast-inner wrap"><a class="brand" href="${path()}" aria-label="IDOLCRUSH 首页">${logo}</a>
    <nav class="main-nav" id="main-nav" aria-label="主导航">${navItems.map(([href, name], i) => `<a href="${href}" ${i === (home ? 0 : 1) ? 'aria-current="location"' : ""}>${name}</a>`).join("")}</nav>
    <div class="header-tools"><button type="button" class="search-trigger" aria-haspopup="dialog" aria-label="搜索艺人与视频">${icon("search", 17)}<span>搜索档案</span><kbd>/</kbd></button>
    <button type="button" class="menu-trigger circle" aria-controls="main-nav" aria-expanded="false" aria-label="打开导航"><span></span><span></span></button></div></div>`;

  const menuButton = header.querySelector(".menu-trigger");
  function setMenu(open) {
    header.classList.toggle("menu-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "收起导航" : "打开导航");
  }
  menuButton.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("click", event => {
    if (!header.contains(event.target) || event.target.closest("nav a")) setMenu(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") { setMenu(false); menuButton.focus(); }
  });

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
    cover.innerHTML = `<div class="cover-art" aria-hidden="true">${picture ? `<img class="cover-photo" src="${esc(photoUrl(picture))}" alt="" fetchpriority="high" style="--focus:${esc(picture.heroPosition || picture.position)};--mobile-focus:${esc(picture.mobilePosition || picture.heroPosition || picture.position)}">` : ""}</div>
      <div class="cover-shade"></div><div class="cover-inner wrap">
      <div class="cover-story"><div class="cover-label"><span class="label-dot"></span>${home ? "ON THE COVER" : "ARTIST ARCHIVE"}<span class="label-divider"></span><span lang="zh-CN">${home ? "封面人物" : "艺人档案"}</span></div>
      <h1 class="display-name ${artist.lines.length === 1 ? "one-line" : ""}" aria-label="${artist.roman} ${artist.name}">${title}</h1>
      <div class="cover-person"><strong>${artist.name}</strong><span class="person-divider"></span><span>${artist.group}</span><span class="native-name">${artist.native}</span></div>
      <div class="cover-actions">${home ? `<a class="primary" href="${path(id)}">进入艺人主页 ${icon("outward", 17)}</a>` : `<button type="button" class="primary" data-cover="photo">${icon("expand", 17)} 全屏看图</button>`}
      ${videos(id).length ? `<button type="button" class="play-link" data-cover="video"><span>${icon("play", 13)}</span>播放精选</button>` : ""}</div></div>
      ${home && picture ? `<button type="button" class="photo-open" data-cover="photo" aria-label="全屏欣赏${artist.name}的封面照片">${icon("expand", 16)}<span>全屏看图</span></button>` : ""}
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
        return `<a class="artist-card" href="${path(id)}" style="--tint:${a.tint}">${photo ? `<img src="${esc(photoUrl(photo))}" alt="${esc(photo.alt)}" width="${photo.width}" height="${photo.height}" style="object-position:${esc(photo.cardPosition || photo.position)}">` : ""}
          <span class="artist-scrim"></span><span class="artist-tag"><i style="background:${a.color}"></i>${a.group}</span>
          <div class="artist-caption"><div><h3>${a.roman}</h3><p>${a.name} <span>${a.native}</span></p></div><span class="card-arrow">${icon("outward", 19)}</span></div></a>`;
      }).join("")}</div>`;
  } else {
    const library = videos(page);
    const gallery = document.querySelector("#gallery");
    const photoCards = photos(page).map((photo, index) => `<button type="button" class="still" data-photo="${index}"><img src="${esc(photoUrl(photo))}" alt="${esc(photo.alt)}" loading="lazy" style="object-position:${esc(photo.position)}"><span class="still-info">${icon("expand", 14)} ${esc(photo.title)}</span></button>`);
    const topIds = library.map((_, i) => i).sort((a, b) => Number(Boolean(library[b].featured)) - Number(Boolean(library[a].featured))).filter(i => library[i].category === "stage").slice(0, 2);
    gallery.innerHTML = `${heading("gallery", "SCREENING ROOM", "影像精选")}<div class="media-tabs chips" role="group" aria-label="影像类型">
      <button type="button" class="chip" data-media="photo" aria-pressed="true">美图 <span>${pad(photoCards.length)}</span></button>
      <button type="button" class="chip" data-media="video" aria-pressed="false">TOP 视频 <span>${pad(topIds.length)}</span></button></div>
      <div class="still-grid">${photoCards.join("")}</div>`;
    gallery.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.hasAttribute("data-photo")) openViewer(page, "photo", Number(button.dataset.photo));
      if (button.hasAttribute("data-top")) openViewer(page, "video", Number(button.dataset.top), topIds);
      if (!button.dataset.media) return;
      const isPhoto = button.dataset.media === "photo";
      gallery.querySelectorAll("[data-media]").forEach(tab => tab.setAttribute("aria-pressed", String(tab === button)));
      gallery.querySelector(".still-grid").innerHTML = isPhoto ? photoCards.join("") : topIds.map(i => `<button type="button" class="still top-still" data-top="${i}"><img loading="lazy" src="${esc(thumbUrl(library[i], page))}" alt=""><span class="still-info">${icon("play", 15)} ${esc(library[i].title)}</span></button>`).join("");
    });

    const archive = document.querySelector("#archive");
    let category = "all";
    let album = "";
    let displayed = [];
    function renderArchive() {
      const albums = [...new Set(library.filter(video => video.category === "stage" && video.album).map(video => video.album))];
      displayed = library.map((_, index) => index).filter(i => (category === "all" || library[i].category === category) && (!album || library[i].album === album));
      archive.innerHTML = `${heading("archive", "VIDEO ARCHIVE", "分类视频", `<span class="section-count"><b>${pad(library.length)}</b> 部影像</span>`)}
        <div class="archive-filters"><div class="chips" role="group" aria-label="视频分类">${Object.entries({all: "全部视频", ...categories}).map(([key, name]) =>
          `<button type="button" class="chip" data-category="${key}" aria-pressed="${category === key}">${name}</button>`).join("")}</div>
          ${category === "stage" && albums.length ? `<label class="album-select">${icon("album", 16)}<select aria-label="按专辑筛选打歌舞台"><option value="">全部专辑</option>${albums.map(name => `<option ${album === name ? "selected" : ""} value="${esc(name)}">${esc(name)}</option>`).join("")}</select>${icon("down", 14)}</label>` : ""}</div>
        <div class="video-grid">${displayed.map(index => {
          const item = library[index];
          return `<button class="video-card" type="button" data-video="${index}"><span class="video-poster"><img src="${esc(thumbUrl(item, page))}" alt="" loading="lazy"><span class="video-play">${icon("play", 15)}</span><span class="duration">${esc(item.duration)}</span></span>
            <span class="video-copy"><span class="video-meta">${esc(categories[item.category])}${item.album ? `<i></i>${esc(item.album)}` : ""}</span><strong>${esc(item.title)}</strong><small>${esc(item.publisher)} · ${esc(item.date)}</small></span></button>`;
        }).join("") || '<p class="empty-note">这个分类暂未收录视频。</p>'}</div>${page === "wonyoung" ? `<a class="reference-link" href="https://shaojiemike.top/love/2024/04/14/wonyoung" ${ext}>延伸阅读 · 从 IZ*ONE 到 IVE 的张元英舞台索引 ${icon("outward", 14)}</a>` : ""}`;
    }
    archive.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.category) {
        category = button.dataset.category;
        album = "";
        renderArchive();
        archive.querySelector(`[data-category="${category}"]`).focus({preventScroll: true});
      } else if (button.hasAttribute("data-video")) openViewer(page, "video", Number(button.dataset.video), displayed);
    });
    archive.addEventListener("change", event => {
      if (!event.target.matches("select")) return;
      album = event.target.value;
      renderArchive();
      archive.querySelector("select")?.focus({preventScroll: true});
    });
    renderArchive();
  }

  const footer = document.querySelector(".site-footer");
  footer.innerHTML = `<div class="footer-inner wrap"><div><a class="brand" href="${path()}" aria-label="返回 IDOLCRUSH 首页">${logo}</a>
    <p>非官方粉丝影像档案 · 照片署名与视频出处见放映页</p></div>
    <div class="footer-actions">${!home ? `<a href="${path("home", "#artists")}">艺人索引</a>` : ""}<a href="#top" class="text-link">回到顶部 ${icon("up", 16)}</a></div></div>`;

  const search = document.createElement("dialog");
  search.className = "search-box";
  search.setAttribute("aria-labelledby", "search-title");
  search.innerHTML = `<div class="search-head"><h2 id="search-title">搜索档案</h2><button class="circle small" type="button" aria-label="关闭搜索">${icon("close", 17)}</button></div>
    <label class="search-field">${icon("search")}<input type="search" placeholder="艺人、组合、歌曲或节目" aria-label="搜索艺人、组合、歌曲或节目" autocomplete="off"></label><div class="search-results"></div>`;
  document.body.append(search);
  const input = search.querySelector("input");
  const results = search.querySelector(".search-results");
  const normalize = text => text.toLocaleLowerCase().replace(/[\s·'’*_-]+/g, "");
  function showResults() {
    const q = normalize(input.value.trim());
    const people = ids.filter(id => normalize(Object.values(artists[id]).join(" ")).includes(q));
    const items = [];
    for (const id of ids) {
      videos(id).forEach((v, index) => {
        const a = artists[id];
        if (q ? normalize([a.name, a.roman, a.group, v.title, v.album, v.publisher, categories[v.category]].join(" ")).includes(q) : index === feature(id)) items.push({id, index, v});
      });
    }
    const persons = people.map(id => `<a class="search-result" href="${path(id)}"><span><strong>${artists[id].name}</strong><small>${artists[id].group} / ${artists[id].roman}</small></span>${icon("outward", 16)}</a>`).join("");
    const clips = items.map(({id, index, v}) => `<button type="button" class="search-result" data-id="${id}" data-index="${index}"><span><strong>${esc(v.title)}</strong><small>${artists[id].name} · ${esc(categories[v.category])}</small></span>${icon("play", 14)}</button>`).join("");
    results.innerHTML = `${persons ? `<h3>艺人</h3>${persons}` : ""}${clips ? `<h3>${q ? "视频" : "精选放映"}</h3>${clips}` : ""}${!persons && !clips ? '<p class="empty-note" role="status">没有找到匹配的档案，试试组合名或歌名。</p>' : ""}`;
  }
  function openSearch() {
    if (search.open || document.querySelector(".viewer[open]")) return;
    setMenu(false);
    input.value = "";
    showResults();
    search.showModal();
    input.focus();
  }
  header.querySelector(".search-trigger").addEventListener("click", openSearch);
  search.querySelector(".search-head button").addEventListener("click", () => search.close());
  search.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      search.close();
    }
  });
  input.addEventListener("input", showResults);
  results.addEventListener("click", event => {
    const button = event.target.closest("[data-index]");
    if (button) { search.close(); openViewer(button.dataset.id, "video", Number(button.dataset.index)); }
  });
  search.addEventListener("click", event => {
    if (event.target !== search) return;
    const box = search.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) search.close();
  });
  document.addEventListener("keydown", event => {
    if (event.target.matches("input, textarea, select, [contenteditable=true]") || document.querySelector("dialog[open]")) return;
    if (event.key === "/" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) { event.preventDefault(); openSearch(); }
  });

  const anchoredNav = [...header.querySelectorAll('nav a[href^="#"]')];
  function updateActiveNav() {
    const line = window.innerHeight * .33;
    const current = [...anchoredNav].reverse().find(link => document.querySelector(link.hash)?.getBoundingClientRect().top <= line) || anchoredNav[0];
    anchoredNav.forEach(link => {
      if (link === current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
  let scheduled = false;
  window.addEventListener("scroll", () => {
    if (!scheduled) requestAnimationFrame(() => { updateActiveNav(); scheduled = false; });
    scheduled = true;
  }, {passive: true});
  updateActiveNav();
})();
