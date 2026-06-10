export function createReferenceOdds(matches, updatedAt = new Date().toISOString()) {
  return matches.map((match) => {
    const seed = hash(match.id);
    const homeFavored = seed % 3 !== 0;
    const favorite = 1.55 + ((seed % 45) / 100);
    const outsider = 2.75 + ((Math.floor(seed / 8) % 180) / 100);
    const draw = 3.05 + ((Math.floor(seed / 32) % 90) / 100);
    const home = homeFavored ? favorite : outsider;
    const away = homeFavored ? outsider : favorite;

    return {
      match_id: match.id,
      home_win: roundOdds(home),
      draw: roundOdds(draw),
      away_win: roundOdds(away),
      bookmaker: "worldcup-codex",
      updated_at: updatedAt,
    };
  });
}

function hash(value) {
  let result = 2166136261;
  for (const char of value) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function roundOdds(value) {
  return Math.round(value * 100) / 100;
}
