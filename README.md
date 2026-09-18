# DSH Skin: Endfield

以《明日方舟：终末地》(Arknights: Endfield) 平面设计语言为主题的 **DSH Web GUI 皮肤插件**。

> 状态：**Step 1 —— 设计参考资料收集已完成**（本仓库当前只包含设计参考与素材索引，尚未实现插件本体）。

## 这个仓库是什么

一个独立 DSH 插件仓库，目标是把 DSH Web GUI 的视觉层重绘为终末地工业的界面语言：

- 深色画布 `#191919` + 信号黄 `#FFFA00` + 薄荷绿 `#00FFA2` 的点缀体系
- 直角面板、发丝线、角括号框、`//` 标签、等宽数字
- 工业警示语汇：斜线纹理、等高线底纹、CMYK 色标条、扫描/擦除动效

## 目录

```
docs/design-reference/     设计参考资料（本步产物，可直接用于实现阶段）
  README.md                资料总览与使用方式
  01-visual-language.md    风格定位、配色、字体、版式、图形母题、动效
  02-ui-inventory.md       界面清单、组件解剖、信息架构、动效规范、字段映射
  03-design-tokens.json    机器可读设计令牌
  04-reference-sources.md  参考来源总表（含可信度标注）
assets/                    素材索引与获取脚本（大体积素材不入库）
  README.md
  manifest.md              已收集素材清单
scripts/harvest/           可复现的素材抓取脚本
```

## 快速开始（实现阶段）

先读 `docs/design-reference/README.md`，其中「实现落点」一节给出了每个 DSH 界面元素对应的终末地设计原型。

## 授权与合规

终末地是鹰角网络（Hypergryph）的商标与版权作品。本仓库**不附带**任何官方字体文件、游戏内素材或官方图集；`scripts/harvest/` 中的脚本仅用于从公开来源抓取研究用参考资料到本地缓存。字体请使用 `03-design-tokens.json` 中列出的可开源替代栈。
