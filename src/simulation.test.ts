import { describe, expect, it } from "vitest";
import {
  advanceDay,
  assignDwarf,
  expectedProduction,
  hasStarved,
  isAvailable,
  serveMeals,
} from "./simulation";
import type { ColonyState, Dwarf } from "./types";

const dwarf = (id: string, overrides: Partial<Dwarf> = {}): Dwarf => ({
  id, name: id, title: "", icon: "", species: "dwarf", assignment: null, status: "idle", hungry: false, hasTool: false, ...overrides,
});

const colony = (overrides: Partial<ColonyState> = {}): ColonyState => ({
  day: 1,
  resources: { wood: 0, stone: 0, food: 5, tools: 0, weapons: 0 },
  dwarves: [],
  activities: [],
  activityCount: 0,
  expeditions: [],
  ...overrides,
});

const food = (amount: number) => ({ wood: 0, stone: 0, food: amount, tools: 0, weapons: 0 });
const hungryIds = (state: ColonyState) =>
  state.dwarves.filter((item) => item.hungry).map((item) => item.id);

describe("colony simulation", () => {
  it("produces assigned resources and feeds the company", () => {
    const state = colony({ dwarves: [dwarf("d1", { assignment: "woodcutting", status: "working" })] });
    expect(advanceDay(state)).toMatchObject({ day: 2, resources: { wood: 3, food: 4 } });
    expect(state.resources.wood).toBe(0);
  });

  it("gives the same result for the same state", () => {
    const state = colony({ resources: food(1), dwarves: [dwarf("d1"), dwarf("d2")] });
    expect(advanceDay(state)).toEqual(advanceDay(state));
  });
});

describe("D1: one activity at a time", () => {
  it("a dwarf on an expedition does not produce, but still eats", () => {
    const state = colony({ dwarves: [dwarf("d1", { assignment: "mining", status: "expedition" })] });
    expect(advanceDay(state).resources).toMatchObject({ stone: 0, food: 4 });
  });

  it("an unassigned dwarf does not produce", () => {
    const state = colony({ dwarves: [dwarf("d1")] });
    expect(expectedProduction(state)).toEqual({ wood: 0, stone: 0, food: 0, tools: 0, weapons: 0 });
  });

  it("does not reassign a dwarf who is away", () => {
    const state = colony({ dwarves: [dwarf("d1", { status: "expedition" })] });
    expect(assignDwarf(state, "d1", "mining")).toBe(state);
  });

  it("assigning a job at home sets the matching status", () => {
    const state = colony({ dwarves: [dwarf("d1")] });
    expect(assignDwarf(state, "d1", "mining").dwarves[0]).toMatchObject({ assignment: "mining", status: "working" });
    const working = colony({ dwarves: [dwarf("d1", { assignment: "mining", status: "working" })] });
    expect(assignDwarf(working, "d1", null).dwarves[0]).toMatchObject({ assignment: null, status: "idle" });
  });
});

describe("D1: meals", () => {
  const three = [dwarf("d1"), dwarf("d2"), dwarf("d3")];

  it("feeds everyone when the stores are large enough", () => {
    expect(serveMeals(three, 5)).toEqual({ dwarves: three, food: 2 });
  });

  it("with too little food the roster order decides, and food never goes below zero", () => {
    const result = serveMeals(three, 2);
    expect(result.food).toBe(0);
    expect(result.dwarves.map((item) => item.hungry)).toEqual([false, false, true]);
  });

  it("hungry dwarves are served first, so the shortage moves through the company", () => {
    const evening1 = advanceDay(colony({ resources: food(2), dwarves: three }));
    expect(hungryIds(evening1)).toEqual(["d3"]);

    const evening2 = advanceDay({ ...evening1, resources: food(2) });
    expect(hungryIds(evening2)).toEqual(["d2"]);

    const evening3 = advanceDay({ ...evening2, resources: food(2) });
    expect(hungryIds(evening3)).toEqual(["d3"]);
  });

  it("travellers eat from the stores as well", () => {
    const result = serveMeals([dwarf("d1", { status: "expedition" }), dwarf("d2")], 1);
    expect(result.dwarves.map((item) => item.hungry)).toEqual([false, true]);
  });
});

describe("D1: hunger strike", () => {
  it("a hungry dwarf produces nothing and cannot start anything new", () => {
    const striker = dwarf("d1", { assignment: "mining", status: "working", hungry: true });
    expect(expectedProduction(colony({ dwarves: [striker] })).stone).toBe(0);
    expect(isAvailable(striker)).toBe(false);
  });

  it("a hungry dwarf can be given another job, but still does not work", () => {
    const state = colony({ dwarves: [dwarf("d1", { assignment: "mining", status: "working", hungry: true })] });
    const next = assignDwarf(state, "d1", "farming");
    expect(next.dwarves[0].assignment).toBe("farming");
    expect(expectedProduction(next).food).toBe(0);
  });

  it("going without a meal writes a report that needs acknowledgement", () => {
    const next = advanceDay(colony({ resources: food(1), dwarves: [dwarf("d1"), dwarf("d2")] }));
    expect(hungryIds(next)).toEqual(["d2"]);
    expect(next.activities[0]).toMatchObject({ day: 2, tone: "warning", needsAck: true });
  });

  it("a meal ends the strike and the dwarf produces again", () => {
    const state = colony({
      resources: food(1),
      dwarves: [dwarf("d1", { assignment: "mining", status: "working", hungry: true })],
    });
    const fed = advanceDay(state);
    expect(fed.dwarves[0].hungry).toBe(false);
    expect(fed.resources).toMatchObject({ stone: 0, food: 0 }); // struck today, ate tonight
    expect(fed.activities[0]).toMatchObject({ tone: "good" });
    expect(expectedProduction(fed).stone).toBe(2);
  });

  it("a dwarf who stays hungry is not reported twice", () => {
    const state = colony({
      resources: food(1),
      dwarves: [dwarf("d1", { hungry: true }), dwarf("d2", { hungry: true })],
    });
    const next = advanceDay(state);
    expect(hungryIds(next)).toEqual(["d2"]);
    expect(next.activities.filter((item) => item.needsAck)).toHaveLength(0);
  });
});

describe("D1: starvation", () => {
  it("everyone hungry with empty stores means the colony has starved", () => {
    const next = advanceDay(colony({ resources: food(0), dwarves: [dwarf("d1"), dwarf("d2")] }));
    expect(hasStarved(next)).toBe(true);
    expect(next.activities).toHaveLength(1);
    expect(next.activities[0].needsAck).toBeUndefined();
  });

  it("one fed dwarf is enough to keep the colony alive", () => {
    const next = advanceDay(colony({ resources: food(1), dwarves: [dwarf("d1"), dwarf("d2")] }));
    expect(next.resources.food).toBe(0);
    expect(hasStarved(next)).toBe(false);
  });

  it("a farmer can still save the evening, because production comes before meals", () => {
    const next = advanceDay(colony({
      resources: food(0),
      dwarves: [dwarf("d1", { assignment: "farming", status: "working" }), dwarf("d2")],
    }));
    expect(hungryIds(next)).toEqual([]);
    expect(next.resources.food).toBe(2);
  });
});
