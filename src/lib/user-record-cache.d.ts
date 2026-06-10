import type { UserRecord } from "./store";

export const LOCAL_SNAPSHOT_UPDATED_AT: "__clientUpdatedAt";
export type LocalUserRecord = UserRecord & { __clientUpdatedAt?: string };
export function markLocalUserSnapshot<T extends UserRecord>(user: T, updatedAt?: string): T & { __clientUpdatedAt: string };
export function resolveUserRecordSnapshot(
  remoteUser: UserRecord | null,
  localUser: LocalUserRecord | null,
  username: string,
  remoteLastUpdated?: string
): LocalUserRecord | UserRecord | null;
