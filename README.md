# 五笔字根图解（98 版）

98 版五笔学习站：输入汉字、词语或五笔编码，田字格按字根分色高亮，并自动讲解取码规则（键名字、成字字根、末笔字型识别码、简码、词组规则）。

## 来源与致谢

本项目源自 **[sdcb/wubi86-viewer](https://github.com/sdcb/wubi86-viewer)** —— 86 版五笔学习站（作者 [sdcb](https://github.com/sdcb)，演示站 <https://wubi.sdcb.ai>）。界面、数据管线以及“字根—笔画”自动对齐的算法均由上游项目提供，本项目在其基础上改用 98 版五笔码表重建。

**特别感谢原作者 sdcb。** 田字格按字根分色的交互、从少量人工分段中学习字根笔画序列、回溯求解拆字、近似降级、按笔画中线推断笔画类型（kNN）等设计都来自上游项目，这些工作构成了本项目的地基。如果你只需要 86 版，请直接使用与支持上游仓库。

## 与上游的差异

|  | wubi86-viewer（上游） | 本项目 |
| --- | --- | --- |
| 码表 | 微软五笔 86 词库（`ChsWubiNew.lex`） | 98 五笔基础码表（[yanhuacuo/98wubi-tables](https://github.com/yanhuacuo/98wubi-tables)） |
| 字根字形 | `黑体字根.ttf` | `98wb.otf` |
| 词库 | `ms-wubi.tsv` | `wubi98-lex.tsv`（词条 + 权重，候选顺序与码表一致） |
| 数据生成 | `extract-ms-lex` → `build-data` | `gen-98`（由原始 98 表生成码表）→ `build-data` |
| 识别码 | 直接读取 86 表的末笔字型标注 | 98 表以“占位字形”追加识别码；标注缺失时按末笔 + 键位反推区位 |
| 整字单根配色 | 整字染首个色槽 | 键名字 / 成字字根 / 单笔画用中性墨色，悬停部件时才上色 |

## 功能

- 汉字 / 词语 → 98 五笔的全部编码（含简码），候选顺序与词库一致
- 句子 / 未收录词组 → 推荐打法：按词库权重动态规划切分，给出免选重的推荐打法，以及允许数字选重、更省键的优化打法
- 编码 → 汉字 / 词语（支持前缀“继续输入”，第 3、4 位可用 Z 万能键）
- 田字格字根高亮：悬停字根芯片即高亮对应笔画，支持拆解演示与笔顺演示
- 识别码讲解：末笔类型 + 字型 → 区位 → 键位
- 字根键盘表（含 98 版助记词）与取码规则速记
- 查询记录保存在 localStorage：易忘标记、删除、清空、导入导出、复习卡片

数据规模：收录 99,753 字、110,519 条编码、61,344 个词条；99,751 字有字根拆解，9,574 字有笔画矢量（其中 5,215 字为精确分段，3,781 字为近似分段）。

## 数据

| 文件 | 说明 / 来源 |
| --- | --- |
| `data-src/src-wubi98-unicode.txt` | 98 五笔全字集拆分（UTF-16LE），来自 yanhuacuo/98wubi-tables |
| `data-src/src-wubi98-phrase.txt` | 98 五笔词库（UTF-16LE），同上 |
| `data-src/src-wubi98-gb.txt` | GB 两万字集拆分，同上 |
| `data-src/data-wubi-v98.tsv` | 由 `npm run gen` 生成：字根序列、全码、末笔字型标注、人工分段 |
| `data-src/wubi98-lex.tsv` | 由 `npm run gen` 生成：词条 / 编码 / 权重 |
| `data-src/data-chars.tsv` | 字符元数据：拼音、IDS、部首、笔画序、字频，随上游项目提供 |
| `data-src/hanzi-writer-data/` | 笔画矢量，源自 [Make Me a Hanzi](https://github.com/skishore/makemeahanzi)（Arphic Public License） |
| `data-src/98wb.otf` | 98 版字根字形；同时用于识别码占位字形的识别 |
| `scripts/root-names.json` | 非成字字根的中文名称（如“青字头”） |

86 版数据（`ms-wubi.tsv`、`data-wubi-v86.tsv`、`黑体字根.ttf`）不在本仓库。

## 字根与笔画的自动对齐

`scripts/lib/roots.mjs` 先从人工分段中学习每个字根的笔画序列，再对其余字做回溯搜索（允许包围结构拆成两段、允许超过四个字根时中间不取码的笔画）；失败时依次尝试：字根变形（如“延”中的“止”）、书写顺序交错的任意序搜索（如“兆”“非”）、编辑距离近似匹配。近似结果会在页面上提示“自动推断”。

98 版有三处特有处理：

1. **识别码占位字形**：98 码表在需要末笔字型识别码的字后面追加一个字根单元，该单元的字形是码表缩略图。`scripts/gen-98.mjs` 依据这些字形在 `98wb.otf` 中共享同一包围盒的特征把它们识别出来。
2. **两段式求解**：`segmentChar` 先按“字带有末笔字型标注才剔除末位占位单元”求解；失败后再尝试剔除“从未学到任何笔画序列”的末位单元，并同步修正字根列表与识别码。这样原本会整字变灰的高频字（天、有、主、区……）恢复了笔画分色。
3. **识别码反推**：标注缺失时，末笔类型给出区号、识别码键位给出位号，两者区号一致才采信（如“天”→ 43 → I）。

## 开发

```bash
npm install
npm run data     # gen-98 → build-data，生成 public/data（约 7,200 个 JSON 分片）
npm run dev      # 本地开发
npm run build    # tsc -b && vite build，产物在 dist/
npm run lint     # oxlint
```

单独步骤：`npm run gen` 只重建 98 码表；`node scripts/build-data.mjs` 只重建分片。

`npm run extract` 是上游遗留的微软五笔词库导出脚本，98 版不需要。

## 部署

纯静态站点，`dist/` 可直接部署到任意静态服务器：

- nginx 需要 SPA 回退（`try_files $uri $uri/ /index.html`），并确保 `data/` 下的文件以 `application/json` 返回
- `public/data` 是生成产物、不入库，所以 CI 或部署前必须先执行 `npm run data`
- `.github/workflows/deploy.yml` 给出了 Cloudflare Pages 的完整示例（推送到 `main` 时自动生成数据、构建并发布，需要 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_PAGES_PROJECT` 三个 secret）；若托管在 Gitee 且使用 `master` 分支，请相应修改该工作流的分支名或改用其它 CI

## 第三方数据与致谢

- **98 五笔码表与词库**：[yanhuacuo/98wubi-tables](https://github.com/yanhuacuo/98wubi-tables)（98五笔小组），本项目的数据基础
- **笔画矢量**：[Make Me a Hanzi](https://github.com/skishore/makemeahanzi)（Arphic Public License）
- **上游项目**：[sdcb/wubi86-viewer](https://github.com/sdcb/wubi86-viewer) 与 [sdcb/search-wubi](https://github.com/sdcb/search-wubi)
- **字根字体**：98 版字根字形随 98 五笔资源配套提供

## 许可

本项目源代码以 [GNU AGPL-3.0](LICENSE) 许可开源，衍生自同样采用 AGPL-3.0 的上游项目 [sdcb/wubi86-viewer](https://github.com/sdcb/wubi86-viewer)，原作者的版权与许可声明一并保留。

`data-src/` 中的第三方数据各自遵循其原始许可（见上文）。
