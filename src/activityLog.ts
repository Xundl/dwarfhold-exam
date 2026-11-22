import type { Activity, ColonyState } from "./types";

const MAX_ACTIVITIES = 6;

/**
 * Returns a new state with one more chronicle entry on top. Pure: the id comes from a counter in the state.
 * With needsAck the entry is a report the player has to acknowledge before the next day starts.
 */
export function logActivity(
  state: ColonyState,
  message: string,
  tone?: Activity["tone"],
  needsAck = false,
): ColonyState {
  const activityCount = state.activityCount + 1;
  const entry: Activity = {
    id: `activity-${activityCount}`,
    day: state.day,
    message,
    tone,
    ...(needsAck ? { needsAck: true } : {}),
  };

  // Unacknowledged reports are never dropped; ordinary entries fill the remaining places.
  const all = [entry, ...state.activities];
  const pending = all.filter((item) => item.needsAck);
  const others = all
    .filter((item) => !item.needsAck)
    .slice(0, Math.max(0, MAX_ACTIVITIES - pending.length));
  const kept = new Set([...pending, ...others]);
  const activities = all.filter((item) => kept.has(item));

  return { ...state, activityCount, activities };
}

/** True while at least one report waits for the player. The day clock stands still meanwhile. */
export const awaitingAcknowledgement = (state: ColonyState) =>
  state.activities.some((item) => item.needsAck);

/** Marks one report as seen. It becomes an ordinary entry; a strike itself only ends with a meal. */
export function acknowledgeActivity(state: ColonyState, activityId: string): ColonyState {
  if (!state.activities.some((item) => item.id === activityId && item.needsAck)) return state;

  return {
    ...state,
    activities: state.activities.map((item) =>
      item.id === activityId
        ? { id: item.id, day: item.day, message: item.message }
        : item,
    ),
  };
}
