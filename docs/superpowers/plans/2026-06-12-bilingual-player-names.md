# 球员姓名中英双语化 & 去重 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一球员姓名、位置为中英双语格式（英文在前），以英文名为匹配主键消除因语言不同导致的重复统计，所有数据以 FIFA API 为准。

**Architecture:** 核心改动分四层 — (1) FIFA API 层：同时以 en/zh 两种语言调用，合并双语球员名；(2) 合并去重层：在 mergePlayers 中增加 nameEn 归一化二级匹配，清理生成球员中的重复项；(3) 展示层：球队页/球员页/比赛详情页/统计页统一显示双语；(4) 数据清理层：一次性扫描并移除 players.json 中的重复条目。

**Tech Stack:** TypeScript (scripts), JavaScript (core libs), Astro (.astro pages), React/TSX (MatchCard component)

---

## File Structure

| 文件 | 角色 | 改动类型 |
|------|------|----------|
| `scripts/fifa-client.ts` | FIFA API 客户端 | 修改：新增 en 获取、修复 Locale、导出合并函数 |
| `scripts/update-squads.ts` | 大名单更新/合并逻辑 | 修改：双语姓名、nameEn 二级匹配、去重函数 |
| `scripts/player-stats-core.js` | 球员统计更新核心 | 修改：Locale 修复、bilingual 名字、nameEn 回退 |
| `scripts/match-details-core.js` | 比赛详情（阵型）核心 | 修改：Locale 修复、bilingual 名字 |
| `scripts/fetch-data.ts` | 数据抓取主入口 | 修改：增加清理步骤 |
| `src/pages/teams/[slug].astro` | 球队详情页 | 修改：位置标签双语、球员名已存为双语 |
| `src/pages/players/[slug].astro` | 球员详情页 | 修改：位置标签双语、球员名已存为双语 |
| `src/pages/stats.astro` | 数据统计页 | 修改：球员名、位置双语显示 |
| `src/components/MatchCard.tsx` | 比赛卡片（含阵型面板） | 修改：阵型球员名双语 |
| `tests/player-stats-core.test.js` | 球员统计核心测试 | 检查：确保测试覆盖新增逻辑 |

---

### Task 1: 修复 FIFA API 客户端 —— 双语获取 + Locale 修复

**Files:**
- Modify: `scripts/fifa-client.ts`

- [ ] **Step 1: 新增英文版球员获取函数**

在文件末尾（`checkApiHealth` 之后）添加：

```typescript
/**
 * 获取所有球员大名单（英文版，用于 nameEn 主键匹配）
 * 端点: GET /players?language=en&idseason={seasonId}
 */
export async function fetchAllPlayersEn(): Promise<FifaPlayerRaw[] | null> {
  console.log("📡 从 FIFA API 获取全部球员数据 (EN)...");
  const data = await fifaFetch<{ Results: FifaPlayerRaw[] }>(
    "/players",
    { idseason: WORLD_CUP_2026_SEASON_ID, count: "1500" },
    "en"
  );
  if (!data?.Results?.length) return null;
  console.log(`  ✅ 获取到 ${data.Results.length} 名球员 (EN)`);
  return data.Results;
}
```

- [ ] **Step 2: 修改 fifaFetch 支持指定语言参数**

将 `fifaFetch` 函数签名和实现改为：

```typescript
async function fifaFetch<T>(
  endpoint: string,
  params: Record<string, string> = {},
  language: string = "zh"
): Promise<T | null> {
  if (!WORLD_CUP_2026_SEASON_ID) {
    console.warn(`  ⚠ FIFA_SEASON_ID 未配置，跳过 API 请求`);
    return null;
  }

  const url = new URL(`${FIFA_BASE_URL}${endpoint}`);
  url.searchParams.set("language", language);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  // ... 其余不变
```

- [ ] **Step 3: 新增中英文球员合并工具函数**

在文件末尾添加：

