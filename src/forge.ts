import { logActivity } from "./activityLog";
import type { ColonyState } from "./types";

export type RecipeId = "tool" | "weapon";

export interface Recipe {
  label: string;
  icon: string;
  cost: { wood: number; stone: number };
  /** The resource that grows by one when the item is finished. */
  product: "tools" | "weapons";
  purpose: string;
  done: string;
}

/** D2: the one place that defines what the forge can make and what it costs. */
export const recipes: Record<RecipeId, Recipe> = {
  tool: {
    label: "Tool",
    icon: "⚒️",
    cost: { wood: 3, stone: 2 },
    product: "tools",
    purpose: "Equip it to a dwarf: +1 per day in their job.",
    done: "A sturdy iron tool joins the stores.",
  },
  weapon: {
    label: "Weapon",
    icon: "⚔️",
    cost: { wood: 2, stone: 4 },
    product: "weapons",
    purpose: "Kept by the whole colony to defend Stonehome against hostile forces.",
    done: "A sharp weapon is added to the armoury.",
  },
};

export const canAfford = (state: ColonyState, recipeId: RecipeId) =>
  state.resources.wood >= recipes[recipeId].cost.wood &&
  state.resources.stone >= recipes[recipeId].cost.stone;

/**
 * Starter behaviour moved out of the provider: crafting is still immediate.
 * D3 replaces this with a crafting task that needs a worker and time.
 * An invalid attempt changes no resources; it only writes a chronicle entry.
 */
export function craft(state: ColonyState, recipeId: RecipeId): ColonyState {
  const recipe = recipes[recipeId];

  if (!canAfford(state, recipeId)) {
    return logActivity(
      state,
      `A ${recipe.label.toLowerCase()} needs ${recipe.cost.wood} timber and ${recipe.cost.stone} stone.`,
      "warning",
    );
  }

  const next: ColonyState = {
    ...state,
    resources: {
      ...state.resources,
      wood: state.resources.wood - recipe.cost.wood,
      stone: state.resources.stone - recipe.cost.stone,
      [recipe.product]: state.resources[recipe.product] + 1,
    },
  };

  return logActivity(next, recipe.done, "good");
}
