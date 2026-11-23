import { logActivity } from "./activityLog";
import type { ColonyState, Dwarf, Job, RecipeId, ResourceKey, Species } from "./types";

/** Which resource a local job produces. How much depends on the species of the worker. */
export const jobResource: Record<Job, ResourceKey> = {
  woodcutting: "wood",
  mining: "stone",
  farming: "food",
};

export interface SpeciesInfo {
  label: string;
  plural: string;
  /** Units per day in each local job, before any tool bonus. */
  production: Record<Job, number>;
  /** The recipes this species is willing and able to forge. */
  canForge: RecipeId[];
}

/**
 * D6: the one place that defines how the species differ.
 * The simulation, the forge and the interface all read from this table.
 */
export const speciesInfo: Record<Species, SpeciesInfo> = {
  dwarf: {
    label: "Dwarf",
    plural: "Dwarves",
    production: { woodcutting: 3, mining: 2, farming: 4 },
    canForge: ["tool", "weapon"],
  },
  elf: {
    label: "Elf",
    plural: "Elves",
    production: { woodcutting: 4, mining: 1, farming: 5 },
    canForge: ["tool"],
  },
};

/** Units per day this resident produces in a job, without tool bonus. */
export const yieldOf = (dwarf: Dwarf, job: Job) =>
  speciesInfo[dwarf.species].production[job];

export const canForge = (dwarf: Dwarf, recipe: RecipeId) =>
  speciesInfo[dwarf.species].canForge.includes(recipe);

/** One line for the roster, e.g. "Wood 4 · Stone 1 · Food 5 · forges tools only". */
export function traits(species: Species): string {
  const { production, canForge: recipes } = speciesInfo[species];
  const forge =
    recipes.length === 0
      ? "does not forge"
      : recipes.includes("weapon")
        ? "forges tools and weapons"
        : "forges tools only";

  return `Wood ${production.woodcutting} · Stone ${production.mining} · Food ${production.farming} · ${forge}`;
}

/* ---- The newcomer ---- */

/** A successful expedition to this destination brings the elf to Stonehome, once. */
export const NEWCOMER_DESTINATION = "crystal-cave";

export const newcomer: Dwarf = {
  id: "elf-1",
  name: "Sylwen Mossfoot",
  title: "Forest Wanderer",
  icon: "🧝‍♀️",
  species: "elf",
  assignment: null,
  status: "idle",
  hungry: false,
  hasTool: false,
};

/** The roster itself is the memory: the newcomer has joined when she is in it. */
export const hasNewcomerJoined = (state: ColonyState) =>
  state.dwarves.some((dwarf) => dwarf.id === newcomer.id);

/**
 * Called after a SUCCESSFUL expedition. Adds the elf if the destination is the right one
 * and she is not a resident yet. Any other case returns the state unchanged.
 */
export function welcomeNewcomer(state: ColonyState, destination: string): ColonyState {
  if (destination !== NEWCOMER_DESTINATION || hasNewcomerJoined(state)) return state;

  return logActivity(
    { ...state, dwarves: [...state.dwarves, newcomer] },
    `${newcomer.name}, a forest elf lost among the crystals, joins Stonehome. ${traits("elf")}.`,
    "good",
  );
}