```typescript
/**
 * 将英文版和中文版球员数据按 IdPlayer 合并为双语格式
 * @returns 合并后的球员数组，name 为 "EnglishName / 中文名" 格式
 */
export function mergeBilingualPlayers(
  enPlayers: FifaPlayerRaw[],
  zhPlayers: FifaPlayerRaw[]
): FifaPlayerRaw[] {
  const zhIndex = new Map<string, FifaPlayerRaw>();
  for (const p of zhPlayers) {
    zhIndex.set(p.IdPlayer, p);
  }

  return enPlayers.map((enP) => {
    const zhP = zhIndex.get(enP.IdPlayer);
    if (!zhP) return enP; // 无中文对应，保留英文

    // 合并 PlayerName：英文描述在前，中文补充
    const enNameDesc = enP.PlayerName?.find(
      (n) => n.Locale === "en" || n.Locale === "en-GB"
    )?.Description || enP.PlayerName?.[0]?.Description || "";
    const zhNameDesc = zhP.PlayerName?.find(
      (n) => n.Locale === "zh" || n.Locale === "zh-CN"
    )?.Description || zhP.PlayerName?.[0]?.Description || "";

    // 构建双语名：EnglishName / 中文名
    const bilingualName = zhNameDesc && zhNameDesc !== enNameDesc
      ? `${enNameDesc} / ${zhNameDesc}`
      : enNameDesc;

    return {
      ...enP,
      PlayerName: [
        { Locale: "en-GB", Description: enNameDesc },
        { Locale: "zh-CN", Description: zhNameDesc },
        { Locale: "bilingual", Description: bilingualName },
      ],
      // 保留英文的 ClubName 等基础字段
      ClubName: enP.ClubName || zhP.ClubName,
      ClubLogoUrl: enP.ClubLogoUrl || zhP.ClubLogoUrl,
    };
  });
}
```

- [ ] **Step 4: 导出统一的 getLocalizedText 工具函数**

在文件末尾添加（供其他模块复用）：

```typescript
/**
 * 从 FIFA API 多语言字段中提取文本
 * 优先顺序：bilingual > zh-CN > zh > en-GB > en > 第一个
 */
export function getLocalizedText(
  value: Array<{ Description: string; Locale: string }> | string | undefined
): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";

  const priority = ["bilingual", "zh-CN", "zh", "en-GB", "en"];
  for (const locale of priority) {
    const found = value.find((item) => item.Locale === locale);
    if (found?.Description) return found.Description;
  }
  return value[0]?.Description || "";
}
```

- [ ] **Step 5: Commit**

```bash
git add scripts/fifa-client.ts
git commit -m "feat: add bilingual player fetching and Locale-aware text extraction to FIFA client"
```

---

### Task 2: 修复大名单更新逻辑 —— 双语姓名 + nameEn 去重

**Files:**
- Modify: `scripts/update-squads.ts`

- [ ] **Step 1: 使用统一的 getLocalizedText**

在文件顶部 import 区域，从 `./fifa-client` 中导入 `getLocalizedText`：

```typescript
import {
  fetchAllPlayers,
  fetchTeamSquad,
  fetchTeams,
  isApiConfigured,
  getLocalizedText,
  type FifaPlayerRaw,
  type FifaTeamRaw,
} from "./fifa-client";
```

- [ ] **Step 2: 修改 convertFifaPlayer 输出双语 name**

替换 `convertFifaPlayer` 函数中的名字处理逻辑（行 97-104）：

```typescript
function convertFifaPlayer(raw: FifaPlayerRaw, teamCode: string): PlayerRecord {
  // 从合并后的双语数据中提取
  const bilingualName = raw.PlayerName?.find((n) => n.Locale === "bilingual")?.Description
    || "";
  const nameEn = raw.PlayerName?.find((n) => n.Locale === "en-GB" || n.Locale === "en")?.Description
    || raw.PlayerName?.[0]?.Description
    || "";
  const nameZn = raw.PlayerName?.find((n) => n.Locale === "zh-CN" || n.Locale === "zh")?.Description
    || "";

  const displayName = bilingualName || (nameZn && nameZn !== nameEn
    ? `${nameEn} / ${nameZn}`
    : nameEn);

  const nationality = raw.Nationality?.[0]?.Description || "";

  return {
    id: raw.IdPlayer || `${teamCode.toLowerCase()}-${raw.ShirtNumber}`,
    name: displayName,
    nameEn: nameEn,
    team: teamCode,
    position: normalizePosition(raw.Position || "CM"),
    // ... 其余字段保持不变
  };
}
```

