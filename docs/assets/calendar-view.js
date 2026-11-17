(function () {
  "use strict";

  const {page, artists, icon, esc, safeLink, heading, pad, ext} = window.IC;
  const calendar = window.IC_CALENDAR || {events: []};
  const events = [...calendar.events].filter(event => artists[event.artist]).sort((left, right) =>
    left.date.localeCompare(right.date) || (left.time || "").localeCompare(right.time || "") || left.title.localeCompare(right.title, "zh-CN"));
  const today = new Intl.DateTimeFormat("sv-SE", {timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date());
  const currentMonth = today.slice(0, 7);
  const container = document.querySelector("#calendar");
  const monthName = key => `${Number(key.slice(0, 4))} 年 ${Number(key.slice(5, 7))} 月`;
  const dayName = key => `${Number(key.slice(5, 7))} 月 ${Number(key.slice(8))} 日`;
  let artist = page === "home" ? "all" : page;
  let selectedDay = "";
  let month;

  function forArtist() {
    return artist === "all" ? events : events.filter(event => event.artist === artist);
  }

  function nearestMonth() {
    const records = forArtist();
    if (records.some(event => event.date.startsWith(currentMonth))) return currentMonth;
    const chosen = records.find(event => event.date >= today) || records[records.length - 1];
    return chosen ? chosen.date.slice(0, 7) : currentMonth;
  }

  function updateMonth(key) {
    month = key;
    selectedDay = "";
    render();
  }

  function stepMonth(delta) {
    const [year, number] = month.split("-").map(Number);
    const date = new Date(Date.UTC(year, number - 1 + delta, 1));
    updateMonth(`${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`);
  }

  function chips() {
    if (page !== "home") return "";
    return `<div class="chips calendar-filters" role="group" aria-label="按艺人筛选行程">
      ${[["all", "全部艺人"], ...Object.entries(artists).map(([id, data]) => [id, data.name])].map(([id, label]) =>
        `<button type="button" class="chip" data-artist="${id}" aria-pressed="${id === artist}">${label}</button>`).join("")}</div>`;
  }

  function days(records) {
    const [year, number] = month.split("-").map(Number);
    const offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
    const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
    const cells = Array(offset).fill('<span aria-hidden="true"></span>');
    for (let i = 1; i <= last; i++) {
      const date = `${month}-${pad(i)}`;
      const items = records.filter(event => event.date === date);
      const dots = [...new Set(items.map(event => event.artist))].map(id =>
        `<i style="--dot:${artists[id].color}"></i>`).join("");
      const isToday = date === today;
      cells.push(`<button type="button" data-date="${date}" class="day ${items.length ? "has-events" : ""} ${isToday ? "is-today" : ""}"
        aria-label="${date}，${items.length ? `${items.length} 项公开行程` : "暂无收录"}" aria-pressed="${selectedDay === date}" ${isToday ? 'aria-current="date"' : ""}>
        ${i}<span class="date-dots" aria-hidden="true">${dots}</span></button>`);
    }
    return cells.join("");
  }

  function card(event) {
    const who = artists[event.artist];
    const day = new Date(`${event.date}T12:00:00Z`).getUTCDay();
    const zone = ({"Asia/Seoul": "韩国时间", "Asia/Tokyo": "日本时间", "Asia/Shanghai": "北京时间", "Asia/Hong_Kong": "香港时间", "Asia/Taipei": "台北时间"})[event.timezone] || event.timezone;
    const label = event.scope === "团体" ? `${who.group} · 团体` : `${who.name} · 个人`;
    return `<article class="event">
      <div class="event-date"><small>${Number(event.date.slice(5, 7))} 月</small><strong>${event.date.slice(8)}</strong><small>周${"日一二三四五六"[day]}</small></div>
      <div class="event-info"><div class="event-meta"><span class="event-person" style="--dot:${who.color}"><i></i>${label}</span><span>${esc(event.kind)}</span></div>
      <h3>${esc(event.title)}</h3>
      <div class="event-detail">${event.time ? `<span>${icon("clock", 13)} ${esc(event.time)} ${esc(zone || "当地时间")}</span>` : ""}
      <a href="${safeLink(event.source)}" ${ext}>${esc(event.publisher || "公告原文")} ${icon("outward", 13)}</a></div></div>
    </article>`;
  }

  function agendaItems(visible) {
    if (selectedDay || month !== currentMonth) return visible.map(card).join("");
    const next = visible.filter(event => event.date >= today);
    const past = visible.filter(event => event.date < today);
    return (next.length ? '<h4 class="agenda-group">今日及以后</h4>' + next.map(card).join("") : "") +
      (past.length ? '<h4 class="agenda-group">本月回顾</h4>' + past.reverse().map(card).join("") : "");
  }

  function sourcesNote() {
    const sources = (calendar.sources || []).filter(source => artist === "all" || source.artist === "all" || source.artist === artist);
    const rows = sources.map(source => `<li><a href="${safeLink(source.url)}" ${ext}>${esc(source.publisher)} · ${esc(source.topic || "公告")}</a>
      <span>${source.status === "stale" ? "最近读取失败，上次核对 " : "核对于 "}${esc(source.checkedAt || "尚无记录")}</span></li>`).join("");
    return `<details class="source-details"><summary>行程来源与核对日期</summary><p>节目与发行来自官方公开列表，演出、签售和个人活动另行核对主办方公告。点击行程下方的发布方可查看原文。</p>
      ${calendar.curatedAt ? `<p>人工整理的公告核对于 ${esc(calendar.curatedAt)}。</p>` : ""}${rows ? `<ul>${rows}</ul>` : ""}</details>`;
  }

  function render() {
    const records = forArtist();
    const inMonth = records.filter(event => event.date.startsWith(month));
    const visible = selectedDay ? inMonth.filter(event => event.date === selectedDay) : inMonth;
    const months = [...new Set([month, currentMonth, ...records.map(event => event.date.slice(0, 7))])].sort().reverse();
    const label = selectedDay ? dayName(selectedDay) : `${Number(month.slice(5))} 月`;
    const focus = document.activeElement;
    const restore = container.contains(focus) ? ["date", "step", "artist", "command"].find(k => focus.dataset[k] !== undefined) : undefined;
    const focusValue = restore ? focus.dataset[restore] : null;
    container.innerHTML = `${heading("calendar", "PUBLIC SCHEDULE", "行程日历")}
      ${chips()}<div class="calendar-layout">
      <div class="date-panel">
        <div class="month-bar"><label class="month-select"><select aria-label="跳到收录月份">${months.map(m => `<option value="${m}" ${month === m ? "selected" : ""}>${monthName(m)}</option>`).join("")}</select>${icon("down", 15)}</label>
        <div class="month-nav"><button type="button" class="mini-btn" data-command="today">本月</button><button type="button" class="circle small" data-step="-1" aria-label="上个月">${icon("left", 16)}</button><button type="button" class="circle small" data-step="1" aria-label="下个月">${icon("right", 16)}</button></div></div>
        <div class="weekdays" aria-hidden="true">${[..."一二三四五六日"].map(d => `<span>${d}</span>`).join("")}</div>
        <div class="day-grid" role="group" aria-label="${monthName(month)}的日期">${days(inMonth)}</div>
        <div class="calendar-legend"><span><i></i>已收录行程</span><span>按活动当地日期展示</span></div>
      </div>
      <div class="agenda"><div class="agenda-heading"><h3 aria-live="polite">${label}行程 <span>${pad(visible.length)}</span></h3>
      ${selectedDay ? '<button type="button" data-command="month" class="text-link">显示全月</button>' : ""}</div>
      <div class="event-list">${visible.length ? agendaItems(visible) : `<div class="calendar-empty">${icon("calendar", 26)}<p>${selectedDay ? "这一天暂无已收录的公开行程" : "本月暂无已收录的公开行程"}</p>${records.length ? '<button type="button" data-command="nearest" class="text-link">跳到最近收录的月份 ↗</button>' : ""}</div>`}</div></div></div>${sourcesNote()}`;
    if (restore) container.querySelector(`[data-${restore}="${CSS.escape(focusValue)}"]`)?.focus({preventScroll: true});
  }

  container.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.artist) {
      artist = button.dataset.artist;
      updateMonth(nearestMonth());
    } else if (button.dataset.step) {
      stepMonth(Number(button.dataset.step));
    } else if (button.dataset.date) {
      selectedDay = selectedDay === button.dataset.date ? "" : button.dataset.date;
      render();
    } else if (button.dataset.command === "today") {
      updateMonth(currentMonth);
    } else if (button.dataset.command === "nearest") {
      updateMonth(nearestMonth());
    } else if (button.dataset.command === "month") {
      updateMonth(month);
    }
  });
  container.addEventListener("change", event => {
    if (!event.target.matches("select")) return;
    updateMonth(event.target.value);
    container.querySelector("select").focus({preventScroll: true});
  });
  month = nearestMonth();
  render();
})();
