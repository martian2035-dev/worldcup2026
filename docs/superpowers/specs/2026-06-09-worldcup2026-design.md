# 2026 世界杯网站 — 设计规范

## 1. 项目概述

构建一个 2026 年美加墨世界杯的静态展示网站，覆盖完整赛程、球队/球员信息、数据统计、直播计划。通过 GitHub Actions 定时抓取赛后数据实现自动更新，部署到 GitHub Pages。

## 2. 技术选型

| 维度 | 选择 | 理由 |
|------|------|------|
| 框架 | Astro + React | 内容型站点首选，零 JS 默认输出，React 岛屿按需加载 |
| 样式 | Tailwind CSS + CSS 变量 | 原子化样式 + 主题变量，球场之夜风格 |
| 数据 | JSON（结构化）+ MDX（内容） | 各取所长 |
| 图表 | Recharts | React 生态最成熟的图表库 |
| 部署 | GitHub Pages + Actions | 免费、简单、CI 原生集成 |
| 包管理 | pnpm | 快速、节省磁盘 |

## 3. 视觉风格：球场之夜

- **背景**：深蓝黑底 `#0a1628` → `#162d50` 渐变
- **主色调**：金色 `#FFD700`（高亮、时间、链接）
- **辅助色**：草绿 `#43A047`（正向数据、出线区）、红色 `#E53935`（负向数据）
- **卡片**：`rgba(255,255,255,0.04-0.08)` 半透明 + `backdrop-filter: blur(8px)` + 1px 细边框
- **字体**：系统字体栈，中文优先 PingFang SC
- **禁用**：蓝紫渐变 ❌

## 4. 页面结构

### 4.1 首页 — 赛事仪表盘（卡片网格布局）

- 顶部导航栏（网站 Logo + 页面入口）
- 开幕倒计时组件
- 今日比赛卡片（2-3 场，显示国旗+时间）
- 12 个小组入口卡片网格（点击进入该组赛程）
- 底部可展开完整赛程

### 4.2 比赛日程 `/schedule`

- 顶部：阶段筛选（全部/小组赛/淘汰赛/决赛）+ 小组筛选 + 月份筛选
- 右上角「+ 添加到日历」按钮（下载 ICS 文件）
- 按日期分组排列比赛卡片：
  - 未开赛：显示开球时间（金色）
  - 进行中：「实时比分」红色闪烁 + 每 30s 自动刷新
  - 已完赛：灰色 + 比分高亮
- 点击卡片展开：阵容、进球事件、基础统计
- 底部「加载更多」

### 4.3 积分榜 & 晋级图 `/standings`

- 小组筛选器（A-L）
- 积分表：场/胜/平/负/进球/失球/净胜球/积分
- 出线区绿色高亮，淘汰区灰色
- 淘汰赛晋级树：横向展开，32 强 → 16 强 → 8 强 → 半决赛 → 决赛
- 已确定的队伍显示国旗+队名，待定为 TBD

### 4.4 球队 & 球员 `/teams`

- 48 队总览页（按小组分组，国旗卡片）
- 球队详情页 `/teams/[slug]`：
  - 英雄区：大国旗 + FIFA 排名 + 世界冠军星标 + 教练
  - Tab：球员名单 / 赛程 / 数据统计 / 球队介绍(MDX)
  - 明星球员区：3-5 人头像卡片 + 关键数据 + 金色边框
  - 完整阵容列表：号码 + 姓名 + 位置
- 球员详情页 `/players/[slug]`：
  - 个人信息 + 赛事数据（进球/助攻/射门/传球/跑动/纪律）
  - 近期比赛表现时间线

### 4.5 数据统计 `/stats`

- 四个主 Tab：球队积分 / 球员数据 / 球队对比 / 比赛详情
- **球队积分 Tab**：全部小组积分榜 + 赛事总览卡片（总进球、场均、纪律、观众）
- **球员数据 Tab**：射手榜（进球/点球/射门/射正率/分钟每球）、助攻榜、跑动距离、纪律榜
- **球队对比 Tab**：双队雷达图（控球/射门/传球/抢断/犯规/角球）+ 场均排名
- **比赛详情 Tab**：单场赛后统计（控球率对比条、射门柱状图、球员评分列表）

