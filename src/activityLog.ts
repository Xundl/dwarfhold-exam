// chronicle (log on screen): write entry, check for waiting reports, acknowledge report
// types only
import type { Activity, ColonyState } from "./types";

// max number of entries shown in chronicle
const MAX_ACTIVITIES = 6;

// adds one chronicle entry on top, returns new state (pure: id comes from counter in state, no random)
export function logActivity(
  // current state
  state: ColonyState,
  // text of entry
  message: string,
  // optional colour (good / warning)
  tone?: Activity["tone"],
  // true = report the player must acknowledge before next day starts (default false)
  needsAck = false,
): ColonyState {
  // count up, new number becomes part of id
  const activityCount = state.activityCount + 1;
  // build new entry
  const entry: Activity = {
    // id like activity-7
    id: `activity-${activityCount}`,
    // day it happened
    day: state.day,
    // text (short for message: message)
    message,
    // colour
    tone,
    // add needs-ack only when true (spreading empty object adds nothing)
    ...(needsAck ? { needsAck: true } : {}),
  };

  // new entry first, then old ones (newest on top)
  const all = [entry, ...state.activities];
  // reports still waiting for acknowledge, these are never dropped
  const pending = all.filter((item) => item.needsAck);
  // ordinary entries
  const others = all
    // only those without needs-ack
    .filter((item) => !item.needsAck)
    // keep only as many as still fit (max minus waiting ones, never below 0)
    .slice(0, Math.max(0, MAX_ACTIVITIES - pending.length));
  // set of all entries we keep (set = fast lookup)
  const kept = new Set([...pending, ...others]);
  // filter full list with set so order stays the same
  const activities = all.filter((item) => kept.has(item));

  // copy of state with new counter and new list (old state not changed)
  return { ...state, activityCount, activities };
}

// true while at least one report waits for player, day clock stands still meanwhile
export const awaitingAcknowledgement = (state: ColonyState) =>
  state.activities.some((item) => item.needsAck);

// marks one report as seen, becomes ordinary entry (strike itself only ends with a meal)
export function acknowledgeActivity(state: ColonyState, activityId: string): ColonyState {
  // guard: no such waiting report = return same state (invalid attempt changes nothing)
  if (!state.activities.some((item) => item.id === activityId && item.needsAck)) return state;

  // new state
  return {
    // copy everything else
    ...state,
    // go through all entries
    activities: state.activities.map((item) =>
      // is this the acknowledged one
      item.id === activityId
        // yes: copy without colour and needs-ack (looks like normal entry now)
        ? { id: item.id, day: item.day, message: item.message }
        // no: keep as is
        : item,
    ),
  };
}
