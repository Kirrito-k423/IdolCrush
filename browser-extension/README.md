# IDOLCRUSH B 站连播扩展

扩展让 IDOLCRUSH 接收 B 站外链播放器的视频结束事件，以便按网页上选择的顺序切换视频。适用于 Windows 和 macOS 上的 Chrome、Edge 桌面浏览器。

## 安装

1. 将扩展文件解压到电脑中的一个固定文件夹，保留 `manifest.json` 与两个 `.js` 文件。
2. Chrome 打开 `chrome://extensions`，Edge 打开 `edge://extensions`。
3. 打开「开发者模式」，选择「加载已解压的扩展程序」，选中包含 `manifest.json` 的文件夹。
4. 刷新 IDOLCRUSH 页面，在视频档案中选择顺序播放或随机播放。

扩展仅在 `kirrito-k423.github.io/IdolCrush/` 页面和它嵌入的 `player.bilibili.com` 播放器上工作。它只转发播放结束事件，不读取或保存 B 站账号、密码或 Cookie。

请在 B 站网站使用自己的账号登录。登录状态由浏览器与 B 站管理。部分浏览器会阻止嵌入页面使用第三方 Cookie，此时可在 B 站原网页观看，或在浏览器设置中允许 B 站使用第三方 Cookie。能否选择 1080P、4K 等画质也取决于原视频和 B 站账号权限。
