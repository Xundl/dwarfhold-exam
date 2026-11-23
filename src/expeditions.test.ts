// tests for expeditions (d4): pending, reward exactly once, failure, late and double answers
// test tools: describe = group of tests, it = one test, expect = check a value
import { describe, expect, it } from "vitest";
// reducer and start colony
import { colonyReducer, initialColony } from "./state/colonyReducer";
// types only
import type { ExpeditionResult } from "./types";

// a successful answer of the server
const result: ExpeditionResult = {
  // 8 stone as reward
  expeditionId: "exp-17", status: "completed", rewards: { stone: 8 }, message: "Found stone.",
};
// shared start: dori (dwarf-3) has left with expedition id e1
const away = colonyReducer(initialColony, {
  // departure action
  type: "expeditionDeparted", expeditionId: "e1", dwarfId: "dwarf-3", destination: "old-mine",
});

// group: all d4 rules
describe("D4: resilient expeditions", () => {
  // test: after departure resident is away and expedition is pending
  it("a departing dwarf is away and the expedition is pending", () => {
    // status expedition
    expect(away.dwarves[2].status).toBe("expedition");
    // one pending expedition
    expect(away.expeditions).toHaveLength(1);
  });

  // test: reward exactly once, even if answer arrives twice
  it("rewards are applied exactly once, even if the answer arrives twice", () => {
    // first answer
    const once = colonyReducer(away, { type: "expeditionSucceeded", expeditionId: "e1", result });
    // same answer again
    const twice = colonyReducer(once, { type: "expeditionSucceeded", expeditionId: "e1", result });
    // stone + 8
    expect(once.resources.stone).toBe(initialColony.resources.stone + 8);
    // second answer changed nothing (same object)
    expect(twice).toBe(once);
    // dori is home, no job = idle
    expect(once.dwarves[2].status).toBe("idle");
    // nothing pending anymore
    expect(once.expeditions).toHaveLength(0);
  });

  // test: failed expedition gives no reward and brings resident home
  it("a failed expedition gives no reward and brings the dwarf home", () => {
    // failure
    const failed = colonyReducer(away, { type: "expeditionFailed", expeditionId: "e1", reason: "Rockfall." });
    // stores unchanged
    expect(failed.resources).toEqual(initialColony.resources);
    // home again
    expect(failed.dwarves[2].status).toBe("idle");
  });

  // test: late success after failure (timeout) is ignored
  it("a late success after a failure (e.g. timeout) is ignored", () => {
    // timeout first
    const failed = colonyReducer(away, { type: "expeditionFailed", expeditionId: "e1", reason: "Timeout." });
    // real answer arrives later: same state back
    expect(colonyReducer(failed, { type: "expeditionSucceeded", expeditionId: "e1", result })).toBe(failed);
  });

  // test: second departure of same resident (double click) is rejected
  it("a second departure of the same dwarf (double click) is rejected", () => {
    // dori is already away
    const again = colonyReducer(away, {
      // second departure with new id
      type: "expeditionDeparted", expeditionId: "e2", dwarfId: "dwarf-3", destination: "old-mine",
    });
    // same state back
    expect(again).toBe(away);
    // answer to that rejected departure gives nothing either
    expect(colonyReducer(again, { type: "expeditionSucceeded", expeditionId: "e2", result })).toBe(again);
  });

  // test: answer after restart is ignored
  it("an answer arriving after a colony restart is ignored", () => {
    // new colony
    const restarted = colonyReducer(away, { type: "colonyRestarted" });
    // old answer finds no pending expedition
    expect(colonyReducer(restarted, { type: "expeditionSucceeded", expeditionId: "e1", result })).toBe(restarted);
  });
});