- [ ] **Step 3: 在 mergePlayers 中增加 nameEn 二级匹配**

替换 `mergePlayers` 函数（行 240-293）。关键改动：

```typescript
function mergePlayers(
  existing: PlayerRecord[],
  incoming: PlayerRecord[]
): { players: PlayerRecord[]; total: number; new: number; updated: number; removed: number } {
  const existingMap = new Map(existing.map((p) => [p.id, p]));
  // 二级索引：归一化 nameEn → PlayerRecord（仅对 FIFA 来源的现有球员）
  const nameEnIndex = new Map<string, PlayerRecord>();
  for (const p of existing) {
    const key = normalizeNameEn(p.nameEn);
    if (key && p.dataSource === "generated") {
      // 只索引 generated 球员，用于被 FIFA 球员匹配后替换
      nameEnIndex.set(key, p);
    }
  }

  let added = 0;
  let updated = 0;
  let removed = 0;

  const incomingMap = new Map(incoming.map((p) => [p.id, p]));

  for (const [id, incPlayer] of incomingMap) {
    const extPlayer = existingMap.get(id);

    if (extPlayer) {
      // 主匹配：ID 精确相等
      Object.assign(extPlayer, {
        name: incPlayer.name,
        nameEn: incPlayer.nameEn,
        position: incPlayer.position,
        number: incPlayer.number,
        age: incPlayer.age,
        height: incPlayer.height,
        weight: incPlayer.weight,
        preferredFoot: incPlayer.preferredFoot,
        nationality: incPlayer.nationality,
        club: incPlayer.club,
        dataSource: "fifa" as const,
      });
      updated++;
    } else {
      // 次匹配：按 nameEn 查找 generated 球员
      const nameKey = normalizeNameEn(incPlayer.nameEn);
      const matchedGen = nameKey ? nameEnIndex.get(nameKey) : undefined;

      if (matchedGen && matchedGen.dataSource === "generated") {
        // 找到同名 generated 球员 → 迁移数据，替换 ID
        const oldId = matchedGen.id;
        // 从 existing 中移除旧条目
        const oldIndex = existing.findIndex((p) => p.id === oldId);
        if (oldIndex >= 0) {
          // 迁移 stats 和 matchLog
          incPlayer.stats = matchedGen.stats || incPlayer.stats;
          incPlayer.matchLog = matchedGen.matchLog || incPlayer.matchLog;
          incPlayer.isStar = matchedGen.isStar || incPlayer.isStar;
          existing.splice(oldIndex, 1);
          removed++;
        }
        existing.push(incPlayer);
        added++;
      } else {
        // 全新球员
        existing.push(incPlayer);
        added++;
      }
    }
  }

  return {
    players: existing,
    total: existing.length,
    new: added,
    updated,
    removed,
  };
}

/** 归一化英文名用于匹配：去空格、转小写、去重音 */
function normalizeNameEn(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // 移除重音符号
}
```

- [ ] **Step 4: 新增去重清理函数并导出**

在文件末尾添加：

