// save and restore (d5): colony is saved to local storage (small storage in browser, survives refresh) after every change and loaded at start
// writes chronicle entries
import { logActivity } from "./activityLog";
// fails an expedition (same rule as d4)
import { failExpedition } from "./expeditions";
// start colony, used when nothing usable is saved
import { initialColony } from "./state/colonyReducer";
// types only
import type { ColonyState } from "./types";

// name of entry in local storage
export const SAVE_KEY = "dwarfhold-save";
// version of save format, raise whenever shape of colony state changes, older saves then count as incompatible
export const SAVE_VERSION = 1;

// the part of local storage we need (get and set), passed in as parameter so tests can use a fake object (no browser needed)
export type SaveStorage = Pick<Storage, "getItem" | "setItem">;

// result of loading, three cases told apart by kind
export type LoadResult = 
// nothing saved
| { kind : "empty" }
// saved but not usable
| { kind : "corrupt" }
// usable, with state
| { kind : "loaded", state : ColonyState };

// checking a save: loaded json can be anything (types do not exist at runtime), so every field is checked by hand
// is it a real object (not null, not a list), value is ... = typescript may treat it as object afterwards
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// is it a whole number from 0 up (no negative, no decimals, no text)
const isCount = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

// is value one of the allowed values
const isOneOf = (value: unknown, allowed: readonly unknown[]) => allowed.includes(value);

// is it a valid resident
function isResident(value: unknown): boolean {
  // must be object
  if (!isObject(value)) return false;
  // all conditions must be true
  return (
    // id is text
    typeof value.id === "string" &&
    // name is text
    typeof value.name === "string" &&
    // title is text
    typeof value.title === "string" &&
    // icon is text
    typeof value.icon === "string" &&
    // species dwarf or elf
    isOneOf(value.species, ["dwarf", "elf"]) &&
    // job is one of three or null
    isOneOf(value.assignment, [null, "woodcutting", "mining", "farming"]) &&
    // status is one of four
    isOneOf(value.status, ["idle", "working", "crafting", "expedition"]) &&
    // hungry is true/false
    typeof value.hungry === "boolean" &&
    // has-tool is true/false
    typeof value.hasTool === "boolean" &&
    // smith must have forge order, and only a smith may have one (rule from d3)
    (value.status === "crafting"
      // smith: order is object
      ? isObject(value.crafting) &&
        // with known recipe
        isOneOf(value.crafting.recipe, ["tool", "weapon"]) &&
        // and days left as count
        isCount(value.crafting.daysLeft)
      // no smith: no order allowed
      : value.crafting === undefined)
  );
}

// is it a valid pending expedition
function isExpedition(value: unknown): boolean {
  // all conditions must be true
  return (
    // object
    isObject(value) &&
    // id is text
    typeof value.id === "string" &&
    // traveller id is text
    typeof value.dwarfId === "string" &&
    // destination is text
    typeof value.destination === "string" &&
    // departure day is count
    isCount(value.departedDay)
  );
}

// is it a valid chronicle entry
function isActivity(value: unknown): boolean {
  // all conditions must be true
  return (
    // object
    isObject(value) &&
    // id is text
    typeof value.id === "string" &&
    // message is text
    typeof value.message === "string" &&
    // day is count
    isCount(value.day)
  );
}

// true only if value has every field the game needs with right types
export function isColonyState(value: unknown): value is ColonyState {
  // state and its stores must be objects
  if (!isObject(value) || !isObject(value.resources)) return false;
  // take stores out
  const { resources } = value;

  // all conditions must be true
  return (
    // day is count
    isCount(value.day) &&
    // all five resources are counts
    ["wood", "stone", "food", "tools", "weapons"].every((key) => isCount(resources[key])) &&
    // residents is a list and every entry is a valid resident
    Array.isArray(value.dwarves) && value.dwarves.every(isResident) &&
    // chronicle is a list of valid entries
    Array.isArray(value.activities) && value.activities.every(isActivity) &&
    // counter is count
    isCount(value.activityCount) &&
    // pending expeditions is a list of valid expeditions
    Array.isArray(value.expeditions) && value.expeditions.every(isExpedition) &&
    // raid reports is a list of objects (fields inside are not checked)
    Array.isArray(value.raids) && value.raids.every(isObject)
  );
}

// saving and loading
// writes state to storage
export function saveColony(state: ColonyState, storage: SaveStorage): void {
  // try = writing can fail
  try {
    // state plus version as json text
    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }));
  } catch {
  // storage full or blocked (private mode): game keeps running, it just is not saved
  }
}

// reads save, returns one of three results
export function loadColony(storage: SaveStorage): LoadResult {
  // raw text from storage
  let raw: string | null;
  // try = reading can fail
  try {
    // read entry
    raw = storage.getItem(SAVE_KEY);
  } catch {
    // storage not readable = treat like nothing saved
    return { kind: "empty" };
  }
  // nothing saved
  if (raw === null) return { kind: "empty" };

  // try = parsing can fail
  try {
    // text to object (unknown = not trusted yet)
    const data: unknown = JSON.parse(raw);
    // wrong shape, wrong version or invalid state
    if (!isObject(data) || data.version !== SAVE_VERSION || !isColonyState(data.state)) {
      // not usable
      return { kind: "corrupt" };
    }
    // usable
    return { kind: "loaded", state: data.state };
  } catch {
    // not even valid json
    return { kind: "corrupt" };
  }
}

// refresh policy: what happens to things that were running when page was reloaded
// expedition on the road lost its answer with the refresh (server keeps nothing) = counts as failed like in d4 (home, no loot, no raid), forge work just continues because days left are part of the save
export function restoreColony(saved: ColonyState): ColonyState {
  // chronicle entry so player sees save was loaded
  let state = logActivity(saved, `Saved game from day ${saved.day} restored.`, "good");

  // every expedition that was still pending
  saved.expeditions.forEach((expedition) => {
    // find traveller for the text
    const traveller = saved.dwarves.find((item) => item.id === expedition.dwarfId);
    // fail it (same function as d4)
    state = failExpedition(
      // on current state
      state,
      // which expedition
      expedition.id,
      // text with name
      `${traveller?.name ?? "A traveller"}'s expedition was interrupted by the refresh and returned without loot.`,
    );
  });

  // restored state
  return state;
}

// state the game starts with: restored save or new colony
export function startingColony(storage: SaveStorage): ColonyState {
  // try to load
  const save = loadColony(storage);

  // usable = restore with refresh policy
  if (save.kind === "loaded") return restoreColony(save.state);
  // not usable
  if (save.kind === "corrupt") {
    // new colony with red chronicle entry (player sees why progress is gone)
    return logActivity(
      // start colony
      initialColony,
      // text
      "The saved chronicle was unreadable or from an older version. Stonehome begins anew.",
      // red
      "warning",
    );
  }
  // nothing saved = plain start colony
  return initialColony;
}