### 4.6 直播计划 `/broadcast`

- 比赛列表 + 转播平台标签（央视CCTV5/咪咕/抖音等）
- 按日期筛选
- 底部下载 ICS 日历入口

### 4.7 赛事新闻 `/news`

- MDX 内容页，卡片列表布局
- 标签分类：战报/转会/集锦
- RSS 风格时间线

## 5. 数据层

### 5.1 JSON 结构化数据（GitHub Actions 自动更新）

**`src/data/matches.json`**：
```json
{
  "lastUpdated": "2026-06-15T12:00:00Z",
  "matches": [{
    "id": "A01", "group": "A", "stage": "group", "round": 1,
    "home": { "code": "MEX", "name": "墨西哥", "flag": "🇲🇽" },
    "away": { "code": "RSA", "name": "南非", "flag": "🇿🇦" },
    "datetime": "2026-06-12T03:00:00+08:00",
    "venue": { "name": "阿兹特克球场", "city": "墨西哥城" },
    "status": "finished",
    "score": { "home": 2, "away": 0 },
    "stats": {
      "home": { "possession": 55, "shots": 18, "shotsOnTarget": 7, "corners": 6, "fouls": 12, "yellowCards": 1, "redCards": 0 },
      "away": { "possession": 45, "shots": 8, "shotsOnTarget": 2, "corners": 3, "fouls": 15, "yellowCards": 2, "redCards": 0 }
    }
  }]
}
```

**`src/data/standings.json`**：
```json
{
  "lastUpdated": "2026-06-15T12:00:00Z",
  "tournamentStats": { "totalGoals": 37, "avgGoalsPerMatch": 2.85, "totalYellowCards": 28, "totalRedCards": 3, "totalAttendance": 2400000 },
  "groups": [{
    "name": "A", "teams": [{
      "code": "MEX", "played": 3, "won": 2, "drawn": 1, "lost": 0,
      "gf": 6, "ga": 2, "gd": 4, "pts": 7, "qualified": "round32"
    }]
  }]
}
```

**`src/data/players.json`**：
```json
{
  "lastUpdated": "2026-06-15T12:00:00Z",
  "players": [{
    "id": "vinicius-jr", "name": "维尼修斯", "nameEn": "Vinícius Júnior",
    "team": "BRA", "position": "LW", "number": 7, "isStar": true,
    "stats": { "goals": 5, "penalties": 1, "assists": 2, "shots": 14,
      "shotsOnTarget": 5, "minutesPlayed": 270, "distanceKm": 32.4,
      "yellowCards": 0, "redCards": 0, "matchRatings": [8.2, 7.8, 9.1] }
  }]
}
```

**`src/data/teams.json`**：
```json
{
  "teams": [{
    "code": "BRA", "name": "巴西", "nameEn": "Brazil",
    "flag": "🇧🇷", "group": "C", "fifaRank": 3,
    "worldCups": 5, "coach": "多里瓦尔",
    "colors": { "primary": "#FFD700", "secondary": "#009639" }
  }]
}
```

**`src/data/broadcast.json`**：
```json
{
  "broadcasts": [{
    "matchId": "A01",
    "platforms": [
      { "name": "央视CCTV5", "type": "tv", "url": "https://..." },
      { "name": "咪咕视频", "type": "streaming", "url": "https://..." },
      { "name": "抖音", "type": "social", "url": "https://..." }
    ]
  }]
}
```

### 5.2 MDX 内容（手动/半自动维护）

- `src/content/teams/brazil.mdx` — 球队历史、战术风格分析
- `src/content/news/opening-ceremony.mdx` — 赛事新闻

## 6. 组件架构

