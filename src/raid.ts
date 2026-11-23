import { logActivity } from "./activityLog";
import type { ColonyState, RaidReport, Resources } from "./types";

/* D7: a successful expedition to this destination makes goblins follow the scout home. */

export const RAID_DESTINATION = "goblin-warren";
/** With at least this many weapons in the armoury Stonehome defends itself. */
export const WEAPONS_TO_DEFEND = 2;
/** A successful defence breaks this many weapons. A looted colony keeps its weapons. */
export const WEAPONS_LOST_IN_DEFENCE = 1;

/** What undefended goblins carry off: half of the stored timber, stone and rations, rounded down. */
export function lootOf(resources: Resources): RaidReport["loot"] {
  return {
    wood: Math.floor(resources.wood / 2),
    stone: Math.floor(resources.stone / 2),
    food: Math.floor(resources.food / 2),
  };
}

const canDefend = (state: ColonyState) => state.resources.weapons >= WEAPONS_TO_DEFEND;

/**
 * Decides one attack, changes the stores accordingly and files a report for the player.
 * No randomness: the same stores always give the same outcome.
 */
export function resolveRaid(state: ColonyState, scout: string): ColonyState {
  const weaponsBefore = state.resources.weapons;

  if (canDefend(state)) {
    const report: RaidReport = {
      scout,
      defended: true,
      weaponsBefore,
      weaponsLost: WEAPONS_LOST_IN_DEFENCE,
      loot: { wood: 0, stone: 0, food: 0 },
    };
    const next: ColonyState = {
      ...state,
      resources: { ...state.resources, weapons: weaponsBefore - WEAPONS_LOST_IN_DEFENCE },
      raids: [...state.raids, report],
    };
    return logActivity(
      next,
      `Goblins followed ${scout} home. Stonehome held the gate with ${weaponsBefore} weapons; ${WEAPONS_LOST_IN_DEFENCE} broke in the fight.`,
      "good",
    );
  }

  const loot = lootOf(state.resources);
  const report: RaidReport = { scout, defended: false, weaponsBefore, weaponsLost: 0, loot };
  const next: ColonyState = {
    ...state,
    resources: {
      ...state.resources,
      wood: state.resources.wood - loot.wood,
      stone: state.resources.stone - loot.stone,
      food: state.resources.food - loot.food,
    },
    raids: [...state.raids, report],
  };
  return logActivity(
    next,
    `Goblins followed ${scout} home. With ${weaponsBefore} of ${WEAPONS_TO_DEFEND} weapons needed, Stonehome was looted: -${loot.wood} timber, -${loot.stone} stone, -${loot.food} rations.`,
    "warning",
  );
}

/** Called after a SUCCESSFUL expedition, with the rewards already in the stores. */
export function raidAfterExpedition(state: ColonyState, destination: string, scout: string): ColonyState {
  return destination === RAID_DESTINATION ? resolveRaid(state, scout) : state;
}

/** The report the player has to read next, or null. While one is open the day clock stands still. */
export const openRaid = (state: ColonyState): RaidReport | null => state.raids[0] ?? null;

/** The player pressed "Continue": the oldest open report is closed. */
export function dismissRaid(state: ColonyState): ColonyState {
  return state.raids.length === 0 ? state : { ...state, raids: state.raids.slice(1) };
}