```typescript
/**
 * 扫描 players.json 中同队同 nameEn（归一化后）的重复条目
 * 保留 FIFA 来源的，合并其 stats/matchLog，删除 generated 重复项
 */
export function deduplicatePlayersByEnglishName(): { removed: number; merged: number } {
  const playersPath = path.join(DATA_DIR, "players.json");
  const playersData = JSON.parse(fs.readFileSync(playersPath, "utf-8"));
  const players: PlayerRecord[] = playersData.players || [];

  // 按 (team, normalizeNameEn) 分组
  const groups = new Map<string, PlayerRecord[]>();
  for (const p of players) {
    const key = `${p.team}::${normalizeNameEn(p.nameEn)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  let removed = 0;
  let merged = 0;

  for (const [, group] of groups) {
    if (group.length <= 1) continue;

    // 优先保留 FIFA 来源的
    const fifaPlayers = group.filter((p) => p.dataSource === "fifa");
    const genPlayers = group.filter((p) => p.dataSource === "generated");

    if (fifaPlayers.length > 0 && genPlayers.length > 0) {
      const keeper = fifaPlayers[0];

      for (const gen of genPlayers) {
        // 合并 stats（取较大值）
        keeper.stats = mergeStats(keeper.stats, gen.stats);
        // 合并 matchLog（去重按 matchId）
        keeper.matchLog = mergeMatchLogs(keeper.matchLog || [], gen.matchLog || []);
        // 保留 isStar
        keeper.isStar = keeper.isStar || gen.isStar;
      }

      // 从 players 数组中移除 generated 条目
      for (const gen of genPlayers) {
        const idx = players.findIndex((p) => p.id === gen.id);
        if (idx >= 0) {
          players.splice(idx, 1);
          removed++;
        }
      }
      merged += genPlayers.length;
    }
  }

  if (removed > 0) {
    playersData.players = players;
    playersData.lastUpdated = new Date().toISOString();
    fs.writeFileSync(playersPath, JSON.stringify(playersData, null, 2));
    console.log(`  🧹 去重: 移除 ${removed} 个重复球员, 合并 ${merged} 条数据`);
  }

  return { removed, merged };
}

function mergeStats(a: any, b: any): any {
  const result = { ...a };
  for (const key of Object.keys(b)) {
    if (typeof b[key] === "number") {
      result[key] = Math.max(a[key] || 0, b[key] || 0) + (Array.isArray(a[key]) ? 0 : 0);
    }
  }
  // 特殊处理累加字段
  result.goals = (a.goals || 0) + (b.goals || 0);
  result.assists = (a.assists || 0) + (b.assists || 0);
  result.shots = (a.shots || 0) + (b.shots || 0);
  result.shotsOnTarget = (a.shotsOnTarget || 0) + (b.shotsOnTarget || 0);
  result.minutesPlayed = (a.minutesPlayed || 0) + (b.minutesPlayed || 0);
  result.distanceKm = (a.distanceKm || 0) + (b.distanceKm || 0);
  result.yellowCards = (a.yellowCards || 0) + (b.yellowCards || 0);
  result.redCards = (a.redCards || 0) + (b.redCards || 0);
  result.foulsCommitted = (a.foulsCommitted || 0) + (b.foulsCommitted || 0);
  result.foulsSuffered = (a.foulsSuffered || 0) + (b.foulsSuffered || 0);
  result.offsides = (a.offsides || 0) + (b.offsides || 0);
  result.passes = (a.passes || 0) + (b.passes || 0);
  result.tackles = (a.tackles || 0) + (b.tackles || 0);
  result.matchRatings = [...(a.matchRatings || []), ...(b.matchRatings || [])];
  result.appearances = (a.appearances || 0) + (b.appearances || 0);
  result.starts = (a.starts || 0) + (b.starts || 0);
  return result;
}

