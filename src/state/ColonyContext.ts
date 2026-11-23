// context: lets every component reach colony state and actions without passing them through all levels (props)
// react tools for context
import { createContext, useContext } from "react";
// types only
import type { RecipeId } from "../forge";
// types only
import type { Activity, ColonyState, JobType } from "../types";

// everything components can get from context
export interface ColonyContextValue {
  // whole colony state
  colony: ColonyState;
  // is day clock paused by player
  paused: boolean;
  // chronicle entries
  activities: Activity[];
  // pause / resume
  togglePaused: () => void;
  // give a job
  assignDwarf: (id: string, assignment: JobType) => void;
  // start forge order
  startCrafting: (dwarfId: string, recipe: RecipeId) => void;
  // give tool
  equipTool: (dwarfId: string) => void;
  // take tool back
  returnTool: (dwarfId: string) => void;
  // send on expedition (promise = takes time, waits for server)
  sendExpedition: (dwarfId: string, destination: string) => Promise<void>;
  // acknowledge strike report
  acknowledgeActivity: (activityId: string) => void;
  // new colony after game over
  restartColony: () => void;
  // close raid screen
  dismissRaid: () => void;
}

// the context itself, null until provider fills it
export const ColonyContext = createContext<ColonyContextValue | null>(null);

// hook for components: use colony() gives state and actions
export function useColony(): ColonyContextValue {
  // read context
  const context = useContext(ColonyContext);
  // null = component is not inside provider
  if (!context) {
    // clear error instead of strange crash later
    throw new Error("useColony must be used inside <ColonyProvider>");
  }
  // filled context
  return context;
}
