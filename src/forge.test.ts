// tests for forge (d3): start order, time, invalid attempts, several smiths, hungry smith
// test tools: describe = group of tests, it = one test, expect = check a value
import { describe, expect, it } from "vitest";
// equip a tool
import { equipTool } from "./equipment";
// functions under test
import { craftingProblem, craftingSummary, recipes, startCrafting } from "./forge";
// day, job change, production, availability
import { advanceDay, assignDwarf, expectedProduction, isAvailable } from "./simulation";
// reducer and start colony
import { colonyReducer, initialColony } from "./state/colonyReducer";
// types only
import type { ColonyState, Dwarf } from "./types";

// helper: builds a test resident with defaults, overrides = only fields that matter for the test
const dwarf = (id: string, overrides: Partial<Dwarf> = {}): Dwarf => ({
  // idle dwarf, not hungry, no tool, then overrides on top
  id, name: id, title: "", icon: "", species: "dwarf", assignment: null, status: "idle", hungry: false, hasTool: false, ...overrides,
});

// helper: test colony with enough material and two residents
const colony = (overrides: Partial<ColonyState> = {}): ColonyState => ({
  // day 12
  day: 12,
  // 10 wood, 10 stone, plenty of food
  resources: { wood: 10, stone: 10, food: 30, tools: 0, weapons: 0 },
  // d1 is a working miner, d2 is idle
  dwarves: [dwarf("d1", { assignment: "mining", status: "working" }), dwarf("d2")],
  // empty chronicle
  activities: [],
  // counter 0
  activityCount: 0,
    // nobody travelling
    expeditions: [],
  // no raid reports
  raids: [],
  // overrides last, so they win
  ...overrides,
});

// helper: let several days pass
const days = (state: ColonyState, count: number) => {
  // start state
  let next = state;
  // one day per round
  for (let i = 0; i < count; i += 1) next = advanceDay(next);
  // state after all days
  return next;
};

// group: starting an order
describe("D3: starting a forge order", () => {
  // test: material is taken at once, resident goes to forge, nothing is made yet
  it("takes the materials at once and sends the dwarf to the forge, but makes nothing yet", () => {
    // d1 starts a weapon
    const next = startCrafting(colony(), "d1", "weapon");
    // 10 - 2 wood, 10 - 4 stone, still no weapon
    expect(next.resources).toMatchObject({ wood: 8, stone: 6, weapons: 0 });
    // status crafting with order: weapon, 2 days left
    expect(next.dwarves[0]).toMatchObject({ status: "crafting", crafting: { recipe: "weapon", daysLeft: 2 } });
    // chronicle says ready on day 14 (12 + 2)
    expect(next.activities[0].message).toContain("Ready on day 14");
  });

  // test: smith does not do own job meanwhile and cannot start anything else
  it("the smith does not do the job meanwhile and cannot start anything else", () => {
    // d1 (miner) starts a tool
    const next = startCrafting(colony(), "d1", "tool");
    // no stone mined
    expect(expectedProduction(next).stone).toBe(0);
    // not available
    expect(isAvailable(next.dwarves[0])).toBe(false);
    // job change ignored (not at home)
    expect(assignDwarf(next, "d1", "farming")).toBe(next);
    // expedition ignored
    expect(colonyReducer(next, { type: "expeditionDeparted", expeditionId: "e1", dwarfId: "d1", destination: "old-mine" })).toBe(next);  });
});

// group: forging takes time
describe("D3: forging takes time", () => {
  // test: tool is ready after one day and smith goes back to job
  it("a tool is ready after one day and the smith returns to the job", () => {
    // start
    const started = startCrafting(colony(), "d1", "tool");
    // one day
    const done = advanceDay(started);
    // day 13
    expect(done.day).toBe(13);
    // one tool in stores
    expect(done.resources.tools).toBe(1);
    // working again
    expect(done.dwarves[0].status).toBe("working");
    // order is gone
    expect(done.dwarves[0].crafting).toBeUndefined();
    // green entry on day 13
    expect(done.activities[0]).toMatchObject({ day: 13, tone: "good" });
    // next day he mines again: +2 stone
    expect(advanceDay(done).resources.stone).toBe(started.resources.stone + 2);
  });

  // test: weapon is not ready after one day but after two
  it("a weapon is not ready after one day, but after two", () => {
    // d2 starts a weapon
    const started = startCrafting(colony(), "d2", "weapon");
    // one day
    const half = advanceDay(started);
    // no weapon yet
    expect(half.resources.weapons).toBe(0);
    // still forging, 1 day left
    expect(half.dwarves[1]).toMatchObject({ status: "crafting", crafting: { daysLeft: 1 } });
    // display text shows ready day
    expect(craftingSummary(half, half.dwarves[1])).toBe("Forging a weapon · ready on day 14");

    // second day
    const done = advanceDay(half);
    // day 14
    expect(done.day).toBe(14);
    // one weapon
    expect(done.resources.weapons).toBe(1);
    // d2 had no job, so idle again
    expect(done.dwarves[1].status).toBe("idle");
  });

  // test: exactly one item per order
  it("exactly one item comes out of one order", () => {
    // start one tool, wait 5 days
    const done = days(startCrafting(colony(), "d1", "tool"), 5);
    // still only 1 tool
    expect(done.resources.tools).toBe(1);
    // wood was taken exactly once
    expect(done.resources.wood).toBe(10 - recipes.tool.cost.wood);
  });
});