function mergeMatchLogs(a: any[], b: any[]): any[] {
  const seen = new Set(a.map((m) => m.matchId));
  for (const log of b) {
    if (!seen.has(log.matchId)) {
      a.push(log);
      seen.add(log.matchId);
    }
  }
  return a;
}
```

- [ ] **Step 5: Commit**

```bash
git add scripts/update-squads.ts
git commit -m "feat: add nameEn-based dedup and bilingual name support in squad updater"
```

---

### Task 3: 修复 player-stats-core.js —— Locale + bilingual + nameEn 回退

**Files:**
- Modify: `scripts/player-stats-core.js`

- [ ] **Step 1: 修复 getLocalizedText 的 Locale 匹配**

替换行 326-334 的 `getLocalizedText` 函数：

```javascript
function getLocalizedText(value) {
  if (!Array.isArray(value)) return value || "";
  return (
    value.find((item) => item.Locale === "bilingual")?.Description ||
    value.find((item) => item.Locale === "zh-CN" || item.Locale === "zh")?.Description ||
    value.find((item) => item.Locale === "en-GB" || item.Locale === "en")?.Description ||
    value.find((item) => item.Description)?.Description ||
    ""
  );
}
```

- [ ] **Step 2: 在 collectFifaPlayers 中输出双语球员名**

替换 `collectFifaPlayers` 函数中 `nameEn` 和新增 `name` 的赋值（行 48-70）：

```javascript
function collectFifaPlayers(liveData, teamCodes) {
  const players = [];
  for (const side of ["HomeTeam", "AwayTeam"]) {
    const team = liveData?.[side];
    if (!team?.Players?.length) continue;
    const teamCode = teamCodes.get(team.IdTeam) || team.Abbreviation;

    for (const raw of team.Players) {
      const rawNameEn = getLocalizedTextEn(raw.PlayerName) || getLocalizedTextEn(raw.ShortName);
      const rawNameZh = getLocalizedTextZh(raw.PlayerName) || getLocalizedTextZh(raw.ShortName);
      const displayName = rawNameZh && rawNameZh !== rawNameEn
        ? `${rawNameEn} / ${rawNameZh}`
        : rawNameEn;

      players.push({
        fifaId: raw.IdPlayer,
        fifaTeamId: raw.IdTeam || team.IdTeam,
        team: teamCode,
        name: displayName,
        nameEn: rawNameEn,
        shortName: getLocalizedTextEn(raw.ShortName) || rawNameEn,
        number: raw.ShirtNumber,
        position: POSITION_LABELS[raw.Position] || "FW",
        photoUrl: raw.PlayerPicture?.PictureUrl || "",
        status: raw.Status,
      });
    }
  }
  return players;
}

/** 提取英文名 */
function getLocalizedTextEn(value) {
  if (!Array.isArray(value)) return value || "";
  return (
    value.find((item) => item.Locale === "en-GB" || item.Locale === "en")?.Description ||
    value[0]?.Description ||
    ""
  );
}

/** 提取中文名 */
function getLocalizedTextZh(value) {
  if (!Array.isArray(value)) return value || "";
  return (
    value.find((item) => item.Locale === "zh-CN" || item.Locale === "zh")?.Description ||
    ""
  );
}
```

- [ ] **Step 3: 在 findOrCreatePlayer 中增加 nameEn 回退匹配**

替换 `findOrCreatePlayer` 和 `buildPlayerIndex` 函数（行 145-183），增加 nameEn 索引：

```javascript
function buildPlayerIndex(players) {
  const byFifaId = new Map();
  const byNameEn = new Map(); // 新增：按 nameEn 索引

  for (const player of players) {
    const canonicalFifaId = getCanonicalFifaId(player);
    if (canonicalFifaId) byFifaId.set(canonicalFifaId, player);
    // 索引所有球员的 nameEn（归一化）
    const nameKey = normalizeNameKey(player.nameEn);
    if (nameKey) byNameEn.set(nameKey, player);
  }

  return { byFifaId, byNameEn };
}

function findOrCreatePlayer(players, index, fifaPlayer) {
  // 主匹配：fifaId
  let player = index.byFifaId.get(fifaPlayer.fifaId);

  if (player) {
    player.fifaId = fifaPlayer.fifaId;
    index.byFifaId.set(fifaPlayer.fifaId, player);
    return player;
  }

  // 次匹配：nameEn 归一化
  const nameKey = normalizeNameKey(fifaPlayer.nameEn);
  if (nameKey) {
    player = index.byNameEn.get(nameKey);
    if (player) {
      // 找到同名球员，更新其 fifaId 关联
      player.fifaId = fifaPlayer.fifaId;
      index.byFifaId.set(fifaPlayer.fifaId, player);
      return player;
    }
  }

  // 创建新球员
  player = {
    id: `fifa-${fifaPlayer.fifaId}`,
    fifaId: fifaPlayer.fifaId,
    name: fifaPlayer.name || fifaPlayer.nameEn || `Player ${fifaPlayer.fifaId}`,
    nameEn: fifaPlayer.nameEn || fifaPlayer.name || `Player ${fifaPlayer.fifaId}`,
    team: fifaPlayer.team,
    position: fifaPlayer.position,
    number: fifaPlayer.number || 0,
    isStar: false,
    stats: emptyTournamentStats(),
    photoUrl: fifaPlayer.photoUrl || "",
    dataSource: "fifa",
    matchLog: [],
  };
  players.push(player);
  index.byFifaId.set(fifaPlayer.fifaId, player);
  return player;
}

