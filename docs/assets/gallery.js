(function () {
  "use strict";

  const {page, photos, videos, feature, openViewer, responsivePhoto, thumbUrl, esc, icon, pad, rememberQuery} = window.IC;
  const container = document.querySelector("#gallery");
  const pictures = photos(page);
  const library = videos(page);
  const ranked = [feature(page), ...library.map((_, i) => i)];
  const top = [...new Set(ranked)].filter(i => library[i]?.category === "stage").slice(0, 2);
  let tab = new URLSearchParams(location.search).get("show") === "video" ? "video" : "photo";

  function render() {
    const photoMode = tab === "photo";
    const items = photoMode ? pictures.map((photo, i) => `<button type="button" class="photo-plate" data-photo="${i}">
      <span class="plate-image"><img loading="${i < 3 ? "eager" : "lazy"}" ${responsivePhoto(photo, "(max-width: 950px) 47vw, 25vw")} alt="${esc(photo.alt)}" width="${photo.previewWidth || photo.width}" height="${photo.previewHeight || photo.height}" style="object-position:${esc(photo.position)}"><span class="plate-open">${icon("expand", 16)}</span></span>
      <span class="plate-caption"><strong>${esc(photo.title)}</strong><span>${photo.width} × ${photo.height} px</span></span></button>`) :
      top.map(i => `<button type="button" class="photo-plate film-plate" data-top="${i}">
      <span class="plate-image"><img src="${esc(thumbUrl(library[i], page))}" alt=""><span class="video-play">${icon("play", 15)}</span><span class="duration">${esc(library[i].duration)}</span></span>
      <span class="plate-caption"><strong>${esc(library[i].title)}</strong><span>${esc(library[i].publisher)} · ${esc(library[i].date)}</span></span></button>`);
    container.innerHTML = `<div class="gallery-toolbar"><div class="chips" role="group" aria-label="影像类型">
      <button type="button" class="chip" data-media="photo" aria-pressed="${photoMode}">4K+ 写真 <span>${pad(pictures.length)}</span></button>
      <button type="button" class="chip" data-media="video" aria-pressed="${!photoMode}">TOP 视频 <span>${pad(top.length)}</span></button></div>
      <span class="gallery-hint">${photoMode ? "点击照片查看原图" : "点击封面进入放映厅"}</span></div>
      <div class="photo-plates ${photoMode ? "" : "film-plates"}">${items.join("") || '<p class="empty-note">暂未收录。</p>'}</div>`;
  }
  container.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.media) {
      tab = button.dataset.media;
      rememberQuery(tab === "video" ? new URLSearchParams({show: "video"}) : new URLSearchParams());
      render();
      container.querySelector(`[data-media="${tab}"]`).focus({preventScroll: true});
    } else if (button.hasAttribute("data-photo")) {
      openViewer(page, "photo", Number(button.dataset.photo));
    } else if (button.hasAttribute("data-top")) {
      openViewer(page, "video", Number(button.dataset.top), top);
    }
  });
  render();
})();
