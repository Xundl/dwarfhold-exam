// tests for daily simulation (d1): production, meals, strike, game over
// test tools: describe = group of tests, it = one test, expect = check a value
import { describe, expect, it } from "vitest";
// functions under test
import {
  advanceDay,
  assignDwarf,
  expectedProduction,
  hasStarved,
  isAvailable,
  serveMeals,
} from "./simulation";
// types only
import type { ColonyState, Dwarf } from "./types";

// helper: builds a test resident with defaults, overrides = only fields that matter for the test
const dwarf = (id: string, overrides: Partial<Dwarf> = {}): Dwarf => ({
  // idle dwarf, not hungry, no tool, then overrides on top
  id, name: id, title: "", icon: "", species: "dwarf", assignment: null, status: "idle", hungry: false, hasTool: false, ...overrides,
});

// helper: builds a small test colony, overrides on top
const colony = (overrides: Partial<ColonyState> = {}): ColonyState => ({
  // day 1
  day: 1,
  // only 5 food
  resources: { wood: 0, stone: 0, food: 5, tools: 0, weapons: 0 },
  // no residents
  dwarves: [],
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

// helper: stores with only food
const food = (amount: number) => ({ wood: 0, stone: 0, food: amount, tools: 0, weapons: 0 });
// helper: ids of all hungry residents
const hungryIds = (state: ColonyState) =>
  state.dwarves.filter((item) => item.hungry).map((item) => item.id);

// group: basics
describe("colony simulation", () => {
  // test: produces and feeds
  it("produces assigned resources and feeds the company", () => {
    // one woodcutter
    const state = colony({ dwarves: [dwarf("d1", { assignment: "woodcutting", status: "working" })] });
    // next day: day 2, 3 wood, 5 food minus 1 meal = 4 (to match object = only these fields are checked)
    expect(advanceDay(state)).toMatchObject({ day: 2, resources: { wood: 3, food: 4 } });
    // old state was not changed (pure function)
    expect(state.resources.wood).toBe(0);
  });

  // test: same state gives same result (deterministic)
  it("gives the same result for the same state", () => {
    // 1 food for 2 residents
    const state = colony({ resources: food(1), dwarves: [dwarf("d1"), dwarf("d2")] });
    // two runs, same content
    expect(advanceDay(state)).toEqual(advanceDay(state));
  });
});

// group: one activity at a time
describe("D1: one activity at a time", () => {
  // test: resident on expedition does not produce but still eats
  it("a dwarf on an expedition does not produce, but still eats", () => {
    // miner who is away
    const state = colony({ dwarves: [dwarf("d1", { assignment: "mining", status: "expedition" })] });
    // no stone, but one meal eaten
    expect(advanceDay(state).resources).toMatchObject({ stone: 0, food: 4 });
  });

  // test: resident without job does not produce
  it("an unassigned dwarf does not produce", () => {
    // idle resident
    const state = colony({ dwarves: [dwarf("d1")] });
    // all zero
    expect(expectedProduction(state)).toEqual({ wood: 0, stone: 0, food: 0, tools: 0, weapons: 0 });
  });

  // test: resident who is away cannot be reassigned
  it("does not reassign a dwarf who is away", () => {
    // away
    const state = colony({ dwarves: [dwarf("d1", { status: "expedition" })] });
    // same state back
    expect(assignDwarf(state, "d1", "mining")).toBe(state);
  });

  // test: job at home sets matching status
  it("assigning a job at home sets the matching status", () => {
    // idle resident
    const state = colony({ dwarves: [dwarf("d1")] });
    // with job = working
    expect(assignDwarf(state, "d1", "mining").dwarves[0]).toMatchObject({ assignment: "mining", status: "working" });
    // working miner
    const working = colony({ dwarves: [dwarf("d1", { assignment: "mining", status: "working" })] });
    // job removed = idle
    expect(assignDwarf(working, "d1", null).dwarves[0]).toMatchObject({ assignment: null, status: "idle" });
  });
});

// group: meals
describe("D1: meals", () => {
  // three residents, roster order d1, d2, d3
  const three = [dwarf("d1"), dwarf("d2"), dwarf("d3")];

  // test: enough food = everyone eats
  it("feeds everyone when the stores are large enough", () => {
    // same residents back (nobody changed), 5 - 3 = 2 food left
    expect(serveMeals(three, 5)).toEqual({ dwarves: three, food: 2 });
  });

  // test: too little food = roster order decides, food never below zero
  it("with too little food the roster order decides, and food never goes below zero", () => {
    // 2 meals for 3
    const result = serveMeals(three, 2);
    // stores empty, not negative
    expect(result.food).toBe(0);
    // last in roster stays hungry
    expect(result.dwarves.map((item) => item.hungry)).toEqual([false, false, true]);
  });

  // test: hungry first, so shortage moves through the group
  it("hungry dwarves are served first, so the shortage moves through the company", () => {
    // evening 1: 2 food for 3
    const evening1 = advanceDay(colony({ resources: food(2), dwarves: three }));
    // d3 goes hungry
    expect(hungryIds(evening1)).toEqual(["d3"]);

    // evening 2: again only 2 food
    const evening2 = advanceDay({ ...evening1, resources: food(2) });
    // d3 eats first now, d1 next, d2 goes hungry
    expect(hungryIds(evening2)).toEqual(["d2"]);

    // evening 3: again only 2 food
    const evening3 = advanceDay({ ...evening2, resources: food(2) });
    // d2 eats first, then d1, d3 goes hungry again
    expect(hungryIds(evening3)).toEqual(["d3"]);
  });

  // test: travellers eat too
  it("travellers eat from the stores as well", () => {
    // traveller first in roster, 1 food
    const result = serveMeals([dwarf("d1", { status: "expedition" }), dwarf("d2")], 1);
    // traveller is fed, the one at home goes hungry
    expect(result.dwarves.map((item) => item.hungry)).toEqual([false, true]);
  });
});

// group: hunger strike
describe("D1: hunger strike", () => {
  // test: hungry resident produces nothing and cannot start anything
  it("a hungry dwarf produces nothing and cannot start anything new", () => {
    // hungry miner
    const striker = dwarf("d1", { assignment: "mining", status: "working", hungry: true });
    // no stone
    expect(expectedProduction(colony({ dwarves: [striker] })).stone).toBe(0);
    // not available (no expedition, no forge)
    expect(isAvailable(striker)).toBe(false);
  });

  // test: hungry resident can get another job but still does not work
  it("a hungry dwarf can be given another job, but still does not work", () => {
    // hungry miner
    const state = colony({ dwarves: [dwarf("d1", { assignment: "mining", status: "working", hungry: true })] });
    // change job to farming
    const next = assignDwarf(state, "d1", "farming");
    // job is changed
    expect(next.dwarves[0].assignment).toBe("farming");
    // but no food produced
    expect(expectedProduction(next).food).toBe(0);
  });

  // test: going hungry writes a report that must be acknowledged
  it("going without a meal writes a report that needs acknowledgement", () => {
    // 1 food for 2
    const next = advanceDay(colony({ resources: food(1), dwarves: [dwarf("d1"), dwarf("d2")] }));
    // d2 goes hungry
    expect(hungryIds(next)).toEqual(["d2"]);
    // newest entry is red and needs acknowledge
    expect(next.activities[0]).toMatchObject({ day: 2, tone: "warning", needsAck: true });
  });

  // test: meal ends strike and resident produces again
  it("a meal ends the strike and the dwarf produces again", () => {
    // hungry miner with 1 food in stores
    const state = colony({
      // one meal
      resources: food(1),
      // on strike today
      dwarves: [dwarf("d1", { assignment: "mining", status: "working", hungry: true })],
    });
    // one day
    const fed = advanceDay(state);
    // fed again
    expect(fed.dwarves[0].hungry).toBe(false);
    // no stone (was on strike today), food eaten tonight
    expect(fed.resources).toMatchObject({ stone: 0, food: 0 });
    // green back at work entry
    expect(fed.activities[0]).toMatchObject({ tone: "good" });
    // next day 2 stone again
    expect(expectedProduction(fed).stone).toBe(2);
  });

  // test: resident who stays hungry is not reported twice
  it("a dwarf who stays hungry is not reported twice", () => {
    // two hungry residents, only 1 food
    const state = colony({
      // one meal
      resources: food(1),
      // both already hungry
      dwarves: [dwarf("d1", { hungry: true }), dwarf("d2", { hungry: true })],
    });
    // one day
    const next = advanceDay(state);
    // d1 eats (first in queue), d2 stays hungry
    expect(hungryIds(next)).toEqual(["d2"]);
    // no new report for d2 (was already reported)
    expect(next.activities.filter((item) => item.needsAck)).toHaveLength(0);
  });
});

// group: game over
describe("D1: starvation", () => {
  // test: everyone hungry and stores empty = starved
  it("everyone hungry with empty stores means the colony has starved", () => {
    // no food for 2
    const next = advanceDay(colony({ resources: food(0), dwarves: [dwarf("d1"), dwarf("d2")] }));
    // game over
    expect(hasStarved(next)).toBe(true);
    // only one chronicle entry (the game over text)
    expect(next.activities).toHaveLength(1);
    // and it needs no acknowledge
    expect(next.activities[0].needsAck).toBeUndefined();
  });

  // test: one fed resident keeps colony alive
  it("one fed dwarf is enough to keep the colony alive", () => {
    // 1 food for 2
    const next = advanceDay(colony({ resources: food(1), dwarves: [dwarf("d1"), dwarf("d2")] }));
    // stores empty
    expect(next.resources.food).toBe(0);
    // but not lost, d1 can still farm
    expect(hasStarved(next)).toBe(false);
  });

  // test: farmer can still save the evening because production comes before meals
  it("a farmer can still save the evening, because production comes before meals", () => {
    // one day
    const next = advanceDay(colony({
      // stores empty
      resources: food(0),
      // one farmer (4 food) and one idle
      dwarves: [dwarf("d1", { assignment: "farming", status: "working" }), dwarf("d2")],
    }));
    // nobody hungry
    expect(hungryIds(next)).toEqual([]);
    // 4 produced minus 2 eaten = 2
    expect(next.resources.food).toBe(2);
  });
});
