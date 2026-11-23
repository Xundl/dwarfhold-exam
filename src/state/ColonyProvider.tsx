// provider: holds colony state (react part), runs day timer, saves, talks to api, hands everything to components via context
// react hooks
import { useEffect, useReducer, useState, type ReactNode } from "react";
// is a strike report waiting
import { awaitingAcknowledgement } from "../activityLog";
// request to server
import { beginExpedition } from "../api";
// save and load (d5)
import { saveColony, startingColony } from "../persistence";
// is a raid report open
import { openRaid } from "../raid";
// game over check, is resident available
import { hasStarved, isAvailable } from "../simulation";
// context and its type
import { ColonyContext, type ColonyContextValue } from "./ColonyContext";
// reducer with all rules
import { colonyReducer } from "./colonyReducer";

// component around whole app, children = everything inside
export function ColonyProvider({ children }: { children: ReactNode }) {
  // colony state lives here, dispatch sends actions to reducer, third parameter = start state is computed once from local storage (saved game or new colony)
  const [colony, dispatch] = useReducer(colonyReducer, localStorage, startingColony);
  // pause switch, only ui setting (not saved, not part of colony)
  const [paused, setPaused] = useState(false);

  // day clock stops for four reasons
  const clockStopped =
    // player paused
    paused ||
    // unread strike report
    awaitingAcknowledgement(colony) ||
    // unread raid report
    openRaid(colony) !== null ||
    // game over
    hasStarved(colony);

  // save after every change of colony (d5), effect runs after render whenever colony changed
  useEffect(() => {
    // write to local storage
    saveColony(colony, localStorage);
  // [colony] = run only when colony changed
  }, [colony]);

  // day timer
  useEffect(() => {
    // stopped = start no timer
    if (clockStopped) return;

    // every 8 seconds
    const timer = window.setInterval(
      // tell reducer a day passed
      () => dispatch({ type: "dayPassed" }),
      // 8_000 = 8000 ms
      8_000,
    );

    // cleanup: stop old timer when clock stops or component goes away (otherwise several timers would run)
    return () => window.clearInterval(timer);
  // [clockstopped] = restart effect only when this changes
  }, [clockStopped]);

    // sends resident on expedition, async = waits for server
    async function sendExpedition(dwarfId: string, destination: string) {
    // find resident by id
    const dwarf = colony.dwarves.find((item) => item.id === dwarfId);
    // guard: unknown, not available or game over = do nothing (reducer checks again)
    if (!dwarf || !isAvailable(dwarf) || hasStarved(colony)) return;

    // id created here (random is not allowed inside reducer), so answer can later be matched to exactly this expedition
    const expeditionId = crypto.randomUUID();

    // resident leaves right away, before server answers
    dispatch({ type: "expeditionDeparted", expeditionId, dwarfId, destination });

    // try = request can fail
    try {
      // wait for answer of server
      const result = await beginExpedition(dwarfId, destination);
      // success: rewards (only counts if expedition is still pending)
      dispatch({ type: "expeditionSucceeded", expeditionId, result });
    // any error (server error, unreachable, timeout, unreadable)
    } catch (error) {
      // failure action
      dispatch({
        // type
        type: "expeditionFailed",
        // which expedition
        expeditionId,
        // reason for chronicle
        reason:
          // real error object
          error instanceof Error
            // use its text
            ? error.message
            // otherwise general text
            : "The expedition was lost from view.",
      });
    }
  }

  // everything components can use
  const value: ColonyContextValue = {
    // state
    colony,
    // paused flag
    paused,
    // chronicle (shortcut)
    activities: colony.activities,
    // flip pause
    togglePaused: () => setPaused((value) => !value),
    // give a job
    assignDwarf: (dwarfId, assignment) =>
      // = action to reducer
      dispatch({ type: "dwarfAssigned", dwarfId, assignment }),
    // start forge order
    startCrafting: (dwarfId, recipe) =>
      // = action to reducer
      dispatch({ type: "craftingStarted", dwarfId, recipe }),
    // give tool
    equipTool: (dwarfId) => dispatch({ type: "toolEquipped", dwarfId }),
    // take tool back
    returnTool: (dwarfId) => dispatch({ type: "toolReturned", dwarfId }),
    // send on expedition (function above)
    sendExpedition,
    // acknowledge strike report
    acknowledgeActivity: (activityId) =>
      // = action to reducer
      dispatch({ type: "activityAcknowledged", activityId }),
    // new colony
    restartColony: () => dispatch({ type: "colonyRestarted" }),
    // close raid screen
    dismissRaid: () => dispatch({ type: "raidAcknowledged" }),
  };

  // make value available to all components inside
  return <ColonyContext value={value}>{children}</ColonyContext>;
}