// group: invalid attempts change nothing
describe("D3: invalid attempts change nothing", () => {
  // test: not enough material
  it("not enough materials", () => {
    // only 1 wood
    const poor = colony({ resources: { wood: 1, stone: 10, food: 30, tools: 0, weapons: 0 } });
    // same state back
    expect(startCrafting(poor, "d1", "weapon")).toBe(poor);
    // reason for the screen
    expect(craftingProblem(poor, poor.dwarves[0], "weapon")).toBe("Needs 2 timber and 4 stone.");
  });

  // test: resident who is away, on strike, unknown or already forging
  it("a dwarf who is away, on strike, unknown or already forging", () => {
    // away
    const away = colony({ dwarves: [dwarf("d1", { status: "expedition" })] });
    // same state back
    expect(startCrafting(away, "d1", "tool")).toBe(away);

    // on strike
    const striking = colony({ dwarves: [dwarf("d1", { hungry: true })] });
    // same state back
    expect(startCrafting(striking, "d1", "tool")).toBe(striking);
    // reason for the screen
    expect(craftingProblem(striking, striking.dwarves[0], "tool")).toBe("d1 is on strike.");

    // normal colony
    const state = colony();
    // unknown id = same state back
    expect(startCrafting(state, "nobody", "tool")).toBe(state);

    // d1 already forging
    const busy = startCrafting(state, "d1", "tool");
    // second order ignored
    expect(startCrafting(busy, "d1", "weapon")).toBe(busy);
  });

  // test: double click starts one order and takes material once
  it("a double click starts one order and takes the materials once", () => {
    // first click
    const once = startCrafting(colony(), "d1", "tool");
    // second click
    const twice = startCrafting(once, "d1", "tool");
    // nothing changed by second click
    expect(twice).toBe(once);
    // wood taken once (10 - 3)
    expect(twice.resources.wood).toBe(7);
  });
});

// group: several smiths
describe("D3: several smiths", () => {
  // test: two residents can forge at the same time
  it("two dwarves can forge at the same time", () => {
    // d1 weapon, d2 tool
    const both = startCrafting(startCrafting(colony(), "d1", "weapon"), "d2", "tool");
    // both costs are gone: 10 - 2 - 3 wood, 10 - 4 - 2 stone
    expect(both.resources).toMatchObject({ wood: 5, stone: 4 });
    // two days
    const done = days(both, 2);
    // both items are there
    expect(done.resources).toMatchObject({ tools: 1, weapons: 1 });
  });

  // test: second order is refused if first one used up the material
  it("the second order is refused when the first one used up the materials", () => {
    // only 4 wood and 4 stone
    const tight = colony({ resources: { wood: 4, stone: 4, food: 30, tools: 0, weapons: 0 } });
    // weapon takes 2 wood and 4 stone
    const first = startCrafting(tight, "d1", "weapon");
    // no stone left for a tool, same state back
    expect(startCrafting(first, "d2", "tool")).toBe(first);
  });
});

// group: hungry smith pauses
describe("D3: a hungry smith pauses", () => {
  // helper: exactly one meal per evening for two residents
  const oneMeal = (state: ColonyState): ColonyState => ({ ...state, resources: { ...state.resources, food: 1 } });
  // d2 starts hungry and is served first, so smith d1 gets no meal on first evening and eats on second
  const start = colony({ dwarves: [dwarf("d1"), dwarf("d2", { hungry: true })] });

  // test: no day is counted while hungry and nothing is lost
  it("no day is counted while hungry, and nothing is lost", () => {
    // d1 starts weapon on day 12 (2 days)
    const started = startCrafting(start, "d1", "weapon");

    // first evening: worked on day 12, then got no meal
    const day13 = advanceDay(oneMeal(started));
    // hungry, 1 day left
    expect(day13.dwarves[0]).toMatchObject({ hungry: true, crafting: { daysLeft: 1 } });
    // display text shows pause
    expect(craftingSummary(day13, day13.dwarves[0])).toBe("Forging a weapon · paused: hungry");

    // second evening: hungry all of day 13 so no progress, but eats tonight
    const day14 = advanceDay(oneMeal(day13));
    // fed again, still 1 day left
    expect(day14.dwarves[0]).toMatchObject({ hungry: false, status: "crafting", crafting: { daysLeft: 1 } });
    // no weapon yet
    expect(day14.resources.weapons).toBe(0);

    // third day with enough food
    const day15 = advanceDay({ ...day14, resources: { ...day14.resources, food: 5 } });
    // day 15, one day later than ready on day 14 from the start
    expect(day15.day).toBe(15);
    // weapon is there
    expect(day15.resources.weapons).toBe(1);
    // material was taken exactly once (10 - 2)
    expect(day15.resources.wood).toBe(8);
  });
});

// group: tools and forge
describe("D3: tools and the forge", () => {
  // test: smith keeps equipped tool, no bonus while forging
  it("a smith keeps an equipped tool, without bonus while forging", () => {
    // d1 gets a tool
    const equipped = equipTool(colony({ resources: { wood: 10, stone: 10, food: 30, tools: 1, weapons: 0 } }), "d1");
    // d1 starts forging
    const forging = startCrafting(equipped, "d1", "tool");
    // still has the tool
    expect(forging.dwarves[0].hasTool).toBe(true);
    // no production while forging
    expect(expectedProduction(forging).stone).toBe(0);
    // after order is done: 2 stone + 1 bonus
    expect(expectedProduction(advanceDay(forging)).stone).toBe(3);
  });
});

// group: through the reducer
describe("D3: through the reducer", () => {
  // test: action starts order in the real colony
  it("craftingStarted starts an order in the real colony", () => {
    // dori starts a tool
    const next = colonyReducer(initialColony, { type: "craftingStarted", dwarfId: "dwarf-3", recipe: "tool" });
    // status crafting
    expect(next.dwarves[2].status).toBe("crafting");
    // one day later one more tool
    expect(colonyReducer(next, { type: "dayPassed" }).resources.tools).toBe(initialColony.resources.tools + 1);
  });
});
