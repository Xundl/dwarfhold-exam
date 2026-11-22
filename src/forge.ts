import { logActivity } from "./activityLog";
import { homeStatus } from "./dwarves";
import type { ColonyState, Dwarf, RecipeId } from "./types";

export type { RecipeId } from "./types";

export interface Recipe {
  label: string;
  icon: string;
  cost: { wood: number; stone: number };
  /** D3: working days a smith needs. */
  days: number;
  /** The resource that grows by one when the item is finished. */
  product: "tools" | "weapons";
  purpose: string;
  done: string;
}

/** The one place that defines what the forge can make, what it costs and how long it takes. */
export const recipes: Record<RecipeId, Recipe> = {
  tool: {
    label: "Tool",
    icon: "⚒️",
    cost: { wood: 3, stone: 2 },
    days: 1,
    product: "tools",
    purpose: "Equip it to a dwarf: +1 per day in their job.",
    done: "A sturdy iron tool joins the stores.",
  },
  weapon: {
    label: "Weapon",
    icon: "⚔️",
    cost: { wood: 2, stone: 4 },
    days: 2,
    product: "weapons",
    purpose: "Kept by the whole colony to defend Stonehome against hostile forces.",
    done: "A sharp weapon is added to the armoury.",
  },
};

export const canAfford = (state: ColonyState, recipeId: RecipeId) =>
  state.resources.wood >= recipes[recipeId].cost.wood &&
  state.resources.stone >= recipes[recipeId].cost.stone;

/**
 * Why can this dwarf not start this recipe right now? null means "nothing stands in the way".
 * The rule (startCrafting) and the interface (disabled button + reason) both ask this one function.
 */
export function craftingProblem(
  state: ColonyState,
  dwarf: Dwarf | undefined,
  recipeId: RecipeId,
): string | null {
  const { cost } = recipes[recipeId];

  if (!dwarf) return "Choose a smith.";
  if (dwarf.status === "crafting") return `${dwarf.name} is already forging.`;
  if (dwarf.status === "expedition") return `${dwarf.name} is away on an expedition.`;
  if (dwarf.hungry) return `${dwarf.name} is on strike.`;
  if (!canAfford(state, recipeId)) return `Needs ${cost.wood} timber and ${cost.stone} stone.`;
  return null;
}

/**
 * Starts a forge order: the materials are taken now (so they cannot be spent twice),
 * the dwarf leaves the job and works at the forge. An invalid attempt changes nothing at all.
 */
export function startCrafting(state: ColonyState, dwarfId: string, recipeId: RecipeId): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  if (!dwarf || craftingProblem(state, dwarf, recipeId) !== null) return state;

  const recipe = recipes[recipeId];
  const next: ColonyState = {
    ...state,
    resources: {
      ...state.resources,
      wood: state.resources.wood - recipe.cost.wood,
      stone: state.resources.stone - recipe.cost.stone,
    },
    dwarves: state.dwarves.map((item) =>
      item.id === dwarfId
        ? { ...item, status: "crafting", crafting: { recipe: recipeId, daysLeft: recipe.days } }
        : item,
    ),
  };

  return logActivity(
    next,
    `${dwarf.name} starts forging a ${recipe.label.toLowerCase()}. Ready on day ${state.day + recipe.days}.`,
  );
}

/**
 * One day of work at the forge, called by the daily simulation.
 * A smith who is hungry is on strike: the order pauses and no day is counted.
 * When no days are left the smith goes back to the remembered job; the caller adds the product.
 */
export function workAtForge(dwarves: Dwarf[]): {
  dwarves: Dwarf[];
  finished: { name: string; recipe: RecipeId }[];
} {
  const finished: { name: string; recipe: RecipeId }[] = [];

  const after = dwarves.map((dwarf) => {
    if (dwarf.status !== "crafting" || !dwarf.crafting || dwarf.hungry) return dwarf;

    const daysLeft = dwarf.crafting.daysLeft - 1;
    if (daysLeft > 0) return { ...dwarf, crafting: { ...dwarf.crafting, daysLeft } };

    finished.push({ name: dwarf.name, recipe: dwarf.crafting.recipe });
    const { crafting: _done, ...rest } = dwarf;
    return { ...rest, status: homeStatus(dwarf.assignment) };
  });

  return { dwarves: after, finished };
}

/** The day a running order will be ready if the smith keeps eating, or null while it is paused by hunger. */
export function readyOnDay(state: ColonyState, dwarf: Dwarf): number | null {
  if (!dwarf.crafting || dwarf.hungry) return null;
  return state.day + dwarf.crafting.daysLeft;
}

/** Short text for the roster and the forge page, e.g. "Forging a weapon · ready on day 14". */
export function craftingSummary(state: ColonyState, dwarf: Dwarf): string | null {
  if (!dwarf.crafting) return null;

  const what = `Forging a ${recipes[dwarf.crafting.recipe].label.toLowerCase()}`;
  const ready = readyOnDay(state, dwarf);
  return ready === null ? `${what} · paused: hungry` : `${what} · ready on day ${ready}`;
}
