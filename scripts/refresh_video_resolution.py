"""Record public Bilibili upload dimensions and per-part running times.

The view endpoint exposes source upload dimensions for each cid. These do not
promise that the same playback quality is available on every account/device.
Existing successful responses are kept if a later refresh is unavailable.
"""

import argparse
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from tempfile import NamedTemporaryFile

from update_bilibili import BVID, CHINA, Client, SourceError, now_text, read_archive


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "data" / "video-resolution.js"
CURATED = ROOT / "docs" / "data" / "videos.js"
PREFIX = "window.IC_VIDEO_RESOLUTIONS = "
WONYOUNG = re.compile(r"张元英|張元英|张员瑛|張員瑛|元英|员瑛|장원영|\bwonyoung\b|\bIVE\b|아이브", re.I)
WONYOUNG_SOURCE = "15774483"


def read_dimensions():
    if not DATA.exists():
        return {"videos": {}, "failures": {}}
    content = DATA.read_text(encoding="utf-8").strip()
    if not content.startswith(PREFIX):
        raise ValueError("无法识别现有分辨率数据，保留原文件")
    result = json.loads(content[len(PREFIX):].rstrip(";\n\r "))
    if not isinstance(result.get("videos"), dict) or not isinstance(result.get("failures", {}), dict):
        raise ValueError("分辨率数据格式无效，保留原文件")
    return result


def curated_bvids():
    # videos.js contains both the original catalogue and later additions.
    # Evaluate it in Node so that all entries follow the same normal path.
    program = ("global.window=global;require(process.argv[1]);"
               "const rows=Object.values(window.IC_VIDEOS||{}).flat();"
               "process.stdout.write(JSON.stringify(rows.map(x=>x.bilibili).filter(Boolean)))")
    output = subprocess.run(["node", "-e", program, str(CURATED)], check=True,
                            capture_output=True, text=True, encoding="utf-8", timeout=30)
    values = json.loads(output.stdout)
    if not isinstance(values, list):
        raise ValueError("无法读取精选视频")
    return [value for value in values if isinstance(value, str) and BVID.fullmatch(value)]


def candidate_order():
    archive = read_archive()
    target = []
    others = []
    for video in archive["videos"]:
        bvid = video.get("bvid") or ""
        if not isinstance(bvid, str) or not BVID.fullmatch(bvid):
            continue
        if WONYOUNG.search(str(video.get("title") or "")) or WONYOUNG_SOURCE in video.get("sources", []):
            target.append(bvid)
        else:
            others.append(bvid)
    # Preserve each archive's existing newest-first ordering.
    return list(dict.fromkeys([*curated_bvids(), *target, *others]))


def valid_time(value):
    if not value:
        return None
    try:
        result = datetime.fromisoformat(value)
        if result.tzinfo is None:
            return None
        return result
    except (TypeError, ValueError):
        return None


def nonnegative_int(value):
    try:
        value = int(value)
    except (TypeError, ValueError, OverflowError):
        return 0
    return max(0, value)


def read_video(client, bvid):
    referer = "https://www.bilibili.com/"
    original = {}
    try:
        parts = client.get("/x/player/pagelist", {"bvid": bvid}, "0", attempts=2,
                           allow_list=True, referer=referer)
        if not isinstance(parts, list) or not parts:
            raise SourceError("分 P 列表结构发生变化")
    except SourceError as list_error:
        try:
            data = client.get("/x/web-interface/view", {"bvid": bvid}, "0", attempts=2,
                              referer=referer)
            if data.get("bvid") != bvid or not isinstance(data.get("pages"), list):
                raise SourceError("视频详情结构发生变化")
            parts = data["pages"]
            original = data.get("dimension") or {}
        except SourceError as view_error:
            raise SourceError(f"分 P 接口 {list_error}; 视频详情 {view_error}") from view_error
    if not isinstance(original, dict):
        original = {}
    pages = []
    for item in parts:
        if not isinstance(item, dict):
            continue
        page = nonnegative_int(item.get("page"))
        cid = nonnegative_int(item.get("cid"))
        if not page or not cid:
            continue
        dimension = item.get("dimension") or {}
        if not isinstance(dimension, dict):
            dimension = {}
        width = nonnegative_int(dimension.get("width"))
        height = nonnegative_int(dimension.get("height"))
        # The top-level dimension only describes the first part.
        if page == 1 and not (width and height):
            width = nonnegative_int(original.get("width"))
            height = nonnegative_int(original.get("height"))
        pages.append({"page": page, "cid": str(cid), "width": width, "height": height,
                      "duration": nonnegative_int(item.get("duration"))})
    if not pages:
        raise SourceError("没有可识别的分 P")
    first = next((part for part in pages if part["page"] == 1), None)
    return {"width": first["width"] if first else 0, "height": first["height"] if first else 0,
            "pages": pages, "checkedAt": now_text()}


