const betTypes = new Set(["home_win", "draw", "away_win"]);

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};

export async function handleRequest(request, env) {
  const origin = request.headers.get("Origin") ?? "";
  const cors = corsHeaders(origin, env);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!isAllowedOrigin(origin, env)) {
    return jsonResponse({ message: "Origin not allowed" }, 403, cors);
  }

  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse({ ok: true }, 200, cors);
  }

  if (request.method === "POST" && url.pathname === "/api/register") {
    const payload = await safeJson(request);
    const validation = validateRegisterPayload(payload);
    if (!validation.ok) return jsonResponse(validation, 400, cors);

    const event = createEvent("register", payload);
    const persisted = await persistEvent(event, env, cors);
    if (persisted) return persisted;
    return jsonResponse({ ok: true, eventId: event.id, accountId: event.accountId }, 201, cors);
  }

  if (request.method === "POST" && url.pathname === "/api/bets") {
    const payload = await safeJson(request);
    const validation = validateBetPayload(payload);
    if (!validation.ok) return jsonResponse(validation, 400, cors);

    const event = createEvent("bet", payload);
    const persisted = await persistEvent(event, env, cors);
    if (persisted) return persisted;
    return jsonResponse({ ok: true, eventId: event.id, accountId: event.accountId }, 201, cors);
  }

  return jsonResponse({ message: "Not found" }, 404, cors);
}

export function validateRegisterPayload(payload) {
  if (!payload || typeof payload !== "object") return invalid("invalid-json", "请求内容无效");
  const username = normalizeUsername(payload.username);
  if (!isValidUsername(username)) return invalid("invalid-username", "昵称需为 2-16 位中英文、数字或下划线");
  if (!isValidDeviceId(payload.deviceId)) return invalid("invalid-device", "缺少设备标识");
  return { ok: true };
}

export function validateBetPayload(payload) {
  const base = validateRegisterPayload(payload);
  if (!base.ok) return base;
  if (!isValidMatchId(payload.matchId)) return invalid("invalid-match", "比赛编号无效");
  if (!betTypes.has(payload.betType)) return invalid("invalid-bet-type", "竞猜选项无效");

  const amount = Number(payload.amount);
  if (!Number.isInteger(amount) || amount < 10 || amount > 100) {
    return invalid("invalid-amount", "投注豆数需为 10 到 100 的整数");
  }

  const odds = Number(payload.odds);
  if (!Number.isFinite(odds) || odds <= 1 || odds > 100) {
    return invalid("invalid-odds", "赔率无效");
  }

  return { ok: true };
}

export function createEvent(type, payload) {
  const serverTimestamp = new Date().toISOString();
  const username = normalizeUsername(payload.username);
  const accountId = payload.accountId || accountIdFor(username, payload.deviceId);

  return {
    id: crypto.randomUUID(),
    type,
    accountId,
    username,
    deviceId: String(payload.deviceId),
    matchId: payload.matchId,
    matchLabel: payload.matchLabel,
    betType: payload.betType,
    amount: payload.amount === undefined ? undefined : Number(payload.amount),
    odds: payload.odds === undefined ? undefined : Number(payload.odds),
    clientTimestamp: payload.clientTimestamp || serverTimestamp,
    serverTimestamp,
  };
}

async function persistEvent(event, env, cors) {
  try {
    await writeEventToGitHub(event, env);
    return null;
  } catch {
    return jsonResponse({
      ok: false,
      reason: "github-write-failed",
      message: "竞猜单暂时无法写入，请稍后重试。",
    }, 500, cors);
  }
}

export async function writeEventToGitHub(event, env) {
  const owner = requiredEnv(env, "GITHUB_OWNER");
  const repo = requiredEnv(env, "GITHUB_REPO");
  const token = requiredEnv(env, "GITHUB_TOKEN");
  const branch = env.SUBMISSIONS_BRANCH || "prediction-submissions";
  const date = event.serverTimestamp.slice(0, 10).replaceAll("-", "/");
  const path = `events/${date}/${event.id}.json`;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "worldcup-predictions-worker",
    },
    body: JSON.stringify({
      message: `chore: record prediction ${event.id}`,
      branch,
      content: utf8ToBase64(`${JSON.stringify(event, null, 2)}\n`),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub write failed: ${response.status} ${text.slice(0, 160)}`);
  }
}

function corsHeaders(origin, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || origin || "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function isAllowedOrigin(origin, env) {
  if (!origin) return true;
  if (!env.ALLOWED_ORIGIN) return true;
  return origin === env.ALLOWED_ORIGIN;
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

async function safeJson(request) {
  const text = await request.text();
  if (text.length > 4096) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeUsername(value) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

function isValidUsername(value) {
  return /^[\p{Script=Han}A-Za-z0-9_]{2,16}$/u.test(value);
}

function isValidDeviceId(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 80;
}

function isValidMatchId(value) {
  return /^[A-Z]\d{2}$/.test(String(value ?? ""));
}

function invalid(reason, message) {
  return { ok: false, reason, message };
}

function requiredEnv(env, key) {
  if (!env?.[key]) throw new Error(`Missing ${key}`);
  return env[key];
}

function accountIdFor(username, deviceId) {
  const source = `${username.toLowerCase()}|${String(deviceId)}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `acct-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function utf8ToBase64(value) {
  if (typeof Buffer !== "undefined") return Buffer.from(value, "utf8").toString("base64");
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
