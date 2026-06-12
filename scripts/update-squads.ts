/**
 * 球员大名单更新器
 *
 * 从 FIFA 官方数据更新参赛球员信息。
 * 支持两种模式：
 * 1. FIFA API 模式：从 api.fifa.com 实时拉取（需要配置 FIFA_SEASON_ID）
 * 2. 文件模式：从本地 JSON 导入（离线/测试用）
 *
 * 更新策略：
 * - 保留现有球员的 id（不变）
 * - 新增 FIFA 公布的球员
 * - 移除不在官方名单中的球员
 * - 更新已有球员的属性（号码、位置等）
 */

import fs from "node:fs";
import path from "node:path";
import {
  fetchAllPlayers,
  fetchTeamSquad,
  fetchTeams,
  isApiConfigured,
  getLocalizedText,
  type FifaPlayerRaw,
  type FifaTeamRaw,
} from "./fifa-client";

const DATA_DIR = path.resolve("src/data");

// ============================================================
// 类型
// ============================================================

interface PlayerRecord {
  id: string;
  name: string;
  nameEn: string;
  team: string;
  position: string;
  number: number;
  isStar: boolean;
  age?: number;
  height?: number;
  weight?: number;
  preferredFoot?: string;
  nationality?: string;
  club?: string;
  clubEn?: string;
  photoUrl?: string;
  dataSource?: "fifa" | "generated";
  worldCupApps?: number;
  stats: {
    appearances: number;
    starts: number;
    minutesPlayed: number;
    goals: number;
    penalties: number;
    assists: number;
    shots: number;
    shotsOnTarget: number;
    distanceKm: number;
    yellowCards: number;
    redCards: number;
    foulsCommitted: number;
    foulsSuffered: number;
    offsides: number;
    passes: number;
    passAccuracy?: number;
    tackles: number;
    matchRatings: number[];
  };
  matchLog?: any[];
}

interface TeamRecord {
  code: string;
  name: string;
  players: {
    id: string;
    name: string;
    nameEn: string;
    position: string;
    number: number;
    isStar: boolean;
    age?: number;
    height?: number;
    weight?: number;
    club?: string;
    preferredFoot?: string;
    nationality?: string;
  }[];
}

// ============================================================
// 数据转换
// ============================================================

/** 从 FIFA 球员数据转换为项目格式 */
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
    number: raw.ShirtNumber || 0,
    isStar: raw.IsStar || false,
    age: raw.Age || undefined,
    height: raw.Height || undefined,
    weight: raw.Weight ?? undefined,
    preferredFoot: normalizeFoot(raw.PreferredFoot || ""),
    nationality: nationality,
    club: raw.ClubName || "",
    clubEn: "",
    photoUrl: "",
    dataSource: "fifa" as const,
    worldCupApps: undefined,
    stats: {
      appearances: 0,
      starts: 0,
      minutesPlayed: 0,
      goals: 0,
      penalties: 0,
      assists: 0,
      shots: 0,
      shotsOnTarget: 0,
      distanceKm: 0,
      yellowCards: 0,
      redCards: 0,
      foulsCommitted: 0,
      foulsSuffered: 0,
      offsides: 0,
      passes: 0,
      tackles: 0,
      matchRatings: [],
    },
  };
}

/** 标准化位置代码 */
function normalizePosition(pos: string): string {
  const map: Record<string, string> = {
    Goalkeeper: "GK", goalkeeper: "GK", GK: "GK",
    CentreBack: "CB", "Centre Back": "CB", CB: "CB", Defender: "CB",
    LeftBack: "LB", "Left Back": "LB", LB: "LB",
    RightBack: "RB", "Right Back": "RB", RB: "RB",
    DefensiveMidfielder: "CDM", "Defensive Midfielder": "CDM", CDM: "CDM",
    CentralMidfielder: "CM", "Central Midfielder": "CM", CM: "CM",
    AttackingMidfielder: "CAM", "Attacking Midfielder": "CAM", CAM: "CAM",
    LeftWinger: "LW", "Left Winger": "LW", LW: "LW",
    RightWinger: "RW", "Right Winger": "RW", RW: "RW",
    Striker: "ST", Forward: "ST", ST: "ST",
  };
  return map[pos] || pos.toUpperCase().replace(/\s/g, "");
}

/** 标准化惯用脚 */
function normalizeFoot(foot: string): string {
  if (!foot) return "";
  if (foot.includes("右") || foot.toLowerCase().includes("right")) return "右脚";
  if (foot.includes("左") || foot.toLowerCase().includes("left")) return "左脚";
  if (foot.toLowerCase() === "both") return "双脚";
  return foot;
}

// ============================================================
// 更新逻辑
// ============================================================

interface UpdateResult {
  total: number;
  new: number;
  updated: number;
  removed: number;
  source: string;
}

