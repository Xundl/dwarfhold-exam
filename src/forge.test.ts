import { describe, expect, it } from "vitest";
import { equipTool } from "./equipment";
import { craftingProblem, craftingSummary, recipes, startCrafting } from "./forge";
import { advanceDay, assignDwarf, expectedProduction, isAvailable } from "./simulation";
import { colonyReducer, initialColony } from "./state/colonyReducer";
import type { ColonyState, Dwarf } from "./types";

const dwarf = (id: string, overrides: Partial<Dwarf> = {}): Dwarf => ({
  id, name: id, title: "", icon: "", assignment: null, status: "idle", hungry: false, hasTool: false, ...overrides,
});

const colony = (overrides: Partial<ColonyState> = {}): ColonyState => ({
  day: 12,
  resources: { wood: 10, stone: 10, food: 30, tools: 0, weapons: 0 },
  dwarves: [dwarf("d1", { assignment: "mining", status: "working" }), dwarf("d2")],
  activities: [],
  activityCount: 0,
    expeditions: [],
  ...overrides,
});

const days = (state: ColonyState, count: number) => {
  let next = state;
  for (let i = 0; i < count; i += 1) next = advanceDay(next);
  return next;
};

describe("D3: starting a forge order", () => {
  it("takes the materials at once and sends the dwarf to the forge, but makes nothing yet", () => {
    const next = startCrafting(colony(), "d1", "weapon");
    expect(next.resources).toMatchObject({ wood: 8, stone: 6, weapons: 0 });
    expect(next.dwarves[0]).toMatchObject({ status: "crafting", crafting: { recipe: "weapon", daysLeft: 2 } });
    expect(next.activities[0].message).toContain("Ready on day 14");
  });

  it("the smith does not do the job meanwhile and cannot start anything else", () => {
    const next = startCrafting(colony(), "d1", "tool");
    expect(expectedProduction(next).stone).toBe(0);
    expect(isAvailable(next.dwarves[0])).toBe(false);
    expect(assignDwarf(next, "d1", "farming")).toBe(next);
    expect(colonyReducer(next, { type: "expeditionDeparted", expeditionId: "e1", dwarfId: "d1", destination: "old-mine" })).toBe(next);  });
});

describe("D3: forging takes time", () => {
  it("a tool is ready after one day and the smith returns to the job", () => {
    const started = startCrafting(colony(), "d1", "tool");
    const done = advanceDay(started);
    expect(done.day).toBe(13);
    expect(done.resources.tools).toBe(1);
    expect(done.dwarves[0].status).toBe("working");
    expect(done.dwarves[0].crafting).toBeUndefined();
    expect(done.activities[0]).toMatchObject({ day: 13, tone: "good" });
    expect(advanceDay(done).resources.stone).toBe(started.resources.stone + 2);
  });

  it("a weapon is not ready after one day, but after two", () => {
    const started = startCrafting(colony(), "d2", "weapon");
    const half = advanceDay(started);
    expect(half.resources.weapons).toBe(0);
    expect(half.dwarves[1]).toMatchObject({ status: "crafting", crafting: { daysLeft: 1 } });
    expect(craftingSummary(half, half.dwarves[1])).toBe("Forging a weapon · ready on day 14");

    const done = advanceDay(half);
    expect(done.day).toBe(14);
    expect(done.resources.weapons).toBe(1);
    expect(done.dwarves[1].status).toBe("idle");
  });

  it("exactly one item comes out of one order", () => {
    const done = days(startCrafting(colony(), "d1", "tool"), 5);
    expect(done.resources.tools).toBe(1);
    expect(done.resources.wood).toBe(10 - recipes.tool.cost.wood);
  });
});

