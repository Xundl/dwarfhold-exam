import { logActivity } from "./activityLog";
import { TOOL_BONUS } from "./equipment";
import type {
  ColonyState,
  Dwarf,
  DwarfStatus,
  Job,
  JobType,
  ResourceKey,
  Resources,
} from "./types";

export const production: Record<Job, Partial<Resources>> = {
  woodcutting: { wood: 3 }, mining: { stone: 2 }, farming: { food: 4 },
};

/** A dwarf is at home when idle or working. Every other status means "busy elsewhere". */
export const isAtHome = (dwarf: Dwarf) =>
  dwarf.status === "idle" || dwarf.status === "working";

/** Can this dwarf start something new (expedition, forge work)? Not when away and not when on strike. */
export const isAvailable = (dwarf: Dwarf) => isAtHome(dwarf) && !dwarf.hungry;

/** The status a dwarf at home has for a given assignment. */
export const homeStatus = (assignment: JobType): DwarfStatus =>
  assignment ? "working" : "idle";

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
 * One simulation day: production first, then meals.
 * Shortage rule (D1): a dwarf without a meal is hungry and strikes until fed again.
 */
export function advanceDay(state: ColonyState): ColonyState {
  const produced = expectedProduction(state);
  const meals = serveMeals(state.dwarves, state.resources.food + produced.food);

  let next: ColonyState = {
    ...state,
    day: state.day + 1,
    resources: {
      ...state.resources,
      wood: state.resources.wood + produced.wood,
      stone: state.resources.stone + produced.stone,
      food: meals.food,
    },
    dwarves: meals.dwarves,
  };

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
