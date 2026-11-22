import { acknowledgeActivity, awaitingAcknowledgement } from "../activityLog";
import { completeExpedition, departOnExpedition, failExpedition } from "../expeditions";
import { craftTool } from "../forge";
import { advanceDay, assignDwarf, hasStarved } from "../simulation";
import type { ColonyState, ExpeditionResult, JobType } from "../types";

export type ColonyAction =
  | { type: "dayPassed" }
  | { type: "dwarfAssigned"; dwarfId: string; assignment: JobType }
  | { type: "toolCrafted" }
  | { type: "expeditionDeparted"; dwarfId: string; destination: string }
  | { type: "expeditionSucceeded"; dwarfId: string; result: ExpeditionResult }
  | { type: "expeditionFailed"; dwarfId: string; reason: string }
  | { type: "activityAcknowledged"; activityId: string }
  | { type: "colonyRestarted" };

/**
 * The only place where colony state changes. Every rule is a pure function
 * (state in, new state out), so it always sees the current state and can be unit-tested.
 */
export function colonyReducer(state: ColonyState, action: ColonyAction): ColonyState {
  if (action.type === "colonyRestarted") return initialColony;
  // A starved colony is lost: nothing changes any more until the player starts a new one.
  if (hasStarved(state)) return state;

  switch (action.type) {
    case "dayPassed":
      // The day clock stands still while a strike report is unacknowledged.
      return awaitingAcknowledgement(state) ? state : advanceDay(state);
    case "activityAcknowledged":
      return acknowledgeActivity(state, action.activityId);
    case "dwarfAssigned":
      return assignDwarf(state, action.dwarfId, action.assignment);
    case "toolCrafted":
      return craftTool(state);
    case "expeditionDeparted":
      return departOnExpedition(state, action.dwarfId, action.destination);
    case "expeditionSucceeded":
      return completeExpedition(state, action.dwarfId, action.result);
    case "expeditionFailed":
      return failExpedition(state, action.dwarfId, action.reason);
  }
}

export const initialColony: ColonyState = {
  day: 12,
  resources: {
    wood: 14,
    stone: 9,
    food: 18,
    tools: 1,
  },
  dwarves: [
    {
      id: "dwarf-1",
      name: "Bromli Copperkeg",
      title: "Hold Warden",
      icon: "🧔🏻",
      assignment: "mining",
      status: "working",
      hungry: false,
      specialty: "mining",
    },
    {
      id: "dwarf-2",
      name: "Yrsa Flintbraid",
      title: "Trail Scout",
      icon: "🧔🏼‍♀️",
      assignment: "woodcutting",
      status: "working",
      hungry: false,
      specialty: "woodcutting",
    },
    {
      id: "dwarf-3",
      name: "Dori Ashmantle",
      title: "Stone Singer",
      icon: "🧔🏽",
      assignment: null,
      status: "idle",
      hungry: false,
    },
  ],
  activities: [
    {
      id: "welcome",
      day: 12,
      message: "The forge fires are lit. Stonehome wakes.",
    },
  ],
  activityCount: 0,
};