/** 归一化 nameEn 用于匹配 */
function normalizeNameKey(name) {
  if (!name) return "";
  return name.toLowerCase().trim().replace(/\s+/g, " ")
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}
```

- [ ] **Step 4: 在 enrichPlayer 中保留双语 name**

修改 `enrichPlayer` 函数（行 191-204）：

```javascript
function enrichPlayer(player, fifaPlayer) {
  player.fifaId = fifaPlayer.fifaId;
  player.fifaTeamId = fifaPlayer.fifaTeamId;
  player.nameEn = fifaPlayer.nameEn || player.nameEn || player.name;
  // 优先使用双语名
  player.name = fifaPlayer.name || player.name || player.nameEn;
  player.team = fifaPlayer.team || player.team;
  player.position = fifaPlayer.position || player.position;
  player.number = fifaPlayer.number || player.number;
  player.photoUrl = fifaPlayer.photoUrl || player.photoUrl || "";
  player.dataSource = player.dataSource === "generated" ? "fifa" : player.dataSource || "fifa";
  player.stats ||= emptyTournamentStats();
  player.matchLog ||= [];
  return player;
}
```

- [ ] **Step 5: Commit**

```bash
git add scripts/player-stats-core.js
git commit -m "feat: add bilingual name support and nameEn fallback matching in player stats core"
```

---

### Task 4: 修复 match-details-core.js —— Locale + bilingual 阵型名

**Files:**
- Modify: `scripts/match-details-core.js`

- [ ] **Step 1: 修复 getLocalizedText 的 Locale 匹配**

替换行 116-124 的 `getLocalizedText` 函数：

```javascript
function getLocalizedText(value) {
  if (!Array.isArray(value)) return value || null;
  return (
    value.find((item) => item.Locale === "bilingual")?.Description ||
    value.find((item) => item.Locale === "zh-CN" || item.Locale === "zh")?.Description ||
    value.find((item) => item.Locale === "en-GB" || item.Locale === "en")?.Description ||
    value.find((item) => item.Description)?.Description ||
    null
  );
}
```

- [ ] **Step 2: 修改 normalizeLineupPlayer 输出双语名字**

替换行 83-97 的 `normalizeLineupPlayer` 函数：

```javascript
function normalizeLineupPlayer(player, code) {
  const nameEn = getLocalizedTextEn(player.PlayerName) || getLocalizedTextEn(player.ShortName) || `#${player.ShirtNumber}`;
  const nameZh = getLocalizedTextZh(player.PlayerName) || getLocalizedTextZh(player.ShortName) || "";
  const displayName = nameZh && nameZh !== nameEn ? `${nameEn} / ${nameZh}` : nameEn;
  const shortNameEn = getLocalizedTextEn(player.ShortName) || nameEn;

  return {
    id: `fifa-${player.IdPlayer}`,
    fifaId: player.IdPlayer,
    name: displayName,
    shortName: shortNameEn,
    team: code,
    number: Number(player.ShirtNumber) || 0,
    position: POSITION_LABELS.get(Number(player.Position)) || "球员",
    positionCode: Number(player.Position),
    status: Number(player.Status),
    captain: Boolean(player.Captain),
    photoUrl: player.PlayerPicture?.PictureUrl || null,
  };
}

function getLocalizedTextEn(value) {
  if (!Array.isArray(value)) return value || null;
  return (
    value.find((item) => item.Locale === "en-GB" || item.Locale === "en")?.Description ||
    value[0]?.Description ||
    null
  );
}

