const betTypes = new Set(["home_win", "draw", "away_win"]);

export function settlePredictionEvents(events, { rules, matches, odds, now = new Date() }) {
  const context = createContext({ rules, matches, odds });
  const accounts = new Map();
  const activeBetKeys = new Set();
  const seenEvents = new Set();
  const acceptedBets = [];
  const rejections = [];

  const orderedEvents = [...events].sort((a, b) => eventTime(a) - eventTime(b));

  for (const event of orderedEvents) {
    if (seenEvents.has(event.id)) {
      rejections.push(rejectionFor(event, "duplicate-event", "重复事件"));
      continue;
    }
    seenEvents.add(event.id);

    const validation = validateEvent(event, context);
    if (!validation.ok) {
      rejections.push(rejectionFor(event, validation.reason, validation.message));
      continue;
    }

    const account = ensureAccount(accounts, event.accountId, event, rules);
    if (event.type === "register") continue;

    const betKey = `${account.id}|${event.matchId}`;
    if (activeBetKeys.has(betKey)) {
      rejections.push(rejectionFor(event, "duplicate-match-bet", "每个账号每场比赛只能押一次"));
      continue;
    }

    if (event.amount > account.beans) {
      rejections.push(rejectionFor(event, "insufficient-beans", "可用豆不足"));
      continue;
    }

    const match = context.matchesById.get(event.matchId);
    const bet = {
      id: event.id,
      username: account.username,
      matchId: event.matchId,
      matchLabel: event.matchLabel || `${match.home?.name ?? "主队"} vs ${match.away?.name ?? "客队"}`,
      betType: event.betType,
      amount: Number(event.amount),
      odds: Number(event.odds),
      status: "pending",
      payout: null,
      createdAt: event.serverTimestamp ?? event.clientTimestamp,
    };

    account.beans -= bet.amount;
    account.totalBets += 1;
    account.bets.push(bet);
    acceptedBets.push(bet);
    activeBetKeys.add(betKey);
  }

  for (const account of accounts.values()) {
    for (const bet of account.bets) {
      const match = context.matchesById.get(bet.matchId);
      const settlement = settleBet(bet, match, now);
      bet.status = settlement.status;
      bet.payout = settlement.payout;

      if (settlement.status === "won") {
        account.beans += settlement.payout;
        account.wonBets += 1;
      }
      if (settlement.status === "refunded") {
        account.beans += settlement.payout;
      }
    }
  }

  return {
    betData: {
      users: usersFromAccounts(accounts),
      lastUpdated: now.toISOString(),
    },
    leaderboard: [...accounts.values()]
      .map(accountToUserRecord)
      .sort((a, b) => b.beans - a.beans || b.wonBets - a.wonBets || a.username.localeCompare(b.username, "zh-CN")),
    bets: acceptedBets,
    rejections,
  };
}

export function validateEvent(event, context) {
  if (!event || typeof event !== "object") return reject("invalid-event", "事件格式无效");
  if (!event.id || typeof event.id !== "string") return reject("invalid-id", "事件缺少 id");
  if (!event.accountId || typeof event.accountId !== "string") return reject("invalid-account", "事件缺少账号");
  if (!isValidUsername(event.username)) return reject("invalid-username", "昵称无效");

  if (event.type === "register") return { ok: true };
  if (event.type !== "bet") return reject("invalid-type", "不支持的事件类型");
  if (!event.matchId || !context.matchesById.has(event.matchId)) return reject("unknown-match", "未知比赛");
  if (!betTypes.has(event.betType)) return reject("invalid-bet-type", "竞猜选项无效");

  const amount = Number(event.amount);
  if (!Number.isInteger(amount) || amount < context.rules.minimumStake || amount > context.rules.maximumStake) {
    return reject("amount-out-of-range", "投注豆数超出范围");
  }

  const match = context.matchesById.get(event.matchId);
  const placedAt = new Date(event.serverTimestamp ?? event.clientTimestamp ?? Date.now());
  if (placedAt >= closeTimeFor(match, context.rules)) return reject("after-close", "该场比赛已封盘");

  const market = context.oddsByMatchId.get(event.matchId);
  const currentOdds = Number(market?.[event.betType]);
  const lockedOdds = Number(event.odds);
  if (!Number.isFinite(lockedOdds) || lockedOdds <= 1) return reject("invalid-odds", "锁单赔率无效");
  if (!Number.isFinite(currentOdds)) return reject("missing-odds", "缺少该场赔率");
  if (Math.abs(currentOdds - lockedOdds) > 0.001) return reject("odds-changed", "赔率已变化，请刷新后重试");

  return { ok: true };
}

export function createContext({ rules, matches, odds }) {
  return {
    rules: {
      initialBeans: 10000,
      minimumStake: 10,
      maximumStake: 100,
      closeMinutesBeforeKickoff: 5,
      ...rules,
    },
    matchesById: new Map(matches.map((match) => [match.id, match])),
    oddsByMatchId: new Map((odds.odds ?? odds).map((item) => [item.match_id, item])),
  };
}

export function closeTimeFor(match, rules) {
  const kickoff = match.datetime ?? match.kickoff;
  return new Date(new Date(kickoff).getTime() - rules.closeMinutesBeforeKickoff * 60 * 1000);
}

function settleBet(bet, match, now) {
  if (!match) return { status: "pending", payout: null };
  if (["void", "postponed", "cancelled"].includes(match.status)) {
    return { status: "refunded", payout: bet.amount };
  }
  if (match.status !== "finished" || !hasScore(match.score)) {
    return { status: "pending", payout: null };
  }
  if (new Date(match.datetime) > now) {
    return { status: "pending", payout: null };
  }

  const winningBetType = matchBetType(match);
  if (!winningBetType) return { status: "pending", payout: null };
  if (bet.betType === winningBetType) {
    return { status: "won", payout: Math.round(bet.amount * bet.odds) };
  }
  return { status: "lost", payout: 0 };
}

function matchBetType(match) {
  const home = Number(match.score?.home);
  const away = Number(match.score?.away);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  if (home > away) return "home_win";
  if (away > home) return "away_win";
  return "draw";
}

function hasScore(score) {
  return Number.isFinite(Number(score?.home)) && Number.isFinite(Number(score?.away));
}

function ensureAccount(accounts, accountId, event, rules) {
  if (accounts.has(accountId)) return accounts.get(accountId);

  const account = {
    id: accountId,
    username: normalizeUsername(event.username),
    beans: rules.initialBeans,
    totalBets: 0,
    wonBets: 0,
    createdAt: event.serverTimestamp ?? event.clientTimestamp ?? new Date().toISOString(),
    bets: [],
  };
  accounts.set(accountId, account);
  return account;
}

function usersFromAccounts(accounts) {
  return Object.fromEntries([...accounts.values()].map((account) => [account.username, accountToUserRecord(account)]));
}

function accountToUserRecord(account) {
  return {
    username: account.username,
    beans: account.beans,
    totalBets: account.totalBets,
    wonBets: account.wonBets,
    createdAt: account.createdAt,
    bets: account.bets,
  };
}

function eventTime(event) {
  return new Date(event.serverTimestamp ?? event.clientTimestamp ?? 0).getTime();
}

function normalizeUsername(value) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

function isValidUsername(value) {
  return /^[\p{Script=Han}A-Za-z0-9_]{2,16}$/u.test(normalizeUsername(value));
}

function rejectionFor(event, reason, message) {
  return {
    eventId: event?.id ?? "",
    username: event?.username ?? "",
    matchId: event?.matchId ?? "",
    reason,
    message,
  };
}

function reject(reason, message) {
  return { ok: false, reason, message };
}
