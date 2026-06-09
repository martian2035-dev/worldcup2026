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
  stats: {
    home: { possession: number; shots: number; shotsOnTarget: number; corners: number; fouls: number; yellowCards: number; redCards: number };
    away: { possession: number; shots: number; shotsOnTarget: number; corners: number; fouls: number; yellowCards: number; redCards: number };
  } | null;
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

export interface Team {
  code: string;
  name: string;
  nameEn: string;
  group: string;
  fifaRank: number | null;
  worldCups: number;
  coach: string;
  colors: { primary: string; secondary: string };
  players: Player[];
}

export interface Player {
  id: string;
  name: string;
  nameEn: string;
  team: string;
  position: string;
  number: number;
  isStar: boolean;
  stats: {
    goals: number;
    penalties: number;
    assists: number;
    shots: number;
    shotsOnTarget: number;
    minutesPlayed: number;
    distanceKm: number;
    yellowCards: number;
    redCards: number;
    matchRatings: number[];
  };
}
