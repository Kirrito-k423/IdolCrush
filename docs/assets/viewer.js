(function () {
  "use strict";

  const {artists, photos, videos, photoUrl, previewUrl, thumbUrl, icon, esc, safeLink, ext, pad, base} = window.IC;
  const dialog = document.createElement("dialog");
  dialog.className = "viewer";
  dialog.setAttribute("aria-labelledby", "viewer-title");
  dialog.innerHTML = `<div class="viewer-layout">
    <header class="viewer-head"><div class="viewer-id"><span class="live-dot"></span><span id="viewer-person"></span></div>
      <div class="viewer-tools"><label class="viewer-order"><span class="sr-only">播放顺序</span><select aria-label="播放顺序"><option value="sequence">顺序播放</option><option value="random">随机播放</option></select></label><button class="photo-zoom mini-btn" type="button" aria-pressed="false">原寸查看</button><button class="circle native-full" type="button" aria-label="进入系统全屏">${icon("expand")}</button>
      <button class="circle viewer-close" type="button" aria-label="关闭放映厅" autofocus>${icon("close")}</button></div></header>
    <div class="viewer-stage">
      <button class="circle viewer-prev" type="button" aria-label="上一个作品">${icon("left")}</button>
      <div class="viewer-screen"></div>
      <button class="circle viewer-next" type="button" aria-label="下一个作品">${icon("right")}</button>
    </div>
    <footer class="viewer-caption"><div><span class="viewer-count micro"></span><h2 id="viewer-title" aria-live="polite"></h2><div class="viewer-credit"></div><p class="viewer-message" role="status"></p></div>
      <div class="viewer-links"></div></footer>
  </div>`;
  document.body.append(dialog);
  const screen = dialog.querySelector(".viewer-screen");
  const fullscreenButton = dialog.querySelector(".native-full");
  const zoomButton = dialog.querySelector(".photo-zoom");
  const orderControl = dialog.querySelector(".viewer-order");
  const orderSelect = orderControl.querySelector("select");
  const message = dialog.querySelector(".viewer-message");
  const fullscreenRoot = document.documentElement;
  fullscreenButton.hidden = !fullscreenRoot.requestFullscreen && !fullscreenRoot.webkitRequestFullscreen;
  let state;
  let enteredFullscreen = false;
  let bridgeReady = false;
  let youtubeAPI;
  let youtubePlayer;

  function saved(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Playback works without saved preferences. */ }
  }
  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
      const pick = Math.floor(Math.random() * (index + 1));
      [result[index], result[pick]] = [result[pick], result[index]];
    }
    return result;
  }
  function updateMessage() {
    if (!state || state.type !== "video" || state.queue.length < 2) { message.textContent = ""; return; }
    if (state.currentPlayer === "bili") {
      const helper = `${base}bili-helper/${location.protocol === "file:" ? "index.html" : ""}`;
      message.innerHTML = bridgeReady ? "B 站自动连播已启用。" : `B 站自动连播可使用桌面浏览器扩展。<a href="${helper}" ${ext}>安装方法 ${icon("outward", 12)}</a>`;
    } else if (state.currentPlayer === "youtube") {
      message.textContent = state.youtubeReady ? "视频结束后按所选顺序继续播放。" : state.youtubeError ? "播放器接口未连接，可手动切换视频。" : "正在连接自动连播。";
    } else {
      message.textContent = "可使用上一条和下一条切换视频。";
    }
  }
  function pingBridge() {
    if (location.origin !== "null") window.postMessage({channel: "idolcrush-bili", type: "ping"}, location.origin);
  }
  function loadYouTubeAPI() {
    if (window.YT?.Player) return Promise.resolve(true);
    if (!youtubeAPI) youtubeAPI = new Promise(resolve => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (typeof previous === "function") previous(); resolve(true); };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => resolve(false);
      document.head.append(script);
      setTimeout(() => resolve(Boolean(window.YT?.Player)), 12000);
    });
    return youtubeAPI;
  }
  function destroyYouTubePlayer() {
    if (youtubePlayer) {
      try { youtubePlayer.destroy(); } catch { /* The iframe may already have been removed. */ }
      youtubePlayer = undefined;
    }
  }
  function advanceAutomatically() {
    if (!state || state.type !== "video") return;
    if (state.cursor < state.queue.length - 1) move(1);
    else message.textContent = "播放列表已结束。";
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement;
  }

  async function toggleFullscreen() {
    try {
      if (fullscreenElement()) {
        await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        await (fullscreenRoot.requestFullscreen || fullscreenRoot.webkitRequestFullscreen).call(fullscreenRoot);
        enteredFullscreen = true;
      }
    } catch {
      fullscreenButton.hidden = true;
    }
  }

  function syncFullscreen() {
    const active = Boolean(fullscreenElement());
    fullscreenButton.setAttribute("aria-label", active ? "退出系统全屏" : "进入系统全屏");
    fullscreenButton.innerHTML = icon(active ? "shrink" : "expand");
    if (!active) enteredFullscreen = false;
  }

  function availablePlayers(item) {
    const players = [];
    if (/^[\w-]{11}$/.test(item.youtube || "")) {
      const query = new URLSearchParams({autoplay: 1, playsinline: 1, rel: 0, enablejsapi: 1});
      if (location.origin !== "null") query.set("origin", location.origin);
      players.push({name: "YouTube", type: "youtube", embed: `https://www.youtube-nocookie.com/embed/${item.youtube}?${query}`, source: `https://www.youtube.com/watch?v=${item.youtube}`});
    }
    if (/^BV[0-9a-z]{10}$/i.test(item.bilibili || "")) {
      const part = Number(item.bilibiliPage) || 1;
      const query = new URLSearchParams({bvid: item.bilibili, p: part, page: part, autoplay: 1, danmaku: 0});
      if (/^\d+$/.test(item.bilibiliCid || "")) query.set("cid", item.bilibiliCid);
      players.push({name: "哔哩哔哩", type: "bili", embed: `https://player.bilibili.com/player.html?${query}`, source: `https://www.bilibili.com/video/${item.bilibili}/?p=${part}`});
    }
    return players;
  }

  function renderVideo(item) {
    destroyYouTubePlayer();
    const players = availablePlayers(item);
    const player = players.find(choice => choice.type === state.player) || players.find(choice => choice.type === saved("idolcrush-player", "bili")) || players[0];
    state.currentPlayer = player?.type;
    state.youtubeReady = false;
    state.youtubeError = false;
    const links = dialog.querySelector(".viewer-links");
    const publisher = player?.type === "bili" ? item.bilibiliPublisher || item.publisher : item.publisher;
    dialog.querySelector(".viewer-credit").textContent = [publisher, item.album, item.date].filter(Boolean).join("  /  ");
    links.innerHTML = `${players.length > 1 ? `<div class="platforms" aria-label="播放平台">${players.map(choice => `<button type="button" data-player="${choice.type}" aria-pressed="${choice === player}">${choice.name}</button>`).join("")}</div>` : ""}
      ${player?.type === "bili" ? `<a class="text-link" href="https://passport.bilibili.com/login" ${ext}>登录 B 站 ${icon("outward", 14)}</a><button type="button" class="text-link" data-reload>登录后刷新</button>` : ""}
      <a class="text-link" href="${safeLink(player?.source || item.source)}" ${ext}>${player ? `在 ${player.name} 观看` : "去原站观看"} ${icon("outward", 16)}</a>`;
    if (player) {
      const frame = document.createElement("iframe");
      frame.title = `${artists[state.id]?.name || "账号更新"} · ${item.title} · ${player.name}`;
      frame.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
      frame.allowFullscreen = true;
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.src = player.embed;
      screen.replaceChildren(frame);
      if (player.type === "youtube") {
        loadYouTubeAPI().then(available => {
          if (!frame.isConnected || state?.currentPlayer !== "youtube") return;
          if (!available) { state.youtubeError = true; updateMessage(); return; }
          try {
            youtubePlayer = new window.YT.Player(frame, {events: {
              onReady() { if (frame.isConnected && state?.currentPlayer === "youtube") { state.youtubeReady = true; updateMessage(); } },
              onStateChange(event) {
                if (event.data === window.YT.PlayerState.ENDED && event.target === youtubePlayer && frame.isConnected) advanceAutomatically();
              }
            }});
          } catch {
            state.youtubeError = true;
            updateMessage();
          }
        });
      } else {
        pingBridge();
      }
    } else {
      screen.innerHTML = `<a class="video-external" href="${safeLink(item.source)}" ${ext}><img src="${esc(thumbUrl(item, state.id))}" alt="" referrerpolicy="no-referrer"><span class="primary">去原站观看 ${icon("outward")}</span></a>`;
    }
    updateMessage();
  }

  function render() {
    const {id, type, queue, cursor} = state;
    const photoMode = type === "photo";
    const item = (photoMode ? photos(id) : videos(id))[queue[cursor]];
    dialog.dataset.mode = type;
    setZoom(false);
    zoomButton.hidden = !photoMode;
    orderControl.hidden = photoMode;
    if (!photoMode) orderSelect.value = state.mode;
    else message.textContent = "";
    const person = artists[id] || {roman: "BILIBILI", name: "账号更新"};
    dialog.querySelector("#viewer-person").textContent = `${person.roman}  /  ${person.name}`;
    dialog.querySelector(".viewer-count").textContent = `${photoMode ? "PHOTO" : "VIDEO"}  ${pad(cursor + 1)} / ${pad(queue.length)}`;
    dialog.querySelector("#viewer-title").textContent = item.title;
    dialog.querySelectorAll(".viewer-prev, .viewer-next").forEach(button => { button.hidden = queue.length < 2; });
    if (photoMode) {
      const img = document.createElement("img");
      img.className = "viewer-photo";
      img.width = item.width;
      img.height = item.height;
      img.alt = item.alt;
      const status = document.createElement("span");
      const preview = document.createElement("img");
      preview.className = "viewer-loading-preview";
      preview.alt = "";
      preview.src = previewUrl(item);
      status.className = "photo-status";
      status.setAttribute("role", "status");
      status.textContent = "正在载入高清原图…";
      zoomButton.disabled = true;
      img.addEventListener("load", () => {
        preview.remove();
        status.remove();
        if (img.isConnected) zoomButton.disabled = false;
      }, {once: true});
      img.addEventListener("error", () => { status.textContent = "原图暂未载入，可打开图片来源查看。"; }, {once: true});
      screen.replaceChildren(img, preview, status);
      img.src = photoUrl(item);
      const rights = item.licenseUrl ? `<a href="${safeLink(item.licenseUrl)}" ${ext}>${esc(item.license)}</a>` : esc(item.rights || item.license || "");
      dialog.querySelector(".viewer-credit").innerHTML = [`${item.width} × ${item.height} px`, esc(item.date), esc(item.credit), rights, esc(item.changes)].filter(Boolean).join(" · ");
      dialog.querySelector(".viewer-links").innerHTML = `<a class="text-link" href="${esc(photoUrl(item))}" ${ext}>打开原图 ${icon("outward", 15)}</a><a class="text-link" href="${safeLink(item.source)}" ${ext}>图片来源 ${icon("outward", 15)}</a>`;
    } else {
      renderVideo(item);
    }
  }

  function move(by) {
    if (!state) return;
    state.cursor = (state.cursor + by + state.queue.length) % state.queue.length;
    render();
  }

  function setZoom(zoomed) {
    dialog.classList.toggle("is-zoomed", zoomed);
    zoomButton.setAttribute("aria-pressed", String(zoomed));
    zoomButton.textContent = zoomed ? "适应屏幕" : "原寸查看";
    screen.scrollLeft = 0;
    screen.scrollTop = 0;
    if (zoomed && state?.type === "photo") {
      const picture = photos(state.id)[state.queue[state.cursor]];
      const [x, y] = (picture.position || "50% 35%").split(" ").map(parseFloat);
      screen.scrollLeft = screen.scrollWidth * x / 100 - screen.clientWidth / 2;
      screen.scrollTop = screen.scrollHeight * y / 100 - screen.clientHeight / 2;
    }
  }

  function stopProjection() {
    destroyYouTubePlayer();
    screen.replaceChildren();
    state = undefined;
    document.body.classList.remove("modal-open");
    if (enteredFullscreen && fullscreenElement()) toggleFullscreen();
  }

  function closeViewer() {
    dialog.close();
    stopProjection();
  }

  window.IC.openViewer = (id, type, index = 0, order, options = {}) => {
    const library = type === "photo" ? photos(id) : videos(id);
    if (!library[index]) return;
    const originalQueue = order?.includes(index) ? [...order] : library.map((_, n) => n);
    const mode = type === "video" && (options.mode || saved("idolcrush-play-order", "sequence")) === "random" ? "random" : "sequence";
    const queue = mode === "random" ? [index, ...shuffle(originalQueue.filter(item => item !== index))] : [...originalQueue];
    state = {id, type, originalQueue, queue, cursor: queue.indexOf(index), mode};
    if (type === "video") save("idolcrush-play-order", mode);
    render();
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("modal-open");
  };

  fullscreenButton.addEventListener("click", toggleFullscreen);
  zoomButton.addEventListener("click", () => setZoom(!dialog.classList.contains("is-zoomed")));
  document.addEventListener("fullscreenchange", syncFullscreen);
  document.addEventListener("webkitfullscreenchange", syncFullscreen);
  dialog.querySelector(".viewer-close").addEventListener("click", closeViewer);
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    closeViewer();
  });
  dialog.querySelector(".viewer-prev").addEventListener("click", () => move(-1));
  dialog.querySelector(".viewer-next").addEventListener("click", () => move(1));
  orderSelect.addEventListener("change", () => {
    if (!state || state.type !== "video") return;
    const current = state.queue[state.cursor];
    state.mode = orderSelect.value === "random" ? "random" : "sequence";
    state.queue = state.mode === "random" ? [current, ...shuffle(state.originalQueue.filter(index => index !== current))] : [...state.originalQueue];
    state.cursor = state.queue.indexOf(current);
    save("idolcrush-play-order", state.mode);
    dialog.querySelector(".viewer-count").textContent = `VIDEO  ${pad(state.cursor + 1)} / ${pad(state.queue.length)}`;
  });
  dialog.querySelector(".viewer-links").addEventListener("click", event => {
    const choice = event.target.closest("[data-player]");
    if (choice) {
      state.player = choice.dataset.player;
      save("idolcrush-player", state.player);
      render();
      dialog.querySelector(`[data-player="${state.player}"]`)?.focus();
    }
    if (event.target.closest("[data-reload]")) render();
  });
  window.addEventListener("message", event => {
    const data = event.data;
    if (!data || data.channel !== "idolcrush-bili") return;
    if (event.source === window && event.origin === location.origin && data.type === "ready") {
      bridgeReady = true;
      updateMessage();
      return;
    }
    const frame = screen.querySelector("iframe");
    if (event.origin !== "https://player.bilibili.com" || event.source !== frame?.contentWindow || state?.currentPlayer !== "bili") return;
    if (data.type === "ended") advanceAutomatically();
  });
  dialog.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    move(event.key === "ArrowRight" ? 1 : -1);
  });
  dialog.addEventListener("close", () => {
    if (!dialog.open && state) stopProjection();
  });
  let start;
  screen.addEventListener("touchstart", event => {
    start = event.touches.length === 1 ? [event.touches[0].clientX, event.touches[0].clientY] : null;
  }, {passive: true});
  screen.addEventListener("touchend", event => {
    if (!start || state?.type !== "photo" || dialog.classList.contains("is-zoomed")) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start[0];
    if (Math.abs(dx) > 55 && Math.abs(dx) > 1.4 * Math.abs(touch.clientY - start[1])) move(dx < 0 ? 1 : -1);
    start = null;
  }, {passive: true});
})();