function getLocalizedTextZh(value) {
  if (!Array.isArray(value)) return value || null;
  return (
    value.find((item) => item.Locale === "zh-CN" || item.Locale === "zh")?.Description ||
    null
  );
}
```

- [ ] **Step 3: 替换换人信息也为双语**

修改 `buildTeamLineup` 中的 substitutions 映射（行 68-80）：

```javascript
substitutions: (team?.Substitutions || []).map((item) => ({
  minute: item.Minute || "",
  playerOffId: item.IdPlayerOff ? `fifa-${item.IdPlayerOff}` : null,
  playerOnId: item.IdPlayerOn ? `fifa-${item.IdPlayerOn}` : null,
  playerOffName: buildBilingualName(item.PlayerOffName) || "",
  playerOnName: buildBilingualName(item.PlayerOnName) || "",
})),
```

并在文件末尾添加：

```javascript
function buildBilingualName(value) {
  const nameEn = getLocalizedTextEn(value);
  const nameZh = getLocalizedTextZh(value);
  if (!nameEn) return nameZh || "";
  if (!nameZh || nameZh === nameEn) return nameEn;
  return `${nameEn} / ${nameZh}`;
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/match-details-core.js
git commit -m "feat: add bilingual lineup names and fix Locale matching in match details core"
```

---

### Task 5: 在 fetch-data.ts 中增加去重清理步骤

**Files:**
- Modify: `scripts/fetch-data.ts`

- [ ] **Step 1: 导入去重函数**

在 import 区域（行 23）添加：

```typescript
import { updateSquadsFromFifa, updateSquadsFromFile, syncTeamsEmbeddedPlayers, getSquadReport, deduplicatePlayersByEnglishName } from "./update-squads";
```

- [ ] **Step 2: 在大名单更新后增加清理步骤**

在大名单更新流程末尾（行 113 `syncTeamsEmbeddedPlayers()` 调用之后）添加：

```typescript
// 清理重复球员（一次性的 generated + FIFA 去重）
const dedupResult = deduplicatePlayersByEnglishName();
if (dedupResult.removed > 0) {
  // 重新同步 teams.json
  syncTeamsEmbeddedPlayers();
  console.log(`  🧹 去重完成: 移除 ${dedupResult.removed} 个重复球员`);
}
```

这应该在行 118 的 `} catch (err: any) {` 之前，即 `syncTeamsEmbeddedPlayers()` 之后。

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch-data.ts
git commit -m "feat: add duplicate player cleanup step in data fetch pipeline"
```

---

### Task 6: 更新展示页面 —— 位置标签双语化

**Files:**
- Modify: `src/pages/teams/[slug].astro`
- Modify: `src/pages/players/[slug].astro`
- Modify: `src/pages/stats.astro`
- Modify: `src/components/MatchCard.tsx`

- [ ] **Step 1: 统一位置标签为双语 —— teams/[slug].astro**

替换行 38-42 的 `positionLabels`：

```typescript
const positionLabels: Record<string, string> = {
  GK: "GK / 守门员", CB: "CB / 中后卫", LB: "LB / 左后卫", RB: "RB / 右后卫",
  CDM: "CDM / 防守中场", CM: "CM / 中前卫", CAM: "CAM / 前腰",
  LW: "LW / 左边锋", RW: "RW / 右边锋", ST: "ST / 前锋",
};
```

行 92 (banner 中的球员数) 无需改动，因为 `teamPlayers` 的数量会在去重后自动变为正确的值。

- [ ] **Step 2: 统一位置标签为双语 —— players/[slug].astro**

替换行 30-34 的 `positionLabels`：

```typescript
const positionLabels: Record<string, string> = {
  GK: "GK / 守门员", CB: "CB / 中后卫", LB: "LB / 左后卫", RB: "RB / 右后卫",
  CDM: "CDM / 防守中场", CM: "CM / 中前卫", CAM: "CAM / 前腰",
  LW: "LW / 左边锋", RW: "RW / 右边锋", ST: "ST / 前锋",
};
```

- [ ] **Step 3: 统一位置标签为双语 —— MatchCard.tsx**

在 `MatchCard.tsx` 的 `LineupPanel` 组件中（行 163-192），无需修改位置标签（因为阵型面板不显示位置）。

但需要在 `normalizeLineupPlayer` 被调用后确保名字已是双语格式（此逻辑已在 Task 4 的 match-details-core.js 中处理）。

阵型面板行 176 处 `{player.shortName || player.name}` — 如果 shortName 是英文而 name 已是双语，这可能会只显示英文。确认 `shortName` 在 `match-details-core.js` 中已设为英文即可。不需要修改此文件。

- [ ] **Step 4: 更新 stats.astro 位置显示**

在 `stats.astro` 行 70，位置 `{p.position}` 目前直接显示。需要将其映射为双语标签。

在 `<script>` 区域添加 positionLabels 映射，并在显示时使用：

在第 70 行附近，将：
```astro
<span style="color:var(--color-text-muted);font-size:9px;">{p.position}</span>
```
改为：
```astro
<span style="color:var(--color-text-muted);font-size:9px;">{positionLabels[p.position] || p.position}</span>
```

并在文件顶部的 frontmatter 中添加 positionLabels 常量（与其他页面一致的格式）。

- [ ] **Step 5: Commit**

```bash
git add src/pages/teams/\[slug\].astro src/pages/players/\[slug\].astro src/pages/stats.astro
git commit -m "feat: update position labels to bilingual format in display pages"
```

---

### Task 7: 运行数据清理 + 端到端验证

**Files:**
- 无新建，验证现有数据

- [ ] **Step 1: 运行去重清理**

```bash
cd /Users/northwang/dev/worldcup && npx tsx scripts/fetch-data.ts --squads
```

预期输出：
- 扫描 players.json 中重复项
- 移除 generated 来源的重复球员
- 合并 stats/matchLog
- 同步 teams.json

- [ ] **Step 2: 验证南非队球员数**

```bash
cat src/data/players.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
rsa = [p for p in data['players'] if p['team'] == 'RSA']
print(f'RSA players: {len(rsa)}')
for p in sorted(rsa, key=lambda x: x['name']):
    print(f'  {p[\"id\"]} name={p[\"name\"][:60]} ds={p.get(\"dataSource\",\"\")}')
"
```

预期：RSA 球员数应在 23-27 之间，且没有同名（nameEn）重复。

- [ ] **Step 3: 验证构建**

```bash
cd /Users/northwang/dev/worldcup && pnpm run build
```

预期：构建成功，无错误。

- [ ] **Step 4: 验证页面渲染**

检查构建输出中球队页的 HTML，确认位置标签为双语格式。

- [ ] **Step 5: Commit（如有数据变更）**

```bash
git add src/data/ src/public/
git commit -m "chore: run player deduplication cleanup"
```

---

### Task 8: 更新测试

**Files:**
- Check: `tests/player-stats-core.test.js`
- Check: `tests/match-details-core.test.js`

- [ ] **Step 1: 检查现有测试是否需要更新**

```bash
cd /Users/northwang/dev/worldcup && cat tests/player-stats-core.test.js | head -20
```

确认 `getLocalizedText` 的测试是否覆盖了新增的 locale 变体。如果不覆盖，现有测试应仍能通过（因为 `getLocalizedText` 的行为向后兼容）。

- [ ] **Step 2: 运行全部测试**

```bash
cd /Users/northwang/dev/worldcup && pnpm test
```

- [ ] **Step 3: 如有失败，修复测试**

根据测试失败的具体信息进行修复。

- [ ] **Step 4: Commit（如有测试变更）**

```bash
git add tests/
git commit -m "test: update tests for bilingual name and Locale changes"
```

---

## 执行顺序

```
Task 1 (fifa-client) ──→ Task 2 (update-squads) ──→ Task 5 (fetch-data)
         │                         │
         └──────────┬──────────────┘
                    ↓
         Task 3 (player-stats-core) ──→ Task 6 (display pages)
         Task 4 (match-details-core) ──┘       │
                    ↓                          │
              Task 7 (验证清理) ←───────────────┘
                    ↓
              Task 8 (测试)
```

Task 1-4 修改核心数据处理逻辑，相互独立可并行。Task 5 串联清理步骤。Task 6 改展示层。Task 7 做端到端验证。Task 8 收尾。
