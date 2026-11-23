// tests for tools (d2): equip, return, bonus, tool stays home on expedition, weapon recipe
// test tools: describe = group of tests, it = one test, expect = check a value
import { describe, expect, it } from "vitest";
// functions under test
import { equipTool, equippedTools, returnTool } from "./equipment";
// recipe table
import { recipes } from "./forge";
// day and production
import { advanceDay, expectedProduction } from "./simulation";
// reducer and start colony
import { colonyReducer, initialColony } from "./state/colonyReducer";
// types only
import type { ColonyState, Dwarf, Job } from "./types";

// helper: builds a test resident with defaults, overrides = only fields that matter for the test
const dwarf = (id: string, overrides: Partial<Dwarf> = {}): Dwarf => ({
  // idle dwarf, not hungry, no tool, then overrides on top
  id, name: id, title: "", icon: "", species: "dwarf", assignment: null, status: "idle", hungry: false, hasTool: false, ...overrides,
});

// helper: builds a small test colony with one free tool
const colony = (overrides: Partial<ColonyState> = {}): ColonyState => ({
  // day 1
  day: 1,
  // 9 food, 1 free tool
  resources: { wood: 0, stone: 0, food: 9, tools: 1, weapons: 0 },
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

// helper: free tools plus equipped tools, must never change by equip or return (invariant = rule that always holds)
const allTools = (state: ColonyState) => state.resources.tools + equippedTools(state);

// group: equipping
describe("D2: equipping tools", () => {
  // test: equip moves one tool from stores to resident
  it("moves one tool from the stores to the dwarf", () => {
    // one resident, equip
    const next = equipTool(colony({ dwarves: [dwarf("d1")] }), "d1");
    // resident has it
    expect(next.dwarves[0].hasTool).toBe(true);
    // stores have none
    expect(next.resources.tools).toBe(0);
    // total still 1
    expect(allTools(next)).toBe(1);
  });

  // test: return puts it back
  it("returning puts the tool back into the stores", () => {
    // equipped state
    const equipped = equipTool(colony({ dwarves: [dwarf("d1")] }), "d1");
    // return
    const next = returnTool(equipped, "d1");
    // resident has none
    expect(next.dwarves[0].hasTool).toBe(false);
    // stores have 1 again
    expect(next.resources.tools).toBe(1);
  });

  // test: one tool cannot be held by two residents
  it("one tool cannot be equipped by two dwarves", () => {
    // d1 takes the only tool
    const first = equipTool(colony({ dwarves: [dwarf("d1"), dwarf("d2")] }), "d1");
    // d2 gets nothing, same state back
    expect(equipTool(first, "d2")).toBe(first);
  });

  // test: one resident cannot carry two tools
  it("one dwarf cannot carry two tools", () => {
    // 2 free tools
    const state = colony({ resources: { wood: 0, stone: 0, food: 9, tools: 2, weapons: 0 }, dwarves: [dwarf("d1")] });
    // first equip works
    const first = equipTool(state, "d1");
    // second is ignored
    expect(equipTool(first, "d1")).toBe(first);
    // one tool still free
    expect(first.resources.tools).toBe(1);
  });

  // test: without tool nothing to return
  it("a dwarf without a tool cannot return one", () => {
    // resident without tool
    const state = colony({ dwarves: [dwarf("d1")] });
    // same state back
    expect(returnTool(state, "d1")).toBe(state);
  });

  // test: resident on expedition can neither get nor return a tool
  it("a dwarf on an expedition can neither get nor return a tool", () => {
    // away without tool
    const away = colony({ dwarves: [dwarf("d1", { status: "expedition" })] });
    // equip ignored
    expect(equipTool(away, "d1")).toBe(away);
    // away with tool
    const awayWithTool = colony({ dwarves: [dwarf("d1", { status: "expedition", hasTool: true })] });
    // return ignored
    expect(returnTool(awayWithTool, "d1")).toBe(awayWithTool);
  });

  // test: resident on strike can still hand tool back (in the hold)
  it("a dwarf on strike can hand the tool back", () => {
    // hungry resident with tool, stores empty
    const state = colony({ resources: { wood: 0, stone: 0, food: 9, tools: 0, weapons: 0 }, dwarves: [dwarf("d1", { hungry: true, hasTool: true })] });
    // tool is back in stores
    expect(returnTool(state, "d1").resources.tools).toBe(1);
  });

  // test: total number of tools stays the same through any sequence
  it("the total number of tools stays the same through any sequence", () => {
    // 2 tools, 3 residents
    let state = colony({ resources: { wood: 0, stone: 0, food: 9, tools: 2, weapons: 0 }, dwarves: [dwarf("d1"), dwarf("d2"), dwarf("d3")] });
    // steps: e = equip, r = return, number = resident (also invalid ones like r2 twice)
    for (const step of ["e1", "e2", "e3", "r1", "e3", "r2", "r2", "e1"]) {
      // run step
      state = step[0] === "e" ? equipTool(state, `d${step[1]}`) : returnTool(state, `d${step[1]}`);
      // total always 2
      expect(allTools(state)).toBe(2);
      // stores never negative
      expect(state.resources.tools).toBeGreaterThanOrEqual(0);
    }
  });
});

// group: bonus
describe("D2: tool bonus", () => {
  // helper: colony with one working resident who carries a tool
  const worker = (job: Job, overrides: Partial<Dwarf> = {}) =>
    // job from parameter, overrides on top
    colony({ dwarves: [dwarf("d1", { assignment: job, status: "working", hasTool: true, ...overrides })] });

  // test: +1 of the job's resource per day
  it("adds one unit of the job's resource per day", () => {
    // wood 3 + 1
    expect(expectedProduction(worker("woodcutting")).wood).toBe(4);
    // stone 2 + 1
    expect(expectedProduction(worker("mining")).stone).toBe(3);
    // food 4 + 1
    expect(expectedProduction(worker("farming")).food).toBe(5);
  });

  // test: daily simulation uses the bonus too
  it("is applied by the daily simulation", () => {
    // 4 wood after one day
    expect(advanceDay(worker("woodcutting")).resources.wood).toBe(4);
  });

  // test: no bonus while carrier does not work
  it("gives nothing while the carrier is not working", () => {
    // hungry = nothing
    expect(expectedProduction(worker("mining", { hungry: true })).stone).toBe(0);
    // away = nothing
    expect(expectedProduction(worker("mining", { status: "expedition" })).stone).toBe(0);
    // no job = nothing at all
    expect(expectedProduction(colony({ dwarves: [dwarf("d1", { hasTool: true })] }))).toEqual({ wood: 0, stone: 0, food: 0, tools: 0, weapons: 0 });
  });
});

// group: tools and expeditions
describe("D2: tools and expeditions", () => {
  // test: equipped tool stays in stores when carrier leaves (team decision)
  it("an equipped tool stays in the stores when its carrier departs", () => {
    // bromli takes the tool
    const equipped = colonyReducer(initialColony, { type: "toolEquipped", dwarfId: "dwarf-1" });
    // stores empty
    expect(equipped.resources.tools).toBe(0);
        // bromli leaves
        const away = colonyReducer(equipped, { type: "expeditionDeparted", expeditionId: "e1", dwarfId: "dwarf-1", destination: "old-mine" });
    // away and without tool
    expect(away.dwarves[0]).toMatchObject({ status: "expedition", hasTool: false });
    // tool is back in stores
    expect(away.resources.tools).toBe(1);

    // free tool can now be given to someone else
    expect(colonyReducer(away, { type: "toolEquipped", dwarfId: "dwarf-2" }).dwarves[1].hasTool).toBe(true);
  });
});

// group: weapon recipe
describe("D2: weapon recipe", () => {
  // test: costs
  it("costs 2 wood and 4 stone, the tool recipe 3 wood and 2 stone", () => {
    // weapon: 2 wood, 4 stone
    expect(recipes.weapon.cost).toEqual({ wood: 2, stone: 4 });
    // tool: 3 wood, 2 stone
    expect(recipes.tool.cost).toEqual({ wood: 3, stone: 2 });
  });

  // test: weapons are a colony resource and a day does not change them
  it("weapons are a colony resource and survive the daily simulation unchanged", () => {
    // 3 weapons
    const state = colony({ resources: { wood: 0, stone: 0, food: 9, tools: 0, weapons: 3 }, dwarves: [dwarf("d1")] });
    // still 3
    expect(advanceDay(state).resources.weapons).toBe(3);
  });
});
