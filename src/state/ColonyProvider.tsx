import { useEffect, useReducer, useState, type ReactNode } from "react";
import { awaitingAcknowledgement } from "../activityLog";
import { beginExpedition } from "../api";
import { hasStarved, isAvailable } from "../simulation";
import { ColonyContext, type ColonyContextValue } from "./ColonyContext";
import { colonyReducer, initialColony } from "./colonyReducer";

export function ColonyProvider({ children }: { children: ReactNode }) {
  const [colony, dispatch] = useReducer(colonyReducer, initialColony);
  const [paused, setPaused] = useState(false);
  const [expeditionPending, setExpeditionPending] = useState(false);

  // The day clock stops for a manual pause, an unacknowledged strike report, or a starved colony.
  const clockStopped =
    paused || awaitingAcknowledgement(colony) || hasStarved(colony);

  useEffect(() => {
    if (clockStopped) return;

    const timer = window.setInterval(
      () => dispatch({ type: "dayPassed" }),
      8_000,
    );

    return () => window.clearInterval(timer);
  }, [clockStopped]);

  async function sendExpedition(dwarfId: string, destination: string) {
    const dwarf = colony.dwarves.find((item) => item.id === dwarfId);
    if (!dwarf || !isAvailable(dwarf) || hasStarved(colony)) return;

    setExpeditionPending(true);
    dispatch({ type: "expeditionDeparted", dwarfId, destination });

    try {
      const result = await beginExpedition(dwarfId, destination);
      dispatch({ type: "expeditionSucceeded", dwarfId, result });
    } catch (error) {
      dispatch({
        type: "expeditionFailed",
        dwarfId,
        reason:
          error instanceof Error
            ? error.message
            : "The expedition was lost from view.",
      });
    } finally {
      setExpeditionPending(false);
    }
  }

  const value: ColonyContextValue = {
    colony,
    paused,
    activities: colony.activities,
    expeditionPending,
    togglePaused: () => setPaused((value) => !value),
    assignDwarf: (dwarfId, assignment) =>
      dispatch({ type: "dwarfAssigned", dwarfId, assignment }),
    startCrafting: (dwarfId, recipe) =>
      dispatch({ type: "craftingStarted", dwarfId, recipe }),
    equipTool: (dwarfId) => dispatch({ type: "toolEquipped", dwarfId }),
    returnTool: (dwarfId) => dispatch({ type: "toolReturned", dwarfId }),
    sendExpedition,
    acknowledgeActivity: (activityId) =>
      dispatch({ type: "activityAcknowledged", activityId }),
    restartColony: () => dispatch({ type: "colonyRestarted" }),
  };

  return <ColonyContext value={value}>{children}</ColonyContext>;
}
