import { logActivity } from "./activityLog";
import { failExpedition } from "./expeditions";
import { initialColony } from "./state/colonyReducer";
import type { ColonyState } from "./types";

/* D5: the colony is saved to localStorage after every change and restored on start. */

export const SAVE_KEY = "dwarfhold-save";
/** Raise this whenever the shape of ColonyState changes. Older saves then count as incompatible. */
export const SAVE_VERSION = 1;

/** The part of localStorage we need. Tests pass a fake object with the same two methods. */
export type SaveStorage = Pick<Storage, "getItem" | "setItem">;

export type LoadResult = 
| { kind : "empty" }
| { kind : "corrupt" }
| { kind : "loaded", state : ColonyState };

//checking a save

// ---------- checking a save ----------

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCount = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isOneOf = (value: unknown, allowed: readonly unknown[]) => allowed.includes(value);

function isResident(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.title === "string" &&
    typeof value.icon === "string" &&
    isOneOf(value.species, ["dwarf", "elf"]) &&
    isOneOf(value.assignment, [null, "woodcutting", "mining", "farming"]) &&
    isOneOf(value.status, ["idle", "working", "crafting", "expedition"]) &&
    typeof value.hungry === "boolean" &&
    typeof value.hasTool === "boolean" &&
    // A smith must have a forge order, and only a smith may have one.
    (value.status === "crafting"
      ? isObject(value.crafting) &&
        isOneOf(value.crafting.recipe, ["tool", "weapon"]) &&
        isCount(value.crafting.daysLeft)
      : value.crafting === undefined)
  );
}

function isExpedition(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.dwarfId === "string" &&
    typeof value.destination === "string" &&
    isCount(value.departedDay)
  );
}

function isActivity(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.message === "string" &&
    isCount(value.day)
  );
}

/** True only if the value has every field the game needs, with the right types. */
export function isColonyState(value: unknown): value is ColonyState {
  if (!isObject(value) || !isObject(value.resources)) return false;
  const { resources } = value;

  return (
    isCount(value.day) &&
    ["wood", "stone", "food", "tools", "weapons"].every((key) => isCount(resources[key])) &&
    Array.isArray(value.dwarves) && value.dwarves.every(isResident) &&
    Array.isArray(value.activities) && value.activities.every(isActivity) &&
    isCount(value.activityCount) &&
    Array.isArray(value.expeditions) && value.expeditions.every(isExpedition) &&
    Array.isArray(value.raids) && value.raids.every(isObject)
  );
}

// ---------- saving and loading ----------

export function saveColony(state: ColonyState, storage: SaveStorage): void {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }));
  } catch {
    // Storage full or blocked (e.g. private mode): the game keeps running, it just is not saved.
  }
}

export function loadColony(storage: SaveStorage): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { kind: "empty" };
  }
  if (raw === null) return { kind: "empty" };

  try {
    const data: unknown = JSON.parse(raw);
    if (!isObject(data) || data.version !== SAVE_VERSION || !isColonyState(data.state)) {
      return { kind: "corrupt" };
    }
    return { kind: "loaded", state: data.state };
  } catch {
    return { kind: "corrupt" }; // not even valid JSON
  }
}

// ---------- the refresh policy ----------

/**
 * Applies the D5 policy to a loaded save:
 * - An expedition still on the road lost its answer with the refresh (the server keeps nothing).
 *   It counts as failed, exactly like a D4 failure: the traveller comes home, no loot, no raid.
 * - Forge work simply continues: its remaining days are part of the save.
 */
export function restoreColony(saved: ColonyState): ColonyState {
  let state = logActivity(saved, `Saved game from day ${saved.day} restored.`, "good");

  saved.expeditions.forEach((expedition) => {
    const traveller = saved.dwarves.find((item) => item.id === expedition.dwarfId);
    state = failExpedition(
      state,
      expedition.id,
      `${traveller?.name ?? "A traveller"}'s expedition was interrupted by the refresh and returned without loot.`,
    );
  });

  return state;
}

/** The state the game starts with: a restored save, or a new colony. */
export function startingColony(storage: SaveStorage): ColonyState {
  const save = loadColony(storage);

  if (save.kind === "loaded") return restoreColony(save.state);
  if (save.kind === "corrupt") {
    return logActivity(
      initialColony,
      "The saved chronicle was unreadable or from an older version. Stonehome begins anew.",
      "warning",
    );
  }
  return initialColony;
}