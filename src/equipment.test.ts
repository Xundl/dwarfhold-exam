import { describe, expect, it } from "vitest";
import { equipTool, equippedTools, returnTool } from "./equipment";
import { craft, recipes } from "./forge";
import { advanceDay, expectedProduction } from "./simulation";
import { colonyReducer, initialColony } from "./state/colonyReducer";
import type { ColonyState, Dwarf, Job } from "./types";

const dwarf = (id: string, overrides: Partial<Dwarf> = {}): Dwarf => ({
  id, name: id, title: "", icon: "", assignment: null, status: "idle", hungry: false, hasTool: false, ...overrides,
});

const colony = (overrides: Partial<ColonyState> = {}): ColonyState => ({
  day: 1,
  resources: { wood: 0, stone: 0, food: 9, tools: 1, weapons: 0 },
  dwarves: [],
  activities: [],
  activityCount: 0,
  ...overrides,
});

/** Free tools in the stores plus tools carried by dwarves. Must never change by equipping or returning. */
const allTools = (state: ColonyState) => state.resources.tools + equippedTools(state);

describe("D2: equipping tools", () => {
  it("moves one tool from the stores to the dwarf", () => {
    const next = equipTool(colony({ dwarves: [dwarf("d1")] }), "d1");
    expect(next.dwarves[0].hasTool).toBe(true);
    expect(next.resources.tools).toBe(0);
    expect(allTools(next)).toBe(1);
  });

  it("returning puts the tool back into the stores", () => {
    const equipped = equipTool(colony({ dwarves: [dwarf("d1")] }), "d1");
    const next = returnTool(equipped, "d1");
    expect(next.dwarves[0].hasTool).toBe(false);
    expect(next.resources.tools).toBe(1);
  });

  it("one tool cannot be equipped by two dwarves", () => {
    const first = equipTool(colony({ dwarves: [dwarf("d1"), dwarf("d2")] }), "d1");
    expect(equipTool(first, "d2")).toBe(first);
  });

  it("one dwarf cannot carry two tools", () => {
    const state = colony({ resources: { wood: 0, stone: 0, food: 9, tools: 2, weapons: 0 }, dwarves: [dwarf("d1")] });
    const first = equipTool(state, "d1");
    expect(equipTool(first, "d1")).toBe(first);
    expect(first.resources.tools).toBe(1);
  });

  it("a dwarf without a tool cannot return one", () => {
    const state = colony({ dwarves: [dwarf("d1")] });
    expect(returnTool(state, "d1")).toBe(state);
  });

  it("a dwarf on an expedition can neither get nor return a tool", () => {
    const away = colony({ dwarves: [dwarf("d1", { status: "expedition" })] });
    expect(equipTool(away, "d1")).toBe(away);
    const awayWithTool = colony({ dwarves: [dwarf("d1", { status: "expedition", hasTool: true })] });
    expect(returnTool(awayWithTool, "d1")).toBe(awayWithTool);
  });

  it("a dwarf on strike can hand the tool back", () => {
    const state = colony({ resources: { wood: 0, stone: 0, food: 9, tools: 0, weapons: 0 }, dwarves: [dwarf("d1", { hungry: true, hasTool: true })] });
    expect(returnTool(state, "d1").resources.tools).toBe(1);
  });

  it("the total number of tools stays the same through any sequence", () => {
    let state = colony({ resources: { wood: 0, stone: 0, food: 9, tools: 2, weapons: 0 }, dwarves: [dwarf("d1"), dwarf("d2"), dwarf("d3")] });
    for (const step of ["e1", "e2", "e3", "r1", "e3", "r2", "r2", "e1"]) {
      state = step[0] === "e" ? equipTool(state, `d${step[1]}`) : returnTool(state, `d${step[1]}`);
      expect(allTools(state)).toBe(2);
      expect(state.resources.tools).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("D2: tool bonus", () => {
  const worker = (job: Job, overrides: Partial<Dwarf> = {}) =>
    colony({ dwarves: [dwarf("d1", { assignment: job, status: "working", hasTool: true, ...overrides })] });

  it("adds one unit of the job's resource per day", () => {
    expect(expectedProduction(worker("woodcutting")).wood).toBe(4);
    expect(expectedProduction(worker("mining")).stone).toBe(3);
    expect(expectedProduction(worker("farming")).food).toBe(5);
  });

  it("is applied by the daily simulation", () => {
    expect(advanceDay(worker("woodcutting")).resources.wood).toBe(4);
  });

  it("gives nothing while the carrier is not working", () => {
    expect(expectedProduction(worker("mining", { hungry: true })).stone).toBe(0);
    expect(expectedProduction(worker("mining", { status: "expedition" })).stone).toBe(0);
    expect(expectedProduction(colony({ dwarves: [dwarf("d1", { hasTool: true })] }))).toEqual({ wood: 0, stone: 0, food: 0, tools: 0, weapons: 0 });
  });
});

describe("D2: tools and expeditions", () => {
  it("an equipped tool stays in the stores when its carrier departs", () => {
    const equipped = colonyReducer(initialColony, { type: "toolEquipped", dwarfId: "dwarf-1" });
    expect(equipped.resources.tools).toBe(0);

    const away = colonyReducer(equipped, { type: "expeditionDeparted", dwarfId: "dwarf-1", destination: "old-mine" });
    expect(away.dwarves[0]).toMatchObject({ status: "expedition", hasTool: false });
    expect(away.resources.tools).toBe(1);

    // The free tool can now be given to someone else.
    expect(colonyReducer(away, { type: "toolEquipped", dwarfId: "dwarf-2" }).dwarves[1].hasTool).toBe(true);
  });
});

describe("D2: weapon recipe", () => {
  it("costs 2 wood and 4 stone and adds one weapon to the colony", () => {
    expect(recipes.weapon.cost).toEqual({ wood: 2, stone: 4 });
    const next = craft(colony({ resources: { wood: 5, stone: 5, food: 9, tools: 1, weapons: 0 } }), "weapon");
    expect(next.resources).toEqual({ wood: 3, stone: 1, food: 9, tools: 1, weapons: 1 });
  });

  it("the tool recipe still costs 3 wood and 2 stone", () => {
    const next = craft(colony({ resources: { wood: 5, stone: 5, food: 9, tools: 1, weapons: 0 } }), "tool");
    expect(next.resources).toEqual({ wood: 2, stone: 3, food: 9, tools: 2, weapons: 0 });
  });

  it("without enough materials nothing is taken and nothing is made", () => {
    const poor = colony({ resources: { wood: 5, stone: 3, food: 9, tools: 1, weapons: 0 } });
    expect(craft(poor, "weapon").resources).toEqual(poor.resources);
  });

  it("weapons survive the daily simulation unchanged", () => {
    const state = colony({ resources: { wood: 0, stone: 0, food: 9, tools: 0, weapons: 3 }, dwarves: [dwarf("d1")] });
    expect(advanceDay(state).resources.weapons).toBe(3);
  });
});
