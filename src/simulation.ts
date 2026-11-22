import { logActivity } from "./activityLog";
import { homeStatus, isAtHome } from "./dwarves";
import { TOOL_BONUS } from "./equipment";
import { recipes, workAtForge } from "./forge";
import type {
  ColonyState,
  Dwarf,
  Job,
  JobType,
  ResourceKey,
  Resources,
} from "./types";

// Kept here as well so existing imports from "./simulation" keep working.
export { homeStatus, isAtHome, isAvailable } from "./dwarves";

export const production: Record<Job, Partial<Resources>> = {
  woodcutting: { wood: 3 }, mining: { stone: 2 }, farming: { food: 4 },
};

/**
 * The job a dwarf really performs today, or null.
 * Away or unassigned dwarves do nothing, and a hungry dwarf is on strike.
 */
export function activeJob(dwarf: Dwarf): Job | null {
  if (dwarf.status !== "working" || !dwarf.assignment || dwarf.hungry) return null;
  return dwarf.assignment;
}

/** The extra units a dwarf's tool adds today: only while the dwarf really performs a job (D2). */
export const toolBonus = (dwarf: Dwarf) =>
  dwarf.hasTool && activeJob(dwarf) ? TOOL_BONUS : 0;

/** What the colony will produce on the current day. Used by the simulation AND the Shift Ledger. */
export function expectedProduction(state: ColonyState): Resources {
  const total: Resources = { wood: 0, stone: 0, food: 0, tools: 0, weapons: 0 };

  state.dwarves.forEach((dwarf) => {
    const job = activeJob(dwarf);
    if (!job) return;

    Object.entries(production[job]).forEach(([resource, amount]) => {
      total[resource as ResourceKey] += (amount ?? 0) + toolBonus(dwarf);
    });
  });

  return total;
}

/** Everyone eats one food per day, travellers included (they carry rations from the stores). */
export const mealsNeeded = (state: ColonyState) => state.dwarves.length;

/**
 * Hands out the evening meals, one food each.
 * Order when food is short: hungry dwarves first, then roster order. So the shortage
 * moves through the company instead of always hitting the same dwarf, and the result is deterministic.
 * Whoever gets a meal is fed (bar full); whoever gets none is hungry (bar empty).
 */
export function serveMeals(dwarves: Dwarf[], food: number): { dwarves: Dwarf[]; food: number } {
  const queue = [
    ...dwarves.filter((dwarf) => dwarf.hungry),
    ...dwarves.filter((dwarf) => !dwarf.hungry),
  ];
  const served = new Set(queue.slice(0, food).map((dwarf) => dwarf.id));

  return {
    dwarves: dwarves.map((dwarf) => {
      const hungry = !served.has(dwarf.id);
      return hungry === dwarf.hungry ? dwarf : { ...dwarf, hungry };
    }),
    food: food - served.size,
  };
}

/** The colony is lost when everyone is hungry and nothing is left to eat: nobody will ever farm again. */
export const hasStarved = (state: ColonyState) =>
  state.resources.food === 0 &&
  state.dwarves.length > 0 &&
  state.dwarves.every((dwarf) => dwarf.hungry);

/**
 * One simulation day: the day's work first (jobs and forge), then meals.
 * Shortage rule (D1): a dwarf without a meal is hungry and strikes until fed again.
 */
export function advanceDay(state: ColonyState): ColonyState {
  const produced = expectedProduction(state);
  const forge = workAtForge(state.dwarves);
  const meals = serveMeals(forge.dwarves, state.resources.food + produced.food);

  const resources: Resources = {
    ...state.resources,
    wood: state.resources.wood + produced.wood,
    stone: state.resources.stone + produced.stone,
    food: meals.food,
  };
  forge.finished.forEach(({ recipe }) => {
    resources[recipes[recipe].product] += 1;
  });

  let next: ColonyState = {
    ...state,
    day: state.day + 1,
    resources,
    dwarves: meals.dwarves,
  };

  forge.finished.forEach(({ name, recipe }) => {
    next = logActivity(next, `${name} finished at the forge. ${recipes[recipe].done}`, "good");
  });

  if (hasStarved(next)) {
    return logActivity(next, "The stores are empty and every dwarf is hungry. Stonehome has starved.", "warning");
  }

  state.dwarves.forEach((before, index) => {
    const after = meals.dwarves[index];
    if (!before.hungry && after.hungry) {
      next = logActivity(next, `${after.name} got no meal. ${after.name} is hungry and refuses to work until fed.`, "warning", true);
    }
    if (before.hungry && !after.hungry) {
      next = logActivity(next, `${after.name} has eaten and is back at work.`, "good");
    }
  });

  return next;
}

/** Changes the local job of a dwarf. Only dwarves at home can be reassigned. */
export function assignDwarf(state: ColonyState, dwarfId: string, assignment: JobType): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  if (!dwarf || !isAtHome(dwarf) || dwarf.assignment === assignment) return state;

  const next: ColonyState = {
    ...state,
    dwarves: state.dwarves.map((item) =>
      item.id === dwarfId
        ? { ...item, assignment, status: homeStatus(assignment) }
        : item,
    ),
  };

  return logActivity(next, `${dwarf.name} assigned to ${jobLabel(assignment)}.`);
}

export const jobLabel = (job: JobType) => job ? ({
  woodcutting: "Woodcutting",
  mining: "Deep Mining",
  farming: "Mushroom Farm"
}[job]) : "Unassigned";
