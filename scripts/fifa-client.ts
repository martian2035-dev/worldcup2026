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

// ============================================================
// API 请求工具
// ============================================================

async function fifaFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!WORLD_CUP_2026_SEASON_ID) {
    console.warn(`  ⚠ FIFA_SEASON_ID 未配置，跳过 API 请求`);
    return null;
  }

  const url = new URL(`${FIFA_BASE_URL}${endpoint}`);
  url.searchParams.set("language", "zh");
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
