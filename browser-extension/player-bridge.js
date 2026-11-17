(() => {
  "use strict";

  const origin = "https://kirrito-k423.github.io";
  const channel = "idolcrush-bili";
  if (window === window.top) return;
  try {
    if (new URL(document.referrer).origin !== origin) return;
  } catch {
    return;
  }

  const bound = new WeakSet();
  let activeVideo;
  let lastEnded;
  let approved = false;

  window.addEventListener("message", event => {
    if (event.source !== window.parent || event.origin !== origin) return;
    if (event.data?.channel === channel && event.data.type === "frame-ready") approved = true;
  });
  window.parent.postMessage({channel, type: "frame-ping"}, origin);

  function attach(video) {
    if (!(video instanceof HTMLVideoElement) || bound.has(video)) return;
    bound.add(video);

    if (!video.paused && !video.ended) activeVideo = video;
    video.addEventListener("playing", () => {
      activeVideo = video;
      lastEnded = undefined;
    });
    video.addEventListener("ended", () => {
      if (!approved || !video.isConnected || !video.ended || !video.closest(".bpx-player-video-wrap")) return;
      if (activeVideo && activeVideo !== video) return;
      if (lastEnded === video) return;
      lastEnded = video;
      window.parent.postMessage({channel, type: "ended"}, origin);
    });
  }

  function inspect(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches("video")) attach(node);
    node.querySelectorAll("video").forEach(attach);
  }

  document.querySelectorAll("video").forEach(attach);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) inspect(node);
    }
  });
  observer.observe(document.documentElement, {childList: true, subtree: true});
})();
