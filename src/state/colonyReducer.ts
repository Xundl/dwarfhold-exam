// reducer: the only place where colony state changes, plus start colony
// chronicle: acknowledge report, is a report waiting
import { acknowledgeActivity, awaitingAcknowledgement } from "../activityLog";
// expedition rules
import { completeExpedition, departOnExpedition, failExpedition } from "../expeditions";
// tool rules
import { equipTool, returnTool } from "../equipment";
// forge rule and recipe id type
import { startCrafting, type RecipeId } from "../forge";
// raid report: close, is one open
import { dismissRaid, openRaid } from "../raid";
// day, job assignment, game over check
import { advanceDay, assignDwarf, hasStarved } from "../simulation";
// types only
import type { ColonyState, ExpeditionResult, JobType } from "../types";

// all actions (things that can happen), each with its data, reducer accepts nothing else
export type ColonyAction =
  // timer: one day is over
  | { type: "dayPassed" }
  // player gave a job
  | { type: "dwarfAssigned"; dwarfId: string; assignment: JobType }
  // player started forge order
  | { type: "craftingStarted"; dwarfId: string; recipe: RecipeId }
  // player gave a tool
  | { type: "toolEquipped"; dwarfId: string }
  // player took tool back
  | { type: "toolReturned"; dwarfId: string }
  // expedition left
  | { type: "expeditionDeparted"; expeditionId: string; dwarfId: string; destination: string }
  // server answered with success
  | { type: "expeditionSucceeded"; expeditionId: string; result: ExpeditionResult }
  // expedition failed
  | { type: "expeditionFailed"; expeditionId: string; reason: string }
  // player clicked acknowledge on strike report
  | { type: "activityAcknowledged"; activityId: string }
  // player clicked continue on raid screen
  | { type: "raidAcknowledged" }
  // player started new colony after game over
  | { type: "colonyRestarted" };

// takes current state and an action, returns new state, every rule is a pure function (state in, new state out) so it always sees current state and can be unit tested
export function colonyReducer(state: ColonyState, action: ColonyAction): ColonyState {
  // restart always works, also after game over, gives fresh start colony
  if (action.type === "colonyRestarted") return initialColony;
  // starved colony is lost: nothing changes anymore until restart (late server answer cannot revive it)
  if (hasStarved(state)) return state;

  // pick rule by action type
  switch (action.type) {
    // day over
    case "dayPassed":
      // day clock stands still while strike report or raid report is unread (second safety net besides timer in provider), otherwise run the day
      return awaitingAcknowledgement(state) || openRaid(state) ? state : advanceDay(state);
    // continue on raid screen
    case "raidAcknowledged":
      // close oldest report
      return dismissRaid(state);
    // acknowledge
    case "activityAcknowledged":
      // mark report as seen
      return acknowledgeActivity(state, action.activityId);
    // job
    case "dwarfAssigned":
      // assign
      return assignDwarf(state, action.dwarfId, action.assignment);
    // forge
    case "craftingStarted":
      // start order
      return startCrafting(state, action.dwarfId, action.recipe);
    // equip
    case "toolEquipped":
      // give tool
      return equipTool(state, action.dwarfId);
    // return
    case "toolReturned":
      // take tool back
      return returnTool(state, action.dwarfId);
    // departure
    case "expeditionDeparted":
      // resident leaves
      return departOnExpedition(state, action.expeditionId, action.dwarfId, action.destination);
    // success
    case "expeditionSucceeded":
      // rewards, maybe elf, maybe attack
      return completeExpedition(state, action.expeditionId, action.result);
    // failure
    case "expeditionFailed":
      // resident comes home without reward
      return failExpedition(state, action.expeditionId, action.reason);
  }
}

// start colony (also used for restart and when save is unusable)
export const initialColony: ColonyState = {
  // starts on day 12
  day: 12,
  // stores at start
  resources: {
    // wood
    wood: 14,
    // stone
    stone: 9,
    // food
    food: 18,
    // one free tool
    tools: 1,
    // no weapons
    weapons: 0,
  },
  // three residents, this order = roster order
  dwarves: [
    // first resident
    {
      // id
      id: "dwarf-1",
      // name
      name: "Bromli Copperkeg",
      // title
      title: "Hold Warden",
      // emoji
      icon: "🧔🏻",
      // dwarf
      species: "dwarf",
      // job mining
      assignment: "mining",
      // working
      status: "working",
      // not hungry
      hungry: false,
      // no tool
      hasTool: false,
      // skill text for roster (display only)
      specialty: "mining",
    },
    // second resident
    {
      // id
      id: "dwarf-2",
      // name
      name: "Yrsa Flintbraid",
      // title
      title: "Trail Scout",
      // emoji
      icon: "🧔🏼‍♀️",
      // dwarf
      species: "dwarf",
      // job woodcutting
      assignment: "woodcutting",
      // working
      status: "working",
      // not hungry
      hungry: false,
      // no tool
      hasTool: false,
      // skill text for roster (display only)
      specialty: "woodcutting",
    },
    // third resident
    {
      // id
      id: "dwarf-3",
      // name
      name: "Dori Ashmantle",
      // title
      title: "Stone Singer",
      // emoji
      icon: "🧔🏽",
      // dwarf
      species: "dwarf",
      // no job
      assignment: null,
      // idle
      status: "idle",
      // not hungry
      hungry: false,
      // no tool
      hasTool: false,
    },
  ],
  // chronicle starts with one welcome entry
  activities: [
    // welcome entry
    {
      // fixed id
      id: "welcome",
      // day
      day: 12,
      // text
      message: "The forge fires are lit. Stonehome wakes.",
    },
  ],
  // no entries written by rules yet
  activityCount: 0,
  // nobody travelling
  expeditions: [],
  // no raid reports
  raids: [],
};
