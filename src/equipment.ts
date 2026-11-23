// tools (d2): equip, return, count, put back at departure
// writes chronicle entries
import { logActivity } from "./activityLog";
// types only
import type { ColonyState, Dwarf } from "./types";

// units a tool adds per day to the resource of the carrier's job
export const TOOL_BONUS = 1;

// in the hold = every status except expedition (working, idle, crafting, also on strike), only then tools can change hands
const isInHold = (dwarf: Dwarf) => dwarf.status !== "expedition";

// can equip: a free tool exists, resident is in the hold, resident has no tool yet (max one per resident)
export const canEquipTool = (state: ColonyState, dwarf: Dwarf) =>
  state.resources.tools > 0 && isInHold(dwarf) && !dwarf.hasTool;

// can return: in the hold and carries a tool
export const canReturnTool = (dwarf: Dwarf) => isInHold(dwarf) && dwarf.hasTool;

// number of tools carried by residents, free tools + equipped tools = all tools of colony (this sum must never change by equip or return)
export const equippedTools = (state: ColonyState) =>
  state.dwarves.filter((dwarf) => dwarf.hasTool).length;

// moves one tool between stores and resident, change -1 = take from stores, +1 = put back, one function for both so counter and flag always change together
function moveTool(state: ColonyState, dwarfId: string, change: -1 | 1): ColonyState {
  // new state
  return {
    // copy the rest
    ...state,
    // stores: free tools plus change
    resources: { ...state.resources, tools: state.resources.tools + change },
    // go through residents
    dwarves: state.dwarves.map((dwarf) =>
      // this resident: has-tool is true if tool was taken (-1), false if put back, others unchanged
      dwarf.id === dwarfId ? { ...dwarf, hasTool: change === -1 } : dwarf,
    ),
  };
}

// gives a free tool to a resident
export function equipTool(state: ColonyState, dwarfId: string): ColonyState {
  // find resident by id
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  // guard: unknown or not allowed = same state back (invalid attempt changes nothing)
  if (!dwarf || !canEquipTool(state, dwarf)) return state;

  // move tool to resident and write chronicle entry
  return logActivity(moveTool(state, dwarfId, -1), `${dwarf.name} takes a tool from the stores.`);
}

// puts tool of a resident back into stores
export function returnTool(state: ColonyState, dwarfId: string): ColonyState {
  // find resident by id
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  // guard: unknown or not allowed = same state back
  if (!dwarf || !canReturnTool(dwarf)) return state;

  // move tool to stores and write chronicle entry
  return logActivity(moveTool(state, dwarfId, 1), `${dwarf.name} returns the tool to the stores.`);
}

// used when a resident leaves on expedition (d4 team decision): tool stays home, no own chronicle entry
export function stowTool(state: ColonyState, dwarfId: string): ColonyState {
  // find resident by id
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  // has tool = put back, otherwise nothing (?. = no crash if resident unknown)
  return dwarf?.hasTool ? moveTool(state, dwarfId, 1) : state;
}
