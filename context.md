# World Cup CNB Migration Context

## Goal

Migrate this project from GitHub-centered hosting/automation to CNB, with the migrated local workspace at `~/dev/worldcup_cnb`.

The recommended architecture is:

- CNB owns the source repository and CI pipelines.
- CNB runs tests, builds, data refreshes, and odds refreshes through `.cnb.yml`.
- Cloudflare Worker remains the public prediction API.
- Prediction storage should be moved away from GitHub branches in a follow-up step, preferably to Cloudflare D1. KV is acceptable for simple event storage, but D1 is better for users, bets, cancellations, and leaderboards.

CNB documentation used for this plan:

- CNB uses a repository-root `.cnb.yml` configuration file.
- CNB pipelines run inside Docker images, for example `node:22`.
- CNB scheduled tasks use branch keys with `"crontab: ..."` entries.
- CNB manual pipelines use `web_trigger` or `web_trigger_*` events.

## Current GitHub Coupling

The project currently depends on GitHub in these places:

- `.github/workflows/deploy.yml`: GitHub Pages build/deploy plus scheduled data and odds updates.
- `.github/workflows/aggregate-predictions.yml`: reads `prediction-submissions` and commits `src/data/bets/index.json`.
- `.github/workflows/deploy-predictions-worker.yml`: deploys the Cloudflare Worker.
- `astro.config.ts`: hard-coded `site: https://martian2035-dev.github.io` and `base: /worldcup2026`.
- `src/lib/store.ts`: reads prediction data from `https://raw.githubusercontent.com/martian2035-dev/worldcup2026/main/src/data/bets/index.json`.
- `workers/predictions-worker.js`: writes prediction events through the GitHub contents API.
- `wrangler.toml`: contains GitHub repository variables and GitHub Pages origin.
- `workers/README.md` and UI text: describe GitHub as the prediction data source.

## Files Changed For CNB Readiness

- `context.md`: this migration context and execution checklist.
- `.cnb.yml`: CNB pipelines for build/test, scheduled data update, and Worker deployment trigger.
- `astro.config.ts`: site URL and base path are now environment-configurable.
- `scripts/configure-predictions.js`: preserves and writes both the Worker API URL and prediction data URL.
- `src/data/predictions/config.json`: adds an optional `betsDataUrl` field.
- `src/lib/store.ts`: prediction aggregate data URL is now configurable via `PUBLIC_BETS_DATA_URL` or `config.json`.

## Recommended Execution Order

1. Commit or copy the current clean project state.
2. Create `~/dev/worldcup_cnb` as the CNB migration workspace.
3. Push `~/dev/worldcup_cnb` to a new CNB repository.
4. Configure CNB repository variables/secrets.
5. Run the CNB `web_trigger` build pipeline.
6. Configure the public site URL and base path.
7. Deploy the static site with CNB or an external static host.
8. Redeploy the Worker with the new allowed origin.
9. Verify prediction flow end to end.
10. Plan and execute the follow-up migration from GitHub branch event storage to Cloudflare D1.

## CNB Variables To Set

Set these in CNB for build/data pipelines:

- `PUBLIC_SITE_URL`: final public site origin, for example `https://your-cnb-site.example.com`.
- `PUBLIC_BASE_PATH`: `/` if deployed at the domain root, or a subpath such as `/worldcup2026`.
- `PUBLIC_PREDICTION_API_BASE`: current Worker URL, currently `https://worldcup2026-predictions.tea106.workers.dev`.
- `PUBLIC_BETS_DATA_URL`: temporary aggregate data URL. Use the raw URL for `src/data/bets/index.json` in CNB, or omit after moving reads to Worker/D1.
- `FIFA_SEASON_ID`: optional, only if FIFA data fetch needs it.
- `ODDS_API_KEY`: optional. If missing, the project falls back to the deterministic reference odds logic.

Set these in CNB only if deploying the current GitHub-backed Worker from CNB:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `PREDICTIONS_GITHUB_TOKEN`

The last variable is legacy. It is still needed while `workers/predictions-worker.js` writes events to GitHub. Remove it after moving prediction storage to D1/KV.

## Manual Steps

### 1. Create CNB Repository

1. Create an empty CNB repository.
2. Push `~/dev/worldcup_cnb` to it:

```bash
cd ~/dev/worldcup_cnb
git remote add cnb <YOUR_CNB_GIT_URL>
git push cnb main
```

If the CNB repository should become `origin`, run:

```bash
cd ~/dev/worldcup_cnb
git remote set-url origin <YOUR_CNB_GIT_URL>
git push origin main
```

### 2. Configure CNB Pipeline Variables

In the CNB repository settings, add the variables listed above. At minimum:

```text
PUBLIC_SITE_URL=<your final site origin>
PUBLIC_BASE_PATH=/
PUBLIC_PREDICTION_API_BASE=https://worldcup2026-predictions.tea106.workers.dev
```

Set `PUBLIC_BETS_DATA_URL` only if keeping temporary aggregate JSON reads. The better final state is to expose prediction reads from the Worker.

### 3. Configure Cloudflare Worker Origin

After the CNB site URL is known, update Worker origin config:

```bash
cd ~/dev/worldcup_cnb
pnpm dlx wrangler@3.90.0 secret put GITHUB_TOKEN
pnpm dlx wrangler@3.90.0 deploy
```

Also update `wrangler.toml`:

```toml
ALLOWED_ORIGIN = "https://your-final-site.example.com"
```

This keeps the current Worker working. The better follow-up is to remove GitHub writes and bind D1.

### 4. Verify Site

Run locally:

```bash
cd ~/dev/worldcup_cnb
pnpm install --frozen-lockfile
pnpm test
PUBLIC_BASE_PATH=/ pnpm run build
```

Then verify in browser:

- Home page loads.
- Schedule and team pages load with correct assets.
- `/bet/` can register/login.
- A single match accepts exactly one active bet.
- Page refresh keeps the active bet visible.
- `/bet/mine/` shows the bet.
- Cancelling from `/bet/mine/` removes it from history.
- Cancelling allows betting on the same match again.

## Worker Migration Recommendation

Do not move the Worker off Cloudflare. Move its storage.

Best option: Cloudflare D1

- Pros: SQL schema, easy uniqueness rule for one active bet per user/match, clean leaderboard queries, no delayed Git aggregation.
- Cons: one-time schema and migration work.

Acceptable option: Cloudflare KV

- Pros: very simple event storage.
- Cons: harder to enforce uniqueness and build leaderboard safely.

Not recommended: CNB repository branch as prediction storage

- Pros: conceptually similar to the current GitHub branch flow.
- Cons: keeps CI/git as a database, still has aggregation delay, makes cancellation/history consistency harder.

## Follow-Up D1 Plan

1. Create D1 database `worldcup2026_predictions`.
2. Add Worker D1 binding in `wrangler.toml`.
3. Add schema for users, bets, and event log.
4. Rewrite Worker endpoints to read/write D1:
   - `POST /api/register`
   - `POST /api/bets`
   - `POST /api/cancel`
   - `GET /api/users/:username`
   - `GET /api/leaderboard`
5. Update `src/lib/store.ts` to read prediction data from Worker instead of raw JSON.
6. Delete the aggregate-predictions pipeline.
7. Remove `PREDICTIONS_GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, and `SUBMISSIONS_BRANCH`.
