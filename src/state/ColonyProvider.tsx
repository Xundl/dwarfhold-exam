import { useEffect, useReducer, useState, type ReactNode } from "react";
import { awaitingAcknowledgement } from "../activityLog";
import { beginExpedition } from "../api";
import { hasStarved, isAvailable } from "../simulation";
import { ColonyContext, type ColonyContextValue } from "./ColonyContext";
import { colonyReducer, initialColony } from "./colonyReducer";

export function ColonyProvider({ children }: { children: ReactNode }) {
  const [colony, dispatch] = useReducer(colonyReducer, initialColony);
  const [paused, setPaused] = useState(false);
  //const [expeditionPending, setExpeditionPending] = useState(false);

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

    // The id is created here so the answer can later be matched to exactly this expedition.
    const expeditionId = crypto.randomUUID();

    dispatch({ type: "expeditionDeparted", expeditionId, dwarfId, destination });

    try {
      const result = await beginExpedition(dwarfId, destination);
      dispatch({ type: "expeditionSucceeded", expeditionId, result });
    } catch (error) {
      dispatch({
        type: "expeditionFailed",
        expeditionId,
        reason:
          error instanceof Error
            ? error.message
            : "The expedition was lost from view.",
      });
    }
  }

  const value: ColonyContextValue = {
    colony,
    paused,
    activities: colony.activities,
    //expeditionPending,
    togglePaused: () => setPaused((value) => !value),
    assignDwarf: (dwarfId, assignment) =>
      dispatch({ type: "dwarfAssigned", dwarfId, assignment }),
    craftTool: () => dispatch({ type: "toolCrafted" }),
    sendExpedition,
    acknowledgeActivity: (activityId) =>
      dispatch({ type: "activityAcknowledged", activityId }),
    restartColony: () => dispatch({ type: "colonyRestarted" }),
  };

  return <ColonyContext value={value}>{children}</ColonyContext>;
}
