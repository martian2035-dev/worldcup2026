export interface Match {
  id: string;
  group: string | null;
  stage: string;
  round: number;
  home: { code: string; name: string };
  away: { code: string; name: string };
  datetime: string;
  venue: { name: string; city: string };
  status: string;
  score: { home: number | null; away: number | null } | null;
  attendance?: number | null;
  stats: {
    home: { possession: number | null; shots: number; shotsOnTarget: number; corners: number; fouls: number; yellowCards: number; redCards: number };
    away: { possession: number | null; shots: number; shotsOnTarget: number; corners: number; fouls: number; yellowCards: number; redCards: number };
  } | null;
  lineups?: MatchLineups | null;
  /** 参赛球员表现（赛后填充） */
  playerEvents?: MatchPlayerEvent[];
}

export interface MatchLineupPlayer {
  id: string;
  fifaId?: string;
  name: string;
  shortName?: string;
  team?: string;
  number: number;
  position: string;
  positionCode?: number;
  status?: number;
  captain?: boolean;
  photoUrl?: string | null;
}

export interface MatchSubstitution {
  minute: string;
  playerOffId: string | null;
  playerOnId: string | null;
  playerOffName: string;
  playerOnName: string;
}

export interface MatchTeamLineup {
  formation: string | null;
  starting: MatchLineupPlayer[];
  substitutes: MatchLineupPlayer[];
  substitutions: MatchSubstitution[];
}

export interface MatchLineups {
  home: MatchTeamLineup;
  away: MatchTeamLineup;
}

/** 单场球员事件 */
export interface MatchPlayerEvent {
  playerId: string;
  team: string;
  minutesPlayed: number;
  isStart: boolean;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  yellowCard: boolean;
  redCard: boolean;
  rating: number | null;
  foulsCommitted?: number;
  offsides?: number;
}

export interface StandingTeam {
  code: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  qualified: string | null;
}

export interface Group {
  name: string;
  teams: StandingTeam[];
}

export interface Coach {
  name: string;
  nameEn?: string;
  nationality: string;
  age?: number;
  since?: string;
}

export interface Team {
  code: string;
  name: string;
  nameEn: string;
  group: string;
  fifaRank: number | null;
  worldCups: number;
  coach: Coach;
  colors: { primary: string; secondary: string };
  players: Player[];
}

/** 球员逐场记录 */
export interface PlayerMatchLog {
  matchId: string;
  date: string;
  opponent: string;
  minutesPlayed: number;
  isStart: boolean;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  yellowCard: boolean;
  redCard: boolean;
  rating: number | null;
  foulsCommitted?: number;
  offsides?: number;
}

export interface Player {
  id: string;
  fifaId?: string;
  fifaTeamId?: string;
  name: string;
  nameEn: string;
  team: string;
  position: string;
  number: number;
  isStar: boolean;

  // 身体数据
  age?: number;
  height?: number;
  weight?: number;
  preferredFoot?: string;
  nationality?: string;

  // 俱乐部
  club?: string;
  clubEn?: string;
  photoUrl?: string;

  /** 数据来源：fifa=官方数据, generated=自动生成 */
  dataSource?: "fifa" | "generated";

  /** 世界杯参赛届数 */
  worldCupApps?: number;

  // 赛事累计数据（随比赛进行增量更新）
  stats: PlayerTournamentStats;

  /** 逐场记录（比赛后追加） */
  matchLog?: PlayerMatchLog[];
}

export interface PlayerTournamentStats {
  /** 出场次数 */
  appearances: number;
  /** 首发次数 */
  starts: number;
  /** 出场时间（分钟） */
  minutesPlayed: number;
  /** 进球 */
  goals: number;
  /** 点球进球 */
  penalties: number;
  /** 助攻 */
  assists: number;
  /** 射门 */
  shots: number;
  /** 射正 */
  shotsOnTarget: number;
  /** 跑动距离（公里） */
  distanceKm: number;
  /** 黄牌 */
  yellowCards: number;
  /** 红牌 */
  redCards: number;
  /** 犯规 */
  foulsCommitted: number;
  /** 被犯规 */
  foulsSuffered: number;
  /** 越位 */
  offsides: number;
  /** 传球次数 */
  passes: number;
  /** 传球成功率 */
  passAccuracy?: number;
  /** 抢断 */
  tackles: number;
  /** 比赛评分记录 */
  matchRatings: number[];
}

/** 数据更新状态 */
export interface DataUpdateStatus {
  lastUpdated: string;
  dataSource: string;
  playersUpdated: number;
  matchesUpdated: number;
  errors?: string[];
}
