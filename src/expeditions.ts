import { logActivity } from "./activityLog";
import { homeStatus, isAvailable } from "./simulation";
import type { ColonyState, ExpeditionResult, ResourceKey } from "./types";

/*
 * D4: every expedition gets an id and is stored as "pending" until its answer arrives.
 * An answer is only applied if its expedition is still pending, and then removed.
 * So rewards are applied exactly once, and late, repeated or unknown answers are ignored.
 */

/** Ends a pending expedition: removes it and brings the dwarf home. Returns null if it is not pending. */
function endExpedition(state: ColonyState, expeditionId: string) {
  const expedition = state.expeditions.find((item) => item.id === expeditionId);
  if (!expedition) return null;

  const next: ColonyState = {
    ...state,
    expeditions: state.expeditions.filter((item) => item.id !== expeditionId),
    dwarves: state.dwarves.map((dwarf) =>
      dwarf.id === expedition.dwarfId
        ? { ...dwarf, status: homeStatus(dwarf.assignment) }
        : dwarf,
    ),
  };
  return { next, expedition };
}

export function departOnExpedition(
  state: ColonyState,
  expeditionId: string,
  dwarfId: string,
  destination: string,
): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  // Away, on strike or unknown: the dwarf cannot leave. Nothing changes.
  if (!dwarf || !isAvailable(dwarf)) return state;

  const next: ColonyState = {
    ...state,
    expeditions: [
      ...state.expeditions,
      { id: expeditionId, dwarfId, destination, departedDay: state.day },
    ],
    dwarves: state.dwarves.map((item) =>
      item.id === dwarfId ? { ...item, status: "expedition" } : item,
    ),
  };

  return logActivity(next, `${dwarf.name} departed for ${destination.replace("-", " ")}.`);
}

export function completeExpedition(
  state: ColonyState,
  expeditionId: string,
  result: ExpeditionResult,
): ColonyState {
  const ended = endExpedition(state, expeditionId);
  if (!ended) return state; // already handled, timed out or unknown → ignore

  const resources = { ...ended.next.resources };
  Object.entries(result.rewards).forEach(([key, amount]) => {
    resources[key as ResourceKey] += amount ?? 0;
  });

  return logActivity({ ...ended.next, resources }, result.message, "good");
}

/** A failed expedition gives no reward and brings the dwarf back home. */
export function failExpedition(
  state: ColonyState,
  expeditionId: string,
  reason: string,
): ColonyState {
  const ended = endExpedition(state, expeditionId);
  if (!ended) return state;

  return logActivity(ended.next, reason, "warning");
}