### Astro 页面（路由 + 数据加载）
```
src/pages/
├── index.astro              # 首页
├── schedule.astro           # 比赛日程
├── standings.astro          # 积分榜 & 晋级图
├── stats.astro              # 数据统计
├── broadcast.astro          # 直播计划
├── teams/index.astro        # 球队总览
├── teams/[slug].astro       # 球队详情
├── players/[slug].astro     # 球员详情
├── news/index.astro         # 新闻列表
└── news/[slug].astro        # 新闻详情
```

### React 交互组件（客户端岛屿）
```
src/components/
├── MatchCard.tsx             # 比赛卡片（可展开）
├── MatchDetail.tsx           # 比赛展开详情（阵容+统计）
├── LiveScore.tsx             # 实时比分（自动刷新）
├── CountdownTimer.tsx        # 倒计时
├── GroupTable.tsx            # 小组积分表
├── BracketTree.tsx           # 淘汰赛晋级树
├── TopScorers.tsx            # 射手榜
├── PlayerStatsCard.tsx       # 球员数据卡片
├── TeamComparison.tsx        # 球队对比雷达图
├── MatchStatsBar.tsx         # 单场统计对比条
├── BroadcastList.tsx         # 转播平台列表
└── CalendarDownload.tsx      # ICS 下载按钮
```

## 7. 数据更新与部署流程

### GitHub Actions 工作流

```yaml
触发条件：
  1. schedule: 每 2 小时（比赛日 6/12-7/19）/ 每 6 小时（非比赛日）
  2. workflow_dispatch: 手动触发（比赛结束后）

Job: fetch-and-deploy
  steps:
    1. checkout 仓库
    2. 设置 Node.js 22
    3. pnpm install
    4. 运行 pnpm run fetch-data（抓取脚本）
    5. git diff --quiet 检查数据变更
    6. 有变更 → git commit + push → 触发构建部署
    7. 无变更 → 跳过
```

### 数据抓取脚本 `scripts/fetch-data.ts`

- 赛后抓取目标网站（FIFA 官网 / ESPN / SofaScore）
- 更新 `src/data/` 下的 JSON 文件
- 保留 `lastUpdated` 时间戳
- 未开始的比赛不更新 score/stats 字段

### Astro 构建与部署

```yaml
Job: build-and-deploy
  trigger: push to main（数据更新后）
  steps:
    1. pnpm install
    2. pnpm run build（Astro SSG）
    3. 部署到 GitHub Pages（peaceiris/actions-gh-pages）
```

## 8. 非功能需求

- **性能**：Lighthouse 评分 90+，首屏 < 2s
- **响应式**：移动端优先，断点 sm(640) / md(768) / lg(1024) / xl(1280)
- **无障碍**：语义化 HTML、图片 alt、键盘导航
- **SEO**：每页独立 title/description、Open Graph 标签
- **国际化**：全中文界面，球员/球队保留英文名

## 9. 项目文件结构

```
WorldCup-2026/
├── public/
│   ├── favicon.svg
│   └── WorldCup-2026.ics         # 可下载日历
├── src/
│   ├── components/               # React 交互组件
│   ├── content/                  # MDX 内容
│   │   ├── config.ts
│   │   ├── teams/
│   │   └── news/
│   ├── data/                     # JSON 数据（自动更新）
│   │   ├── matches.json
│   │   ├── standings.json
│   │   ├── players.json
│   │   ├── teams.json
│   │   └── broadcast.json
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── pages/                    # 路由页面
│   └── styles/
│       └── global.css
├── scripts/
│   └── fetch-data.ts             # 数据抓取
├── .github/workflows/
│   └── deploy.yml
├── astro.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 10. 开发阶段

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| P0 | 项目脚手架 + 主题系统 + 首页 | 最高 |
| P1 | 比赛日程 + 积分榜 + 数据模型 | 高 |
| P2 | 球队&球员页面 | 高 |
| P3 | 数据统计&可视化 | 中 |
| P4 | 直播计划 + 新闻 + ICS 下载 | 中 |
| P5 | GitHub Actions 自动抓取 + 部署 | 低（赛前完成即可） |
