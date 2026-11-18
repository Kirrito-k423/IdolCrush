"""Collect public videos from the Bilibili accounts listed by the site owner.

The archive is append-only: an unavailable feed never erases prior results.
Recent pages are checked on every run, while older submissions are backfilled
over successive runs. Login is optional and comes only from BILI_SESSDATA.
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from http.cookiejar import CookieJar
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPCookieProcessor, Request, build_opener


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "data" / "bilibili.js"
PREFIX = "window.IC_BILIBILI = "
CHINA = timezone(timedelta(hours=8))
PAGE_SIZE = 30
API = "https://api.bilibili.com"
SOURCE_CONFIG = json.loads((ROOT / "scripts" / "video_sources.json").read_text(encoding="utf-8"))
SOURCE_BY_UID = {item["uid"]: item for item in SOURCE_CONFIG["bilibili"]}
ACCOUNTS = tuple((item["uid"], item["name"]) for item in SOURCE_CONFIG["bilibili"])
BVID = re.compile(r"BV[0-9A-Za-z]{10}\Z")


def now_text():
    return datetime.now(CHINA).replace(microsecond=0).isoformat()


def iso_day(timestamp):
    try:
        return datetime.fromtimestamp(int(timestamp), CHINA).date().isoformat()
    except (ValueError, TypeError, OverflowError, OSError):
        return ""


def duration_text(seconds):
    try:
        seconds = max(0, int(seconds))
    except (ValueError, TypeError):
        return ""
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours}:{minutes:02d}:{seconds:02d}" if hours else f"{minutes}:{seconds:02d}"


def https_url(url):
    url = str(url or "")
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("http://"):
        return "https://" + url[7:]
    return url if url.startswith("https://") else ""


def read_archive():
    if not DATA.exists():
        return {"sources": [], "videos": []}
    contents = DATA.read_text(encoding="utf-8").strip()
    if not contents.startswith(PREFIX):
        raise ValueError("无法识别现有 B 站档案，保留原文件")
    archive = json.loads(contents[len(PREFIX):].rstrip(";\n\r "))
    if not isinstance(archive.get("sources"), list) or not isinstance(archive.get("videos"), list):
        raise ValueError("B 站档案格式无效，保留原文件")
    return archive


class SourceError(Exception):
    pass


class Client:
    def __init__(self, pause):
        self.opener = build_opener(HTTPCookieProcessor(CookieJar()))
        self.pause = pause
        self.last_request = 0.0
        self.sessdata = os.environ.get("BILI_SESSDATA", "").strip()

    def get(self, route, params, uid, attempts=3, *, allow_list=False, referer=None):
        url = API + route + "?" + urlencode(params)
        headers = {
            "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                           "AppleWebKit/537.36 (KHTML, like Gecko) "
                           "Chrome/130.0.0.0 Safari/537.36"),
            "Referer": referer or f"https://space.bilibili.com/{uid}/",
            "Accept": "application/json, text/plain, */*",
        }
        if self.sessdata:
            headers["Cookie"] = "SESSDATA=" + self.sessdata
        last_error = "请求失败"
        for attempt in range(attempts):
            delay = self.pause - (time.monotonic() - self.last_request)
            if delay > 0:
                time.sleep(delay)
            self.last_request = time.monotonic()
            try:
                with self.opener.open(Request(url, headers=headers), timeout=18) as response:
                    body = response.read()
                result = json.loads(body)
                if not isinstance(result, dict):
                    raise SourceError("接口数据格式发生变化")
                if result.get("code") != 0:
                    code = result.get("code")
                    message = str(result.get("message") or "接口返回异常")[:80]
                    raise SourceError(f"B 站 {code}：{message}")
                expected = (dict, list) if allow_list else dict
                if not isinstance(result.get("data"), expected):
                    raise SourceError("接口数据格式发生变化")
                return result["data"]
            except HTTPError as exc:
                last_error = f"HTTP {exc.code}"
            except (ValueError, UnicodeError):
                last_error = "接口返回非 JSON 内容"
            except (URLError, TimeoutError, ConnectionError):
                last_error = "网络连接失败"
            except SourceError as exc:
                last_error = str(exc)
            if attempt + 1 < attempts:
                time.sleep(2 * (attempt + 1))
        raise SourceError(last_error)


def submission_record(item, uid, name):
    bvid = item.get("bvid") or ""
    day = iso_day(item.get("pubdate"))
    if not BVID.fullmatch(bvid) or not day or not item.get("title"):
        return None
    return {
        "bvid": bvid,
        "title": str(item["title"]),
        "date": day,
        "publisher": name,
        "source": f"https://www.bilibili.com/video/{bvid}/",
        "cover": https_url(item.get("pic")),
        "duration": duration_text(item.get("duration")),
        "description": str(item.get("desc") or ""),
        "sources": [uid],
        "provenance": [{"uid": uid, "kind": "upload"}],
    }


def module(item, key):
    modules = item.get("modules") or {}
    if isinstance(modules, dict):
        return modules.get(key) or {}
    if isinstance(modules, list):
        return next((entry[key] for entry in modules if isinstance(entry, dict) and key in entry), {})
    return {}


def dynamic_records(item, uid, fallback_name):
    """Extract videos both from own dynamic posts and forwarded originals."""
    result = []
    dynamic_id = str(item.get("id_str") or "")
    dynamic_url = f"https://t.bilibili.com/{dynamic_id}" if dynamic_id.isdecimal() else ""
    nodes = [item]
    for node in nodes:
        content = module(node, "module_dynamic")
        if len(nodes) < 4:
            forwarded = (content.get("dyn_forward") or {}).get("item") or node.get("orig")
            if isinstance(forwarded, dict):
                nodes.append(forwarded)
        major = content.get("major") or {}
        video = content.get("dyn_archive") or major.get("archive") or {}
        author = module(node, "module_author")
        bvid = video.get("bvid") or ""
        day = iso_day(author.get("pub_ts"))
        if not BVID.fullmatch(bvid) or not day or not video.get("title"):
            continue
        origin = {"uid": uid, "kind": "dynamic"}
        if dynamic_url:
            origin["url"] = dynamic_url
        result.append({
            "bvid": bvid,
            "title": str(video["title"]),
            "date": day,
            "publisher": str(author.get("name") or (author.get("user") or {}).get("name") or fallback_name),
            "source": f"https://www.bilibili.com/video/{bvid}/",
            "cover": https_url(video.get("cover")),
            "duration": str(video.get("duration_text") or ""),
            "description": str(video.get("desc") or ""),
            "sources": [uid],
            "provenance": [origin],
        })
    return result


def merge_video(videos, incoming):
    if not incoming:
        return
    key = incoming["bvid"]
    if key not in videos:
        videos[key] = incoming
        return
    current = videos[key]
    for field in ("title", "date", "publisher", "source", "cover", "duration", "description"):
        if not current.get(field) and incoming.get(field):
            current[field] = incoming[field]
    current["sources"] = sorted(set(current.get("sources", [])) | set(incoming["sources"]))
    existing = current.setdefault("provenance", [])
    for source in incoming["provenance"]:
        if source not in existing:
            existing.append(source)


def submissions(client, uid, name, previous, known, videos, pages):
    feed = {"status": "error", "checkedAt": now_text()}
    last_good = previous.get("lastSuccessAt")
    if last_good:
        feed["lastSuccessAt"] = last_good
    new_count = 0
    seen_pages = set()
    page_cache = {}
    feed["headBvids"] = previous.get("headBvids", [])
    feed["pending"] = [dict(entry) for entry in previous.get("pending", [])]
    if previous.get("catchupPage"):
        feed["pending"].append({"page": previous["catchupPage"],
                                "anchors": previous.get("headBvids") or sorted(known)[:30]})
    backfill_cursor = int(previous.get("nextPage") or 2)
    known_total = previous.get("total")
    try:
        def fetch_page(page):
            nonlocal new_count
            if page in page_cache:
                return page_cache[page]
            data = client.get("/x/series/recArchivesByKeywords", {
                "mid": uid, "keywords": "", "ps": PAGE_SIZE, "pn": page,
            }, uid)
            archives = data.get("archives")
            details = data.get("page")
            if not isinstance(archives, list) or not isinstance(details, dict):
                raise SourceError("投稿列表结构发生变化")
            seen_pages.add(page)
            ids = []
            for item in archives:
                record = submission_record(item, uid, name)
                if record:
                    ids.append(record["bvid"])
                    new_count += int(record["bvid"] not in known)
                    merge_video(videos, record)
            page_cache[page] = (archives, details, set(ids))
            return page_cache[page]

        first, details, first_ids = fetch_page(1)
        total = int(details.get("total", 0))
        known_total = total
        if total and not first:
            raise SourceError("投稿列表意外为空")
        total_pages = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)
        # Save the previous first-page IDs when a burst spans multiple pages.
        old_head = previous.get("headBvids") or []
        anchors = old_head or sorted(known)[:30]
        if known and first and not first_ids.intersection(old_head or known):
            gap = {"page": 2, "anchors": anchors}
            if gap not in feed["pending"]:
                feed["pending"].append(gap)
        feed["headBvids"] = [item.get("bvid") for item in first if BVID.fullmatch(item.get("bvid") or "")]
        while feed["pending"] and len(seen_pages) < pages:
            gap = feed["pending"][0]
            gap_page = int(gap["page"])
            if gap_page > total_pages:
                feed["pending"].pop(0)
                continue
            _, _, ids = fetch_page(gap_page)
            if ids.intersection(gap["anchors"]) or gap_page == total_pages:
                feed["pending"].pop(0)
            else:
                gap["page"] = gap_page + 1

        # Revisit a page whenever new videos shift numbered archive pages.
        cursor = int(previous.get("nextPage") or 2)
        overlap_pages = 1 + new_count // PAGE_SIZE
        page = max(2, cursor - overlap_pages) if cursor > 2 else 2
        while page <= total_pages and len(seen_pages) < pages:
            if page not in seen_pages:
                fetch_page(page)
            page += 1
            if page > cursor:
                backfill_cursor = max(backfill_cursor, page)
        feed.update(status="ok", lastSuccessAt=now_text(), total=total,
                    pagesFetched=sorted(seen_pages), nextPage=min(backfill_cursor, total_pages + 1),
                    complete=page > total_pages and not feed["pending"])
    except (SourceError, ValueError, TypeError) as exc:
        feed.update(error=str(exc)[:120], nextPage=backfill_cursor,
                    total=known_total, pagesFetched=sorted(seen_pages))
        if seen_pages:
            feed["status"] = "partial"
            feed["lastSuccessAt"] = now_text()
    return feed


def dynamics(client, uid, name, previous, videos, pages):
    feed = {"status": "error", "checkedAt": now_text()}
    if previous.get("lastSuccessAt"):
        feed["lastSuccessAt"] = previous["lastSuccessAt"]
    for key in ("headId", "historyOffset", "historyComplete", "pending"):
        if key in previous:
            feed[key] = previous[key]
    feed["pending"] = [dict(entry) for entry in previous.get("pending", [])]
    fetched = 0
    added = 0
    try:
        def fetch_page(offset):
            nonlocal fetched, added
            params = {"host_mid": uid, "timezone_offset": -480, "platform": "web"}
            if offset:
                params["offset"] = offset
            for attempt in range(3):
                data = client.get("/x/polymer/web-dynamic/desktop/v1/feed/space", params, uid)
                items = data.get("items")
                if not isinstance(items, list):
                    raise SourceError("动态列表结构发生变化")
                if items:
                    break
                if attempt < 2:
                    time.sleep(2)
            if not items:
                raise SourceError("动态暂未返回内容")
            fetched += 1
            for item in items:
                for record in dynamic_records(item, uid, name):
                    added += int(record["bvid"] not in videos)
                    merge_video(videos, record)
            next_offset = str(data.get("offset") or "")
            has_more = bool(data.get("has_more"))
            if has_more and (not next_offset or next_offset == offset):
                raise SourceError("动态分页游标不可用")
            return items, next_offset, has_more

        first, offset, has_more = fetch_page("")
        first_ids = {str(item.get("id_str") or "") for item in first}
        head = next((str(item.get("id_str") or "") for item in first
                     if not module(item, "module_author").get("is_top") and item.get("id_str")), "")
        old_head = str(previous.get("headId") or "")
        if old_head and old_head not in first_ids and has_more:
            pending = {"offset": offset, "until": old_head}
            if pending not in feed["pending"]:
                feed["pending"].append(pending)
        if head:
            feed["headId"] = head
        if "historyOffset" not in previous and not previous.get("historyComplete"):
            feed["historyOffset"] = offset if has_more else ""
            feed["historyComplete"] = not has_more

        while fetched < pages:
            if feed["pending"]:
                gap = feed["pending"][0]
                items, next_offset, more = fetch_page(gap["offset"])
                ids = {str(item.get("id_str") or "") for item in items}
                if gap["until"] in ids or not more:
                    feed["pending"].pop(0)
                else:
                    gap["offset"] = next_offset
            elif not feed.get("historyComplete") and feed.get("historyOffset"):
                items, next_offset, more = fetch_page(feed["historyOffset"])
                feed["historyOffset"] = next_offset if more else ""
                feed["historyComplete"] = not more
            else:
                break
        feed.update(status="ok", lastSuccessAt=now_text(), pagesFetched=fetched, videosAdded=added)
    except SourceError as exc:
        feed.update(error=str(exc)[:120], pagesFetched=fetched, videosAdded=added)
        if fetched:
            feed.update(status="partial", lastSuccessAt=now_text())
    return feed


def save(archive):
    DATA.parent.mkdir(parents=True, exist_ok=True)
    contents = PREFIX + json.dumps(archive, ensure_ascii=False, indent=2) + ";\n"
    with NamedTemporaryFile("w", encoding="utf-8", dir=DATA.parent, delete=False, newline="\n") as output:
        temporary = Path(output.name)
        output.write(contents)
    temporary.replace(DATA)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages", type=int, default=12, help="Maximum submission pages per account per run")
    parser.add_argument("--dynamic-pages", type=int, default=4, help="Maximum dynamic pages per account per run")
    parser.add_argument("--pause", type=float, default=1.2, help="Minimum seconds between requests")
    parser.add_argument("--account", action="append", choices=[uid for uid, _ in ACCOUNTS],
                        help="Refresh selected account(s) only; default is all accounts")
    parser.add_argument("--check-status", action="store_true",
                        help="Exit with failure if no source was reachable on its latest check")
    parser.add_argument("--rescan", action="store_true", help="Recheck history from the beginning")
    parser.add_argument("--rescan-dynamic", action="store_true", help="Recheck dynamic history from the beginning")
    args = parser.parse_args()
    if args.pages < 1 or args.dynamic_pages < 1 or args.pause < 0:
        parser.error("page counts must be positive and pause must be nonnegative")
    archive = read_archive()
    if args.check_status:
        available = any(source.get(feed, {}).get("status") in {"ok", "partial"}
                        for source in archive["sources"] for feed in ("uploads", "dynamic"))
        if not available:
            print("No Bilibili feed was reachable; the previous archive was preserved.", file=sys.stderr)
            sys.exit(1)
        print("At least one Bilibili feed was reachable.")
        return
    previous_sources = {str(s.get("uid")): s for s in archive["sources"]}
    videos = {v["bvid"]: v for v in archive["videos"] if BVID.fullmatch(v.get("bvid") or "")}
    known_by_source = {uid: {key for key, v in videos.items() if uid in v.get("sources", [])}
                       for uid, _ in ACCOUNTS}
    client = Client(args.pause)
    sources = []
    for uid, name in ACCOUNTS:
        previous = previous_sources.get(uid, {})
        if args.account and uid not in args.account:
            sources.append(previous or {"uid": uid, "name": name,
                           "url": f"https://space.bilibili.com/{uid}/dynamic", "status": "pending"})
            continue
        print(f"Checking {name} ({uid})", flush=True)
        previous_upload = previous.get("uploads", {})
        if args.rescan:
            previous_upload = {**previous_upload, "nextPage": 2}
            previous_upload.pop("catchupPage", None)
        upload = submissions(client, uid, name, previous_upload, known_by_source[uid], videos, args.pages)
        previous_dynamic = dict(previous.get("dynamic", {}))
        if args.rescan_dynamic:
            for key in ("historyComplete", "historyOffset", "pending"):
                previous_dynamic.pop(key, None)
        dynamic = dynamics(client, uid, name, previous_dynamic, videos, args.dynamic_pages)
        statuses = {upload["status"], dynamic["status"]}
        status = "ok" if statuses == {"ok"} else "error" if statuses == {"error"} else "partial"
        sources.append({"uid": uid, "name": name, "url": f"https://space.bilibili.com/{uid}/dynamic",
                        "artists": SOURCE_BY_UID[uid].get("artists", []), "platform": "bilibili",
                        "status": status, "checkedAt": now_text(), "uploads": upload, "dynamic": dynamic})
        print(f"  uploads: {upload['status']}; dynamics: {dynamic['status']}; "
              f"archive: {sum(uid in v.get('sources', []) for v in videos.values())}", flush=True)
    archive = {"updatedAt": now_text(), "sources": sources,
               "videos": sorted(videos.values(), key=lambda v: (v.get("date", ""), v["bvid"]), reverse=True)}
    save(archive)
    print(f"Saved {len(archive['videos'])} distinct videos", flush=True)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError) as error:
        print(f"Bilibili refresh could not save: {error}", file=sys.stderr)
        sys.exit(1)
