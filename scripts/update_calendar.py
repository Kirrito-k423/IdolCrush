"""Refresh official Korean stages, Japanese broadcasts and release dates (stdlib only).

Hand-checked organizer announcements live in calendar.js without a "feed" field.
The public listings are rolling windows. Keep past records that roll off, replace
corrections by article URL, and keep the last good snapshot when a source fails.
"""

import json
import os
import re
import sys
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
from http.client import HTTPException
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.error import URLError
from urllib.parse import parse_qs, urljoin, urlsplit
from urllib.request import Request, urlopen
from xml.etree.ElementTree import Element, SubElement


DATA = Path(__file__).resolve().parents[1] / "docs" / "data" / "calendar.js"
PREFIX = "window.IC_CALENDAR = "
DIVE = "https://ive-official.jp/mob/news/"
UMJ = "https://www.universal-music.co.jp/meovv/"
TOKYO = "Asia/Tokyo"
SBS_INDEX = ("https://static.apis.sbs.co.kr/play-api/1.0/sbs_vodalls"
             "?programid=S01_V0000010182&offset=0&limit=8&sort=new&mdadiv=01&srsdiv=01")


@dataclass(frozen=True)
class Feed:
    id: str
    artist: str
    publisher: str
    url: str
    row_class: str


FEEDS = (
    Feed("sbs-stages", "all", "SBS", "https://programs.sbs.co.kr/enter/gayo/vods/54767", ""),
    Feed("ive-shows", "wonyoung", "IVE 日本官网", DIVE + "diarKiji.php?site=DIVE&cd=SCHEDULE", "entry_panel"),
    Feed("ive-releases", "wonyoung", "IVE 日本官网", DIVE + "diarKiji.php?site=DIVE&cd=DISCOGRAPHY", "entry_panel"),
    Feed("illit-shows", "wonhee", "ILLIT 日本官网", "https://illit-official.jp/schedule", "news__container"),
    Feed("illit-releases", "wonhee", "ILLIT 日本官网", "https://illit-official.jp/discography", "discography-list__container"),
    Feed("meovv-shows", "anna", "环球音乐日本", UMJ + "news/", "list-row"),
    Feed("meovv-releases", "anna", "环球音乐日本", UMJ + "discography/", "article--product"),
)

# The first entry is the featured member. Check the article itself since a
# headline on a group schedule can omit which members actually took part.
MEMBERS = {
    "wonyoung": ("WONYOUNG|ウォニョン", "YUJIN|ユジン", "GAEUL|ガウル", "REI|レイ", "LIZ|リズ", "LEESEO|イソ"),
    "wonhee": ("WONHEE|ウォンヒ", "YUNAH|ユナ", "MINJU|ミンジュ", "MOKA|モカ", "IROHA|イロハ"),
    "anna": ("ANNA|アンナ", "SOOIN|スイン", "GAWON|ガウォン", "NARIN|ナリン", "ELLA|エラ"),
}
SHOW_NAMES = {
    "第77回NHK紅白歌合戦": "第77届 NHK 红白歌合战",
    "ベストアーティスト2026": "Best Artist 2026",
    "CDTV ライブ！ライブ！": "CDTV Live! Live!",
}


class PublicHTML(HTMLParser):
    """Small element tree for the publishers' server-rendered HTML."""

    void = set("area base br col embed hr img input link meta param source track wbr".split())

    def __init__(self):
        super().__init__()
        self.root = Element("document")
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        child = SubElement(self.stack[-1], tag, dict(attrs))
        if tag not in self.void:
            self.stack.append(child)

    def handle_startendtag(self, tag, attrs):
        SubElement(self.stack[-1], tag, dict(attrs))

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_data(self, data):
        node = self.stack[-1]
        if len(node):
            node[-1].tail = (node[-1].tail or "") + data
        else:
            node.text = (node.text or "") + data


def read_url(url, accept):
    request = Request(url, headers={"User-Agent": "IdolCrush-FanCalendar/1.0", "Accept": accept})
    with urlopen(request, timeout=15) as response:
        if urlsplit(response.url).hostname != urlsplit(url).hostname:
            raise ValueError("source redirected to a different site")
        return response.read().decode(response.headers.get_content_charset() or "utf-8")


def fetch_page(url):
    parser = PublicHTML()
    parser.feed(read_url(url, "text/html"))
    parser.close()
    return parser.root


def by_class(root, classname):
    return [elem for elem in root.iter() if classname in elem.get("class", "").split()]


def text(node):
    if node is None:
        raise ValueError("expected article field is missing")
    return " ".join("".join(node.itertext()).split())


def first_class(root, classname):
    items = by_class(root, classname)
    if not items:
        raise ValueError(f"expected publisher field {classname!r} is missing")
    return items[0]


