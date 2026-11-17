# IDOLCRUSH

[打开追星主页](https://kirrito-k423.github.io/IdolCrush/) · [张元英](https://kirrito-k423.github.io/IdolCrush/wonyoung/) · [李沅禧](https://kirrito-k423.github.io/IdolCrush/wonhee/) · [MEOVV ANNA](https://kirrito-k423.github.io/IdolCrush/anna/)

首页是一张可以切换人物的写真封面。每位艺人有三个可直接收藏的子页，例如李沅禧的[高清画廊](https://kirrito-k423.github.io/IdolCrush/wonhee/gallery/)、[行程日历](https://kirrito-k423.github.io/IdolCrush/wonhee/calendar/)和[视频档案](https://kirrito-k423.github.io/IdolCrush/wonhee/videos/)。旧版艺人链接中的 `#gallery`、`#calendar`、`#archive` 会自动前往对应页面。

画廊使用品牌、唱片公司和时尚刊物发布的高分辨率摄影，展示实际像素与来源。进入放映厅后可切换适屏与原寸，方向键翻片，Esc 关闭，手机可左右滑动。

日历默认展示一个自然年。选择起始月份，或点击「从本月起」，可连续浏览跨年的十二个月。不同活动各有颜色和形状，回归与巡演以跨日色带表示。点击日期、月份或区间可看明细和公告。视频可从新到旧或从旧到新排序，并按类型、专辑、年份或已公布的回归与巡演区间筛选。也可搜索标题、选择来源账号、按 CP 对筛选或分组。筛选结果可通过地址栏链接分享。

## 内容维护

| 内容 | 位置 | 维护方式 |
| --- | --- | --- |
| 艺人 | [artists.js](docs/data/artists.js) | 为新艺人添加资料及同名照片目录文件后，运行 `node scripts/build_pages.mjs` 生成入口与三个子页。 |
| 美图 | [分艺人图目](docs/data/photos) | 原图长边至少 3840、短边至少 2160 像素。记录实际宽高、独立预览的尺寸、署名、版权和来源。第一张用作封面，第二张用作目录卡片。本地原图使用 `file`，由发布方托管的原图使用 `originalUrl`。 |
| 视频 | [videos.js](docs/data/videos.js) | 封面放在 `docs/assets/thumbs/`。按打歌舞台、团综、代言和个人节目编目。舞台可按专辑筛选，首选视频设为 `featured: true`。哔哩哔哩合集中记录具体分 P 和 cid。 |
| B 站更新 | [bilibili.js](docs/data/bilibili.js) | 存储关注账号的公开视频、来源、每个接口的最近核对时间以及历史回填进度。自动识别的分类与人物可在视频页筛选。 |
| 行程 | [calendar.js](docs/data/calendar.js) | 活动有公开日期、团体或个人归属、发布方和原文链接。仅在公布具体时间时填写时间和时区。 |
| 时段 | [periods.js](docs/data/periods.js) | 按艺人记录出道、回归宣传和已公告巡演场次的起止依据。每段包含稳定 ID、类型、名称、首末日、范围说明与出处。日历色带和视频的时间筛选共用此记录。 |

### 公开行程

[日历工作流](.github/workflows/calendar.yml) 计划于北京时间每日 06:22 运行。它从韩国 SBS《人气歌谣》的分集阵容和曲目识别舞台，并读取 IVE、ILLIT 日本官网与日本环球音乐的节目、发行列表。每个来源记录最近成功核对日期和最近尝试日期。读取失败时保留上一份数据，页面「行程来源与核对日期」会展示状态。

演唱会、签售、颁奖典礼等也可根据主办方和节目方公告人工录入。将记录加入 `events`，省略 `feed` 字段，并更新 `curatedAt`。同一公告涉及多位收录艺人时，分别标注归属。页面显示公告所用的当地日期，团体公告以组合名呈现。

时段按已核实的活动端点人工编目。巡演用公告首末场标记一段时间，单日列表展示实际收录的公开活动。视频按播出或上线日期匹配区间，同期的采访、广告仍保留自己的节目分类。

照片的原文及权利人信息在全屏查看器中列出。视频保留原发布方及可用的国内播放入口，播放与地区可用性由原平台提供。张元英专页的分类参考了[张元英舞台与综艺索引](https://shaojiemike.top/love/2024/04/14/wonyoung)。

### B 站账号更新

[账号更新页](https://kirrito-k423.github.io/IdolCrush/updates/) 汇集五个指定账号的公开视频和动态转发。视频保留原作者与 BV 号，相同视频跨账号只收录一次。标题明确提到的艺人会出现在对应视频页。团体内容按组合归入成员，人工核验的视频保留单独的分 P 和 cid。账号更新页按投稿日期排序，艺人页优先使用标题中符合日期格式的活动日期，并同时显示投稿日期。

[更新工作流](.github/workflows/bilibili.yml) 计划在北京时间每天 07:15 检查新视频，并分批回填历史投稿。B 站风控或网络故障时保留已收录的数据，账号更新页展示各来源的核对状态。视频类型与 CP 配对根据公开标题识别，自动分类可能需要人工调整。源脚本无额外 Python 包依赖，可运行 `python scripts/update_bilibili.py` 手动刷新，也可以在 Actions 中手动触发工作流。

## 本地预览和发布

网站使用原生 HTML、CSS 和 JavaScript。直接打开 [docs/index.html](docs/index.html) 可浏览图文。要测试第三方视频播放，可在项目目录运行本地 HTTP 服务。

```sh
python -m http.server 8000 --directory docs
```

浏览器打开 [本地预览](http://localhost:8000/)。在 GitHub 仓库的 **Settings → Pages → Build and deployment** 选择 **GitHub Actions**。[发布工作流](.github/workflows/pages.yml) 会在 `main` 上站点文件变更或日历刷新成功后发布 `docs/`。三个一级目录均可直接访问和刷新。
