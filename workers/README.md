# Predictions Worker

This Worker accepts nickname-based prediction submissions and writes immutable JSON events to a GitHub branch. The static site keeps its current pages and reads the aggregated `src/data/bets/index.json`.

## Endpoints

- `GET /health`
- `POST /api/register`
- `POST /api/bets`
- `POST /api/cancel`

`POST /api/bets` body:

```json
{
  "username": "阿北",
  "deviceId": "browser-generated-device-id",
  "matchId": "A01",
  "matchLabel": "墨西哥 vs 南非",
  "betType": "home_win",
  "amount": 20,
  "odds": 1.82,
  "clientTimestamp": "2026-06-10T12:00:00+08:00"
}
```

`POST /api/cancel` body:

```json
{
  "username": "阿北",
  "deviceId": "browser-generated-device-id",
  "matchId": "A01",
  "betId": "submitted-bet-event-id",
  "clientTimestamp": "2026-06-10T12:10:00+08:00"
}
```

## GitHub Secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `PREDICTIONS_GITHUB_TOKEN`

`PREDICTIONS_GITHUB_TOKEN` needs repository Contents read/write permission.

## Setup

Create the submissions branch once before the first write:

```bash
git switch --orphan prediction-submissions
git rm -rf .
mkdir events
touch events/.gitkeep
git add events/.gitkeep
git commit -m "chore: initialize prediction submissions"
git push origin prediction-submissions
git switch main
```

After deploying the Worker, set the repository variable `PREDICTION_API_BASE` to the Worker URL, then rerun the Pages deploy workflow.
