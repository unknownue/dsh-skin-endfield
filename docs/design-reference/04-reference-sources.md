# 04 · 参考来源总表

> 本文件记录每一类资料的来源、抓取方式、落地位置与可信度。**用途**：实现阶段需要复核某个数值时，从这里回到源头。

## 1. 一手官方来源（最高可信度）

| 来源 | URL | 抓到了什么 | 落地位置 |
|------|-----|-----------|---------|
| **官方中文站** | https://endfield.hypergryph.com/ | 10 个 CSS bundle（400,919 字符）→ 全部色值频次、`@font-face` 字体表、字距/圆角/边框/渐变规则、keyframes、类名体系 | `raw/css/`、`01-visual-language.md` |
| **官方国际站** | https://endfield.gryphline.com/en-us | 与中文站同构，交叉验证色值与字体一致；**页面内嵌 10 个官方 YouTube 视频 id** | `raw/rendered/`、`logs/youtube-official.json` |
| **官方繁中站** | https://endfield.gryphline.com/zh-tw | 同构验证 | `raw/tw.html` |
| **官方素材 CDN** | https://web-static.hg-cdn.com/endfield/official-v4/ | **165 个 CSS 引用素材**（技术框 SVG、等高线 PNG、色标条、四角装饰、按钮贴图、图标、角色立绘）+ **33 个字体文件** | `raw/cssimg/`、`raw/fonts/` |
| **官网公告 API** | `web-news.hypergryph.com/api/bulletin?lang=zh-cn&code=endfield_web&page=N&pageSize=50` | **97 条公告**元数据 + 75 张预览横幅；`&cid=<id>` 取单条详情；用于提取标签法（`▼` `//` `■` `「」` `【】`） | `logs/bulletins.json`、`raw/covers/` |
| **Over the Frontier 画廊** | https://endfield.gryphline.com/special/over-the-frontier | 官方图集页（166 件作品，4 主题分页）的版式语言：角括号、竖排 `/// OVER THE FRONTIER`、计数器 `02 / 56` | `shots/04-*.png` |
| **官方 Steam 商店页** | https://store.steampowered.com/app/4732690/Arknights_Endfield/ | `api/appdetails` 返回 10 张 1920×1080 官方截图（**经目视确认：全部为实机渲染画面，无 UI**）+ 2 个预告片条目 | `raw/steam/` |
| **官方 B 站账号** | https://space.bilibili.com/1265652806/ | 通过 `api.bilibili.com/x/web-interface/view?bvid=` 取到官方视频的标题/时长/封面/播放量 | `logs/bili-priority.json` |
| **官方 YouTube 频道** | https://www.youtube.com/channel/UCowPaVRBzg8CE6K4CB6LJfw | 10 个官方 PV / Operator Story 的标题与封面（oEmbed 接口） | `logs/youtube-official.json` |

### 官方站 MP4 直链（官网 HTML 内嵌，可直接下载）

10 个 MP4（`web-static.hg-cdn.com/upload/video/<日期>/<hash>.mp4`），文件列表见 `assets/manifest.md`。

## 2. 官方文案（用于标签法与命名）

| 来源 | 抓到了什么 |
|------|-----------|
| 官网首页正文 | `▼//`、`// 公告`、`010 / 010`、`NEXT 02 / 010`、`1 / 6`、DIJIANG 档案 |
| 97 条公告 | `「」` 134 次、`【】` 73 次、`▼` 42 次、`//` 42 次、`■`、`※`、`•` 的实际用法 |
| 官网研发通讯（如 en-us/news/3846） | 官方对 UI 改动的措辞（小地图、滑索样式区分等） |

## 3. 社区分析（中高可信度，用于风格定性）

