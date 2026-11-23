// all types (shapes of data) of the game in one file, types exist only while coding, not at runtime
// names of all resources in the stores
export type ResourceKey = "wood" | "stone" | "food" | "tools" | "weapons";
// the three local jobs
export type Job = "woodcutting" | "mining" | "farming";
// a job or nothing (null = unassigned)
export type JobType = Job | null;
// the two forge recipes
export type RecipeId = "tool" | "weapon";
// kind of resident (d6), differences are in the species table (species.ts)
export type Species = "dwarf" | "elf";

// the one thing a resident does right now (d1: max one activity), idle and working = at home, crafting = at forge (d3), expedition = away
export type DwarfStatus = "idle" | "working" | "crafting" | "expedition";

// forge order of one resident (d3), only exists while status is crafting
export interface CraftingTask {
    // which recipe is being forged
    recipe: RecipeId;
    // working days still needed, a day only counts if smith is not hungry
    daysLeft: number;
}

// the stores, tools = free tools only (equipped ones are counted on the resident, has-tool flag)
export interface Resources { wood: number; stone: number; food: number; tools: number; weapons: number }

// one resident of stonehome, type is still called dwarf although an elf can live here too (name kept so not every file had to be renamed)
export interface Dwarf {
    // unique id, used to find a resident
    id: string;
    // display name
    name: string;
    // dwarf or elf
    species: Species;
    // title shown under the name
    title: string;
    // emoji shown as portrait
    icon: string;
    // local job at home, kept while away so resident continues afterwards
    assignment: JobType;
    // current activity (see dwarf status above)
    status: DwarfStatus;
    // hunger bar (d1): false = full, true = empty, hungry resident is on strike (no work at all)
    hungry: boolean;
    // carries one tool from the stores (d2), gives +1 per day in own job
    hasTool: boolean;
    // forge order, optional (? = may be missing)
    crafting?: CraftingTask;
    // optional skill, only shown in roster as text (skilled in ...), no effect on rules
    specialty?: Job;
}

// one entry in the chronicle (log on screen)
export interface Activity {
    // unique id (activity-1, activity-2, ...)
    id: string;
    // day it was written
    day: number;
    // text shown to player
    message: string;
    // optional colour: good (green) or warning (red)
    tone?: "good" | "warning";
    // strike report (d1): stays pinned and stops day clock until player clicks acknowledge
    needsAck?: boolean;
}

// whole game state in one object (single source of truth), everything on screen is computed from this
export interface ColonyState {
    // current day number
    day: number;
    // the stores
    resources: Resources;
    // all residents, order of this list = roster order
    dwarves: Dwarf[];
    // chronicle, newest entry first
    activities: Activity[];
    // number of entries ever written, gives every entry a unique predictable id (no random)
    activityCount: number;
    // expeditions that left and still wait for server answer (d4)
    expeditions: PendingExpedition[];
    // attack reports not read yet, oldest first (d7), day clock stands still while not empty
    raids: RaidReport[];
}

// result of one goblin attack (d7), shown full screen until player continues
export interface RaidReport {
    // name of traveller the goblins followed home
    scout: string;
    // true = attack was fought off
    defended: boolean;
    // weapons in armoury before the attack
    weaponsBefore: number;
    // weapons broken in a successful defence, otherwise 0
    weaponsLost: number;
    // what goblins carried off, all zero after successful defence
    loot: { wood: number; stone: number; food: number };
}

// one expedition on its way (d4), id lets us apply the answer exactly once
export interface PendingExpedition {
    // id created by client (uuid)
    id: string;
    // who travels
    dwarfId: string;
    // where to
    destination: string;
    // day of departure
    departedDay: number;
}

// answer of server for a successful expedition
export interface ExpeditionResult {
    // id from server answer
    expeditionId: string;
    // always completed (failures come as http error instead)
    status: "completed";
    // rewards, partial = only some resources have to be present
    rewards: Partial<Resources>;
    // story text for chronicle
    message: string;
}
