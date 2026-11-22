import { describe, expect, it } from "vitest";
import { colonyReducer, initialColony } from "./state/colonyReducer";
import type { ExpeditionResult } from "./types";

const result: ExpeditionResult = {
  expeditionId: "exp-17", status: "completed", rewards: { stone: 8 }, message: "Found stone.",
};
const away = colonyReducer(initialColony, {
  type: "expeditionDeparted", expeditionId: "e1", dwarfId: "dwarf-3", destination: "old-mine",
});

describe("D4: resilient expeditions", () => {
  it("a departing dwarf is away and the expedition is pending", () => {
    expect(away.dwarves[2].status).toBe("expedition");
    expect(away.expeditions).toHaveLength(1);
  });

  it("rewards are applied exactly once, even if the answer arrives twice", () => {
    const once = colonyReducer(away, { type: "expeditionSucceeded", expeditionId: "e1", result });
    const twice = colonyReducer(once, { type: "expeditionSucceeded", expeditionId: "e1", result });
    expect(once.resources.stone).toBe(initialColony.resources.stone + 8);
    expect(twice).toBe(once);
    expect(once.dwarves[2].status).toBe("idle");
    expect(once.expeditions).toHaveLength(0);
  });

  it("a failed expedition gives no reward and brings the dwarf home", () => {
    const failed = colonyReducer(away, { type: "expeditionFailed", expeditionId: "e1", reason: "Rockfall." });
    expect(failed.resources).toEqual(initialColony.resources);
    expect(failed.dwarves[2].status).toBe("idle");
  });

  it("a late success after a failure (e.g. timeout) is ignored", () => {
    const failed = colonyReducer(away, { type: "expeditionFailed", expeditionId: "e1", reason: "Timeout." });
    expect(colonyReducer(failed, { type: "expeditionSucceeded", expeditionId: "e1", result })).toBe(failed);
  });

  it("a second departure of the same dwarf (double click) is rejected", () => {
    const again = colonyReducer(away, {
      type: "expeditionDeparted", expeditionId: "e2", dwarfId: "dwarf-3", destination: "old-mine",
    });
    expect(again).toBe(away);
    // ...and the answer to that rejected departure gives nothing
    expect(colonyReducer(again, { type: "expeditionSucceeded", expeditionId: "e2", result })).toBe(again);
  });

  it("an answer arriving after a colony restart is ignored", () => {
    const restarted = colonyReducer(away, { type: "colonyRestarted" });
    expect(colonyReducer(restarted, { type: "expeditionSucceeded", expeditionId: "e1", result })).toBe(restarted);
  });
});