describe("D3: invalid attempts change nothing", () => {
  it("not enough materials", () => {
    const poor = colony({ resources: { wood: 1, stone: 10, food: 30, tools: 0, weapons: 0 } });
    expect(startCrafting(poor, "d1", "weapon")).toBe(poor);
    expect(craftingProblem(poor, poor.dwarves[0], "weapon")).toBe("Needs 2 timber and 4 stone.");
  });

  it("a dwarf who is away, on strike, unknown or already forging", () => {
    const away = colony({ dwarves: [dwarf("d1", { status: "expedition" })] });
    expect(startCrafting(away, "d1", "tool")).toBe(away);

    const striking = colony({ dwarves: [dwarf("d1", { hungry: true })] });
    expect(startCrafting(striking, "d1", "tool")).toBe(striking);
    expect(craftingProblem(striking, striking.dwarves[0], "tool")).toBe("d1 is on strike.");

    const state = colony();
    expect(startCrafting(state, "nobody", "tool")).toBe(state);

    const busy = startCrafting(state, "d1", "tool");
    expect(startCrafting(busy, "d1", "weapon")).toBe(busy);
  });

  it("a double click starts one order and takes the materials once", () => {
    const once = startCrafting(colony(), "d1", "tool");
    const twice = startCrafting(once, "d1", "tool");
    expect(twice).toBe(once);
    expect(twice.resources.wood).toBe(7);
  });
});

describe("D3: several smiths", () => {
  it("two dwarves can forge at the same time", () => {
    const both = startCrafting(startCrafting(colony(), "d1", "weapon"), "d2", "tool");
    expect(both.resources).toMatchObject({ wood: 5, stone: 4 });
    const done = days(both, 2);
    expect(done.resources).toMatchObject({ tools: 1, weapons: 1 });
  });

  it("the second order is refused when the first one used up the materials", () => {
    const tight = colony({ resources: { wood: 4, stone: 4, food: 30, tools: 0, weapons: 0 } });
    const first = startCrafting(tight, "d1", "weapon");
    expect(startCrafting(first, "d2", "tool")).toBe(first);
  });
});

describe("D3: a hungry smith pauses", () => {
  // Exactly one meal per evening for two dwarves. d2 starts hungry and is served first,
  // so the smith d1 goes without a meal on the first evening and eats on the second.
  const oneMeal = (state: ColonyState): ColonyState => ({ ...state, resources: { ...state.resources, food: 1 } });
  const start = colony({ dwarves: [dwarf("d1"), dwarf("d2", { hungry: true })] });

  it("no day is counted while hungry, and nothing is lost", () => {
    const started = startCrafting(start, "d1", "weapon");

    const day13 = advanceDay(oneMeal(started)); // worked on day 12, then got no meal
    expect(day13.dwarves[0]).toMatchObject({ hungry: true, crafting: { daysLeft: 1 } });
    expect(craftingSummary(day13, day13.dwarves[0])).toBe("Forging a weapon · paused: hungry");

    const day14 = advanceDay(oneMeal(day13)); // hungry all of day 13: no progress, but eats tonight
    expect(day14.dwarves[0]).toMatchObject({ hungry: false, status: "crafting", crafting: { daysLeft: 1 } });
    expect(day14.resources.weapons).toBe(0);

    const day15 = advanceDay({ ...day14, resources: { ...day14.resources, food: 5 } });
    expect(day15.day).toBe(15); // one day later than the "ready on day 14" from the start
    expect(day15.resources.weapons).toBe(1);
    expect(day15.resources.wood).toBe(8); // the materials were taken exactly once
  });
});

describe("D3: tools and the forge", () => {
  it("a smith keeps an equipped tool, without bonus while forging", () => {
    const equipped = equipTool(colony({ resources: { wood: 10, stone: 10, food: 30, tools: 1, weapons: 0 } }), "d1");
    const forging = startCrafting(equipped, "d1", "tool");
    expect(forging.dwarves[0].hasTool).toBe(true);
    expect(expectedProduction(forging).stone).toBe(0);
    expect(expectedProduction(advanceDay(forging)).stone).toBe(3);
  });
});

describe("D3: through the reducer", () => {
  it("craftingStarted starts an order in the real colony", () => {
    const next = colonyReducer(initialColony, { type: "craftingStarted", dwarfId: "dwarf-3", recipe: "tool" });
    expect(next.dwarves[2].status).toBe("crafting");
    expect(colonyReducer(next, { type: "dayPassed" }).resources.tools).toBe(initialColony.resources.tools + 1);
  });
});
