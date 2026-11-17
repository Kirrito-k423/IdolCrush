(function () {
  "use strict";

  const {page, videos, periods, periodLabel, periodName, includesDate, categories, esc, icon, path, thumbUrl, openViewer, ext, safeLink, rememberQuery, pad} = window.IC;
  const feedPage = page === "home";
  const container = document.querySelector(feedPage ? "#updates" : "#videos");
  const library = videos(page);
  const sources = window.IC_BILIBILI?.sources || [];
  const ranges = [...periods(page)].sort((a, b) => b.start.localeCompare(a.start));
  const albums = [...new Set(library.map(video => video.album).filter(Boolean))];
  const years = [...new Set(library.map(video => video.date?.slice(0, 4)).filter(Boolean))].sort().reverse();
  const pairs = [...new Set(library.flatMap(video => video.pairs || []))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const params = new URLSearchParams(location.search);
  let category = Object.hasOwn(categories, params.get("type")) ? params.get("type") : "";
  let album = albums.includes(params.get("album")) ? params.get("album") : "";
  let range = ranges.find(item => item.id === params.get("period"));
  let year = !range && years.includes(params.get("year")) ? params.get("year") : "";
  let pair = pairs.includes(params.get("pair")) ? params.get("pair") : "";
  let source = sources.some(item => String(item.uid) === params.get("source")) ? params.get("source") : "";
  let search = (params.get("q") || "").slice(0, 100);
  let direction = params.get("sort") === "asc" ? "asc" : "desc";
  let grouping = ["album", "period", "year", "pair"].includes(params.get("group")) ? params.get("group") : "time";
  let limit = 36;
  let ordered = [];

  const option = (value, label, current) => `<option value="${esc(value)}"${value === current ? " selected" : ""}>${esc(label)}</option>`;
  function persist() {
    const query = new URLSearchParams();
    if (category) query.set("type", category);
    if (album) query.set("album", album);
    if (range) query.set("period", range.id);
    if (year) query.set("year", year);
    if (pair) query.set("pair", pair);
    if (source) query.set("source", source);
    if (search) query.set("q", search);
    if (direction === "asc") query.set("sort", direction);
    if (grouping !== "time") query.set("group", grouping);
    rememberQuery(query);
  }
  function card(index) {
    const item = library[index];
    const label = category && item.types.includes(category) ? category : item.category;
    const photo = thumbUrl(item, page);
    return `<button class="video-card" type="button" data-video="${index}"><span class="video-poster">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}<span class="video-play">${icon("play", 15)}</span>${item.duration ? `<span class="duration">${esc(item.duration)}</span>` : ""}</span>
      <span class="video-copy"><span class="video-meta">${esc(categories[label] || categories.other)}${item.album ? `<i></i>${esc(item.album)}` : ""}${item.pairs?.length ? `<i></i>${esc(item.pairs.join(" / "))}` : ""}</span><strong>${esc(item.title)}</strong><small>${item.dateFromTitle ? "活动 " : ""}<time datetime="${esc(item.date)}">${esc(item.date)}</time>${item.dateFromTitle ? ` · 发布 ${esc(item.publishedDate)}` : ""} · ${esc(item.publisher)}</small></span></button>`;
  }
  function groupFor(item) {
    if (grouping === "time") return "";
    if (grouping === "year") return item.date?.slice(0, 4) || "未注明日期";
    if (grouping === "album") return item.album || "未关联专辑";
    if (grouping === "pair") return item.pairs?.join(" / ") || "其他影像";
    const matches = ranges.filter(itemRange => includesDate(itemRange, item.date));
    return matches.length ? matches.map(itemRange => `${periodName(itemRange)} · ${itemRange.title}`).join(" / ") : "其他时段";
  }
  function sourceDetails() {
    if (!sources.length) return "";
    const rows = sources.map(item => {
      const lastSuccess = [item.uploads?.lastSuccessAt, item.dynamic?.lastSuccessAt].filter(Boolean).sort().at(-1);
      const status = item.status === "partial" ? "· 部分内容暂未更新" : item.status === "error" ? "· 最近读取未成功" : item.uploads && !item.uploads.complete ? "· 历史投稿回填中" : "";
      return `<li><a href="${safeLink(item.url || `https://space.bilibili.com/${item.uid}/dynamic`)}" ${ext}>${esc(item.name || item.uid)}</a><span>${item.status === "ok" ? "已核对" : "上次成功"} ${esc(lastSuccess || "暂无")} ${status}</span></li>`;
    }).join("");
    return `<details class="source-details archive-sources"><summary>查看监控账号与更新状态</summary><p>按公开标题识别人物和类型。此页按发布日排序，艺人视频页优先采用标题中可识别的活动日期。</p><ul>${rows}</ul></details>`;
  }
  function render() {
    const term = search.trim().toLocaleLowerCase();
    const indices = library.map((_, index) => index).filter(index => {
      const item = library[index];
      const matchesSearch = !term || [item.title, item.publisher, item.album, ...(item.pairs || [])].join(" ").toLocaleLowerCase().includes(term);
      return (!category || item.types.includes(category)) && (!album || item.album === album) &&
        (!range || includesDate(range, item.date)) && (!year || item.date?.startsWith(year)) &&
        (!pair || item.pairs.includes(pair)) && (!source || (item.sources || []).map(String).includes(source)) && matchesSearch;
    }).sort((a, b) => {
      const left = library[a].date, right = library[b].date;
      if (!left || !right) return Number(Boolean(right)) - Number(Boolean(left));
      return (direction === "asc" ? 1 : -1) * left.localeCompare(right) || a - b;
    });
    const groups = new Map();
    for (const index of indices) {
      const key = groupFor(library[index]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(index);
    }
    ordered = [...groups.values()].flat();
    const visible = new Set(ordered.slice(0, limit));
    const region = range ? `period:${range.id}` : year ? `year:${year}` : "";
    const regionOptions = ["comeback", "tour"].map(type => {
      const subset = ranges.filter(item => item.type === type);
      return subset.length ? `<optgroup label="${type === "comeback" ? "出道 / 回归期" : periodLabel[type]}">${subset.map(item => option("period:" + item.id, item.title, region)).join("")}</optgroup>` : "";
    }).join("");
    const activeFilter = Boolean(category || album || range || year || pair || source || search);
    const choices = Object.entries({"": "全部视频", ...categories}).map(([key, label]) => `<button type="button" class="chip" data-category="${key}" aria-pressed="${category === key}">${label}</button>`).join("");
    container.innerHTML = `<div class="archive-bar"><div class="chips" role="group" aria-label="视频类型">${choices}</div></div>
      <div class="archive-search"><label>${icon("search", 17)}<input type="search" data-field="search" value="${esc(search)}" placeholder="搜索视频标题、发布者或 CP" aria-label="搜索视频"></label>${!feedPage ? `<a class="text-link" href="${path("home", "updates")}">查看账号全部更新 ${icon("outward", 14)}</a>` : ""}</div>
      <div class="archive-controls">
        <label class="field-select"><span>专辑</span><select data-field="album">${option("", "全部专辑", album)}${albums.map(item => option(item, item, album)).join("")}</select></label>
        <label class="field-select"><span>时段</span><select data-field="range">${option("", "全部时段", region)}<optgroup label="年份">${years.map(item => option("year:" + item, item + " 年", region)).join("")}</optgroup>${regionOptions}</select></label>
        <label class="field-select"><span>CP 组合</span><select data-field="pair">${option("", "全部组合", pair)}${pairs.map(item => option(item, item, pair)).join("")}</select></label>
        <label class="field-select"><span>来源账号</span><select data-field="source">${option("", "全部来源", source)}${sources.map(item => option(String(item.uid), item.name || item.uid, source)).join("")}</select></label>
        <label class="field-select"><span>编目</span><select data-field="group">${[["time", "按时间排列"], ["year", "按年份分组"], ["album", "按专辑分组"], ["period", "按回归 / 巡演期"], ["pair", "按 CP 对分组"]].map(([key, value]) => option(key, value, grouping)).join("")}</select></label>
        <label class="field-select"><span>时间排序</span><select data-field="sort">${option("desc", "从新到旧", direction)}${option("asc", "从旧到新", direction)}</select></label>
      </div>
      ${range ? `<div class="range-context"><span class="period-tag ${esc(range.type)}">${periodName(range)}</span><strong>${esc(range.title)}</strong><span>${esc(range.start)} — ${esc(range.end)}</span><a class="text-link" href="${path(page, "calendar", "?period=" + encodeURIComponent(range.id))}">在日历查看 ${icon("outward", 14)}</a></div>` : ""}
      <div class="result-bar"><p role="status">共 <b>${ordered.length}</b> 部影像${range || grouping === "period" ? " · 按视频日期归入时段" : ""}</p>${activeFilter ? '<button type="button" class="text-link" data-reset>清除筛选</button>' : ""}</div>
      ${groups.size ? [...groups].map(([name, group]) => {
        const items = group.filter(index => visible.has(index));
        return items.length ? `<section class="archive-group" aria-label="${esc(name || "按时间排列的视频")}">${name ? `<div class="archive-group-head"><h2>${esc(name)}</h2><span>${pad(group.length)}</span></div>` : ""}<div class="video-grid">${items.map(card).join("")}</div></section>` : "";
      }).join("") : '<p class="archive-empty">当前筛选条件下暂无收录的视频。</p>'}
      ${ordered.length > limit ? `<div class="archive-more"><button class="mini-btn" type="button" data-more>加载更多 · 已显示 ${Math.min(limit, ordered.length)} / ${ordered.length}</button></div>` : ""}
      ${feedPage ? sourceDetails() : ""}
      ${page === "wonyoung" ? `<a class="reference-link" href="https://shaojiemike.top/love/2024/04/14/wonyoung" ${ext}>从 IZ*ONE 到 IVE 的张元英舞台索引 ${icon("outward", 14)}</a>` : ""}`;
  }
  container.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-video")) {
      openViewer(page, "video", Number(button.dataset.video), ordered);
      return;
    }
    if (button.hasAttribute("data-more")) {
      limit += 36;
      render();
      container.querySelector("[data-more]")?.focus({preventScroll: true});
      return;
    }
    if (button.hasAttribute("data-reset")) {
      category = album = year = pair = source = search = "";
      range = undefined;
    } else if (button.hasAttribute("data-category")) {
      category = button.dataset.category;
    } else return;
    limit = 36;
    persist();
    render();
    container.querySelector(`[data-category="${category}"]`)?.focus({preventScroll: true});
  });
  container.addEventListener("change", event => {
    const {value, dataset} = event.target;
    if (!dataset.field || dataset.field === "search") return;
    if (dataset.field === "album") album = value;
    if (dataset.field === "group") grouping = value;
    if (dataset.field === "sort") direction = value;
    if (dataset.field === "pair") pair = value;
    if (dataset.field === "source") source = value;
    if (dataset.field === "range") {
      range = ranges.find(item => value === "period:" + item.id);
      year = value.startsWith("year:") ? value.slice(5) : "";
    }
    limit = 36;
    persist();
    render();
    container.querySelector(`[data-field="${dataset.field}"]`)?.focus({preventScroll: true});
  });
  container.addEventListener("input", event => {
    if (event.target.dataset.field !== "search") return;
    search = event.target.value.slice(0, 100);
    const cursor = event.target.selectionStart;
    limit = 36;
    persist();
    render();
    const input = container.querySelector('[data-field="search"]');
    input.focus({preventScroll: true});
    input.setSelectionRange(cursor, cursor);
  });
  render();
})();
