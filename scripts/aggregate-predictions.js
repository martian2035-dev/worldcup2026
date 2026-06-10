import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { settlePredictionEvents } from "./predictions/core.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const submissionsDir = process.env.PREDICTION_SUBMISSIONS_DIR ?? join(root, "tmp/prediction-submissions/events");
const predictionsDir = join(root, "src/data/predictions");
const betsPath = join(root, "src/data/bets/index.json");
const updatedAt = process.env.PREDICTION_NOW ?? new Date().toISOString();

const [rules, matchesData, oddsData] = await Promise.all([
  readJson(join(predictionsDir, "rules.json")).catch(() => ({
    initialBeans: 10000,
    minimumStake: 10,
    maximumStake: 100,
    closeMinutesBeforeKickoff: 5,
  })),
  readJson(join(root, "src/data/matches.json")),
  readJson(join(root, "src/data/odds.json")),
]);

const events = await readSubmissionEvents(submissionsDir);
if (!events.length) {
  console.log("No prediction submissions found.");
  process.exit(0);
}

const result = settlePredictionEvents(events, {
  rules,
  matches: matchesData.matches ?? [],
  odds: oddsData,
  now: new Date(updatedAt),
});

await writeJson(betsPath, result.betData);
await writeJson(join(predictionsDir, "leaderboard.json"), {
  version: 1,
  updatedAt,
  leaders: result.leaderboard,
});
await writeJson(join(predictionsDir, "bets-public.json"), {
  version: 1,
  updatedAt,
  bets: result.bets,
});
await writeJson(join(predictionsDir, "rejections.json"), {
  version: 1,
  updatedAt,
  rejections: result.rejections,
});

console.log(`Aggregated ${events.length} prediction events, accepted ${result.bets.length}, rejected ${result.rejections.length}.`);

async function readSubmissionEvents(dir) {
  const files = await listJsonFiles(dir).catch(() => []);
  const events = [];

  for (const file of files) {
    try {
      events.push(await readJson(file));
    } catch (error) {
      events.push({
        id: `invalid-${file}`,
        type: "invalid",
        username: "",
        matchId: "",
        serverTimestamp: updatedAt,
        parseError: error.message,
      });
    }
  }

  return events;
}

async function listJsonFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJsonFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(path);
    }
  }

  return files.sort();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
