import { describe, expect, it } from "vitest";
import { awaitingAcknowledgement } from "../activityLog";
import { hasStarved } from "../simulation";
import type { ColonyState } from "../types";
import { colonyReducer, initialColony } from "./colonyReducer";

const withFood = (amount: number): ColonyState => ({
  ...initialColony,
  resources: { ...initialColony.resources, food: amount },
});

describe("colony reducer", () => {
  it("a dwarf sent on an expedition stops producing until back home", () => {
    // Bromli (dwarf-1) mines 2 stone per day in the initial colony.
    const away = colonyReducer(initialColony, { type: "expeditionDeparted", expeditionId: "e1", dwarfId: "dwarf-1", destination: "old-mine" });
    expect(colonyReducer(away, { type: "dayPassed" }).resources.stone).toBe(initialColony.resources.stone);

    const back = colonyReducer(away, { type: "expeditionFailed", expeditionId: "e1", reason: "Rockfall." });
    expect(back.dwarves[0].status).toBe("working");
    expect(back.resources).toEqual(initialColony.resources);
    expect(colonyReducer(back, { type: "dayPassed" }).resources.stone).toBe(initialColony.resources.stone + 2);
  });

  it("an invalid forge attempt changes no resources", () => {
    const poor = { ...initialColony, resources: { ...initialColony.resources, stone: 1 } };
    expect(colonyReducer(poor, { type: "toolCrafted" }).resources).toEqual(poor.resources);
  });

  it("chronicle ids are unique and the list stays short", () => {
    let state = initialColony;
    for (let i = 0; i < 10; i += 1) {
      state = colonyReducer(state, { type: "dwarfAssigned", dwarfId: "dwarf-3", assignment: i % 2 ? null : "farming" });
    }
    expect(state.activities).toHaveLength(6);
    expect(new Set(state.activities.map((entry) => entry.id)).size).toBe(6);
  });
});

describe("D1: strike reports stop the day clock", () => {
  // 2 food for 3 dwarves: Dori (dwarf-3) goes without a meal.
  const striking = colonyReducer(withFood(2), { type: "dayPassed" });
  const report = striking.activities.find((entry) => entry.needsAck)!;

  it("no day passes until the report is acknowledged", () => {
    expect(awaitingAcknowledgement(striking)).toBe(true);
    expect(colonyReducer(striking, { type: "dayPassed" })).toBe(striking);
  });

  it("acknowledging restarts the clock but does not end the strike", () => {
    const seen = colonyReducer(striking, { type: "activityAcknowledged", activityId: report.id });
    expect(awaitingAcknowledgement(seen)).toBe(false);
    expect(seen.dwarves[2].hungry).toBe(true);
    expect(colonyReducer(seen, { type: "dayPassed" }).day).toBe(striking.day + 1);
  });

  it("an unacknowledged report is never pushed out of the chronicle", () => {
    let state = striking;
    for (let i = 0; i < 10; i += 1) {
      state = colonyReducer(state, { type: "dwarfAssigned", dwarfId: "dwarf-1", assignment: i % 2 ? "mining" : null });
    }
    expect(state.activities).toHaveLength(6);
    expect(state.activities.some((entry) => entry.id === report.id)).toBe(true);
  });

  it("a dwarf on strike cannot leave on an expedition", () => {
    expect(colonyReducer(striking, { type: "expeditionDeparted", expeditionId: "e1", dwarfId: "dwarf-3", destination: "old-mine" })).toBe(striking);
  });
});

describe("D1: a starved colony is lost", () => {
  const starved = colonyReducer(withFood(0), { type: "dayPassed" });

  it("ignores every action except a restart", () => {
    expect(hasStarved(starved)).toBe(true);
    expect(colonyReducer(starved, { type: "dayPassed" })).toBe(starved);
    expect(colonyReducer(starved, { type: "dwarfAssigned", dwarfId: "dwarf-3", assignment: "farming" })).toBe(starved);
    expect(colonyReducer(starved, { type: "toolCrafted" })).toBe(starved);
  });

  it("a restart brings back the initial colony", () => {
    expect(colonyReducer(starved, { type: "colonyRestarted" })).toBe(initialColony);
  });
});
