(() => {
  "use strict";

  const origin = "https://kirrito-k423.github.io";
  const channel = "idolcrush-bili";
  if (window !== window.top || location.origin !== origin || !location.pathname.startsWith("/IdolCrush/")) return;

  function announce() {
    window.postMessage({channel, type: "ready"}, origin);
  }

  window.addEventListener("message", event => {
    if (event.data?.channel !== channel) return;
    if (event.source === window && event.origin === origin && event.data.type === "ping") {
      announce();
      return;
    }
    if (event.origin !== "https://player.bilibili.com" || event.data.type !== "frame-ping") return;
    const frame = [...document.querySelectorAll("iframe")].find(item => item.contentWindow === event.source);
    if (!frame) return;
    event.source.postMessage({channel, type: "frame-ready"}, "https://player.bilibili.com");
  });

  announce();
})();
