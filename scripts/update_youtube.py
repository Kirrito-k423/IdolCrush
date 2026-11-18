"""Archive recent uploads from explicitly configured public YouTube feeds.

YouTube's public Atom feed is a recent window, not a complete channel history.
The local archive retains earlier entries when a feed is unavailable or rolls
over. No YouTube login or API key is needed.
"""

import argparse
import json
import re
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "data" / "youtube.js"
PREFIX = "window.IC_YOUTUBE = "
CONFIG = json.loads((ROOT / "scripts" / "video_sources.json").read_text(encoding="utf-8"))["youtube"]
CHINA = timezone(timedelta(hours=8))
VIDEO_ID = re.compile(r"[A-Za-z0-9_-]{11}\Z")
CHANNEL_ID = re.compile(r"UC[A-Za-z0-9_-]{22}\Z")
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015",
      "media": "http://search.yahoo.com/mrss/"}


def now_text():
    return datetime.now(CHINA).replace(microsecond=0).isoformat()


def read_archive():
    if not DATA.exists():
        return {"sources": [], "videos": []}
    content = DATA.read_text(encoding="utf-8").strip()
    if not content.startswith(PREFIX):
        raise ValueError("无法识别现有 YouTube 档案，保留原文件")
    data = json.loads(content[len(PREFIX):].rstrip(";\n\r "))
    if not isinstance(data.get("sources"), list) or not isinstance(data.get("videos"), list):
        raise ValueError("YouTube 档案格式无效，保留原文件")
    return data


def save(data):
    payload = PREFIX + json.dumps(data, ensure_ascii=False, indent=2) + ";\n"
    DATA.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile("w", encoding="utf-8", newline="\n", dir=DATA.parent, delete=False) as tmp:
        tmp.write(payload)
        name = tmp.name
    Path(name).replace(DATA)


def read_feed(source):
    channel = source["channelId"]
    if not CHANNEL_ID.fullmatch(channel):
        raise ValueError("频道 ID 无效")
    request = Request("https://www.youtube.com/feeds/videos.xml?channel_id=" + channel,
                      headers={"User-Agent": "Mozilla/5.0 (compatible; IdolCrush/1.0)",
                               "Accept": "application/atom+xml, application/xml, text/xml"})
    with urlopen(request, timeout=25) as response:
        content = response.read(2 * 1024 * 1024)
    root = ET.fromstring(content)
    if root.tag != "{" + NS["a"] + "}feed":
        raise ValueError("频道订阅格式异常")
    author_uri = root.findtext("a:author/a:uri", "", NS)
    if author_uri.rstrip("/").rsplit("/", 1)[-1] != channel:
        raise ValueError("频道订阅与配置不匹配")
    items = []
    for entry in root.findall("a:entry", NS):
        video_id = entry.findtext("yt:videoId", "", NS)
        entry_channel = entry.findtext("yt:channelId", "", NS)
        title = entry.findtext("a:title", "", NS).strip()
        published = entry.findtext("a:published", "", NS)
        if not VIDEO_ID.fullmatch(video_id) or entry_channel != channel or not title:
            continue
        try:
            day = datetime.fromisoformat(published.replace("Z", "+00:00")).astimezone(CHINA).date().isoformat()
        except ValueError:
            continue
        if source.get("titleFilter") and not re.search(source["titleFilter"], title):
            continue
        description = entry.findtext("media:group/media:description", "", NS)[:2000]
        record = {"youtube": video_id, "title": title, "date": day, "publisher": source["name"],
                  "source": "https://www.youtube.com/watch?v=" + video_id,
                  "description": description, "sources": ["yt:" + channel]}
        if source.get("category"):
            record["category"] = source["category"]
        items.append(record)
    return items


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-status", action="store_true")
    parser.add_argument("--pause", type=float, default=0.8)
    args = parser.parse_args()
    if args.pause < 0:
        parser.error("pause must be nonnegative")
    archive = read_archive()
    if args.check_status:
        if not any(source.get("status") == "ok" for source in archive["sources"]):
            print("没有可读取的 YouTube 频道；已保留历史档案。", file=sys.stderr)
            sys.exit(1)
        print("At least one YouTube feed was reachable.")
        return
    previous = {source.get("uid"): source for source in archive["sources"]}
    videos = {video["youtube"]: video for video in archive["videos"]
              if VIDEO_ID.fullmatch(video.get("youtube") or "")}
    sources = []
    for index, config in enumerate(CONFIG):
        uid = "yt:" + config["channelId"]
        prior = previous.get(uid, {})
        source = {"uid": uid, "name": config["name"], "platform": "youtube",
                  "url": "https://www.youtube.com/@" + config["handle"],
                  "artists": config.get("artists", []), "alwaysArtists": config.get("alwaysArtists", []),
                  "checkedAt": now_text(), "status": "error"}
        if prior.get("lastSuccessAt"):
            source["lastSuccessAt"] = prior["lastSuccessAt"]
        try:
            items = read_feed(config)
            for item in items:
                current = videos.get(item["youtube"], {})
                item["sources"] = sorted(set(current.get("sources", []) + item["sources"]))
                videos[item["youtube"]] = {**current, **item}
            source.update(status="ok", lastSuccessAt=now_text(), recentCount=len(items))
            print(f"{config['name']}: {len(items)} recent videos", flush=True)
        except (HTTPError, URLError, TimeoutError, ConnectionError, OSError, ET.ParseError, ValueError) as error:
            message = f"HTTP {error.code}" if isinstance(error, HTTPError) else str(error)[:120]
            source["error"] = message
            print(f"{config['name']}: {message}; prior videos retained", file=sys.stderr, flush=True)
        sources.append(source)
        if args.pause and index + 1 < len(CONFIG):
            time.sleep(args.pause)
    archive = {"updatedAt": now_text(), "sources": sources,
               "videos": sorted(videos.values(), key=lambda item: (item.get("date", ""), item["youtube"]), reverse=True)}
    save(archive)
    print(f"Saved {len(videos)} distinct YouTube videos", flush=True)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        print(f"YouTube refresh could not save: {error}", file=sys.stderr)
        sys.exit(1)