/**
 * 从 FIFA API 更新全部球员大名单
 */
export async function updateSquadsFromFifa(): Promise<UpdateResult | null> {
  if (!isApiConfigured()) {
    console.log("⏭  FIFA API 未配置，跳过在线更新");
    return null;
  }

  // 1. 获取球队列表
  const teams = await fetchTeams();
  if (!teams) return null;

  // 2. 获取全部球员
  const rawPlayers = await fetchAllPlayers();
  if (!rawPlayers) return null;

  // 3. 建立球队 code -> FIFA teamId 映射
  const teamIdToCode = buildTeamCodeMapping(teams);

  // 4. 转换球员数据
  const newPlayers: PlayerRecord[] = [];
  for (const raw of rawPlayers) {
    const teamCode = teamIdToCode[raw.TeamId];
    if (!teamCode) {
      console.warn(`  ⚠ 无法匹配球队: ${raw.TeamName?.[0]?.Description} (${raw.TeamId})`);
      continue;
    }
    newPlayers.push(convertFifaPlayer(raw, teamCode));
  }

  // 5. 读取现有数据
  const playersPath = path.join(DATA_DIR, "players.json");
  const existing = JSON.parse(fs.readFileSync(playersPath, "utf-8"));
  const existingPlayers: PlayerRecord[] = existing.players || [];

  // 6. 合并：保留已有统计，更新基本信息
  const result = mergePlayers(existingPlayers, newPlayers);

  // 7. 写入
  existing.lastUpdated = new Date().toISOString();
  existing.players = result.players;
  fs.writeFileSync(playersPath, JSON.stringify(existing, null, 2));

  console.log(`  📊 球员更新: ${result.total} 总 / ${result.new} 新增 / ${result.updated} 更新 / ${result.removed} 移除`);
  return { ...result, source: "FIFA API" };
}

/**
 * 合并现有球员和新数据
 * - 保留现有统计字段（stats, matchLog）
 * - 更新基本信息（name, position, number, club 等）
 * - 新增缺失球员
 * - 标记不在官方名单中的球员
 */
function mergePlayers(
  existing: PlayerRecord[],
  incoming: PlayerRecord[]
): { players: PlayerRecord[]; total: number; new: number; updated: number; removed: number } {
  const existingMap = new Map(existing.map((p) => [p.id, p]));
  // 二级索引：归一化 nameEn → PlayerRecord（仅对 generated 球员，用于被 FIFA 球员匹配后替换）
  const nameEnIndex = new Map<string, PlayerRecord>();
  for (const p of existing) {
    const key = normalizeNameEn(p.nameEn);
    if (key && p.dataSource === "generated") {
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
      // 主匹配：ID 精确相等 — 更新基本信息，保留统计数据
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
    .replace(/[̀-ͯ]/g, "");
}

/**
 * 用本地 FIFA 数据文件更新（离线模式）
 * @param filePath 包含球队和球员数据的 JSON 文件路径
 */
export async function updateSquadsFromFile(filePath: string): Promise<UpdateResult | null> {
  console.log(`📂 从本地文件导入: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠ 文件不存在: ${filePath}`);
    return null;
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const rawPlayers: FifaPlayerRaw[] = data.players || data.Results || [];

  if (!rawPlayers.length) {
    console.warn("  ⚠ 文件中无球员数据");
    return null;
  }

  // 读取团队映射
  const teamsData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "teams.json"), "utf-8"));
  const teamCodeSet = new Set(teamsData.teams.map((t: any) => t.code));

  const newPlayers: PlayerRecord[] = [];
  for (const raw of rawPlayers) {
    const teamCode = findTeamCode(raw, teamCodeSet);
    if (!teamCode) continue;
    newPlayers.push(convertFifaPlayer(raw, teamCode));
  }

  const playersPath = path.join(DATA_DIR, "players.json");
  const existing = JSON.parse(fs.readFileSync(playersPath, "utf-8"));
  const result = mergePlayers(existing.players || [], newPlayers);

  existing.lastUpdated = new Date().toISOString();
  existing.players = result.players;
  fs.writeFileSync(playersPath, JSON.stringify(existing, null, 2));

  console.log(`  📊 球员更新: ${result.total} 总 / ${result.new} 新增 / ${result.updated} 更新`);
  return { ...result, source: `本地文件: ${path.basename(filePath)}` };
}

/**
 * 同步 teams.json 中的内嵌球员数据
 */
