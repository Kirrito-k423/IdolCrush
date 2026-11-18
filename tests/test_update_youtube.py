import io
import sys
import unittest
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import update_youtube as sync


CHANNEL = "UCWpY0eSJtyO-qNAPbKFRSSg"
OTHER = "UC7Q3HUnJA3nvjZR2JeMn2Cw"


def feed(author=CHANNEL):
    return f'''<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns:media="http://search.yahoo.com/mrss/">
      <author><uri>https://www.youtube.com/channel/{author}</uri></author>
      <entry><yt:videoId>N3MX2W5_Zfs</yt:videoId><yt:channelId>{CHANNEL}</yt:channelId>
        <title>WONI &amp; MINAMI</title><published>2026-11-17T20:00:00Z</published>
        <media:group><media:description>hello</media:description></media:group></entry>
      <entry><yt:videoId>not-a-valid-id</yt:videoId><yt:channelId>{CHANNEL}</yt:channelId>
        <title>Invalid</title><published>2026-11-17T20:00:00Z</published></entry>
      </feed>'''.encode()


class FeedTests(unittest.TestCase):
    def test_feed_validates_channel_and_uses_china_date(self):
        response = io.BytesIO(feed())
        with patch.object(sync, "urlopen", return_value=response):
            items = sync.read_feed({"channelId": CHANNEL, "name": "WONI", "category": "solo"})
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["title"], "WONI & MINAMI")
        self.assertEqual(items[0]["date"], "2026-11-18")
        self.assertEqual(items[0]["sources"], ["yt:" + CHANNEL])
        self.assertEqual(items[0]["category"], "solo")

    def test_feed_rejects_wrong_channel(self):
        with patch.object(sync, "urlopen", return_value=io.BytesIO(feed(OTHER))):
            with self.assertRaisesRegex(ValueError, "不匹配"):
                sync.read_feed({"channelId": CHANNEL, "name": "WONI"})

    def test_company_channel_filter_does_not_add_other_groups(self):
        with patch.object(sync, "urlopen", return_value=io.BytesIO(feed())):
            items = sync.read_feed({"channelId": CHANNEL, "name": "company", "titleFilter": "A2O LITE"})
        self.assertEqual(items, [])

    def test_failed_refresh_keeps_old_videos_and_last_success(self):
        uid = "yt:" + CHANNEL
        archive = {"sources": [{"uid": uid, "lastSuccessAt": "2026-11-17T12:00:00+08:00"}],
                   "videos": [{"youtube": "N3MX2W5_Zfs", "title": "Existing", "date": "2026-11-17"}]}
        saved = []
        config = [{"channelId": CHANNEL, "handle": "woni", "name": "WONI", "artists": ["woni"]}]
        with patch.object(sync, "CONFIG", config), patch.object(sync, "read_archive", return_value=archive), \
             patch.object(sync, "read_feed", side_effect=OSError("temporarily unavailable")), \
             patch.object(sync, "save", side_effect=saved.append), patch.object(sys, "argv", ["sync", "--pause", "0"]), \
             redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            sync.main()
        self.assertEqual(saved[0]["videos"], archive["videos"])
        self.assertEqual(saved[0]["sources"][0]["status"], "error")
        self.assertEqual(saved[0]["sources"][0]["lastSuccessAt"], "2026-11-17T12:00:00+08:00")


if __name__ == "__main__":
    unittest.main()
