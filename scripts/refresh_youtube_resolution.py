"""Record formats exposed by public YouTube watch pages for curated videos.

The maximum listed video dimensions may depend on YouTube's platform and
account rules. No cookie or private account information is used.
"""

import argparse
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from refresh_video_resolution import CHINA, CURATED, nonnegative_int, now_text, read_dimensions, save, valid_time


VIDEO_ID = re.compile(r"[\w-]{11}\Z", re.ASCII)
PLAYER = re.compile(r"\bytInitialPlayerResponse\s*=\s*")
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
              "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")


class VideoError(Exception):
    pass


def candidates():
    program = ("global.window=global;require(process.argv[1]);"
               "const rows=Object.values(window.IC_VIDEOS||{}).flat();"
               "process.stdout.write(JSON.stringify(rows.map(x=>x.youtube).filter(Boolean)))")
    result = subprocess.run(["node", "-e", program, str(CURATED)], check=True,
                            capture_output=True, text=True, encoding="utf-8", timeout=30)
    values = json.loads(result.stdout)
    if not isinstance(values, list):
        raise ValueError("无法读取精选 YouTube 视频")
    return list(dict.fromkeys(value for value in values
                              if isinstance(value, str) and VIDEO_ID.fullmatch(value)))


def read_video(video_id):
    request = Request("https://www.youtube.com/watch?v=" + video_id,
                      headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"})
    try:
        with urlopen(request, timeout=20) as response:
            html = response.read(10 * 1024 * 1024).decode("utf-8")
    except HTTPError as error:
        raise VideoError(f"HTTP {error.code}") from error
    except (URLError, TimeoutError, ConnectionError) as error:
        raise VideoError("网络连接失败") from error
    except UnicodeError as error:
        raise VideoError("页面编码异常") from error
    match = PLAYER.search(html)
    if not match:
        raise VideoError("未找到播放器数据")
    try:
        player, _ = json.JSONDecoder().raw_decode(html[match.end():])
    except ValueError as error:
        raise VideoError("播放器数据格式发生变化") from error
    details = player.get("videoDetails") or {}
    if details.get("videoId") != video_id:
        raise VideoError("视频标识不匹配")
    if (player.get("playabilityStatus") or {}).get("status") != "OK":
        raise VideoError("视频暂不可公开播放")
    streaming = player.get("streamingData") or {}
    formats = (streaming.get("formats") or []) + (streaming.get("adaptiveFormats") or [])
    dimensions = [(nonnegative_int(item.get("width")), nonnegative_int(item.get("height")))
                  for item in formats if isinstance(item, dict)]
    dimensions = [(width, height) for width, height in dimensions if width and height]
    if not dimensions:
        raise VideoError("播放器未提供视频尺寸")
    width, height = max(dimensions, key=lambda pair: pair[0] * pair[1])
    return {"width": width, "height": height,
            "duration": nonnegative_int(details.get("lengthSeconds")), "checkedAt": now_text()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-items", type=int, default=50)
    parser.add_argument("--pause", type=float, default=0.8)
    parser.add_argument("--refresh-days", type=int, default=45)
    args = parser.parse_args()
    if args.max_items < 1 or args.pause < 0 or args.refresh_days < 1:
        parser.error("max-items and refresh-days must be positive; pause must be nonnegative")
    archive = read_dimensions()
    videos = archive.setdefault("youtube", {})
    failures = archive.setdefault("youtubeFailures", {})
    ordered = candidates()
    now = datetime.now(CHINA)
    fresh_until = now - timedelta(days=args.refresh_days)
    missing, stale = [], []
    for video_id in ordered:
        retry_after = valid_time((failures.get(video_id) or {}).get("retryAfter"))
        if retry_after and retry_after > now:
            continue
        checked = valid_time((videos.get(video_id) or {}).get("checkedAt"))
        if not checked:
            missing.append(video_id)
        elif checked < fresh_until:
            stale.append(video_id)
    queue = (missing + stale)[:args.max_items]
    attempted = succeeded = 0
    blocked = False
    for video_id in queue:
        attempted += 1
        try:
            record = read_video(video_id)
        except VideoError as error:
            message = str(error)[:100]
            print(f"{video_id}: {message}", file=sys.stderr, flush=True)
            if message in {"HTTP 403", "HTTP 429", "网络连接失败"}:
                blocked = True
                break
            old = failures.get(video_id) or {}
            failures[video_id] = {"attempts": nonnegative_int(old.get("attempts")) + 1,
                                  "checkedAt": now_text(),
                                  "retryAfter": (datetime.now(CHINA) + timedelta(days=7)).replace(microsecond=0).isoformat(),
                                  "error": message}
        else:
            videos[video_id] = record
            failures.pop(video_id, None)
            succeeded += 1
        if args.pause:
            time.sleep(args.pause)
    archive["updatedAt"] = now_text()
    archive["youtubeStatus"] = {"checkedAt": archive["updatedAt"], "attempted": attempted,
                                "succeeded": succeeded, "blocked": blocked,
                                "known": sum(video_id in videos for video_id in ordered), "total": len(ordered)}
    save(archive)
    print(f"YouTube: saved {len(videos)} video records; checked {attempted}, succeeded {succeeded}; "
          f"{archive['youtubeStatus']['known']} / {len(ordered)} curated videos have metadata", flush=True)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print(f"YouTube metadata could not be saved: {error}", file=sys.stderr)
        sys.exit(1)