export function syncTeamsEmbeddedPlayers(): void {
  console.log("🔄 同步 teams.json 内嵌球员数据...");

  const teamsPath = path.join(DATA_DIR, "teams.json");
  const playersPath = path.join(DATA_DIR, "players.json");

  const teamsData = JSON.parse(fs.readFileSync(teamsPath, "utf-8"));
  const playersData = JSON.parse(fs.readFileSync(playersPath, "utf-8"));

  const playerIndex = new Map(playersData.players.map((p: any) => [p.id, p]));

  for (const team of teamsData.teams) {
    // 获取该队在 players.json 中的全部球员
    const squadPlayers = playersData.players
      .filter((p: any) => p.team === team.code)
      .sort((a: any, b: any) => a.number - b.number);

    team.players = squadPlayers.map((p: any) => ({
      id: p.id,
      name: p.name,
      nameEn: p.nameEn,
      position: p.position,
      number: p.number,
      isStar: p.isStar,
      age: p.age,
      height: p.height,
      weight: p.weight,
      club: p.club,
      preferredFoot: p.preferredFoot,
      nationality: p.nationality,
      dataSource: p.dataSource,
    }));
  }

  fs.writeFileSync(teamsPath, JSON.stringify(teamsData, null, 2));

  const totalPlayers = teamsData.teams.reduce((sum: number, t: any) => sum + t.players.length, 0);
  console.log(`  ✅ teams.json 已同步: ${totalPlayers} 名球员`);
}

// ============================================================
// 工具函数
// ============================================================

function buildTeamCodeMapping(teams: FifaTeamRaw[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  // 读取 teams.json 获取已知映射
  try {
    const teamsData = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "teams.json"), "utf-8")
    );
    for (const team of teamsData.teams) {
      // 按名称模糊匹配
      const fifaTeam = teams.find(
        (t: FifaTeamRaw) =>
          t.TeamName.some(
            (n) => n.Description.toLowerCase() === team.name.toLowerCase()
          ) ||
          t.Abbreviation?.toUpperCase() === team.code.toUpperCase()
      );
      if (fifaTeam) {
        mapping[fifaTeam.IdTeam] = team.code;
      }
    }
  } catch {
    // teams.json 不可读时跳过
  }
  return mapping;
}

function findTeamCode(raw: FifaPlayerRaw, validCodes: Set<string>): string | null {
  // 从 TeamId 推导（如果与我们的 code 匹配）
  const teamId = raw.TeamId?.toUpperCase();
  if (teamId && validCodes.has(teamId)) return teamId;

  // 从 TeamName 推导
  const teamName = raw.TeamName?.[0]?.Description || "";
  // 尝试在 teams.json 中按名称查找
  try {
    const teamsData = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "teams.json"), "utf-8")
    );
    const match = teamsData.teams.find(
      (t: any) =>
        t.name.toLowerCase() === teamName.toLowerCase() ||
        t.nameEn.toLowerCase() === teamName.toLowerCase()
    );
    if (match) return match.code;
  } catch {}

  return null;
}

// ============================================================
// 统计报告
// ============================================================

export function getSquadReport(): void {
  const playersPath = path.join(DATA_DIR, "players.json");
  const teamsPath = path.join(DATA_DIR, "teams.json");

  const playersData = JSON.parse(fs.readFileSync(playersPath, "utf-8"));
  const teamsData = JSON.parse(fs.readFileSync(teamsPath, "utf-8"));

  console.log("\n📋 大名单报告");
  console.log("=" .repeat(40));

  const totalPlayers = playersData.players.length;
  const fifaPlayers = playersData.players.filter((p: any) => p.dataSource === "fifa").length;
  const genPlayers = playersData.players.filter((p: any) => p.dataSource === "generated" || !p.dataSource).length;

  console.log(`  总球员数: ${totalPlayers}`);
  console.log(`  FIFA 官方: ${fifaPlayers}`);
  console.log(`  自动生成: ${genPlayers}`);

  console.log("\n  每队球员数:");
  for (const team of teamsData.teams) {
    const count = team.players.length;
    const flag = count >= 23 && count <= 26 ? "✅" : "⚠️";
    console.log(`    ${flag} ${team.code} ${team.name}: ${count} 人`);
  }
}

// ============================================================
// 去重清理
// ============================================================

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
        keeper.stats = mergeStats(keeper.stats, gen.stats);
        keeper.matchLog = mergeMatchLogs(keeper.matchLog || [], gen.matchLog || []);
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
  const numericKeys = [
    "goals", "assists", "shots", "shotsOnTarget", "minutesPlayed",
    "yellowCards", "redCards", "foulsCommitted", "foulsSuffered",
    "offsides", "passes", "tackles", "appearances", "starts",
    "penalties",
  ];
  for (const key of numericKeys) {
    result[key] = (a[key] || 0) + (b[key] || 0);
  }
  result.distanceKm = Math.round((result.minutesPlayed || 0) * 0.115 * 10) / 10;
  result.matchRatings = [...(a.matchRatings || []), ...(b.matchRatings || [])];
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
