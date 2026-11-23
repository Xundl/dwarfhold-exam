// daily simulation (d1): production, meals, hunger and strike, game over, job assignment
// writes chronicle entries
import { logActivity } from "./activityLog";
// questions about one resident (status at home, is at home)
import { homeStatus, isAtHome } from "./dwarves";
// bonus per tool (+1)
import { TOOL_BONUS } from "./equipment";
// recipe table and one work day at forge
import { recipes, workAtForge } from "./forge";
// which job gives which resource, amount per species
import { jobResource, yieldOf } from "./species";
// types only
import type {
  ColonyState,
  Dwarf,
  Job,
  JobType,
  Resources,
} from "./types";

// re-export, so old imports from simulation still work
export { homeStatus, isAtHome, isAvailable } from "./dwarves";

// job a resident really does today, or null
export function activeJob(dwarf: Dwarf): Job | null {
  // not working, no job or hungry (strike) = nothing today
  if (dwarf.status !== "working" || !dwarf.assignment || dwarf.hungry) return null;
  // otherwise own job
  return dwarf.assignment;
}

// extra units from tool today, only if resident carries tool and really works (d2)
export const toolBonus = (dwarf: Dwarf) =>
  dwarf.hasTool && activeJob(dwarf) ? TOOL_BONUS : 0;

// what colony produces today, used by simulation and by shift ledger (same function = display cannot differ from rule)
export function expectedProduction(state: ColonyState): Resources {
  // start with zero of everything
  const total: Resources = { wood: 0, stone: 0, food: 0, tools: 0, weapons: 0 };

  // go through all residents
  state.dwarves.forEach((dwarf) => {
    // job done today
    const job = activeJob(dwarf);
    // no job = adds nothing, go to next resident
    if (!job) return;

    // add base amount of species (d6) plus tool bonus to the resource of that job
    total[jobResource[job]] += yieldOf(dwarf, job) + toolBonus(dwarf);
  });

  // finished sum
  return total;
}

// meals needed per day = number of residents, travellers eat too
export const mealsNeeded = (state: ColonyState) => state.dwarves.length;

// hands out evening meals, one food per resident, returns updated residents (who ate) and leftover food
export function serveMeals(dwarves: Dwarf[], food: number): { dwarves: Dwarf[]; food: number } {
  // who eats first (queue)
  const queue = [
    // hungry people
    ...dwarves.filter((dwarf) => dwarf.hungry),
    // the rest in roster order (roster order = order of residents list in state, same order as on screen)
    ...dwarves.filter((dwarf) => !dwarf.hungry),
  ];
  // first residents in queue get meal (as many as there is food), remember their id
  const served = new Set(queue.slice(0, food).map((dwarf) => dwarf.id));

  // return new list, old list is not changed (pure function: react only notices a change if it gets a new object, and tests can compare before and after)
  return {
    // go through residents in original order
    dwarves: dwarves.map((dwarf) => {
      // hungry = got no meal tonight
      const hungry = !served.has(dwarf.id);
      // nothing changed = keep same object, otherwise copy with new value
      return hungry === dwarf.hungry ? dwarf : { ...dwarf, hungry };
    }),
    // leftover food (one less per served meal)
    food: food - served.size,
  };
}

// colony lost (game over): nobody can ever farm again
export const hasStarved = (state: ColonyState) =>
  // stores empty
  state.resources.food === 0 &&
  // there are residents
  state.dwarves.length > 0 &&
  // all of them hungry
  state.dwarves.every((dwarf) => dwarf.hungry);

// one day: first work (jobs and forge), then meals
export function advanceDay(state: ColonyState): ColonyState {
  // production of today
  const produced = expectedProduction(state);
  // one work day at forge (updated smiths, finished orders)
  const forge = workAtForge(state.dwarves);
  // meals after work, so today's harvest can already be eaten tonight
  const meals = serveMeals(forge.dwarves, state.resources.food + produced.food);

  // new stores
  const resources: Resources = {
    // copy old values (tools, weapons stay)
    ...state.resources,
    // add wood
    wood: state.resources.wood + produced.wood,
    // add stone
    stone: state.resources.stone + produced.stone,
    // food left after meals
    food: meals.food,
  };
  // every finished forge order
  forge.finished.forEach(({ recipe }) => {
    // adds one product (tool or weapon) to stores
    resources[recipes[recipe].product] += 1;
  });

  // next state (let = gets replaced below when log entries are added)
  let next: ColonyState = {
    // copy the rest
    ...state,
    // next day
    day: state.day + 1,
    // new stores
    resources,
    // residents after meals
    dwarves: meals.dwarves,
  };

  // one chronicle entry per finished forge order
  forge.finished.forEach(({ name, recipe }) => {
    // green entry with name and product text
    next = logActivity(next, `${name} finished at the forge. ${recipes[recipe].done}`, "good");
  });

  // everyone hungry and no food left
  if (hasStarved(next)) {
    // game over entry, stop here (no single strike reports needed)
    return logActivity(next, "The stores are empty and everyone is hungry. Stonehome has starved.", "warning");
  }

  // compare every resident before and after meals
  state.dwarves.forEach((before, index) => {
    // same resident after meals (same position in list)
    const after = meals.dwarves[index];
    // newly hungry
    if (!before.hungry && after.hungry) {
      // strike report, last true = must be acknowledged
      next = logActivity(next, `${after.name} got no meal. ${after.name} is hungry and refuses to work until fed.`, "warning", true);
    }
    // was hungry and got meal
    if (before.hungry && !after.hungry) {
      // back at work entry
      next = logActivity(next, `${after.name} has eaten and is back at work.`, "good");
    }
  });

  // finished state of new day
  return next;
}

// changes local job of a resident
export function assignDwarf(state: ColonyState, dwarfId: string, assignment: JobType): ColonyState {
  // find resident by id
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  // guard: unknown, not at home, or already this job = same state back
  if (!dwarf || !isAtHome(dwarf) || dwarf.assignment === assignment) return state;

  // new state
  const next: ColonyState = {
    // copy the rest
    ...state,
    // go through residents
    dwarves: state.dwarves.map((item) =>
      // is it this one
      item.id === dwarfId
        // yes: new job and matching status (working or idle)
        ? { ...item, assignment, status: homeStatus(assignment) }
        // no: unchanged
        : item,
    ),
  };

  // chronicle entry
  return logActivity(next, `${dwarf.name} assigned to ${jobLabel(assignment)}.`);
}

// display name of a job (lookup in small table), null = unassigned
export const jobLabel = (job: JobType) => job ? ({
  woodcutting: "Woodcutting",
  mining: "Deep Mining",
  farming: "Mushroom Farm"
}[job]) : "Unassigned";
