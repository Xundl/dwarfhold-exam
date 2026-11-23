// expeditions (d4): depart, success, failure, every expedition gets an id and is stored as pending until answer arrives, answer only counts while still pending and is removed then, so reward is applied exactly once and late, repeated or unknown answers are ignored
// writes chronicle entries
import { logActivity } from "./activityLog";
// goblin attack after success (d7)
import { raidAfterExpedition } from "./raid";
// puts tool back into stores at departure
import { stowTool } from "./equipment";
// status at home, is resident available
import { homeStatus, isAvailable } from "./simulation";
// elf joins after success (d6)
import { welcomeNewcomer } from "./species";
// types only
import type { ColonyState, ExpeditionResult, ResourceKey } from "./types";

// ends a pending expedition: removes it and brings resident home, returns null if it is not pending (shared by success and failure)
function endExpedition(state: ColonyState, expeditionId: string) {
  // find expedition by id in pending list
  const expedition = state.expeditions.find((item) => item.id === expeditionId);
  // not pending (already handled, timed out, unknown) = null
  if (!expedition) return null;

  // new state
  const next: ColonyState = {
    // copy the rest
    ...state,
    // pending list without this expedition
    expeditions: state.expeditions.filter((item) => item.id !== expeditionId),
    // go through residents
    dwarves: state.dwarves.map((dwarf) =>
      // is it the traveller
      dwarf.id === expedition.dwarfId
        // yes: back home, status from remembered job (working or idle)
        ? { ...dwarf, status: homeStatus(dwarf.assignment) }
        // no: unchanged
        : dwarf,
    ),
  };
  // give back new state and ended expedition (caller needs destination and traveller)
  return { next, expedition };
}

// resident leaves on expedition
export function departOnExpedition(
  // current state
  state: ColonyState,
  // id created by provider (uuid)
  expeditionId: string,
  // who travels
  dwarfId: string,
  // where to
  destination: string,
): ColonyState {
  // find resident by id
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  // guard: unknown, away or on strike = cannot leave, same state back
  if (!dwarf || !isAvailable(dwarf)) return state;

  // equipped tool does not travel (team decision d2/d4), goes back to stores so someone else can use it
  const stowed = stowTool(state, dwarfId);

  // new state, based on state after tool was put back
  const next: ColonyState = {
    // copy the rest
    ...stowed,
    // pending list
    expeditions: [
      // all old ones
      ...stowed.expeditions,
      // plus new one with id, traveller, destination and day
      { id: expeditionId, dwarfId, destination, departedDay: stowed.day },
    ],
    // go through residents
    dwarves: stowed.dwarves.map((item) =>
      // traveller gets status expedition, others unchanged
      item.id === dwarfId ? { ...item, status: "expedition" } : item,
    ),
  };

  // chronicle entry
  return logActivity(
    // on new state
    next,
    // text, with extra sentence if a tool stayed behind (dwarf = resident before departure, so has-tool is still true here)
    `${dwarf.name} departed for ${destination.replace("-", " ")}.${dwarf.hasTool ? " The tool stays in the stores." : ""}`,
  );
}

// answer of server arrived: success
export function completeExpedition(
  // current state
  state: ColonyState,
  // which expedition
  expeditionId: string,
  // answer of server (rewards and text)
  result: ExpeditionResult,
): ColonyState {
  // end expedition and bring resident home
  const ended = endExpedition(state, expeditionId);
  // null = not pending anymore (already handled, timed out or unknown) = ignore, same state back (this makes reward exactly once)
  if (!ended) return state;

  // copy of stores
  const resources = { ...ended.next.resources };
  // go through rewards (pairs of resource name and amount)
  Object.entries(result.rewards).forEach(([key, amount]) => {
    // add amount to that resource (?? 0 = missing amount counts as zero)
    resources[key as ResourceKey] += amount ?? 0;
  });

  // state with rewards and green chronicle entry with server text
  const rewarded = logActivity({ ...ended.next, resources }, result.message, "good");

  // first success at crystal cave brings the elf (d6), otherwise unchanged
  const settled = welcomeNewcomer(rewarded, ended.expedition.destination);

  // find traveller for the report
  const scout = settled.dwarves.find((dwarf) => dwarf.id === ended.expedition.dwarfId);
  // success at goblin warren is followed by attack right now (d7), failed expedition never reaches this function so it can never cause an attack
  return raidAfterExpedition(settled, ended.expedition.destination, scout?.name ?? "the scout");
}

// expedition failed (server error, unreachable, timeout, unreadable answer, refresh): no reward, resident comes home
export function failExpedition(
  // current state
  state: ColonyState,
  // which expedition
  expeditionId: string,
  // text for chronicle
  reason: string,
): ColonyState {
  // end expedition and bring resident home
  const ended = endExpedition(state, expeditionId);
  // not pending anymore = ignore, same state back
  if (!ended) return state;

  // red chronicle entry with reason
  return logActivity(ended.next, reason, "warning");
}