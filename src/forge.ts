// forge (d2 recipes, d3 crafting takes time): recipe table, start order, daily work, texts for display
// writes chronicle entries
import { logActivity } from "./activityLog";
// status a resident gets when back home
import { homeStatus } from "./dwarves";
// which species may forge what
import { canForge, speciesInfo } from "./species";
// types only
import type { ColonyState, Dwarf, RecipeId } from "./types";

// pass recipe id type on, so pages can import it from here
export type { RecipeId } from "./types";

// shape of one recipe
export interface Recipe {
  // name shown on screen
  label: string;
  // emoji
  icon: string;
  // materials needed
  cost: { wood: number; stone: number };
  // working days a smith needs (d3)
  days: number;
  // resource that grows by one when item is finished
  product: "tools" | "weapons";
  // text: what is it good for
  purpose: string;
  // text for chronicle when finished
  done: string;
}

// the one place that defines what forge can make, what it costs and how long it takes (table instead of ifs, new recipe = new entry)
export const recipes: Record<RecipeId, Recipe> = {
  // recipe tool
  tool: {
    // name
    label: "Tool",
    // emoji
    icon: "⚒️",
    // cost
    cost: { wood: 3, stone: 2 },
    // one day
    days: 1,
    // goes to free tools
    product: "tools",
    // purpose text
    purpose: "Equip it to a resident: +1 per day in their job.",
    // chronicle text
    done: "A sturdy iron tool joins the stores.",
  },
  // recipe weapon (team decision d2)
  weapon: {
    // name
    label: "Weapon",
    // emoji
    icon: "⚔️",
    // cost
    cost: { wood: 2, stone: 4 },
    // two days
    days: 2,
    // goes to weapons
    product: "weapons",
    // purpose text
    purpose: "Kept by the whole colony to defend Stonehome against hostile forces.",
    // chronicle text
    done: "A sharp weapon is added to the armoury.",
  },
};

// enough materials in stores for this recipe
export const canAfford = (state: ColonyState, recipeId: RecipeId) =>
  // enough wood
  state.resources.wood >= recipes[recipeId].cost.wood &&
  // enough stone
  state.resources.stone >= recipes[recipeId].cost.stone;

// why can this resident not start this recipe now, null = nothing in the way, used by rule (start crafting) and by screen (disabled button + reason), so both always agree
export function craftingProblem(
  // current state
  state: ColonyState,
  // chosen smith (undefined = nobody chosen)
  dwarf: Dwarf | undefined,
  // which recipe
  recipeId: RecipeId,
): string | null {
  // cost of recipe (destructuring = take one field out)
  const { cost } = recipes[recipeId];

  // nobody chosen
  if (!dwarf) return "Choose a smith.";
  // species limit first (d6), because waiting or more material would not change it
  if (!canForge(dwarf, recipeId)) {
    // text like elves do not forge weapons
    return `${speciesInfo[dwarf.species].plural} do not forge ${recipes[recipeId].label.toLowerCase()}s.`;
  }
  // already has an order (max one activity)
  if (dwarf.status === "crafting") return `${dwarf.name} is already forging.`;
  // away
  if (dwarf.status === "expedition") return `${dwarf.name} is away on an expedition.`;
  // hungry = on strike
  if (dwarf.hungry) return `${dwarf.name} is on strike.`;
  // not enough material
  if (!canAfford(state, recipeId)) return `Needs ${cost.wood} timber and ${cost.stone} stone.`;
  // no problem
  return null;
}

// starts forge order: material is taken now (cannot be spent twice), resident leaves job and works at forge
export function startCrafting(state: ColonyState, dwarfId: string, recipeId: RecipeId): ColonyState {
  // find resident by id
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  // guard: unknown or any problem = same state back (invalid attempt changes nothing, double click starts no second order)
  if (!dwarf || craftingProblem(state, dwarf, recipeId) !== null) return state;

  // chosen recipe
  const recipe = recipes[recipeId];
  // new state
  const next: ColonyState = {
    // copy the rest
    ...state,
    // stores
    resources: {
      // copy other resources
      ...state.resources,
      // minus wood
      wood: state.resources.wood - recipe.cost.wood,
      // minus stone
      stone: state.resources.stone - recipe.cost.stone,
    },
    // go through residents
    dwarves: state.dwarves.map((item) =>
      // is it the smith
      item.id === dwarfId
        // yes: status crafting and order with recipe and days left
        ? { ...item, status: "crafting", crafting: { recipe: recipeId, daysLeft: recipe.days } }
        // no: unchanged
        : item,
    ),
  };

  // chronicle entry
  return logActivity(
    // on new state
    next,
    // text with ready day (today + days)
    `${dwarf.name} starts forging a ${recipe.label.toLowerCase()}. Ready on day ${state.day + recipe.days}.`,
  );
}

// one work day at forge, called by daily simulation, returns updated residents and list of finished orders
export function workAtForge(dwarves: Dwarf[]): {
  // residents after this day
  dwarves: Dwarf[];
  // finished orders (who, what)
  finished: { name: string; recipe: RecipeId }[];
} {
  // collect finished orders here
  const finished: { name: string; recipe: RecipeId }[] = [];

  // go through residents
  const after = dwarves.map((dwarf) => {
    // no smith, or hungry smith (strike: order pauses, day does not count) = unchanged
    if (dwarf.status !== "crafting" || !dwarf.crafting || dwarf.hungry) return dwarf;

    // one day less
    const daysLeft = dwarf.crafting.daysLeft - 1;
    // not finished yet = copy with new days left
    if (daysLeft > 0) return { ...dwarf, crafting: { ...dwarf.crafting, daysLeft } };

    // finished: remember for stores and chronicle
    finished.push({ name: dwarf.name, recipe: dwarf.crafting.recipe });
    // take order off resident (rest = resident without crafting field)
    const { crafting: _done, ...rest } = dwarf;
    // back to remembered job (working) or idle
    return { ...rest, status: homeStatus(dwarf.assignment) };
  });

  // both results
  return { dwarves: after, finished };
}

// day a running order will be ready, null while paused by hunger
export function readyOnDay(state: ColonyState, dwarf: Dwarf): number | null {
  // no order or hungry = unknown
  if (!dwarf.crafting || dwarf.hungry) return null;
  // today + days left
  return state.day + dwarf.crafting.daysLeft;
}

// short text for roster and forge page, like forging a weapon · ready on day 14
export function craftingSummary(state: ColonyState, dwarf: Dwarf): string | null {
  // no order = no text
  if (!dwarf.crafting) return null;

  // what is forged
  const what = `Forging a ${recipes[dwarf.crafting.recipe].label.toLowerCase()}`;
  // ready day or null
  const ready = readyOnDay(state, dwarf);
  // paused text or ready text
  return ready === null ? `${what} · paused: hungry` : `${what} · ready on day ${ready}`;
}