| 来源 | 贡献 |
|------|------|
| [Bilibili《浅谈终末地的设计-vol.01 色彩运用》](https://www.bilibili.com/opus/1012354732615794692) | **黄黑白工业配色逻辑**、卡特彼勒 CAT 先例与"卡特黄"专利史、CMYK 色标（色标条）的由来、黄色=警示/视觉引导 |
| [GameRes《新时代二游的审美诠释？分析终末地的自然内敛之美》](https://www.gameres.com/916280.html) | 低饱和 / 冷调 / 灰度、去装饰化、"返璞归真"的材质处理 |
| [观察者网风闻：试玩体验与工业设计语言](https://user.guancha.cn/main/content?id=1367572) | 工业风 UI/UX、画内界面（HUD 插入国风地图）、过渡动画与镜头配合 |
| [腾讯游戏学堂《明日方舟 UI/UX 分析》](http://gameinstitute.qq.com/article/10027) | 层级对比度极高、背景模糊突出交互焦点（对象为方舟本体） |
| [indienova《方舟 UI/UX 设计》](https://indienova.com/indie-game-development/arknights-ui-ux-design/) | diegetic interface 方法论；《全境封锁》《死亡空间》参照 |
| [知乎《从 ta 的视角看 UI #1》](https://zhuanlan.zhihu.com/p/570566718) | 黑白灰底 + 亮色突出信息点、机能风设计（对象为方舟本体） |
| [站酷《「明日方舟」里的美学》](https://m.zcool.com.cn/article/ZMTQyNDAyOA==.html) | 磁带盒未来主义、HUD、《西部世界》等高线、机能风 / ACRONYM、三角符号化 |
| [NGA《终末地的风格化设计》](https://bbs.nga.cn/read.php?tid=47127278) | "一眼能看出终味" —— 风格识别度的社区共识（含周边） |
| [Bilibili 视频 BV1HDCpYJEHQ](https://www.bilibili.com/video/BV1HDCpYJEHQ/) | 设计分析（47 万播放） |
| [Bilibili 视频 BV1zK6gB8E2E](https://www.bilibili.com/video/BV1zK6gB8E2E/) | 平面设计师视角的排版分析（11 万播放） |
| [Bilibili 视频 BV1Hw411x7pH](https://www.bilibili.com/video/BV1Hw411x7pH/) | UI/UX 设计展示，直接点出**等高线**母题 |

## 4. 玩法 / 界面文字资料（用于界面清单）

| 来源 | 贡献 |
|------|------|
| [游民星空 新手基础游玩指南](https://www.gamersky.com/handbook/202601/2079685_3.shtml) | **HUD 逐角解剖**（四角分区、三段式技力条、终结技能量条） |
| [wiki.gg User Interface](https://endfield.wiki.gg/wiki/User_Interface) / [Settings Menu](https://endfield.wiki.gg/wiki/Settings_Menu) / [Baker](https://endfield.wiki.gg/wiki/Baker) | AIC 双模式与俯瞰、设置三段结构、Baker 通讯网络定位 |
| [game8 键位表](https://game8.co/games/Arknights-Endfield/archives/538343) | Esc/Tab/CapsLock/F1–F12 热键体系 |
| [灰机 wiki 集成工业系统](https://endfield.huijiwiki.com/wiki/%E9%9B%86%E6%88%90%E5%B7%A5%E4%B8%9A%E7%B3%BB%E7%BB%9F) | 协议核心 PAC、集成核心区域 |
| [17173 界面 UI 设计赏析](https://news.17173.com/z/arknights2026/content/01112026/195613273.shtml) | 标签页/筛选器/对比视图、三角符号（**注意：疑含 AI 生成成分，仅作线索**） |

## 5. 视频参考（详见 `assets/manifest.md` 的视频清单）

| 类别 | 代表 | 价值 |
|------|------|------|
| 官方系统全景片 | [BV1zHkkB4ESQ 玩法前瞻「前进与开拓」](https://www.bilibili.com/video/BV1zHkkB4ESQ/) 10:42、1206 万播放 | 一次覆盖绝大多数界面形态 |
| 官方实机长录 | [BV1qSJ9z7EMY 序章全流程演示](https://www.bilibili.com/video/BV1qSJ9z7EMY/) 14:50 | 真实交互节奏与转场 |
| UI 专项 | [BV16zwne9Eod 整体 UI 展示+卡池展示](https://www.bilibili.com/video/BV16zwne9Eod/) 10:17 | 界面切换最密集 |
| 纯 UI 录屏 | [YouTube PcG2xHzBYfc「UIを見る」](https://www.youtube.com/watch?v=PcG2xHzBYfc) | 无解说，抽帧效率最高 |
| 菜单 IA | [YouTube 1m4WvuXY3Bg](https://www.youtube.com/watch?v=1m4WvuXY3Bg) | 菜单信息架构逐项讲解 |
| 角色菜单动效 | [YouTube U_uRTrbBU5A](https://www.youtube.com/watch?v=U_uRTrbBU5A) | 过渡曲线参考 |
| **实现手法教学** | [BV1QHwYzPE1o](https://www.bilibili.com/video/BV1QHwYzPE1o/)（UI 元素）、[BV1S2zcB7EVL](https://www.bilibili.com/video/BV1S2zcB7EVL/)（扫描特效）、[BV1xMzgBKECZ](https://www.bilibili.com/video/BV1xMzgBKECZ/)（激光打印特效） | **直接教怎么做出官网那几种特效** |
| 登录界面 | [BV1vewge7E7g](https://www.bilibili.com/video/BV1vewge7E7g/) | 逐帧登录页 |
| 无 UI 场景（可作底图） | [BV19yNZedET4](https://www.bilibili.com/video/BV19yNZedET4/) | 21:9 纯净场景 |
| 同源设计语言 | [BV1WFkwBJEhR 明日方舟「众生行记」UI/交互/动效记录](https://www.bilibili.com/video/BV1WFkwBJEhR/) | 鹰角 UI 动效规范的另一实例 |

## 6. 明确否定的来源（不要在这上面浪费时间）

| 来源 | 结论 |
|------|------|
| Game UI Database | **未收录终末地**（`?id=478` 是《明日方舟》）；站点有反爬（403 + JS 渲染） |
| IGDB Press Kit | 全为空壳（Videos / Images / Key art / Logos / Artwork 均空） |
| 游民星空图库 | 空图库（0 张） |
| Steam `appid=3575040` | 是别的东西（"Life Core"）；终末地正确 appid 为 **4732690** |
| 官方 press kit / fan kit / 素材包 | **不存在**。社区共识：只能自己截帧裁剪 |
| BV1B5mAB4E6D | 标称官方特别映像，正文含"同好群"，**疑为第三方搬运，不可作官方素材引用** |

## 7. 抓取方法备注（可复现）

- 本机为 **Windows 本地会话**：`bash` 工具不可用（远端 Linux 专用），全部抓取用 `pwsh` + `Invoke-WebRequest` / `curl.exe` / headless Chrome。
- 官方站是 Next.js SPA：列表数据不在 HTML 里。**用 Chrome DevTools Protocol 抓 XHR** 才找到公告 API（脚本：`scripts/harvest/cdp-fetch.mjs`）。
- 官网 HTML 里内嵌了视频直链与 YouTube 视频 id，**优先从官网 HTML 取视频，而不是靠搜索**。
- Bilibili 搜索 API 需 wbi 签名（返回 0 结果）；但 `view?bvid=` 元数据接口可用（带 `Referer`）。**用 web 检索得到 BV 号，再用 API 取元数据与封面**是最省事的路径。
- Bilibili 视频流下载易被 412 风控；本次以 **API 封面 + web 端页面**为主，视频流下载成功率不稳定。
- 33 个字体文件的体积都很小（8–84 KB），说明是**子集化产物**（`Gilroy-Medium.woff2` 仅 8 KB），不要把它们当作完整字体使用。