def official_article(feed, anchor):
    if anchor is None or not anchor.get("href"):
        raise ValueError("article link is missing")
    parts = urlsplit(urljoin(feed.url, anchor.get("href")))
    if parts.scheme != "https" or parts.netloc != urlsplit(feed.url).netloc:
        raise ValueError("unexpected article host")
    if feed.artist == "wonyoung":
        article_id = parse_qs(parts.query).get("id", [""])[0]
        if not article_id.isdecimal() or not parts.path.endswith("/diarKijiShw.php"):
            raise ValueError("unrecognized IVE article URL")
        return f"{DIVE}diarKijiShw.php?site=DIVE&id={article_id}"
    return parts._replace(query="", fragment="").geturl()


def printed_date(value):
    match = re.search(r"\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b", value)
    if not match:
        raise ValueError(f"missing publisher date in {value!r}")
    return date(*map(int, match.groups()))


def broadcast_day(reference, content):
    # A news posting date, a ticket window, and a TV air date are different.
    # Require one explicit, unambiguous air date in the broadcast notice.
    dates = set()
    normalized = unicodedata.normalize("NFKC", content)
    if re.search(r"深夜|翌日|(?:2[4-9]|30)[:時]", normalized):
        return None  # Late-night listings need editorial date normalization.
    tokens = re.findall(r"(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日", normalized)
    for year, month, day in tokens:
        if year:
            dates.add(date(int(year), int(month), int(day)))
            continue
        options = []
        for candidate_year in (reference.year - 1, reference.year, reference.year + 1):
            try:
                options.append(date(candidate_year, int(month), int(day)))
            except ValueError:
                continue
        if not options:
            return None
        nearest = min(options, key=lambda option: abs((reference - option).days))
        if abs((reference - nearest).days) > 100:
            return None
        dates.add(nearest)
    return dates.pop() if len(dates) == 1 else None


def appearance_scope(artist, title, content):
    members = MEMBERS[artist]
    mentioned = [pattern for pattern in members if re.search(pattern, content, re.I)]
    if not mentioned or len(mentioned) == len(members):
        return "团体"
    if mentioned == [members[0]] and re.search(members[0], title, re.I):
        return "个人"
    return None


def item(feed, source, day, title, scope, kind):
    return dict(artist=feed.artist, date=day.isoformat(), title=title, scope=scope,
                kind=kind, publisher=feed.publisher, source=source, timezone=TOKYO, feed=feed.id)


def release_record(feed, row):
    tz = TOKYO
    if feed.id == "ive-releases":
        source = official_article(feed, row.find("a"))
        title = text(row.find(".//h4"))
        day = printed_date(text(first_class(row, "caption")))
    elif feed.id == "illit-releases":
        name = first_class(row, "discography__title")
        source = official_article(feed, name)
        title = text(name)
        quoted = re.search("[‘'’](.+)[’']$", title)
        if quoted:
            title = quoted[1]
        labels = by_class(row, "discography-list__text")
        day = printed_date(text(labels[0]))
        if text(labels[-1]) == "KOREA":
            tz = "Asia/Seoul"
    else:
        name = first_class(row, "prod-name")
        source = official_article(feed, name.find("a"))
        title = text(name)
        labelled = [li for li in row.iter("li") if "発売日" in text(li)]
        if not labelled:
            raise ValueError("release date field is missing")
        day = printed_date(text(first_class(labelled[0], "prod-data__text")))
    scope = appearance_scope(feed.artist, title, title)
    record = item(feed, source, day, f"《{title}》发行", scope, "发行") if scope else None
    if record:
        record["timezone"] = tz
    return source, record


def broadcast_record(feed, row):
    if feed.id == "ive-shows":
        source = official_article(feed, row.find("a"))
        category = text(first_class(row, "category_name"))
        reference = printed_date(text(first_class(row, "date")))
        title = text(row.findall(".//p")[-1])
    elif feed.id == "illit-shows":
        heading = first_class(row, "news__title")
        source = official_article(feed, heading)
        labels = by_class(row, "news__text")
        if len(labels) < 3:
            raise ValueError("schedule date or category is missing")
        reference, category, title = printed_date(text(labels[0])), text(labels[2]), text(heading)
    else:
        source = official_article(feed, row.find("a"))
        reference = printed_date(text(first_class(row, "tags__date")))
        category = text(first_class(row, "tags__icon")).removeprefix("MEDIA - ")
        title = text(row.findall(".//p")[-1])
    if category not in {"TV", "RADIO"} or re.search("中止|休止|延期|欠席", title):
        return source, None

    detail = fetch_page(source)
    if feed.id == "ive-shows":
        body = first_class(detail, "entry_detail")
    elif feed.id == "illit-shows":
        body = detail.find(".//div[@id='news-desc']")
    else:
        body = first_class(detail, "main-editor-content")
    content = title + " " + text(body)
    if re.search(r"出演を見合わせ|出演いたしません|放送中止|放送休止|欠席いたします", content):
        return source, None
    day = broadcast_day(reference, content)
    scope = appearance_scope(feed.artist, title, content)
    name = re.search("[「『]([^」』]+)[」』]", title)
    if not day or not scope or not name:
        return source, None
    program = SHOW_NAMES.get(name[1], name[1])
    suffix = "电台播出" if category == "RADIO" else "播出"
    return source, item(feed, source, day, f"《{program}》{suffix}", scope, "节目")


