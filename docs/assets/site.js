(function () {
  "use strict";

  const {page, view, artists, categories, icon, mark, esc, path, videos, feature, openViewer} = window.IC;
  const home = page === "home";
  const ids = Object.keys(artists);
  const header = document.querySelector(".masthead");
  const logo = `<span class="brand-symbol">${mark}</span><span class="brand-name">IDOL<span>CRUSH</span></span>`;
  const navItems = home
    ? [[path(), "首页", view === "home"], [path("home", "", "#artists"), "艺人索引", false], [path("home", "calendar"), "行程日历", view === "calendar"], [path("home", "updates"), "账号更新", view === "updates"]]
    : [[path(page), "艺人首页", view === "artist"], ...[["gallery", "高清画廊"], ["calendar", "行程日历"], ["videos", "视频档案"]].map(([key, label]) => [path(page, key), label, view === key])];
  const links = entries => entries.map(([href, name, active]) => `<a href="${href}" ${active ? 'aria-current="page"' : ""}>${name}</a>`).join("");
  header.innerHTML = `<div class="mast-inner wrap"><a class="brand" href="${path()}" aria-label="IDOLCRUSH 首页">${logo}</a>
    <nav class="main-nav" id="main-nav" aria-label="主导航">${links(navItems)}</nav>
    <div class="header-tools"><button type="button" class="search-trigger" aria-haspopup="dialog" aria-label="搜索艺人与视频">${icon("search", 17)}<span>搜索档案</span><kbd>/</kbd></button>
    <button type="button" class="menu-trigger circle" aria-controls="main-nav" aria-expanded="false" aria-label="打开导航"><span></span><span></span></button></div></div>
    ${home ? "" : `<nav class="mobile-chapters" aria-label="艺人子页">${links(navItems.slice(1))}</nav>`}`;

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

  const footer = document.querySelector(".site-footer");
  footer.innerHTML = `<div class="footer-inner wrap"><div><a class="brand" href="${path()}" aria-label="返回 IDOLCRUSH 首页">${logo}</a>
    <p>非官方粉丝影像档案 · 照片署名与视频出处见放映页</p></div>
    <div class="footer-actions">${!home ? `<a href="${path("home", "", "#artists")}">艺人索引</a>` : ""}<a href="${path("home", "updates")}">账号更新</a><a href="#top" class="text-link">回到顶部 ${icon("up", 16)}</a></div></div>`;

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
    const clips = items.slice(0, 60).map(({id, index, v}) => `<button type="button" class="search-result" data-id="${id}" data-index="${index}"><span><strong>${esc(v.title)}</strong><small>${artists[id].name} · ${esc(categories[v.category])}</small></span>${icon("play", 14)}</button>`).join("");
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

})();
