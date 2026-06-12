/**
 * FIFA 官方数据源客户端
 *
 * 从 FIFA 公开 API 获取 2026 世界杯数据：
 * - 球队和球员大名单
 * - 比赛结果和统计
 * - 球员个人数据（进球、红黄牌、出场时间等）
 *
 * FIFA Public API 端点（基于 v3 版本）:
 * - 基础 URL: https://api.fifa.com/api/v3/
 * - 2026 世界杯赛季 ID: 待 FIFA 公布（预计 2026 年初）
 *
 * 参考：
 * - 2022 卡塔尔世界杯赛季 ID: 255711
 * - 2026 美加墨世界杯赛季 ID: 待定
 *
 * 当 API 不可用时，返回 null 由上游 fallback 处理。
 */

const FIFA_BASE_URL = "https://api.fifa.com/api/v3";

/** 2026 世界杯可能的赛季 ID（FIFA 公布后更新） */
const WORLD_CUP_2026_SEASON_ID = process.env.FIFA_SEASON_ID || "";

/** 请求超时 (ms) */
const TIMEOUT_MS = 15000;

// ============================================================
// 类型定义
// ============================================================

/** FIFA API 原始响应的球员数据 */
export interface FifaPlayerRaw {
  IdPlayer: string;
  PlayerName: Array<{ Description: string; Locale: string }>;
  Position: string;
  ShirtNumber: number;
  Height: number;
  Weight: number | null;
  Age: number;
  PreferredFoot?: string;
  Nationality: Array<{ Description: string }>;
  ClubName?: string;
  ClubLogoUrl?: string;
  TeamId: string;
  TeamName: Array<{ Description: string }>;
  IsStar?: boolean;
}

/** FIFA API 原始响应的球队数据 */
export interface FifaTeamRaw {
  IdTeam: string;
  TeamName: Array<{ Description: string; Locale: string }>;
  Abbreviation: string;
  GroupName: string;
  FlagUrl: string;
  CoachName: string;
  CoachNationality: string;
}

/** FIFA API 比赛数据 */
export interface FifaMatchRaw {
  IdMatch: string;
  IdStage: string;
  GroupName: string | null;
  Date: string;
  LocalDate: string;
  Home?: {
    IdTeam?: string;
    IdCountry?: string;
    Abbreviation?: string;
    Score?: number | null;
    TeamName?: Array<{ Description: string }>;
  };
  Away?: {
    IdTeam?: string;
    IdCountry?: string;
    Abbreviation?: string;
    Score?: number | null;
    TeamName?: Array<{ Description: string }>;
  };
  HomeTeam?: { IdTeam: string; Abbreviation?: string; TeamName: Array<{ Description: string }>; Score?: number | null };
  AwayTeam?: { IdTeam: string; Abbreviation?: string; TeamName: Array<{ Description: string }>; Score?: number | null };
  HomeTeamScore: number | null;
  AwayTeamScore: number | null;
  MatchStatus: number;
  MatchTime?: string | null;
  Winner?: string | null;
  ResultType?: number | null;
  OfficialityStatus?: number | null;
  Stadium: { Name: string; CityName: string };
  StageName: string;
  PlaceHolderA: string;
  PlaceHolderB: string;
}

/** FIFA API 比赛球员统计 */
export interface FifaPlayerStatRaw {
  IdPlayer: string;
  IdMatch: string;
  MinutesPlayed: number;
  IsStart: boolean;
  Goals: number;
  Assists: number;
  Shots: number;
  ShotsOnTarget: number;
  YellowCard: boolean;
  RedCard: boolean;
  FoulsCommitted: number;
  FoulsSuffered: number;
  Offsides: number;
  Passes: number;
  PassAccuracy?: number;
  Tackles: number;
  DistanceKm?: number;
  Rating: number | null;
}

export interface FifaTimelineRaw {
  IdMatch: string;
  Event: Array<{
    IdPlayer?: string;
    IdTeam?: string;
    IdSubPlayer?: string;
    IdSubTeam?: string;
    Type: number;
    MatchMinute?: string;
    Timestamp?: string;
    TypeLocalized?: Array<{ Locale: string; Description: string }>;
  }>;
}

export interface FifaLiveMatchRaw {
  IdMatch: string;
  MatchTime?: string | null;
  Attendance?: string | number | null;
  HomeTeam?: FifaLiveTeamRaw;
  AwayTeam?: FifaLiveTeamRaw;
}

export interface FifaLiveTeamRaw {
  IdTeam: string;
  Abbreviation: string;
  Tactics?: string | null;
  Players?: Array<{
    IdPlayer: string;
    IdTeam: string;
    ShirtNumber: number;
    Status: number;
    Position: number;
    Captain?: boolean;
    PlayerName?: Array<{ Locale: string; Description: string }>;
    ShortName?: Array<{ Locale: string; Description: string }>;
    PlayerPicture?: { PictureUrl?: string };
  }>;
  Substitutions?: Array<{
    IdPlayerOff: string;
    IdPlayerOn: string;
    Minute: string;
    IdTeam: string;
    PlayerOffName?: Array<{ Locale: string; Description: string }>;
    PlayerOnName?: Array<{ Locale: string; Description: string }>;
  }>;
  Bookings?: Array<{
    IdPlayer: string;
    Card: number;
    Minute: string;
    IdTeam: string;
  }>;
}

// ============================================================
// API 请求工具
// ============================================================

