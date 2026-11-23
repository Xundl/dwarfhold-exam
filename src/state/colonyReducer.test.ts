// tests for reducer: every action goes through the reducer like in the real game
// test tools: describe = group of tests, it = one test, expect = check a value
import { describe, expect, it } from "vitest";
// is a report waiting
import { awaitingAcknowledgement } from "../activityLog";
// game over check
import { hasStarved } from "../simulation";
// types only
import type { ColonyState } from "../types";
// reducer and start colony
import { colonyReducer, initialColony } from "./colonyReducer";

// helper: start colony with a chosen amount of food
const withFood = (amount: number): ColonyState => ({
  // copy start colony
  ...initialColony,
  // only food is different
  resources: { ...initialColony.resources, food: amount },
});

// group: general reducer behaviour
describe("colony reducer", () => {
  // test: resident on expedition does not produce (d1: max one activity)
  it("a dwarf sent on an expedition stops producing until back home", () => {
    // bromli (dwarf-1) mines 2 stone per day in start colony, send him away
    const away = colonyReducer(initialColony, { type: "expeditionDeparted", expeditionId: "e1", dwarfId: "dwarf-1", destination: "old-mine" });
    // one day later stone is the same as before = nothing mined
    expect(colonyReducer(away, { type: "dayPassed" }).resources.stone).toBe(initialColony.resources.stone);

    // expedition fails, he comes home
    const back = colonyReducer(away, { type: "expeditionFailed", expeditionId: "e1", reason: "Rockfall." });
    // back home he works again (job was kept)
    expect(back.dwarves[0].status).toBe("working");
    // no reward for failed expedition (to equal = same content)
    expect(back.resources).toEqual(initialColony.resources);
    // next day he mines again: +2 stone
    expect(colonyReducer(back, { type: "dayPassed" }).resources.stone).toBe(initialColony.resources.stone + 2);
  });

  // test: invalid forge attempt changes nothing (d3)
  it("an invalid forge attempt changes nothing", () => {
    // colony with only 1 stone (tool needs 2)
    const poor = { ...initialColony, resources: { ...initialColony.resources, stone: 1 } };
    // same object comes back (to be = exactly the same object, not just same content)
    expect(colonyReducer(poor, { type: "craftingStarted", dwarfId: "dwarf-3", recipe: "tool" })).toBe(poor);
  });

  // test: chronicle ids are unique and list stays short
  it("chronicle ids are unique and the list stays short", () => {
    // start state (let = gets replaced in loop)
    let state = initialColony;
    // ten actions in a row
    for (let i = 0; i < 10; i += 1) {
      // switch job of dori between farming and none (i % 2 = odd or even)
      state = colonyReducer(state, { type: "dwarfAssigned", dwarfId: "dwarf-3", assignment: i % 2 ? null : "farming" });
    }
    // only six entries are kept
    expect(state.activities).toHaveLength(6);
    // set removes doubles, still six = all ids different
    expect(new Set(state.activities.map((entry) => entry.id)).size).toBe(6);
  });
});

// group: strike report stops day clock (d1)
describe("D1: strike reports stop the day clock", () => {
  // 2 food for 3 residents: dori (dwarf-3) gets no meal, shared by all tests in this group
  const striking = colonyReducer(withFood(2), { type: "dayPassed" });
  // the strike report (! = we know it exists)
  const report = striking.activities.find((entry) => entry.needsAck)!;

  // test: no day passes until report is acknowledged
  it("no day passes until the report is acknowledged", () => {
    // a report is waiting
    expect(awaitingAcknowledgement(striking)).toBe(true);
    // day passed is ignored, same state back
    expect(colonyReducer(striking, { type: "dayPassed" })).toBe(striking);
  });

  // test: acknowledge restarts clock but does not end strike
  it("acknowledging restarts the clock but does not end the strike", () => {
    // player clicks acknowledge
    const seen = colonyReducer(striking, { type: "activityAcknowledged", activityId: report.id });
    // nothing waiting anymore
    expect(awaitingAcknowledgement(seen)).toBe(false);
    // dori is still hungry (only a meal ends strike)
    expect(seen.dwarves[2].hungry).toBe(true);
    // now day moves on
    expect(colonyReducer(seen, { type: "dayPassed" }).day).toBe(striking.day + 1);
  });

  // test: waiting report is never pushed out of chronicle
  it("an unacknowledged report is never pushed out of the chronicle", () => {
    // start with striking state
    let state = striking;
    // ten other entries
    for (let i = 0; i < 10; i += 1) {
      // switch job of bromli back and forth
      state = colonyReducer(state, { type: "dwarfAssigned", dwarfId: "dwarf-1", assignment: i % 2 ? "mining" : null });
    }
    // list still has six entries
    expect(state.activities).toHaveLength(6);
    // and the report is still one of them
    expect(state.activities.some((entry) => entry.id === report.id)).toBe(true);
  });

  // test: resident on strike cannot leave on expedition
  it("a dwarf on strike cannot leave on an expedition", () => {
    // departure is ignored, same state back
    expect(colonyReducer(striking, { type: "expeditionDeparted", expeditionId: "e1", dwarfId: "dwarf-3", destination: "old-mine" })).toBe(striking);
  });
});

// group: starved colony is lost (d1)
describe("D1: a starved colony is lost", () => {
  // no food for 3 residents: after one day everyone is hungry and stores are empty
  const starved = colonyReducer(withFood(0), { type: "dayPassed" });

  // test: lost colony ignores every action except restart
  it("ignores every action except a restart", () => {
    // it is game over
    expect(hasStarved(starved)).toBe(true);
    // no more days
    expect(colonyReducer(starved, { type: "dayPassed" })).toBe(starved);
    // no job changes
    expect(colonyReducer(starved, { type: "dwarfAssigned", dwarfId: "dwarf-3", assignment: "farming" })).toBe(starved);
    // no forge orders
    expect(colonyReducer(starved, { type: "craftingStarted", dwarfId: "dwarf-3", recipe: "tool" })).toBe(starved);
  });

  // test: restart brings back start colony
  it("a restart brings back the initial colony", () => {
    // exactly the start colony object
    expect(colonyReducer(starved, { type: "colonyRestarted" })).toBe(initialColony);
  });
});
