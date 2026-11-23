// species (d6): table of differences, the elf and how she joins
// writes chronicle entries
import { logActivity } from "./activityLog";
// types only
import type { ColonyState, Dwarf, Job, RecipeId, ResourceKey, Species } from "./types";

// which resource a local job produces (how much depends on species)
export const jobResource: Record<Job, ResourceKey> = {
  // woodcutting gives wood
  woodcutting: "wood",
  // mining gives stone
  mining: "stone",
  // farming gives food
  farming: "food",
};

// shape of one species entry
export interface SpeciesInfo {
  // name
  label: string;
  // plural name (for texts)
  plural: string;
  // units per day in each job, before tool bonus
  production: Record<Job, number>;
  // recipes this species can forge
  canForge: RecipeId[];
}

// the one place that defines how species differ, simulation, forge and screen all read this table (no if species === elf anywhere)
export const speciesInfo: Record<Species, SpeciesInfo> = {
  // dwarf
  dwarf: {
    // name
    label: "Dwarf",
    // plural
    plural: "Dwarves",
    // 3 wood, 2 stone, 4 food per day
    production: { woodcutting: 3, mining: 2, farming: 4 },
    // forges both recipes
    canForge: ["tool", "weapon"],
  },
  // elf (team decision d6)
  elf: {
    // name
    label: "Elf",
    // plural
    plural: "Elves",
    // 4 wood, 1 stone, 5 food per day (better outside, worse in the mine)
    production: { woodcutting: 4, mining: 1, farming: 5 },
    // forges tools only, no weapons
    canForge: ["tool"],
  },
};

// units per day this resident produces in a job, without tool bonus
export const yieldOf = (dwarf: Dwarf, job: Job) =>
  speciesInfo[dwarf.species].production[job];

// may this resident forge this recipe (lookup in table)
export const canForge = (dwarf: Dwarf, recipe: RecipeId) =>
  speciesInfo[dwarf.species].canForge.includes(recipe);

// one line for roster, like wood 4 · stone 1 · food 5 · forges tools only
export function traits(species: Species): string {
  // take production and recipe list of species out of table
  const { production, canForge: recipes } = speciesInfo[species];
  // forge part of text
  const forge =
    // no recipes at all
    recipes.length === 0
      ? "does not forge"
      // includes weapon = both
      : recipes.includes("weapon")
        ? "forges tools and weapons"
        // otherwise tools only
        : "forges tools only";

  // put text together
  return `Wood ${production.woodcutting} · Stone ${production.mining} · Food ${production.farming} · ${forge}`;
}

// successful expedition to this destination brings the elf, once (team decision d6)
export const NEWCOMER_DESTINATION = "crystal-cave";

// the new resident, same shape as a dwarf (so all rules work for her without changes)
export const newcomer: Dwarf = {
  // fixed id, used to check if she is already here
  id: "elf-1",
  // name
  name: "Sylwen Mossfoot",
  // title
  title: "Forest Wanderer",
  // emoji
  icon: "🧝‍♀️",
  // species elf
  species: "elf",
  // no job at start
  assignment: null,
  // at home, idle
  status: "idle",
  // not hungry
  hungry: false,
  // no tool
  hasTool: false,
};

// has she joined already, roster itself is the memory (no extra flag that could be wrong, saved automatically with d5)
export const hasNewcomerJoined = (state: ColonyState) =>
  // is there a resident with her id
  state.dwarves.some((dwarf) => dwarf.id === newcomer.id);

// called after successful expedition, adds elf if destination is right and she is not here yet
export function welcomeNewcomer(state: ColonyState, destination: string): ColonyState {
  // guard: other destination or already joined = same state back (so she joins only once)
  if (destination !== NEWCOMER_DESTINATION || hasNewcomerJoined(state)) return state;

  // chronicle entry
  return logActivity(
    // new state with elf at end of residents list
    { ...state, dwarves: [...state.dwarves, newcomer] },
    // text with her values
    `${newcomer.name}, a forest elf lost among the crystals, joins Stonehome. ${traits("elf")}.`,
    // green
    "good",
  );
}
