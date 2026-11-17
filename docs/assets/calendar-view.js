(function () {
  "use strict";

  const {page, artists, icon, esc, safeLink, pad, ext, today, periods, videos, includesDate, periodName, path, rememberQuery} = window.IC;
  const calendar = window.IC_CALENDAR;
  const box = document.querySelector("#calendar");
  const query = new URLSearchParams(location.search);
  const currentMonth = today.slice(0, 7);
  const markers = {"演出": "concert", "打歌": "stage", "节目": "broadcast", "发行": "release", "签售": "signing", "主持": "host", "活动": "other"};
  const kindOf = event => event.feed === "sbs-stages" ? "打歌" : event.kind === "活动" && event.title.includes("签售") ? "签售" : Object.hasOwn(markers, event.kind) ? event.kind : "活动";
  const mark = kind => `<i class="kind-mark mark-${markers[kind]}" aria-hidden="true"></i>`;
  const allEvents = [...calendar.events].filter(event => artists[event.artist]).sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || "") || a.title.localeCompare(b.title, "zh-CN"));
  const allPeriods = Object.keys(artists).flatMap(id => periods(id).map(p => ({...p, artist: id, key: id + "/" + p.id}))).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const monthString = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  const shiftMonth = (month, offset) => monthString(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 + offset, 1)));
  const lengthOf = month => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  const monthName = month => `${month.slice(0, 4)} 年 ${Number(month.slice(5))} 月`;
  const validMonth = month => /^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(month || "");
  const validDate = date => validMonth(date?.slice(0, 7)) && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number(date.slice(8)) > 0 && Number(date.slice(8)) <= lengthOf(date.slice(0, 7));
  const overlap = (p, lo, hi) => p.start <= hi && p.end >= lo;
  const mobile = matchMedia("(max-width: 950px)");
  let artist = page !== "home" ? page : Object.hasOwn(artists, query.get("artist")) ? query.get("artist") : "all";
  let kind = Object.hasOwn(markers, query.get("kind")) ? query.get("kind") : "";
  let selectedPeriod = allPeriods.find(p => (artist === "all" || p.artist === artist) && (p.id === query.get("period") || p.key === query.get("period")));
  let day = validDate(query.get("date")) ? query.get("date") : "";
  const initialMonth = day.slice(0, 7) || selectedPeriod?.start.slice(0, 7) || (validMonth(query.get("month")) ? query.get("month") : currentMonth);
  let start = validMonth(query.get("from")) ? query.get("from") : initialMonth.slice(0, 4) + "-01";
  let activeMonth = initialMonth;
  let eventsByDate;
  let scopePeriods;
  let first, last;
  let expanded = false;

  const sheet = document.createElement("dialog");
  sheet.className = "day-sheet";
  sheet.setAttribute("aria-label", "行程明细");
  sheet.innerHTML = `<div class="sheet-head"><span>行程明细</span><button type="button" class="circle small" aria-label="关闭明细" data-dismiss>${icon("close", 16)}</button></div><div class="sheet-body"></div>`;
  document.body.append(sheet);

  function visibleToArtist(item) {
    return artist === "all" || item.artist === artist || (artist === "liz" && item.artist === "wonyoung" && item.scope === "团体");
  }
  function persist() {
    const params = new URLSearchParams();
    params.set("from", start);
    if (page === "home" && artist !== "all") params.set("artist", artist);
    if (kind) params.set("kind", kind);
    if (selectedPeriod) params.set("period", artist === "all" ? selectedPeriod.key : selectedPeriod.id);
    else if (day) params.set("date", day);
    else if (activeMonth !== currentMonth) params.set("month", activeMonth);
    rememberQuery(params);
  }
  function moveWindow(value) {
    start = value;
    day = "";
    selectedPeriod = undefined;
    activeMonth = currentMonth >= start && currentMonth <= shiftMonth(start, 11) ? currentMonth : start;
  }
  function controls(events) {
    const years = [...allEvents.map(e => +e.date.slice(0, 4)), ...allPeriods.flatMap(p => [+p.start.slice(0, 4), +p.end.slice(0, 4)]), +currentMonth.slice(0, 4), +start.slice(0, 4)];
    const oldest = Math.min(...years), latest = Math.max(...years) + 1;
    const opts = Array.from({length: latest - oldest + 1}, (_, i) => latest - i).map(y => `<option value="${y}"${y === +start.slice(0, 4) ? " selected" : ""}>${y} 年</option>`).join("");
    const months = Array.from({length: 12}, (_, i) => `<option value="${pad(i + 1)}"${i + 1 === +start.slice(5) ? " selected" : ""}>${i + 1} 月起</option>`).join("");
    const kinds = Object.keys(markers).filter(k => k === kind || events.some(e => kindOf(e) === k));
    return `${page === "home" ? `<div class="chips calendar-filters" role="group" aria-label="选择艺人">${[["all", "全部艺人"], ...Object.entries(artists).map(([id, a]) => [id, a.name])].map(([id, name]) =>
      `<button class="chip" type="button" data-artist="${id}" aria-pressed="${id === artist}">${name}</button>`).join("")}</div>` : ""}
      <div class="year-toolbar"><div class="year-move"><button type="button" class="circle small" data-step="-12" aria-label="上一年">${icon("left", 15)}</button>
      <label><span class="sr-only">起始年份</span><select class="year-choice" data-field="year">${opts}</select></label>
      <label><span class="sr-only">起始月份</span><select data-field="month">${months}</select></label>
      <button type="button" class="circle small" data-step="12" aria-label="下一年">${icon("right", 15)}</button></div>
      <div class="year-shortcuts"><button class="mini-btn" type="button" data-action="this-year">今年</button><button class="mini-btn" type="button" data-action="rolling">从本月起</button></div></div>
      <div class="kind-legend" role="group" aria-label="按行程类型筛选"><button type="button" data-kind="" aria-pressed="${!kind}">全部类型</button>${kinds.map(k => `<button type="button" data-kind="${k}" aria-pressed="${kind === k}">${mark(k)}${k}</button>`).join("")}</div>`;
  }
  function calendarMonth(month) {
    const startDay = month + "-01";
    const count = lengthOf(month);
    const offset = (new Date(startDay + "T12:00:00Z").getUTCDay() + 6) % 7;
    const cells = Array(offset).fill('<span aria-hidden="true"></span>');
    let eventCount = 0;
    for (let n = 1; n <= count; n++) {
      const date = month + "-" + pad(n);
      const events = eventsByDate.get(date) || [];
      eventCount += events.length;
      const kinds = [...new Set(events.map(kindOf))];
      const active = scopePeriods.filter(p => includesDate(p, date));
      const bands = ["comeback", "tour"].map(type => {
        const runs = active.filter(p => p.type === type);
        if (!runs.length) return "";
        const ends = runs.every(p => p.end === date) ? " band-end" : "";
        const begins = runs.every(p => p.start === date) ? " band-start" : "";
        return `<i class="day-band ${type}${ends}${begins}" aria-hidden="true"></i>`;
      }).join("");
      const label = [date, ...kinds, ...active.map(p => periodName(p) + " " + p.title)].join("，");
      const focusDate = day.startsWith(month) ? day : today.startsWith(month) ? today : startDay;
      cells.push(`<button class="year-day ${events.length ? "has-events" : ""}" type="button" data-date="${date}" tabindex="${date === focusDate ? 0 : -1}" aria-label="${esc(label)}" aria-pressed="${day === date}" ${date === today ? 'aria-current="date"' : ""} title="${esc(label)}">${bands}<span>${n}</span><span class="day-marks">${kinds.map(mark).join("")}</span></button>`);
    }
    return `<section class="mini-month ${activeMonth === month ? "month-active" : ""}" data-month-grid="${month}" aria-label="${monthName(month)}"><h3><button type="button" data-month="${month}" aria-label="查看${monthName(month)}行程"><span>${Number(month.slice(5))}<small> 月</small></span><span class="month-meta">${eventCount ? `${eventCount} 项 · ` : ""}${month.slice(0, 4)} ${icon("right", 12)}</span></button></h3>
      <div class="mini-week" aria-hidden="true">${[..."一二三四五六日"].map(d => `<span>${d}</span>`).join("")}</div><div class="mini-days">${cells.join("")}</div></section>`;
  }
  function position(date, inclusiveEnd) {
    const key = date.slice(0, 7);
    const diff = (+key.slice(0, 4) - +start.slice(0, 4)) * 12 + +key.slice(5) - +start.slice(5);
    return Math.max(0, Math.min(100, (diff + (+date.slice(8) - (inclusiveEnd ? 0 : 1)) / lengthOf(key)) * 100 / 12));
  }
  function timeline(months) {
    const distance = p => selectedPeriod === p ? -1 : today < p.start ? Date.parse(p.start) - Date.parse(today) : today > p.end ? Date.parse(today) - Date.parse(p.end) : 0;
    const nearest = [...scopePeriods].sort((a, b) => distance(a) - distance(b)).slice(0, 3);
    const visible = expanded || scopePeriods.length <= 4 ? scopePeriods : scopePeriods.filter(p => nearest.includes(p));
    const rows = visible.map(p => {
      const left = position(p.start, false);
      const width = position(p.end, true) - left;
      const label = `${artist === "all" ? (p.group || artists[p.artist].group) + " · " : ""}${p.title}`;
      return `<button type="button" data-period="${esc(p.key)}" aria-pressed="${selectedPeriod?.key === p.key}" aria-label="${esc(label)}，${p.start} 至 ${p.end}，查看依据" class="track-row">
        <span class="track-label"><i class="period-key ${p.type}"></i><span>${esc(label)}</span></span>
        <span class="track-rail" aria-hidden="true"><i class="track-bar ${p.type}" style="left:${left.toFixed(4)}%;width:${width.toFixed(4)}%"></i></span>
        <span class="track-dates">${p.start.slice(5).replace("-", ".")} — ${p.end.slice(5).replace("-", ".")}</span></button>`;
    });
    return `<section class="period-timeline" aria-label="回归期与巡演期"><div class="timeline-head"><h2>回归与巡演</h2><div class="band-legend"><span><i class="period-key comeback"></i>回归期</span><span><i class="period-key tour"></i>巡演期</span></div></div>
      ${rows.length ? `<div class="track-axis" aria-hidden="true"><span></span><div>${months.map(m => `<span>${+m.slice(5)}</span>`).join("")}</div><span></span></div>${rows.join("")}` : '<p class="window-empty">这十二个月暂无已收录的回归或巡演区间。</p>'}
      <div class="timeline-foot">${scopePeriods.length > 4 ? `<button class="expand-periods text-link" type="button" data-action="toggle-periods" aria-expanded="${expanded}">${expanded ? "收起时段" : "展开全部 " + scopePeriods.length + " 段"} ${icon("down", 13)}</button>` : ""}${rows.length ? "<small>色带连接已核实的首末活动，点击可查看出处。</small>" : ""}</div></section>`;
  }
  function eventCard(event) {
    const who = artists[event.artist];
    const zone = ({"Asia/Seoul": "韩国时间", "Asia/Tokyo": "日本时间", "Asia/Shanghai": "北京时间", "Asia/Hong_Kong": "香港时间", "Asia/Taipei": "台北时间"})[event.timezone] || event.timezone;
    const k = kindOf(event);
    return `<article class="event"><div class="event-date"><small>${Number(event.date.slice(5, 7))} 月</small><strong>${event.date.slice(8)}</strong></div>
      <div class="event-info"><div class="event-meta"><span class="kind-name">${mark(k)}${esc(k)}</span><span>${event.scope === "团体" ? `${who.group} · 团体` : `${who.name} · 个人`}</span></div><h3>${esc(event.title)}</h3><div class="event-detail">
      ${event.time ? `<span>${icon("clock", 12)} ${esc(event.time)} ${esc(zone || "当地时间")}</span>` : ""}
      <a href="${safeLink(event.source)}" ${ext}>${esc(event.publisher)} ${icon("outward", 12)}</a></div></div></article>`;
  }
  function periodCard(p) {
    const related = videos(p.artist).filter(v => includesDate(p, v.date)).length;
    return `<article class="period-detail"><span class="period-tag ${p.type}">${periodName(p)} · ${esc(p.group || artists[p.artist].group)}</span><h3>${esc(p.title)}</h3>
      <p class="period-dates">${esc(p.start)} — ${esc(p.end)}</p><p>${esc(p.note)}</p>
      <div class="period-links"><a href="${safeLink(p.source)}" ${ext}>${esc(p.publisher)} ${icon("outward", 12)}</a>
      ${p.endSource && p.endSource !== p.source ? `<a href="${safeLink(p.endSource)}" ${ext}>${esc(p.endPublisher || "结束日期出处")} ${icon("outward", 12)}</a>` : ""}</div>
      ${related ? `<a class="text-link" href="${path(p.artist, "videos", "?period=" + encodeURIComponent(p.id))}">同期视频 · ${related} 部 ${icon("arrow", 14)}</a>` : ""}</article>`;
  }
  function details() {
    if (selectedPeriod) return `<div class="agenda-heading"><h2>时段明细</h2><button data-action="whole-month" type="button" class="text-link">查看本月</button></div>${periodCard(selectedPeriod)}`;
    const monthEvents = [...eventsByDate.values()].flat().filter(e => day ? e.date === day : e.date.startsWith(activeMonth));
    const relevant = scopePeriods.filter(p => day ? includesDate(p, day) : overlap(p, activeMonth + "-01", activeMonth + "-" + lengthOf(activeMonth)));
    const title = day ? `${Number(day.slice(5, 7))} 月 ${Number(day.slice(8))} 日` : monthName(activeMonth);
    let listing = monthEvents.map(eventCard).join("");
    if (!day && activeMonth === currentMonth && monthEvents.length) {
      const next = monthEvents.filter(e => e.date >= today), past = monthEvents.filter(e => e.date < today).reverse();
      listing = (next.length ? '<h3 class="agenda-group">今日及以后</h3>' + next.map(eventCard).join("") : "") +
        (past.length ? '<h3 class="agenda-group">本月回顾</h3>' + past.map(eventCard).join("") : "");
    }
    return `<div class="agenda-heading"><h2>${title}</h2>${day ? '<button type="button" data-action="whole-month" class="text-link">查看全月</button>' : ""}</div>
      ${listing || `<p class="agenda-empty">${day ? "当日" : "本月"}暂无${kind ? "这类" : "已收录的"}公开行程。</p>`}
      ${relevant.length ? `<h3 class="agenda-sub">同期区间</h3>${relevant.map(periodCard).join("")}` : ""}`;
  }
  function sourcesNote() {
    const sources = (calendar.sources || []).filter(s => artist === "all" || s.artist === "all" || s.artist === artist || (artist === "liz" && s.id.startsWith("ive-")));
    return `<details class="source-details"><summary>行程来源与核对日期</summary><p>日期采用主办方公布的当地日期。时段的首末日期与公告见各区间明细。</p>
      <p>手动收录的单日公告核对于 ${esc(calendar.curatedAt)}。</p><ul>${sources.map(s => `<li><a href="${safeLink(s.url)}" ${ext}>${esc(s.publisher)} · ${esc(s.topic)}</a> ${s.status === "stale" ? "最近读取失败，上次核对 " : "核对于 "}${esc(s.checkedAt || "尚无记录")}</li>`).join("")}</ul></details>`;
  }
  function render() {
    const months = Array.from({length: 12}, (_, i) => shiftMonth(start, i));
    first = start + "-01";
    last = months[11] + "-" + lengthOf(months[11]);
    if (activeMonth < start || activeMonth > months[11]) { activeMonth = start; day = ""; }
    scopePeriods = allPeriods.filter(p => visibleToArtist(p) && overlap(p, first, last));
    if (selectedPeriod && !scopePeriods.includes(selectedPeriod)) selectedPeriod = undefined;
    const events = allEvents.filter(visibleToArtist);
    eventsByDate = new Map();
    for (const event of events) {
      if (event.date < first || event.date > last || (kind && kindOf(event) !== kind)) continue;
      if (!eventsByDate.has(event.date)) eventsByDate.set(event.date, []);
      eventsByDate.get(event.date).push(event);
    }
    const panel = details();
    box.innerHTML = `${controls(events)}${timeline(months)}<div class="year-overview"><div class="year-section-head"><h2>十二个月总览</h2>
      <span>${first.slice(0, 7).replace("-", ".")} — ${last.slice(0, 7).replace("-", ".")}</span></div>
      <div class="month-tools"><label class="jump-month"><select aria-label="跳到月份" data-field="jump"><option value="" disabled selected>跳到月份</option>${months.map(m => `<option value="${m}">${monthName(m)}</option>`).join("")}</select></label>
      <button type="button" class="sheet-trigger text-link" data-action="show-detail">明细 ${icon("right", 13)}</button></div></div>
      <div class="year-layout"><div class="year-grid">${months.map(calendarMonth).join("")}</div>
      <aside class="year-agenda" aria-label="当前选择的行程明细">${panel}</aside></div>${sourcesNote()}`;
    sheet.querySelector(".sheet-body").innerHTML = panel;
  }
  function finish(control, showDetail = false) {
    const field = Object.keys(control.dataset)[0], value = control.dataset[field];
    persist();
    render();
    if (showDetail && mobile.matches && !sheet.open) sheet.showModal();
    else {
      const parent = sheet.open ? sheet : box;
      const kebab = field.replace(/[A-Z]/g, c => "-" + c.toLowerCase());
      const same = parent.querySelector(`[data-${kebab}="${CSS.escape(value)}"]`);
      const fallback = sheet.open ? sheet.querySelector("[data-dismiss]") : box.querySelector(`[data-month="${activeMonth}"]`);
      (same || fallback)?.focus({preventScroll: true});
    }
  }
  function click(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const d = button.dataset;
    if (button.hasAttribute("data-dismiss")) { sheet.close(); return; }
    if (d.action === "show-detail") { sheet.showModal(); return; }
    if (d.date) { day = d.date; activeMonth = day.slice(0, 7); selectedPeriod = undefined; finish(button, true); return; }
    if (d.month) { activeMonth = d.month; day = ""; selectedPeriod = undefined; finish(button, true); return; }
    if (d.period) {
      selectedPeriod = allPeriods.find(p => p.key === d.period);
      activeMonth = selectedPeriod.start < first ? start : selectedPeriod.start.slice(0, 7);
      day = ""; finish(button, true); return;
    }
    if (d.artist) { artist = d.artist; selectedPeriod = undefined; kind = ""; }
    else if (button.hasAttribute("data-kind")) kind = d.kind;
    else if (d.step) { const next = shiftMonth(start, +d.step); if (!validMonth(next)) return; moveWindow(next); }
    else if (d.action === "whole-month") { day = ""; selectedPeriod = undefined; }
    else if (d.action === "toggle-periods") expanded = !expanded;
    else if (d.action === "this-year") moveWindow(currentMonth.slice(0, 4) + "-01");
    else if (d.action === "rolling") moveWindow(currentMonth);
    else return;
    finish(button);
  }
  box.addEventListener("click", click);
  sheet.addEventListener("click", click);
  box.addEventListener("change", event => {
    const select = event.target;
    if (select.dataset.field === "jump") {
      activeMonth = select.value; day = ""; selectedPeriod = undefined;
      persist(); render();
      const target = box.querySelector(`[data-month="${activeMonth}"]`);
      target.focus({preventScroll: true});
      target.closest(".mini-month").scrollIntoView({block: "start"});
      return;
    }
    if (select.dataset.field === "year") moveWindow(select.value + start.slice(4));
    else if (select.dataset.field === "month") moveWindow(start.slice(0, 5) + select.value);
    else return;
    finish(select);
  });
  box.addEventListener("keydown", event => {
    const button = event.target.closest("[data-date]");
    const step = {ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7}[event.key];
    if (!button || !step) return;
    event.preventDefault();
    const date = new Date(button.dataset.date + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + step);
    const next = box.querySelector(`[data-date="${date.toISOString().slice(0, 10)}"]`);
    if (next) {
      next.closest(".mini-days").querySelector('[tabindex="0"]')?.setAttribute("tabindex", "-1");
      next.tabIndex = 0;
      next.focus();
    }
  });
  mobile.addEventListener("change", () => { if (!mobile.matches && sheet.open) sheet.close(); });
  sheet.addEventListener("close", () => {
    if (!mobile.matches) return;
    const selector = selectedPeriod ? `[data-period="${CSS.escape(selectedPeriod.key)}"]` : day ? `[data-date="${day}"]` : `[data-month="${activeMonth}"]`;
    box.querySelector(selector)?.focus({preventScroll: true});
  });
  render();
  if (mobile.matches && (day || selectedPeriod)) sheet.showModal();
})();
