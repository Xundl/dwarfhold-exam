import { logActivity } from "./activityLog";
import type { ColonyState, Dwarf } from "./types";

/** D2: an equipped tool adds this many units per day to the resource of the carrier's job. */
export const TOOL_BONUS = 1;

/** Tools can change hands while the dwarf is in the hold: working, idle, on strike. Not on an expedition. */
const isInHold = (dwarf: Dwarf) => dwarf.status !== "expedition";

export const canEquipTool = (state: ColonyState, dwarf: Dwarf) =>
  state.resources.tools > 0 && isInHold(dwarf) && !dwarf.hasTool;

export const canReturnTool = (dwarf: Dwarf) => isInHold(dwarf) && dwarf.hasTool;

/** How many tools are carried by dwarves. Free tools + equipped tools is the colony's total. */
export const equippedTools = (state: ColonyState) =>
  state.dwarves.filter((dwarf) => dwarf.hasTool).length;

/** Moves one tool between the stores and a dwarf. change = -1 takes it from the stores, +1 puts it back. */
function moveTool(state: ColonyState, dwarfId: string, change: -1 | 1): ColonyState {
  return {
    ...state,
    resources: { ...state.resources, tools: state.resources.tools + change },
    dwarves: state.dwarves.map((dwarf) =>
      dwarf.id === dwarfId ? { ...dwarf, hasTool: change === -1 } : dwarf,
    ),
  };
}

/** Gives a free tool from the stores to a dwarf. An invalid attempt changes nothing. */
export function equipTool(state: ColonyState, dwarfId: string): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  if (!dwarf || !canEquipTool(state, dwarf)) return state;

  return logActivity(moveTool(state, dwarfId, -1), `${dwarf.name} takes a tool from the stores.`);
}

/** Puts a dwarf's tool back into the stores. An invalid attempt changes nothing. */
export function returnTool(state: ColonyState, dwarfId: string): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  if (!dwarf || !canReturnTool(dwarf)) return state;

  return logActivity(moveTool(state, dwarfId, 1), `${dwarf.name} returns the tool to the stores.`);
}

/** Used when a dwarf leaves on an expedition: the tool stays behind. No chronicle entry of its own. */
export function stowTool(state: ColonyState, dwarfId: string): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  return dwarf?.hasTool ? moveTool(state, dwarfId, 1) : state;
}
