import { logActivity } from "./activityLog";
import type { ColonyState } from "./types";

export const toolRecipe = { wood: 3, stone: 2 };

/**
 * Starter behaviour moved out of the provider: crafting is still immediate.
 * D3 replaces this with a crafting task that needs a worker and time.
 * An invalid attempt changes no resources; it only writes a chronicle entry.
 */
export function craftTool(state: ColonyState): ColonyState {
  const { wood, stone } = state.resources;

  if (wood < toolRecipe.wood || stone < toolRecipe.stone) {
    return logActivity(
      state,
      `The forge needs ${toolRecipe.wood} timber and ${toolRecipe.stone} stone.`,
      "warning",
    );
  }

  const next: ColonyState = {
    ...state,
    resources: {
      ...state.resources,
      wood: wood - toolRecipe.wood,
      stone: stone - toolRecipe.stone,
      tools: state.resources.tools + 1,
    },
  };

  return logActivity(next, "A sturdy iron tool joins the stores.", "good");
}