def inkigayo(feed):
    # This is the public episode metadata used by the SBS replay index.
    groups = {
        "wonyoung": ("ive", "아이브"),
        "wonhee": ("illit", "아일릿"),
        "anna": ("meovv", "미야오"),
    }
    artists = {}
    for artist, (en, ko) in groups.items():
        for billing in (en, ko, f"{en}({ko})", f"{ko}({en})"):
            artists[billing] = artist
    entries = []
    valid_running_orders = 0
    for episode in json.loads(read_url(SBS_INDEX, "application/json"))["list"]:
        episode_id = str(episode["mediaid"])
        if not episode_id.isdecimal():
            raise ValueError("unrecognized episode URL")
        source = f"https://programs.sbs.co.kr/programTemplate/amp/vod/gayo/{episode_id}"
        day = date.fromisoformat(episode["broaddate"][:10])
        synopsis = re.sub(r"<br\s*/?>", "\n", episode["synopsis"], flags=re.I)
        synopsis = unescape(re.sub(r"<[^>]+>", "", synopsis))
        # Confirm the date against the Korean-language air date. The API's
        # broaddate clock is sometimes local despite a trailing Z.
        airdate = re.search(r"(\d{1,2})월\s*(\d{1,2})일", synopsis)
        if not airdate or (int(airdate[1]), int(airdate[2])) != (day.month, day.day):
            continue
        tracks = re.findall(r"^\s*-\s*([^\[\]\r\n]+?)\s*\[([^\]\r\n]+)\]", synopsis, re.M)
        if not tracks:
            continue
        valid_running_orders += 1
        entries.append((source, None))
        songs = {}
        for billing, track in tracks:
            artist = artists.get("".join(billing.casefold().split()))
            if artist:
                songs.setdefault(artist, []).append(track.strip())
        for artist, titles in songs.items():
            title = "《人气歌谣》舞台 · " + " / ".join(dict.fromkeys(titles))
            event = item(feed, source, day, title, "团体", "演出")
            event.update(artist=artist, timezone="Asia/Seoul")
            entries.append((source, event))
    if not valid_running_orders:
        raise ValueError("no dated SBS lineups were readable")
    return entries


def fetch_feed(feed):
    if feed.id == "sbs-stages":
        return inkigayo(feed)
    rows = by_class(fetch_page(feed.url), feed.row_class)
    if not rows:
        raise ValueError("official listing could not be read")
    reader = release_record if feed.id.endswith("-releases") else broadcast_record
    return [reader(feed, row) for row in rows]


def refresh(calendar, today):
    events = calendar["events"]
    statuses = {source["id"]: source for source in calendar["sources"]}
    for feed in FEEDS:
        state = dict(id=feed.id, artist=feed.artist, publisher=feed.publisher, url=feed.url,
                     topic="发行" if feed.id.endswith("-releases") else "节目",
                     checkedAt=statuses.get(feed.id, {}).get("checkedAt"), attemptedAt=today)
        try:
            entries = fetch_feed(feed)
        except (URLError, OSError, HTTPException, ValueError, IndexError, KeyError, TypeError) as error:
            print(f"{feed.id}: retaining last good snapshot ({error})", file=sys.stderr)
            state["status"] = "stale"
        else:
            seen = {url for url, _ in entries}
            events = [event for event in events if event.get("feed") != feed.id or
                      (event["date"] < today and event["source"] not in seen)]
            known = {(event["artist"], event["source"], event["date"]) for event in events}
            for _, event in entries:
                if not event:
                    continue
                key = (event["artist"], event["source"], event["date"])
                if key not in known:
                    events.append(event)
                    known.add(key)
            state.update(checkedAt=today, status="ok")
            print(f"{feed.id}: checked {len(seen)} listings")
        statuses[feed.id] = state
    calendar["events"] = sorted(events, key=lambda e: (e["date"], e["artist"], e["title"]))
    calendar["sources"] = list(statuses.values())
    verified = [s["checkedAt"] for s in statuses.values() if s.get("checkedAt")]
    calendar["checkedAt"] = max([calendar["curatedAt"], *verified])
    return calendar


def main():
    current = DATA.read_text(encoding="utf-8")
    if not current.startswith(PREFIX) or not current.rstrip().endswith(";"):
        raise ValueError("unexpected calendar format")
    calendar = json.loads(current[len(PREFIX):].rstrip()[:-1])
    today = datetime.now(timezone(timedelta(hours=8))).date().isoformat()
    updated = refresh(calendar, today)
    result = PREFIX + json.dumps(updated, ensure_ascii=False, indent=2) + ";\n"
    if result != current:
        with NamedTemporaryFile(mode="w", dir=DATA.parent, encoding="utf-8", newline="\n", delete=False) as tmp:
            tmp.write(result)
        os.replace(tmp.name, DATA)


if __name__ == "__main__":
    main()
