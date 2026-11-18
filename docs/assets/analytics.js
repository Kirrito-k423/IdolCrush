(function () {
  "use strict";

  const {artists, categories, videos, esc, icon, path} = window.IC;
  const {collect, summarize} = window.ICAnalytics;
  const container = document.querySelector("#analytics");
  const ids = Object.keys(artists);
  const archive = collect(ids, videos);
  const query = new URLSearchParams(location.search);
  let selected = ids.includes(query.get("artist")) ? query.get("artist") : "";
  const palette = ["#dcfa64", "#eaa9c9", "#9ed8cb", "#bcbff5", "#e9ba84", "#e7a6e0", "#88bfff", "#d3d1a3"];
  const number = value => Number(value).toLocaleString("zh-CN");
  const stamp = value => {
    const date = new Date(value);
    if (!value || Number.isNaN(date.valueOf())) return "暂无";
    return new Intl.DateTimeFormat("zh-CN", {timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).format(date);
  };
  const stats = summarize(archive.all, categories);
  const rank = ids.map(id => ({id, name: artists[id].name, value: archive.artists[id].length, color: artists[id].color}))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "zh-CN"));

  container.innerHTML = `<div class="analysis-top">
      <p>把喜欢收进档案，也看看它们如何一点点长大。</p>
      <a href="${path("home", "updates")}" class="text-link">返回账号更新 ${icon("outward", 14)}</a>
    </div>
    <div class="analysis-scope"><span class="analysis-scope-label">统计范围</span><div class="scope-buttons" role="group" aria-label="选择艺人统计范围"></div></div>
    <div class="analysis-kpis" aria-live="polite"></div>
    <div class="analysis-grid">
      <section class="analysis-card artist-stats-card" aria-labelledby="analysis-artists-title">
        <div class="analysis-card-head"><div><p class="analysis-kicker">01 / ARTISTS</p><h2 id="analysis-artists-title">艺人影像数量</h2><p>每位艺人的视频库；点击柱形可切换范围</p></div><span class="analysis-card-number">07</span></div>
        <div class="analysis-chart artist-chart" role="img"></div>
      </section>
      <section class="analysis-card distribution-card" aria-labelledby="analysis-categories-title">
        <div class="analysis-card-head"><div><p class="analysis-kicker">02 / CATEGORIES</p><h2 id="analysis-categories-title">视频分类分布</h2><p>按每部影像的主要类型统计</p></div></div>
        <div class="donut-layout"><div class="analysis-chart donut-chart" role="img"></div><div class="donut-legend"></div></div>
      </section>
      <section class="analysis-card years-card" aria-labelledby="analysis-years-title">
        <div class="analysis-card-head"><div><p class="analysis-kicker">03 / TIMELINE</p><h2 id="analysis-years-title">影像年代分布</h2><p>按视频页面使用的活动日期或发布日期统计</p></div></div>
        <div class="analysis-chart years-chart" role="img"></div>
      </section>
      <section class="analysis-card categories-card" aria-labelledby="analysis-list-title">
        <div class="analysis-card-head"><div><p class="analysis-kicker">04 / INDEX</p><h2 id="analysis-list-title">所有视频分类</h2><p>展示当前范围内有收录的类型</p></div><span class="category-total"></span></div>
        <div class="analysis-category-list"></div>
      </section>
    </div>
    <div class="analysis-foot"><div><strong>关于这些数字</strong><p>全站包含账号更新及艺人专页，部分视频尚未归入具体艺人。相同平台的视频按编号与分 P 去重；已关联的 B 站与 YouTube 版本合并。团体视频可能同时属于多位艺人，因此艺人数量不能相加。分类使用视频的主要类型，自动识别可能有误。</p></div>
      <div><strong>数据更新</strong><p>B 站：${esc(stamp(window.IC_BILIBILI?.updatedAt))}<br>YouTube：${esc(stamp(window.IC_YOUTUBE?.updatedAt))}（北京时间）</p><p>统计随视频档案同步更新，YouTube 目前主要收录监控开始后的近期投稿。</p></div></div>`;

  const buttons = container.querySelector(".scope-buttons");
  const kpis = container.querySelector(".analysis-kpis");
  const categoryList = container.querySelector(".analysis-category-list");
  const categoryTotal = container.querySelector(".category-total");
  const legend = container.querySelector(".donut-legend");
  const chartNodes = ["artist", "donut", "years"].map(name => container.querySelector(`.${name}-chart`));
  let artistChart, donutChart, yearsChart;
  if (window.echarts) {
    [artistChart, donutChart, yearsChart] = chartNodes.map(node => echarts.init(node, null, {renderer: "svg"}));
  } else chartNodes.forEach(node => node.classList.add("chart-fallback"));

  function setSelected(id) {
    selected = ids.includes(id) ? id : "";
    const url = new URL(location.href);
    if (selected) url.searchParams.set("artist", selected); else url.searchParams.delete("artist");
    if (location.protocol !== "file:") history.replaceState(null, "", url);
    render();
  }
  buttons.addEventListener("click", event => {
    const button = event.target.closest("[data-artist]");
    if (button) {
      const id = button.dataset.artist;
      setSelected(id);
      buttons.querySelector(`[data-artist="${id}"]`)?.focus({preventScroll: true});
    }
  });
  artistChart?.on("click", params => {
    const match = rank.find(item => item.name === params.name);
    if (match) setSelected(match.id);
  });

  function render() {
    const current = selected ? archive.artists[selected] : archive.all;
    const result = selected ? summarize(current, categories) : stats;
    const scopeName = selected ? artists[selected].name : "全站";
    buttons.innerHTML = [{id: "", name: "全部"}, ...ids.map(id => ({id, name: artists[id].name}))].map(item =>
      `<button type="button" data-artist="${esc(item.id)}" aria-pressed="${item.id === selected}">${esc(item.name)}</button>`).join("");
    const yearSpan = result.years.length ? `${result.years[0].year} — ${result.years.at(-1).year}` : "暂无";
    kpis.innerHTML = `<div class="analysis-kpi featured"><span>${esc(scopeName)} · 影像总数</span><strong>${number(result.total)}</strong><small>部已收录影像</small></div>
      <div class="analysis-kpi"><span>有内容的分类</span><strong>${number(result.categories.length)}</strong><small>按主要类型计数</small></div>
      <div class="analysis-kpi"><span>影像年代</span><strong class="analysis-years-value">${esc(yearSpan)}</strong><small>以页面显示的日期为准</small></div>
      <div class="analysis-kpi"><span>全站收录艺人</span><strong>${number(ids.length)}</strong><small>团体内容可关联多位艺人</small></div>`;
    categoryTotal.textContent = `${result.categories.length} 类`;
    categoryList.innerHTML = result.categories.length ? result.categories.map((item, index) => `<div class="analysis-category"><span><i style="--category-color:${palette[index % palette.length]}"></i>${esc(item.name)}</span><strong>${number(item.value)}</strong></div>`).join("") : '<p class="analysis-empty">当前范围暂无分类记录。</p>';
    const top = result.categories.slice(0, 6).map((item, index) => ({...item, itemStyle: {color: palette[index]}}));
    const remaining = result.categories.slice(6);
    if (remaining.length) top.push({name: `其余 ${remaining.length} 类`, value: remaining.reduce((sum, item) => sum + item.value, 0), itemStyle: {color: "#676975"}});
    legend.innerHTML = top.map(item => `<div><span><i style="--category-color:${item.itemStyle.color}"></i>${esc(item.name)}</span><b>${number(item.value)}</b></div>`).join("");
    chartNodes[0].setAttribute("aria-label", `各艺人影像数量：${rank.map(item => `${item.name} ${item.value} 部`).join("，")}`);
    chartNodes[1].setAttribute("aria-label", `${scopeName}视频主要类型：${result.categories.map(item => `${item.name} ${item.value} 部`).join("，")}`);
    chartNodes[2].setAttribute("aria-label", `${scopeName}影像年代：${result.years.map(item => `${item.year} 年 ${item.value} 部`).join("，") || "暂无"}`);
    if (!artistChart || !donutChart || !yearsChart) {
      chartNodes[0].innerHTML = `<p class="analysis-chart-error">图表暂不可用</p>${rank.map(item => `<div class="analysis-fallback-row"><span>${esc(item.name)}</span><b>${number(item.value)} 部</b></div>`).join("")}`;
      chartNodes[1].innerHTML = `<p class="analysis-chart-error">${number(result.total)} 部影像</p>`;
      chartNodes[2].innerHTML = result.years.map(item => `<div class="analysis-fallback-row"><span>${esc(item.year)} 年</span><b>${number(item.value)} 部</b></div>`).join("") || '<p class="analysis-chart-error">暂无年代数据</p>';
      return;
    }
    const axisText = {color: "#aaa9ae", fontFamily: "sans-serif", fontSize: 11};
    const tip = {backgroundColor: "#242428", borderColor: "#55555a", textStyle: {color: "#f5f4f1"}, confine: true};
    artistChart.setOption({animationDuration: 500, tooltip: {...tip, trigger: "axis", axisPointer: {type: "shadow"}, valueFormatter: value => `${number(value)} 部`},
      grid: {left: 68, right: 52, top: 12, bottom: 12},
      xAxis: {type: "value", min: 0, show: false}, yAxis: {type: "category", inverse: true, data: rank.map(item => item.name), axisTick: {show: false}, axisLine: {show: false}, axisLabel: {...axisText, color: "#e9e7e7", fontSize: 12}},
      series: [{type: "bar", barMaxWidth: 18, data: rank.map(item => ({value: item.value, itemStyle: {color: item.color, opacity: selected && selected !== item.id ? 0.4 : 1, borderRadius: [0, 3, 3, 0]}})), label: {show: true, position: "right", color: "#dedde0", fontSize: 11, formatter: ({value}) => number(value)}, emphasis: {focus: "self"}}]}, true);
    donutChart.setOption({animationDuration: 500, tooltip: {...tip, trigger: "item", formatter: p => `${esc(p.name)}<br>${number(p.value)} 部 · ${p.percent}%`},
      series: [{type: "pie", radius: ["62%", "84%"], center: ["50%", "50%"], avoidLabelOverlap: true, stillShowZeroSum: false,
        itemStyle: {borderColor: "#171719", borderWidth: 3}, label: {show: false}, emphasis: {scale: true, scaleSize: 5}, data: top}],
      graphic: [{type: "text", left: "center", top: "41%", style: {text: number(result.total), fill: "#f4f4f1", font: "700 25px sans-serif", textAlign: "center"}},
        {type: "text", left: "center", top: "56%", style: {text: "部影像", fill: "#aaa9ae", font: "11px sans-serif", textAlign: "center"}}]}, true);
    yearsChart.setOption({animationDuration: 500, tooltip: {...tip, trigger: "axis", axisPointer: {type: "shadow"}, valueFormatter: value => `${number(value)} 部`},
      grid: {left: 48, right: 16, top: 14, bottom: 32},
      xAxis: {type: "category", data: result.years.map(item => item.year), axisTick: {show: false}, axisLine: {lineStyle: {color: "#4a4a50"}}, axisLabel: {...axisText, hideOverlap: true}},
      yAxis: {type: "value", min: 0, axisLabel: axisText, splitLine: {lineStyle: {color: "#303035"}}},
      series: [{type: "bar", barMaxWidth: 30, data: result.years.map(item => item.value), itemStyle: {color: "#b5c76d", borderRadius: [3, 3, 0, 0]}, emphasis: {itemStyle: {color: "#dcfa64"}}}]}, true);
  }
  render();
  const resize = () => [artistChart, donutChart, yearsChart].forEach(chart => chart?.resize());
  window.addEventListener("resize", resize, {passive: true});
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(resize);
    chartNodes.forEach(node => observer.observe(node));
  }
})();
