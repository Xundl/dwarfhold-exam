// goblin attack (d7): threshold, loot, report, result of attack
// writes chronicle entries
import { logActivity } from "./activityLog";
// types only
import type { ColonyState, RaidReport, Resources } from "./types";

// successful expedition to this destination makes goblins follow scout home
export const RAID_DESTINATION = "goblin-warren";
// with at least this many weapons stonehome defends itself (threshold, team decision)
export const WEAPONS_TO_DEFEND = 2;
// successful defence breaks this many weapons, looted colony keeps its weapons
export const WEAPONS_LOST_IN_DEFENCE = 1;

// what goblins take if not defended: half of wood, stone and food, rounded down (no random = deterministic)
export function lootOf(resources: Resources): RaidReport["loot"] {
  // loot object
  return {
    // half of wood (floor = round down)
    wood: Math.floor(resources.wood / 2),
    // half of stone
    stone: Math.floor(resources.stone / 2),
    // half of food
    food: Math.floor(resources.food / 2),
  };
}

// enough weapons to defend
const canDefend = (state: ColonyState) => state.resources.weapons >= WEAPONS_TO_DEFEND;

// decides one attack, changes stores, files report for player, same stores always give same result
export function resolveRaid(state: ColonyState, scout: string): ColonyState {
  // weapons before attack (for report)
  const weaponsBefore = state.resources.weapons;

  // case defended
  if (canDefend(state)) {
    // report for full screen
    const report: RaidReport = {
      // who was followed
      scout,
      // defended
      defended: true,
      // weapons before
      weaponsBefore,
      // one weapon broke
      weaponsLost: WEAPONS_LOST_IN_DEFENCE,
      // nothing stolen
      loot: { wood: 0, stone: 0, food: 0 },
    };
    // new state
    const next: ColonyState = {
      // copy the rest
      ...state,
      // stores: one weapon less
      resources: { ...state.resources, weapons: weaponsBefore - WEAPONS_LOST_IN_DEFENCE },
      // add report at end of queue (oldest stays first)
      raids: [...state.raids, report],
    };
    // chronicle entry
    return logActivity(
      // on new state
      next,
      // text with numbers
      `Goblins followed ${scout} home. Stonehome held the gate with ${weaponsBefore} weapons; ${WEAPONS_LOST_IN_DEFENCE} broke in the fight.`,
      // green
      "good",
    );
  }

  // case looted: calculate loot
  const loot = lootOf(state.resources);
  // report
  const report: RaidReport = { scout, defended: false, weaponsBefore, weaponsLost: 0, loot };
  // new state
  const next: ColonyState = {
    // copy the rest
    ...state,
    // stores
    resources: {
      // copy other resources (tools and weapons stay)
      ...state.resources,
      // minus wood
      wood: state.resources.wood - loot.wood,
      // minus stone
      stone: state.resources.stone - loot.stone,
      // minus food
      food: state.resources.food - loot.food,
    },
    // add report at end of queue
    raids: [...state.raids, report],
  };
  // chronicle entry
  return logActivity(
    // on new state
    next,
    // text with exact losses
    `Goblins followed ${scout} home. With ${weaponsBefore} of ${WEAPONS_TO_DEFEND} weapons needed, Stonehome was looted: -${loot.wood} timber, -${loot.stone} stone, -${loot.food} rations.`,
    // red
    "warning",
  );
}

// called after successful expedition, rewards are already in stores (so loot is taken from stores incl. reward)
export function raidAfterExpedition(state: ColonyState, destination: string, scout: string): ColonyState {
  // only goblin warren causes attack, every other destination = same state back
  return destination === RAID_DESTINATION ? resolveRaid(state, scout) : state;
}

// report player has to read next (first in queue), null if none, day clock stands still while one is open (?? = use null if nothing there)
export const openRaid = (state: ColonyState): RaidReport | null => state.raids[0] ?? null;

// player pressed continue: remove oldest report
export function dismissRaid(state: ColonyState): ColonyState {
  // empty queue = same state back, otherwise queue without first entry
  return state.raids.length === 0 ? state : { ...state, raids: state.raids.slice(1) };
}
