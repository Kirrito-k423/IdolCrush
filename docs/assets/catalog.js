(function () {
  "use strict";

  const root = document.documentElement;
  const base = root.dataset.base;
  const artists = globalThis.IC_ARTISTS;
  const categories = {
    stage: "打歌 / 舞台", encore: "一位安可", group: "团体综艺", solo: "个人节目 / 综艺",
    vlog: "直播 / VLOG / INS", behind: "幕后花絮", collab: "品牌联名", shorts: "抖音 / 官抖",
    appearance: "品牌站台 / 线下活动", fansign: "饭拍 / 签售直拍", travel: "机场出行", brand: "品牌代言",
    music: "MV / 音乐作品", teaser: "预告物料", concert: "演唱会 / 公演", magazine: "杂志 / 时尚", official: "官方物料", host: "主持",
    fanwork: "粉丝应援", award: "年末大赏感言", cp: "CP 向", other: "其他影像"
  };
  const shapes = {
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    outward: '<path d="M5.5 18.5 18 6M6 6h12v12"/>',
    left: '<path d="m14.5 5-7 7 7 7"/>',
    right: '<path d="m9.5 5 7 7-7 7"/>',
    down: '<path d="m5.5 9 6.5 6.5L18.5 9"/>',
    up: '<path d="M12 20V4m-6.5 6.5L12 4l6.5 6.5"/>',
    play: '<path d="M8 4.8 19 12 8 19.2z" fill="currentColor" stroke-linejoin="round"/>',
    photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.4" cy="9" r="1.2"/><path d="m4 17 5-5 3 3 4-5 5 6"/>',
    expand: '<path d="M8.5 3.5h-5v5m12-5h5v5m0 7v5h-5m-7 0h-5v-5"/>',
    shrink: '<path d="M3 8h5V3m13 5h-5V3m5 13h-5v5M3 16h5v5"/>',
    close: '<path d="m5.5 5.5 13 13m0-13-13 13"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.2"/><path d="m15.2 15.2 5 5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7.5 3v4m9-4v4M3 10h18"/>',
    filter: '<path d="M3 7h18M6 12h12m-9 5h6"/>',
    album: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'
  };
  const icon = (name, size = 20) => `<svg class="icon" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${shapes[name] || ""}</svg>`;
  const mark = '<svg class="star-mark" aria-hidden="true" viewBox="0 0 48 48"><path fill="currentColor" d="m37 5-8 14 15-2-14 9 4 13-11-9-12 13 5-17-14 2 13-9-4-12 11 8z"/></svg>';
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[char]));
  const safeLink = value => {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? esc(url.href) : "";
    } catch {
      return "";
    }
  };
  const page = root.dataset.page;
  const view = root.dataset.view;
  const path = (id = "home", section = "", suffix = "") => {
    const directory = [id === "home" ? "" : id, section].filter(Boolean).map(part => part + "/").join("");
    return `${base}${directory}${location.protocol === "file:" ? "index.html" : ""}${suffix}`;
  };
  const photos = id => (window.IC_PHOTOS?.[id] || []).filter(photo =>
    Math.max(photo.width, photo.height) >= 3840 && Math.min(photo.width, photo.height) >= 2160);
  // A source can publish videos about several people. Use the title to
  // distinguish individual material from whole-group material.
  const names = [
    {id: "wonyoung", name: "张元英", pattern: /张元英|張元英|张员瑛|張員瑛|元英|员瑛|장원영|\bwonyoung\b/i},
    {id: "wonhee", name: "李沅禧", pattern: /李沅禧|李原禧|李元熙|원희|\bwonhee\b/i},
    {id: "anna", name: "田中杏奈", pattern: /田中杏奈|田中アンナ|(?:MEOVV|미야오).{0,40}(?:ANNA|안나|杏奈)|(?:ANNA|안나).{0,40}(?:MEOVV|미야오)/i},
    {id: "woni", name: "郑沅乁", pattern: /郑沅[乁伊]|鄭沅[乁伊]|郑元伊|정원이|\bwoni\b/i},
    {id: "yuna", name: "申有娜", pattern: /申有娜|申宥娜|신유나|(?:ITZY|있지).{0,40}(?:YUNA|유나)|(?:YUNA|유나).{0,40}(?:ITZY|있지)/i},
    {id: "liz", name: "金志垣", pattern: /金志垣|金智媛|\bliz\b|리즈/i},
    {id: "oa", name: "OA", pattern: /(?:A2O\s*LITE|에이투오\s*라이트).{0,40}\bOA\b|\bOA\b.{0,40}(?:A2O\s*LITE|에이투오\s*라이트)|오아/i},
    {name: "安宥真", pattern: /安[宥有]真|안유진|\byujin\b/i},
    {name: "直井怜", pattern: /直井怜|\bnaoi\s+rei\b|\brei\b|아이브.{0,12}레이/i},
    {name: "金秋天", pattern: /金秋天|김가을|\bgaeul\b/i},
    {name: "李瑞", pattern: /李瑞|이현서|\bleeseo\b/i},
    {name: "申留真", pattern: /申留真|신류진|\bryujin\b/i},
    {name: "黄礼志", pattern: /黄礼志|황예지|\byeji\b/i},
    {name: "崔智秀", pattern: /崔智秀|최지수|\blia\b/i},
    {name: "李彩领", pattern: /李彩领|李彩領|이채령|\bchaeryeong\b/i},
    {name: "金玟周", pattern: /金[玟旻]周|\bminju\b|민주/i},
    {name: "卢玧我", pattern: /卢玧我|盧玧我|노윤아|\byunah\b/i},
    {name: "酒井萌香", pattern: /酒井萌香|사카이 모카|\bmoka\b/i},
    {name: "外园彩羽", pattern: /外园彩羽|外園彩羽|\biroha\b|이로하/i},
    {name: "薛允", pattern: /薛允|설윤|\bsullyoon\b/i},
    {name: "MINAMI", pattern: /伊藤南美|\bminami\b|미나미/i},
    {name: "ZENA", pattern: /金柯咏|\bzena\b|제나/i},
    {name: "MAY", pattern: /李睿彬|\bMAY\b|메이/},
    {name: "LIV", pattern: /陈京[恩温昷]|陳京[恩溫昷]|\bliv\b|리브/i},
    {name: "SOOIN", pattern: /\bsooin\b|수인/i},
    {name: "GAWON", pattern: /\bgawon\b|가원/i},
    {name: "NARIN", pattern: /\bnarin\b|나린/i},
    {name: "ELLA", pattern: /\bella\b|엘라/i},
    {name: "XILI", pattern: /梁淅沥|梁淅瀝|\bxili\b|시리/i},
    {name: "AIJING", pattern: /盛艾敬|\baijing\b|아이찡/i},
    {name: "YOUNG", pattern: /郑[始时诗]英|鄭[始時詩]英|\bYOUNG\b|정시영/},
    {name: "HIMEKI", pattern: /山本姬绢|山本姫絹|\bHIMEKI\b|히메키/i},
    {name: "VORA", pattern: /李[垠恩]知|\bVORA\b|보라/i},
    {name: "RADA", pattern: /\bRADA\b|라다/i},
    {name: "MERCI", pattern: /马西桐|馬西桐|\bMERCI\b|메르시/i},
    {name: "AYUNE", pattern: /沈[我雅]允|沈我潤|\bAYUNE\b|아윤/i}
  ];
  const groups = [
    {pattern: /\bIVE\b|아이브/i, members: ["wonyoung", "liz"]},
    {pattern: /\bILLIT\b|아일릿/i, members: ["wonhee"]},
    {pattern: /\bMEOVV\b|미야오/i, members: ["anna"]},
    {pattern: /\bRESCENE\b|리센느/i, members: ["woni"]},
    {pattern: /\bITZY\b|있지/i, members: ["yuna"]},
    {pattern: /A2O\s*LITE|에이투오\s*라이트/i, members: ["oa"]}
  ];
  const brandNames = /rolarola|dashing\s*diva|\bugg\b|\bstance\b|\bdyson\b|戴森|卡诗|卡詩|宝格丽|寶格麗|bvlgari|bulgari|dr\.?\s*althea|tommy\s*(?:jeans|hilfiger)|miu\s*miu|hapa\s*kristin|\bpepsi\b|百事可乐|百事可樂|\bdior\b|迪奥|迪奧|innisfree|悦诗风吟|悅詩風吟|宾格瑞|賓格瑞|new\s*balance|友利银行|友利銀行|woori\s*bank|巴黎卡诗|巴黎卡詩|\blux\b|力士|\bpubg\b|medicube|forever:cherry/i;
  const typeRules = [
    ["behind", /幕后|幕後|花絮|拍摄(?:现场|現場|过程|過程|日志|日記)|拍攝(?:現場|過程|日記)|录音室|錄音室|彩排|\bbehind\b|making\s*(?:of|film)|메이킹|비하인드/i],
    ["collab", /联名|聯名|联名款|聯名款|合作款|跨界合作|collaboration|\bcollab\b/i],
    ["shorts", /官抖|抖音|\btiktok\b|tik\s*tok|틱톡/i],
    ["vlog", /直播|直播放送|\bvlog\b|브이로그|生活日记|日常日志|出行日记|出行日記|个人视频合集|個人視頻合集|instagram|\bins(?:v|更新|快拍|story)?\b|for_everyoung10/i],
    ["appearance", /站台|线下|線下|快闪|快閃|时装周|時裝周|秀场|秀場|红毯|紅毯|开球|開球|展会|展會|展览|展覽|颁奖礼|頒獎禮|音乐节|音樂節|粉丝见面会|粉絲見面會|舞台问候|舞台問候|(?:迪士尼|NBA|志愿|志願|开幕|開幕|公益).{0,12}(?:活动|活動)|fan\s*meeting|showcase|팝업스토어/i],
    ["fansign", /饭拍|飯拍|饭摄|飯攝|粉丝拍摄|粉絲拍攝|签售|簽售|팬싸|fansign|fan\s*sign|直拍|\bfancam\b|\bfacecam\b|직캠/i],
    ["travel", /机场|機場|航站楼|航站樓|出入境|出境|入境|离境|離境|\bICN\b|\bGMP\b|공항|airport/i],
    ["award", /(?:年末|颁奖|頒獎|大赏|大賞|MAMA|MMA|AAA|金唱片).{0,40}(?:感言|获奖|獲獎|领奖|領獎|获赏|發言|speech|소감|수상)|(?:感言|获奖|獲獎|领奖|領獎|소감).{0,40}(?:年末|大赏|大賞|MAMA|MMA|AAA)/i],
    ["encore", /(?:一位|初一位|1位|冠军|冠軍|우승|1위).{0,35}(?:安可|返场|返場|表演|舞台|encore|앵콜)|(?:安可|encore|앵콜).{0,35}(?:一位|1位|冠军|冠軍|1위)/i],
    ["brand", /代言|广告|廣告|\bCF\b|画报|畫報|campaign|ambassador/i],
    ["group", /团综|團綜|团体综艺|團體綜藝|reality show|团体节目|團體節目|IVE[- ]minute|IVE\s*SCOUT|\b1,?2,?3\s*IVE\b|ARCH[·.\s-]*IVE|DIVE ACADEMY LIVE|(?:IVE|IZ\*ONE).{0,35}(?:小游戏|小遊戲|辩论赛|辯論賽|团体篇|團體篇|带娃|帶娃|小剧场|小劇場|角色扮演|電台|电台)/i],
    ["solo", /个综|個綜|个人节目|個人節目|个人综艺|個人綜藝|访谈|訪談|采访|採訪|采访|interview|인터뷰|今天的朱宇宰|安成宰料理咨询所|安成宰料理諮詢所|workman|IU.{0,5}调色盘|IU.{0,5}調色盤|DEX.{0,5}冰箱|salon\s*drip|茶\s*쥐뿔/i],
    ["stage", /打歌|舞台合集|舞台\s*cut|新舞台|人气歌谣|人氣歌謠|音乐银行|音樂銀行|音乐中心|音樂中心|人气歌謠|人歌|音中|音\/银|音\/銀|음악중심|인기가요|뮤직뱅크|엠카운트다운|music\s*bank|music\s*station|m\s*countdown|show\s*champion|\bthe\s*show\b/i],
    ["music", /(?:^|[^a-z])(?:MV|M\/V)(?:[^a-z]|$)|뮤직비디오|音乐作品|音樂作品/i],
    ["teaser", /预告|預告|试听|試聽|概念影片|概念片|concept\s*(?:film|photo)|teaser|trailer|highlight\s*medley/i],
    ["concert", /演唱会|演唱會|巡演|巡迴|世巡|二巡|巡回演出|巡迴演出|concert|world\s*tour/i],
    ["magazine", /杂志|雜誌|月刊|封面人物|vogue|bazaar|esquire|marie\s*claire|allure|grazia|superelle/i],
    ["official", /官咖|官方频道|官方頻道|官推更新|官博更新|官号更新|官號更新|IVE官推|IVE官博|IVE油管|官方油管/i],
    ["host", /主持人|主持|\bMC\s*CUT\b|\bMC\s*元英|元英\s*MC\b|mc\s*开场|mc\s*開場/i],
    ["fanwork", /生贺|生賀|贺频|賀頻|生日应援|生日應援|生日贺|生日賀|应援视频|應援視頻/i]
  ];
  function annotate(video) {
    const text = String(video.title || "");
    const people = names.filter(person => person.pattern.test(text));
    const ids = people.map(person => person.id).filter(Boolean);
    if (!people.length) groups.filter(group => group.pattern.test(text)).forEach(group => ids.push(...group.members));
    const explicitPair = video.pair ? [video.pair] : [];
    const isPair = people.length >= 2 && /\bcp\b|cp向|双人|雙人|互动|互動|同框|chemistry|[×✖&+]|\bx\b/i.test(text);
    const pairs = explicitPair.length ? explicitPair : isPair ? [people.slice(0, 2).map(person => person.name).join(" × ")] : [];
    const types = [...new Set([video.category === "other" ? "" : video.category, ...typeRules.filter(([, pattern]) => pattern.test(text)).map(([type]) => type), ...(pairs.length ? ["cp"] : [])].filter(type => Object.hasOwn(categories, type)))];
    const description = String(video.description || "");
    if (/\[ARCH[·.\s-]*IVE\]/i.test(description) && !types.includes("group")) types.push("group");
    if (/\[IVE OFF\]/i.test(description) && ids.length === 1 && !types.includes("vlog")) types.push("vlog");
    if (brandNames.test(text) && !types.includes("brand")) types.push("brand");
    if (brandNames.test(text) && /[×✖]|\s[xX]\s/.test(text) && !pairs.length && !types.includes("collab")) types.push("collab");
    if (types.includes("stage") && /签售|簽售|팬싸|fansign/i.test(text) && !/打歌|人气歌谣|人氣歌謠|音乐银行|音樂銀行|音乐中心|音樂中心|M\s*COUNTDOWN|음악중심|인기가요|뮤직뱅크/i.test(text)) types.splice(types.indexOf("stage"), 1);
    if (types.includes("stage") && types.includes("host") && !/舞台|打歌|表演|直拍|fancam|facecam/i.test(text)) types.splice(types.indexOf("stage"), 1);
    if (!types.length) types.push("other");
    const category = video.category && video.category !== "other" && Object.hasOwn(categories, video.category) ? video.category : types[0];
    return {...video, artistIds: ids, pairs, types, category};
  }
  const monitored = (window.IC_BILIBILI?.videos || []).map(video => annotate({
    ...video,
    bilibili: video.bvid,
    bilibiliPublisher: video.publisher,
    album: video.album || ""
  }));
  const monitoredByBvid = new Map(monitored.map(video => [video.bilibili, video]));
  function titleDate(video) {
    const match = video.title.match(/(?:^|[^0-9])(20\d{6}|\d{6})(?!\d)/);
    if (!match) return "";
    const digits = match[1].length === 6 ? "20" + match[1] : match[1];
    const candidate = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
    const parsed = new Date(candidate + "T00:00:00Z");
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== candidate || candidate < "2010-01-01" || candidate > video.date) return "";
    return candidate;
  }
  const libraries = new Map();
  const videos = id => {
    if (id === "home") return monitored;
    if (!libraries.has(id)) {
      const curated = (window.IC_VIDEOS?.[id] || []).map(video => {
        const item = annotate(video);
        const monitoredSources = monitoredByBvid.get(video.bilibili)?.sources || [];
        return {...item, sources: [...new Set([...(item.sources || []), ...monitoredSources])]};
      });
      const existing = new Set(curated.filter(video => (Number(video.bilibiliPage) || 1) === 1).map(video => video.bilibili));
      const artistPeriods = id === "liz" ? (window.IC_PERIODS?.wonyoung || []).filter(period => period.group === "IVE") : window.IC_PERIODS?.[id] || [];
      const matching = monitored.filter(video => video.artistIds.includes(id) && !existing.has(video.bilibili)).map(video => {
        const title = video.title.toLocaleLowerCase();
        const namedAlbum = artistPeriods.find(period => period.album && period.album.length >= 3 && title.includes(period.album.toLocaleLowerCase()));
        const eventDate = titleDate(video);
        return {...video, album: video.album || namedAlbum?.album || "", publishedDate: video.date, date: eventDate || video.date, dateFromTitle: Boolean(eventDate)};
      });
      libraries.set(id, [...curated, ...matching]);
    }
    return libraries.get(id);
  };
  const feature = id => Math.max(0, videos(id).findIndex(video => video.featured));
  function durationSeconds(text) {
    if (typeof text === "number") return Number.isFinite(text) && text > 0 ? text : null;
    const parts = String(text || "").split(":");
    if (parts.length < 2 || parts.length > 3 || parts.some(part => !/^\d+$/.test(part))) return null;
    const total = parts.reduce((sum, part) => sum * 60 + Number(part), 0);
    return total > 0 ? total : null;
  }
  function videoDetails(item) {
    const bvid = item.bilibili || item.bvid;
    const record = window.IC_VIDEO_RESOLUTIONS?.videos?.[bvid];
    const parts = record?.pages || [];
    const part = item.bilibiliCid
      ? parts.find(entry => String(entry.cid) === String(item.bilibiliCid))
      : parts.find(entry => Number(entry.page) === (Number(item.bilibiliPage) || 1));
    const youtube = !bvid && item.youtube ? window.IC_VIDEO_RESOLUTIONS?.youtube?.[item.youtube] : null;
    const metadata = part || youtube;
    const width = Number(metadata?.width) || 0;
    const height = Number(metadata?.height) || 0;
    const longest = Math.max(width, height), shortest = Math.min(width, height);
    const quality = longest >= 3840 && shortest >= 2160 ? "4k" : longest >= 1920 && shortest >= 1080 ? "1080" : width && height ? "lower" : "unknown";
    // Public account listings report the sum of all parts. Only use it for a
    // selected part after the detail endpoint has supplied that part's length.
    const duration = durationSeconds(metadata?.duration) ?? (item.bvid ? null : durationSeconds(item.duration));
    return {width, height, quality, duration, platform: part ? "B 站" : youtube ? "YouTube" : ""};
  }
  const formatDuration = seconds => {
    const value = Math.floor(seconds), hours = Math.floor(value / 3600), minutes = Math.floor(value % 3600 / 60), rest = value % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${minutes}:${String(rest).padStart(2, "0")}`;
  };
  const photoUrl = item => item.file ? `${base}assets/photos/${encodeURIComponent(item.file)}` : item.originalUrl;
  const previewUrl = item => item.preview ? `${base}assets/photos/${encodeURIComponent(item.preview)}` : item.previewUrl || photoUrl(item);
  const responsivePhoto = (item, sizes) => {
    const preview = esc(previewUrl(item)), full = esc(photoUrl(item));
    if (!item.previewWidth || preview === full) return `src="${full}"`;
    return `src="${preview}" srcset="${preview} ${item.previewWidth}w, ${full} ${item.width}w" sizes="${sizes}"`;
  };
  const periods = id => id === "liz" ? (window.IC_PERIODS?.wonyoung || []).filter(period => period.group === "IVE") : window.IC_PERIODS?.[id] || [];
  const periodLabel = {comeback: "回归期", tour: "巡演期"};
  const periodName = period => period.debut ? "出道期" : periodLabel[period.type];
  const includesDate = (period, date) => period.start <= date && date <= period.end;
  const today = new Intl.DateTimeFormat("sv-SE", {timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date());
  const thumbUrl = (item, id) => {
    if (item.thumb) return `${base}assets/thumbs/${encodeURIComponent(item.thumb)}`;
    if (item.cover && /^https:\/\//i.test(item.cover)) return item.cover;
    if (item.youtube) return `https://i.ytimg.com/vi/${encodeURIComponent(item.youtube)}/hqdefault.jpg`;
    return photos(id)[0] ? previewUrl(photos(id)[0]) : "";
  };
  const pad = value => String(value).padStart(2, "0");
  const heading = (key, label, title, side = "") => `<div class="section-heading">
    <div><div class="eyebrow"><span class="slashes" aria-hidden="true"></span>${esc(label)}</div><h2 id="${key}-title">${esc(title)}</h2></div>${side}</div>`;
  const ext = 'target="_blank" rel="noopener noreferrer"';
  const rememberQuery = params => {
    const next = new URL(location.href);
    next.search = params.toString();
    if (next.href !== location.href && location.protocol !== "file:") history.replaceState(null, "", next);
  };
  window.IC = {page, view, base, artists, categories, icon, mark, esc, safeLink, path, photos, videos, feature, videoDetails, formatDuration, photoUrl, previewUrl, responsivePhoto, thumbUrl, periods, periodLabel, periodName, includesDate, today, rememberQuery, pad, heading, ext};

  function routeOldBookmark() {
    if (view !== "home" && view !== "artist") return;
    const old = {"#calendar": "calendar", "#archive": "videos", "#gallery": "gallery"};
    const target = old[location.hash];
    if (target && (page !== "home" || target === "calendar")) location.replace(path(page, target, location.search));
  }
  routeOldBookmark();
  window.addEventListener("hashchange", routeOldBookmark);
})();