async function fifaFetch<T>(endpoint: string, params: Record<string, string> = {}, language: string = "zh"): Promise<T | null> {
  if (!WORLD_CUP_2026_SEASON_ID) {
    console.warn(`  ⚠ FIFA_SEASON_ID 未配置，跳过 API 请求`);
    return null;
  }

  const url = new URL(`${FIFA_BASE_URL}${endpoint}`);
  url.searchParams.set("language", language);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "User-Agent": "WorldCup2026-DataFetcher/1.0",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`  ⚠ FIFA API 返回 ${res.status}: ${endpoint}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.warn(`  ⚠ FIFA API 超时: ${endpoint}`);
    } else {
      console.warn(`  ⚠ FIFA API 请求失败: ${err.message}`);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// 数据获取接口
// ============================================================

/**
 * 获取所有参赛球队
 * 端点: GET /teams?language=zh&idseason={seasonId}
 */
export async function fetchTeams(): Promise<FifaTeamRaw[] | null> {
  console.log("📡 从 FIFA API 获取球队数据...");
  const data = await fifaFetch<{ Results: FifaTeamRaw[] }>(
    "/teams",
    { idseason: WORLD_CUP_2026_SEASON_ID, count: "64" }
  );
  if (!data?.Results?.length) return null;

  console.log(`  ✅ 获取到 ${data.Results.length} 支球队`);
  return data.Results;
}

/**
 * 获取某支球队的球员大名单
 * 端点: GET /players?language=zh&idseason={seasonId}&idteam={teamId}
 */
export async function fetchTeamSquad(teamId: string): Promise<FifaPlayerRaw[] | null> {
  const data = await fifaFetch<{ Results: FifaPlayerRaw[] }>(
    "/players",
    { idseason: WORLD_CUP_2026_SEASON_ID, idteam: teamId, count: "30" }
  );
  if (!data?.Results?.length) return null;

  return data.Results;
}

/**
 * 获取所有球员大名单（所有球队）
 * 端点: GET /players?language=zh&idseason={seasonId}
 */
export async function fetchAllPlayers(): Promise<FifaPlayerRaw[] | null> {
  console.log("📡 从 FIFA API 获取全部球员数据...");
  const data = await fifaFetch<{ Results: FifaPlayerRaw[] }>(
    "/players",
    { idseason: WORLD_CUP_2026_SEASON_ID, count: "1500" }
  );
  if (!data?.Results?.length) return null;

  console.log(`  ✅ 获取到 ${data.Results.length} 名球员`);
  return data.Results;
}

/**
 * 获取所有比赛
 * 端点: GET /calendar/matches?language=zh&idseason={seasonId}
 */
export async function fetchMatches(): Promise<FifaMatchRaw[] | null> {
  console.log("📡 从 FIFA API 获取比赛数据...");
  const data = await fifaFetch<{ Results: FifaMatchRaw[] }>(
    "/calendar/matches",
    { idseason: WORLD_CUP_2026_SEASON_ID, count: "104" }
  );
  if (!data?.Results?.length) return null;

  console.log(`  ✅ 获取到 ${data.Results.length} 场比赛`);
  return data.Results;
}

/**
 * 获取指定比赛的球员统计
 * 端点: GET /statistics/players?language=zh&idseason={seasonId}&idmatch={matchId}
 */
export async function fetchMatchPlayerStats(matchId: string): Promise<FifaPlayerStatRaw[] | null> {
  const data = await fifaFetch<{ Results: FifaPlayerStatRaw[] }>(
    "/statistics/players",
    { idseason: WORLD_CUP_2026_SEASON_ID, idmatch: matchId }
  );
  if (!data?.Results?.length) return null;

  return data.Results;
}

/**
 * 获取指定比赛的事件流
 * 端点: GET /timelines/{matchId}?language=zh
 */
export async function fetchMatchTimeline(matchId: string): Promise<FifaTimelineRaw | null> {
  const data = await fifaFetch<FifaTimelineRaw>(`/timelines/${matchId}`);
  if (!data?.Event?.length) return null;

  return data;
}

/**
 * 获取指定比赛的完整比赛数据（阵容、换人、进球、牌）
 * 端点: GET /live/football/{matchId}?language=zh
 */
export async function fetchLiveMatch(matchId: string): Promise<FifaLiveMatchRaw | null> {
  const data = await fifaFetch<FifaLiveMatchRaw>(`/live/football/${matchId}`);
  if (!data?.HomeTeam && !data?.AwayTeam) return null;

  return data;
}

/**
 * 获取赛事总览（总进球、黄牌等）
 * 端点: GET /statistics/seasons?language=zh&idseason={seasonId}
 */
export async function fetchTournamentStats(): Promise<any | null> {
  console.log("📡 从 FIFA API 获取赛事统计...");
  const data = await fifaFetch<any>(
    "/statistics/seasons",
    { idseason: WORLD_CUP_2026_SEASON_ID }
  );
  return data;
}

/**
 * 检查 FIFA API 是否可用
 */
export async function checkApiHealth(): Promise<boolean> {
  const data = await fifaFetch<any>("/versions");
  return data !== null;
}

/**
 * 获取当前配置的赛季 ID
 */
export function getSeasonId(): string {
  return WORLD_CUP_2026_SEASON_ID;
}

/**
 * 设置赛季 ID（在 GitHub Actions 中通过环境变量注入）
 */
export function isApiConfigured(): boolean {
  return WORLD_CUP_2026_SEASON_ID.length > 0;
}

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
    if (!zhP) return enP;

    const enNameDesc = enP.PlayerName?.find(
      (n) => n.Locale === "en" || n.Locale === "en-GB"
    )?.Description || enP.PlayerName?.[0]?.Description || "";
    const zhNameDesc = zhP.PlayerName?.find(
      (n) => n.Locale === "zh" || n.Locale === "zh-CN"
    )?.Description || zhP.PlayerName?.[0]?.Description || "";

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
      ClubName: enP.ClubName || zhP.ClubName,
      ClubLogoUrl: enP.ClubLogoUrl || zhP.ClubLogoUrl,
    };
  });
}

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