def merge_previous(record, previous):
    # A transient zero must not erase verified metadata for the same CID.
    # Old data for a removed or replaced part must never be applied to a new CID.
    old_parts = {str(part.get("cid")): part for part in (previous or {}).get("pages", [])}
    for part in record["pages"]:
        old = old_parts.get(part["cid"])
        if not old:
            continue
        if not (part["width"] and part["height"]) and old.get("width") and old.get("height"):
            part["width"], part["height"] = old["width"], old["height"]
        if not part["duration"] and old.get("duration"):
            part["duration"] = old["duration"]
    first = next((part for part in record["pages"] if part["page"] == 1), None)
    record["width"] = first["width"] if first else 0
    record["height"] = first["height"] if first else 0
    return record


def save(archive):
    DATA.parent.mkdir(parents=True, exist_ok=True)
    contents = PREFIX + json.dumps(archive, ensure_ascii=False, indent=2) + ";\n"
    with NamedTemporaryFile("w", encoding="utf-8", dir=DATA.parent, delete=False, newline="\n") as stream:
        temporary = Path(stream.name)
        stream.write(contents)
    temporary.replace(DATA)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-items", type=int, default=200,
                        help="Maximum public video detail requests per run")
    parser.add_argument("--pause", type=float, default=0.8,
                        help="Minimum seconds between requests")
    parser.add_argument("--refresh-days", type=int, default=45,
                        help="Refresh stored dimensions after this many days")
    parser.add_argument("--multipart-refresh-days", type=int, default=7,
                        help="Refresh multi-part videos after this many days")
    parser.add_argument("--check-status", action="store_true",
                        help="Report failure when the latest refresh could not check any requested video")
    args = parser.parse_args()
    if args.max_items < 1 or args.pause < 0 or args.refresh_days < 1 or args.multipart_refresh_days < 1:
        parser.error("max-items and refresh intervals must be positive; pause must be nonnegative")

    archive = read_dimensions()
    if args.check_status:
        status = archive.get("status") or {}
        if status.get("attempted", 0) and not status.get("succeeded", 0):
            print("Bilibili metadata could not be refreshed; existing dimensions were preserved.", file=sys.stderr)
            sys.exit(1)
        print("Metadata refresh completed or no pending videos needed a request.")
        return

    now = datetime.now(CHINA)
    videos = archive.setdefault("videos", {})
    failures = archive.setdefault("failures", {})
    ordered = candidate_order()
    fresh_until = now - timedelta(days=args.refresh_days)
    multipart_fresh_until = now - timedelta(days=args.multipart_refresh_days)
    missing, stale = [], []
    for bvid in ordered:
        retry_after = valid_time((failures.get(bvid) or {}).get("retryAfter"))
        if retry_after and retry_after > now:
            continue
        record = videos.get(bvid) or {}
        checked = valid_time(record.get("checkedAt"))
        if not checked:
            missing.append(bvid)
        elif checked < (multipart_fresh_until if len(record.get("pages", [])) > 1 else fresh_until):
            stale.append(bvid)
    # Oldest checks go first so an actively updated catalogue cannot starve
    # older multi-part collections of their periodic refresh.
    stale.sort(key=lambda bvid: valid_time(videos[bvid]["checkedAt"]))
    queue = (missing + stale)[:args.max_items]
    client = Client(args.pause)
    attempted = succeeded = 0
    blocked = False

    def checkpoint():
        archive["updatedAt"] = now_text()
        archive["status"] = {"checkedAt": archive["updatedAt"], "attempted": attempted,
                             "succeeded": succeeded, "blocked": blocked,
                             "known": sum(bvid in videos for bvid in ordered), "total": len(ordered)}
        save(archive)

    for bvid in queue:
        attempted += 1
        try:
            record = read_video(client, bvid)
        except SourceError as error:
            details = str(error)
            message = details[:100]
            print(f"{bvid}: {message}", file=sys.stderr, flush=True)
            # A risk-control response can affect every request from this host.
            # Stop promptly so the next run can resume without losing progress.
            if any(code in details for code in ("HTTP 412", "HTTP 429", "B 站 -412", "B 站 -352", "网络连接失败")):
                blocked = True
                break
            old = failures.get(bvid) or {}
            failures[bvid] = {"attempts": nonnegative_int(old.get("attempts")) + 1,
                              "checkedAt": now_text(),
                              "retryAfter": (datetime.now(CHINA) + timedelta(days=7)).replace(microsecond=0).isoformat(),
                              "error": message}
        else:
            videos[bvid] = merge_previous(record, videos.get(bvid))
            failures.pop(bvid, None)
            succeeded += 1
        if attempted % 25 == 0:
            print(f"Checked {attempted} / {len(queue)}; saved {succeeded} videos", flush=True)
        if attempted % 50 == 0:
            checkpoint()

    checkpoint()
    print(f"Saved {len(videos)} video records; checked {attempted}, succeeded {succeeded}; "
          f"{archive['status']['known']} / {len(ordered)} current videos have metadata", flush=True)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print(f"Video metadata could not be saved: {error}", file=sys.stderr)
        sys.exit(1)
