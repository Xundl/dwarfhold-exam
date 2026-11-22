import { logActivity } from "./activityLog";
import { stowTool } from "./equipment";
import { homeStatus, isAvailable } from "./simulation";
import type { ColonyState, DwarfStatus, ExpeditionResult, ResourceKey } from "./types";

/*
 * Starter behaviour moved out of the provider into pure functions.
 * Still open for D4: eligibility checks, rewards exactly once, one pending state per dwarf.
 */

function setStatus(state: ColonyState, dwarfId: string, status: DwarfStatus | "home"): ColonyState {
  return {
    ...state,
    dwarves: state.dwarves.map((dwarf) =>
      dwarf.id === dwarfId
        ? { ...dwarf, status: status === "home" ? homeStatus(dwarf.assignment) : status }
        : dwarf,
    ),
  };
}

export function departOnExpedition(state: ColonyState, dwarfId: string, destination: string): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  // A dwarf who is away or on strike cannot leave.
  if (!dwarf || !isAvailable(dwarf)) return state;

  // D2/D4: an equipped tool does not travel. It goes back to the stores and can be given to someone else.
  return logActivity(
    setStatus(stowTool(state, dwarfId), dwarfId, "expedition"),
    `${dwarf.name} departed for ${destination.replace("-", " ")}.${dwarf.hasTool ? " The tool stays in the stores." : ""}`,
  );
}

export function completeExpedition(state: ColonyState, dwarfId: string, result: ExpeditionResult): ColonyState {
  const resources = { ...state.resources };
  Object.entries(result.rewards).forEach(([key, amount]) => {
    resources[key as ResourceKey] += amount ?? 0;
  });

  return logActivity(
    { ...setStatus(state, dwarfId, "home"), resources },
    result.message,
    "good",
  );
}

/** A failed expedition gives no reward and brings the dwarf back home. */
export function failExpedition(state: ColonyState, dwarfId: string, reason: string): ColonyState {
  return logActivity(setStatus(state, dwarfId, "home"), reason, "warning");
}
