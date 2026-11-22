export type ResourceKey = "wood" | "stone" | "food" | "tools" | "weapons";
export type Job = "woodcutting" | "mining" | "farming";
export type JobType = Job | null;
export type RecipeId = "tool" | "weapon";

/**
 * The ONE thing a dwarf is doing right now (D1: at most one activity at a time).
 * Only "working" produces, and only while the dwarf is not hungry.
 * "idle" and "working" mean the dwarf is at home; "crafting" is work at the forge (D3).
 */
export type DwarfStatus = "idle" | "working" | "crafting" | "expedition";

/** D3: the forge order a dwarf is working on. Only present while the status is "crafting". */
export interface CraftingTask {
    recipe: RecipeId;
    /** Working days still needed. A day only counts when the smith is not hungry. */
    daysLeft: number;
}

/** "tools" counts the free tools in the stores; equipped tools are held by a dwarf (hasTool). */
export interface Resources { wood: number; stone: number; food: number; tools: number; weapons: number }

export interface Dwarf {
    id: string;
    name: string;
    title: string;
    icon: string;
    /** The local job the dwarf does while at home. Kept during an absence so the dwarf resumes it afterwards. */
    assignment: JobType;
    status: DwarfStatus;
    /** D1 hunger bar: either full (false) or empty (true). A hungry dwarf is on strike and does no work at all. */
    hungry: boolean;
    /** D2: carries one tool from the stores. Gives +1 per day in the dwarf's job. */
    hasTool: boolean;
    crafting?: CraftingTask;
    specialty?: Job;
}

export interface Activity {
    id: string;
    day: number;
    message: string;
    tone?: "good" | "warning";
    /** D1: a strike report stays pinned and stops the day clock until the player acknowledges it. */
    needsAck?: boolean;
}

export interface ColonyState {
    day: number;
    resources: Resources;
    dwarves: Dwarf[];
    /** Hold Chronicle, newest entry first. */
    activities: Activity[];
    /** Number of chronicle entries ever written. Gives every entry a unique, predictable id. */
    activityCount: number;
}

export interface ExpeditionResult {
    expeditionId: string;
    status: "completed";
    rewards: Partial<Resources>;
    message: string;
}
