export const LOCAL_SNAPSHOT_UPDATED_AT = "__clientUpdatedAt";

export function markLocalUserSnapshot(user, updatedAt = new Date().toISOString()) {
  if (!user) return user;
  return {
    ...user,
    totalBets: user.bets?.length ?? user.totalBets ?? 0,
    [LOCAL_SNAPSHOT_UPDATED_AT]: updatedAt,
  };
}

export function resolveUserRecordSnapshot(remoteUser, localUser, username, remoteLastUpdated = "") {
  const local = sameUser(localUser, username) ? localUser : null;
  const remote = sameUser(remoteUser, username) ? remoteUser : null;

  if (!remote) return local;
  if (!local) return remote;

  const localUpdatedAt = timestamp(local[LOCAL_SNAPSHOT_UPDATED_AT]);
  const remoteUpdatedAt = timestamp(remoteLastUpdated);

  if (localUpdatedAt && (!remoteUpdatedAt || localUpdatedAt > remoteUpdatedAt)) {
    return local;
  }

  return remote;
}

function sameUser(user, username) {
  return user && user.username === username;
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
