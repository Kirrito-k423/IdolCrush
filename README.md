# IDOLCRUSH

[打开追星主页](https://kirrito-k423.github.io/IdolCrush/) · [张元英](https://kirrito-k423.github.io/IdolCrush/wonyoung/) · [李沅禧](https://kirrito-k423.github.io/IdolCrush/wonhee/) · [MEOVV ANNA](https://kirrito-k423.github.io/IdolCrush/anna/)

首页是一张可以切换人物的演唱会封面。进入艺人目录，可以全屏翻看照片，在放映厅切换视频来源，按月份查公开活动，或按专辑重看打歌舞台。键盘方向键可以翻片，Esc 关闭放映厅，手机可以左右滑动照片。

## 内容维护

| 内容 | 位置 | 维护方式 |
| --- | --- | --- |
| 艺人 | [catalog.js](docs/assets/catalog.js) | 每位艺人有一个独立目录。新增时可复制现有艺人的 `index.html`，修改页面名称、描述和 `data-page`，并在 `artists` 中加入相同的目录名。 |
| 美图 | [photos.js](docs/data/photos.js) | 图片放在 `docs/assets/photos/`。第一张用作封面，第二张用作目录卡片。为每张记录替代文本、裁切焦点、署名、许可、图片处理方式和文件原页。 |
| 视频 | [videos.js](docs/data/videos.js) | 封面放在 `docs/assets/thumbs/`。按打歌舞台、团综、代言和个人节目编目。舞台可按专辑筛选，首选视频设为 `featured: true`。哔哩哔哩合集中记录具体分 P 和 cid。 |
| 行程 | [calendar.js](docs/data/calendar.js) | 活动有公开日期、团体或个人归属、发布方和原文链接。仅在公布具体时间时填写时间和时区。 |

### 公开行程

[日历工作流](.github/workflows/calendar.yml) 计划于北京时间每日 06:22 运行。它从韩国 SBS《人气歌谣》的分集阵容和曲目识别舞台，并读取 IVE、ILLIT 日本官网与日本环球音乐的节目、发行列表。每个来源记录最近成功核对日期和最近尝试日期。读取失败时保留上一份数据，页面「行程来源与核对日期」会展示状态。

演唱会、签售、颁奖典礼等也可根据主办方和节目方公告人工录入。将记录加入 `events`，省略 `feed` 字段，并更新 `curatedAt`。同一公告涉及多位收录艺人时，分别标注归属。页面显示公告所用的当地日期，团体公告以组合名呈现。

照片的来源与许可在全屏查看器中列出。视频保留原发布方及可用的国内播放入口，播放与地区可用性由原平台提供。张元英专页的分类参考了[张元英舞台与综艺索引](https://shaojiemike.top/love/2024/04/14/wonyoung)。

## 本地预览和发布

网站使用原生 HTML、CSS 和 JavaScript。直接打开 [docs/index.html](docs/index.html) 可浏览图文。要测试第三方视频播放，可在项目目录运行本地 HTTP 服务。

```sh
python -m http.server 8000 --directory docs
```

浏览器打开 [本地预览](http://localhost:8000/)。在 GitHub 仓库的 **Settings → Pages → Build and deployment** 选择 **GitHub Actions**。[发布工作流](.github/workflows/pages.yml) 会在 `main` 上站点文件变更或日历刷新成功后发布 `docs/`。三个一级目录均可直接访问和刷新。
