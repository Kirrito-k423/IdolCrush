import "../docs/data/artists.js";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {mkdir, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {join} from "node:path";

const output = fileURLToPath(new URL("../docs/", import.meta.url));
const artists = globalThis.IC_ARTISTS;
const assetPaths = new Map();
const chapters = {
  gallery: ["高清画廊", "PHOTO & FILM", "浏览 4K 以上的写真原图与精选舞台视频。"],
  calendar: ["行程日历", "PUBLIC SCHEDULE", "在连续十二个月的日历中查看公开活动、回归与巡演时段。"],
  videos: ["视频档案", "VIDEO ARCHIVE", "按时间、专辑、回归期或巡演时段查找舞台与节目。"],
  updates: ["账号更新", "BILIBILI ARCHIVE", "浏览关注的 B 站账号发布的视频。"]
};

function assetPath(name) {
  // The scheduled calendar refresh publishes the data independently of these page shells.
  if (name === "data/calendar.js" || name === "data/bilibili.js") return name;
  if (!assetPaths.has(name)) {
    const content = readFileSync(join(output, name), "utf8").replace(/\r\n/g, "\n");
    const digest = createHash("sha256").update(content).digest("hex").slice(0, 10);
    assetPaths.set(name, name + "?v=" + digest);
  }
  return assetPaths.get(name);
}

async function build(id, view) {
  const directory = [id === "home" ? "" : id, chapters[view] ? view : ""].filter(Boolean);
  const base = directory.length ? "../".repeat(directory.length) : "./";
  const artist = artists[id];
  const chapter = chapters[view];
  const person = artist ? `${artist.name} ${artist.roman}` : "全站";
  const title = view === "home" ? "IDOLCRUSH · 追星影像档案" : `${person}${chapter ? " · " + chapter[0] : ""} · IDOLCRUSH`;
  const description = chapter ? person + "。" + chapter[2] : "喜爱的艺人、高清写真、年度公开行程与分类视频档案。";
  const scope = artist ? `<a href="${base}${id}/index.html">${artist.name}</a>` : "全部艺人";
  const artistLinks = Object.entries(artists).map(([key, a]) => `<a href="${base}${key}/index.html">${a.name}</a>`).join(" · ");
  const intro = chapter ? `<header class="chapter-intro wrap">
      <nav class="crumbs" aria-label="面包屑"><a href="${base}index.html#artists">艺人索引</a><span>/</span>${scope}</nav>
      <div class="chapter-heading"><div><p class="eyebrow"><span class="slashes" aria-hidden="true"></span>${chapter[1]}</p><h1>${chapter[0]}</h1></div>
      ${artist ? `<div class="chapter-artist"><strong>${artist.roman}</strong><span>${artist.group} / ${artist.native}</span></div>` : ""}</div>
    </header>
    <section id="${view}" class="chapter-content wrap" aria-label="${chapter[0]}"></section>` : `<section id="cover" class="cover" aria-label="封面人物"></section>
    ${view === "home" ? '<section id="artists" class="section wrap" aria-labelledby="lineup-title"></section>\n    <section id="upcoming" class="section wrap" aria-labelledby="upcoming-title"></section>' : '<section id="chapters" class="section wrap" aria-labelledby="chapters-title"></section>'}`;
  const scripts = [
    "data/artists.js", ...Object.keys(artists).map(key => `data/photos/${key}.js`), "data/videos.js", "data/bilibili.js",
    ...(["home", "artist", "calendar"].includes(view) ? ["data/calendar.js"] : []),
    ...(["calendar", "videos", "updates"].includes(view) ? ["data/periods.js"] : []),
    "assets/catalog.js", "assets/viewer.js", "assets/site.js",
    "assets/" + ({home: "landing", artist: "landing", calendar: "calendar-view", videos: "archive", updates: "archive", gallery: "gallery"})[view] + ".js"
  ];
  const html = `<!doctype html>
<html lang="zh-CN" data-page="${id}" data-view="${view}" data-base="${base}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0b0b0d">
  <meta name="color-scheme" content="dark">
  <meta name="description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <title>${title}</title>
  <link rel="icon" type="image/svg+xml" href="${base}assets/mark.svg">
  <link rel="preload" href="${base}assets/fonts/barlow-condensed-800-italic.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${base}${assetPath("assets/site.css")}">
  <link rel="stylesheet" href="${base}${assetPath("assets/chapters.css")}">
  ${scripts.map(script => `<script defer src="${base}${assetPath(script)}"></script>`).join("\n  ")}
</head>
<body>
  <a class="skip-link" href="#main">跳到主要内容</a>
  <header class="masthead" id="top"></header>
  <main id="main">
    ${intro}
    <noscript><div class="wrap no-script">请启用 JavaScript 浏览放映厅和档案。 ${artistLinks}</div></noscript>
  </main>
  <footer class="site-footer"></footer>
</body>
</html>
`;
  const destination = join(output, ...directory);
  await mkdir(destination, {recursive: true});
  await writeFile(join(destination, "index.html"), html);
}

await build("home", "home");
await build("home", "calendar");
await build("home", "updates");
for (const id of Object.keys(artists)) {
  for (const view of ["artist", "gallery", "calendar", "videos"]) await build(id, view);
}
