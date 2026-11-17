(function () {
  "use strict";

  const {page, videos, periods, periodLabel, periodName, includesDate, categories, esc, icon, path, thumbUrl, openViewer, ext, rememberQuery, pad} = window.IC;
  const container = document.querySelector("#videos");
  const library = videos(page);
  const ranges = [...periods(page)].sort((a, b) => b.start.localeCompare(a.start));
  const albums = [...new Set(library.map(video => video.album).filter(Boolean))];
  const years = [...new Set(library.map(video => video.date?.slice(0, 4)).filter(Boolean))].sort().reverse();
  const params = new URLSearchParams(location.search);
  let category = Object.hasOwn(categories, params.get("type")) ? params.get("type") : "";
  let album = albums.includes(params.get("album")) ? params.get("album") : "";
  let range = ranges.find(r => r.id === params.get("period"));
  let year = !range && years.includes(params.get("year")) ? params.get("year") : "";
  let direction = params.get("sort") === "asc" ? "asc" : "desc";
  let grouping = ["album", "period", "year"].includes(params.get("group")) ? params.get("group") : "time";
  let ordered = [];

  const options = (value, label, current) => `<option value="${esc(value)}"${value === current ? " selected" : ""}>${esc(label)}</option>`;
  function persist() {
    const query = new URLSearchParams();
    if (category) query.set("type", category);
    if (album) query.set("album", album);
    if (range) query.set("period", range.id);
    if (year) query.set("year", year);
    if (direction === "asc") query.set("sort", direction);
    if (grouping !== "time") query.set("group", grouping);
    rememberQuery(query);
  }
  function card(index) {
    const item = library[index];
    return `<button class="video-card" type="button" data-video="${index}"><span class="video-poster"><img src="${esc(thumbUrl(item, page))}" alt="" loading="lazy"><span class="video-play">${icon("play", 15)}</span><span class="duration">${esc(item.duration)}</span></span>
      <span class="video-copy"><span class="video-meta">${esc(categories[item.category])}${item.album ? `<i></i>${esc(item.album)}` : ""}</span><strong>${esc(item.title)}</strong><small><time datetime="${esc(item.date)}">${esc(item.date)}</time> · ${esc(item.publisher)}</small></span></button>`;
  }
  function groupFor(item) {
    if (grouping === "time") return "";
    if (grouping === "year") return item.date?.slice(0, 4) || "未注明日期";
    if (grouping === "album") return item.album || "未关联专辑";
    const matches = ranges.filter(r => includesDate(r, item.date));
    return matches.length ? matches.map(r => `${periodName(r)} · ${r.title}`).join(" / ") : "其他时段";
  }
  function render() {
    ordered = library.map((_, i) => i).filter(i => {
      const item = library[i];
      return (!category || item.category === category) && (!album || item.album === album) &&
        (!range || includesDate(range, item.date)) && (!year || item.date?.startsWith(year));
    }).sort((a, b) => {
      const left = library[a].date, right = library[b].date;
      if (!left || !right) return Number(Boolean(right)) - Number(Boolean(left));
      return (direction === "asc" ? 1 : -1) * left.localeCompare(right) || a - b;
    });
    const groups = new Map();
    for (const index of ordered) {
      const key = groupFor(library[index]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(index);
    }
    const region = range ? `period:${range.id}` : year ? `year:${year}` : "";
    const regionOptions = ["comeback", "tour"].map(type => {
      const subset = ranges.filter(r => r.type === type);
      return subset.length ? `<optgroup label="${type === "comeback" ? "出道 / 回归期" : periodLabel[type]}">${subset.map(r => options("period:" + r.id, r.title, region)).join("")}</optgroup>` : "";
    }).join("");
    const activeFilter = Boolean(category || album || range || year);
    container.innerHTML = `<div class="archive-bar"><div class="chips" role="group" aria-label="视频类型">${Object.entries({"": "全部视频", ...categories}).map(([key, label]) =>
      `<button type="button" class="chip" data-category="${key}" aria-pressed="${category === key}">${label}</button>`).join("")}</div></div>
      <div class="archive-controls">
        <label class="field-select"><span>专辑</span><select data-field="album">${options("", "全部专辑", album)}${albums.map(a => options(a, a, album)).join("")}</select></label>
        <label class="field-select"><span>时段</span><select data-field="range">${options("", "全部时段", region)}<optgroup label="年份">${years.map(y => options("year:" + y, y + " 年", region)).join("")}</optgroup>${regionOptions}</select></label>
        <label class="field-select"><span>编目</span><select data-field="group">${[["time", "按时间排列"], ["year", "按年份分组"], ["album", "按专辑分组"], ["period", "按回归 / 巡演期"]].map(([k, v]) => options(k, v, grouping)).join("")}</select></label>
        <label class="field-select"><span>时间排序</span><select data-field="sort">${options("desc", "从新到旧", direction)}${options("asc", "从旧到新", direction)}</select></label>
      </div>
      ${range ? `<div class="range-context"><span class="period-tag ${esc(range.type)}">${periodName(range)}</span><strong>${esc(range.title)}</strong><span>${esc(range.start)} — ${esc(range.end)}</span><a class="text-link" href="${path(page, "calendar", "?period=" + encodeURIComponent(range.id))}">在日历查看 ${icon("outward", 14)}</a></div>` : ""}
      <div class="result-bar"><p role="status">共 <b>${ordered.length}</b> 部影像${range || grouping === "period" ? " · 按视频日期归入已公布的时段" : ""}</p>${activeFilter ? '<button type="button" class="text-link" data-reset>清除筛选</button>' : ""}</div>
      ${groups.size ? [...groups].map(([name, indices]) => `<section class="archive-group" aria-label="${esc(name || "按时间排列的视频")}">${name ? `<div class="archive-group-head"><h2>${esc(name)}</h2><span>${pad(indices.length)}</span></div>` : ""}<div class="video-grid">${indices.map(card).join("")}</div></section>`).join("") : '<p class="archive-empty">当前筛选条件下暂无收录的视频。</p>'}
      ${page === "wonyoung" ? `<a class="reference-link" href="https://shaojiemike.top/love/2024/04/14/wonyoung" ${ext}>从 IZ*ONE 到 IVE 的张元英舞台索引 ${icon("outward", 14)}</a>` : ""}`;
    // The viewer follows the visible card sequence, including album and period groupings.
    ordered = [...groups.values()].flat();
  }
  container.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-video")) {
      openViewer(page, "video", Number(button.dataset.video), ordered);
      return;
    }
    if (button.hasAttribute("data-reset")) {
      category = album = year = "";
      range = undefined;
    } else if (button.hasAttribute("data-category")) {
      category = button.dataset.category;
    } else return;
    persist();
    render();
    container.querySelector(`[data-category="${category}"]`)?.focus({preventScroll: true});
  });
  container.addEventListener("change", event => {
    const {value, dataset} = event.target;
    if (!dataset.field) return;
    if (dataset.field === "album") album = value;
    if (dataset.field === "group") grouping = value;
    if (dataset.field === "sort") direction = value;
    if (dataset.field === "range") {
      range = ranges.find(r => value === "period:" + r.id);
      year = value.startsWith("year:") ? value.slice(5) : "";
    }
    persist();
    render();
    container.querySelector(`[data-field="${dataset.field}"]`)?.focus({preventScroll: true});
  });
  render();
})();
