// tests for the elf (d6): own production, forge limit, joining once, same rules as everyone
// test tools: describe = group of tests, it = one test, expect = check a value
import { describe, expect, it } from "vitest";
// equip a tool
import { equipTool } from "./equipment";
// forge rule and reason text
import { craftingProblem, startCrafting } from "./forge";
// day, production, game over, meals
import { advanceDay, expectedProduction, hasStarved, mealsNeeded } from "./simulation";
// elf data, species table, traits text
import { hasNewcomerJoined, newcomer, speciesInfo, traits } from "./species";
// reducer and start colony
import { colonyReducer, initialColony } from "./state/colonyReducer";
// types only
import type { ColonyState, Dwarf, ExpeditionResult, Job } from "./types";

// helper: the elf, overrides = only fields that matter for the test
const elf = (overrides: Partial<Dwarf> = {}): Dwarf => ({ ...newcomer, ...overrides });
// helper: a test dwarf with defaults
const dwarf = (id: string, overrides: Partial<Dwarf> = {}): Dwarf => ({
  // idle, not hungry, no tool, then overrides on top
  id, name: id, title: "", icon: "", species: "dwarf", assignment: null, status: "idle", hungry: false, hasTool: false, ...overrides,
});

// helper: small test colony
const colony = (overrides: Partial<ColonyState> = {}): ColonyState => ({
  // day 12
  day: 12,
  // enough material, plenty of food, one free tool
  resources: { wood: 10, stone: 10, food: 30, tools: 1, weapons: 0 },
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

// a successful answer of the server
const result: ExpeditionResult = {
  // 8 stone and 1 tool as reward
  expeditionId: "exp-17", status: "completed", rewards: { stone: 8, tools: 1 }, message: "Found a crystal seam.",
};

// helper: sends dwarf-3 (dori) to a destination and delivers a successful answer
const succeed = (state: ColonyState, expeditionId: string, destination: string, dwarfId = "dwarf-3") => {
  // departure
  const away = colonyReducer(state, { type: "expeditionDeparted", expeditionId, dwarfId, destination });
  // success
  return colonyReducer(away, { type: "expeditionSucceeded", expeditionId, result });
};

// group: own production
describe("D6: the elf has her own production", () => {
  // helper: colony with one resident working in a job
  const working = (who: Dwarf, job: Job) => colony({ dwarves: [{ ...who, assignment: job, status: "working" }] });

  // test: elf 4 / 1 / 5, dwarf 3 / 2 / 4
  it("produces 4 wood, 1 stone and 5 food where a dwarf produces 3, 2 and 4", () => {
    // elf wood 4
    expect(expectedProduction(working(elf(), "woodcutting")).wood).toBe(4);
    // elf stone 1
    expect(expectedProduction(working(elf(), "mining")).stone).toBe(1);
    // elf food 5
    expect(expectedProduction(working(elf(), "farming")).food).toBe(5);

    // dwarf wood 3
    expect(expectedProduction(working(dwarf("d1"), "woodcutting")).wood).toBe(3);
    // dwarf stone 2
    expect(expectedProduction(working(dwarf("d1"), "mining")).stone).toBe(2);
    // dwarf food 4
    expect(expectedProduction(working(dwarf("d1"), "farming")).food).toBe(4);
  });

  // test: tool gives elf the same +1
  it("gets the same +1 from a tool as everyone", () => {
    // 5 + 1
    expect(expectedProduction(working(elf({ hasTool: true }), "farming")).food).toBe(6);
  });

  // test: mixed crew adds up per worker
  it("a mixed crew adds up per worker", () => {
    // one dwarf and one elf, both farming
    const state = colony({
      // residents
      dwarves: [
        // dwarf farmer (4)
        dwarf("d1", { assignment: "farming", status: "working" }),
        // elf farmer (5)
        elf({ assignment: "farming", status: "working" }),
      ],
    });
    // 4 + 5 = 9
    expect(expectedProduction(state).food).toBe(9);
    // after one day: 30 + 9 produced - 2 meals
    expect(advanceDay(state).resources.food).toBe(30 + 9 - 2);
  });

  // test: roster line names the differences (d6: informed decision)
  it("the roster line names the differences", () => {
    // text for elf
    expect(traits("elf")).toBe("Wood 4 · Stone 1 · Food 5 · forges tools only");
    // text for dwarf
    expect(traits("dwarf")).toBe("Wood 3 · Stone 2 · Food 4 · forges tools and weapons");
  });
});

// group: own forge limit
describe("D6: the elf has her own forge limit", () => {
  // elf first, dwarf second
  const state = colony({ dwarves: [elf(), dwarf("d1")] });

  // test: elf forges tools
  it("forges tools", () => {
    // no problem
    expect(craftingProblem(state, state.dwarves[0], "tool")).toBeNull();
    // start a tool, one day
    const done = advanceDay(startCrafting(state, newcomer.id, "tool"));
    // 1 free tool + 1 new
    expect(done.resources.tools).toBe(2);
  });

  // test: elf does not forge weapons, attempt changes nothing
  it("does not forge weapons, and the attempt changes nothing", () => {
    // table says tools only
    expect(speciesInfo.elf.canForge).toEqual(["tool"]);
    // reason for the screen
    expect(craftingProblem(state, state.dwarves[0], "weapon")).toBe("Elves do not forge weapons.");
    // same state back
    expect(startCrafting(state, newcomer.id, "weapon")).toBe(state);
  });

  // test: dwarf still forges weapons
  it("a dwarf still forges weapons", () => {
    // no problem
    expect(craftingProblem(state, state.dwarves[1], "weapon")).toBeNull();
  });
});

// group: joining
describe("D6: joining Stonehome", () => {
  // test: first successful trip to crystal cave brings the elf
  it("the first successful expedition to the Crystal Cave brings the elf", () => {
    // not here at start
    expect(hasNewcomerJoined(initialColony)).toBe(false);

    // successful trip
    const joined = succeed(initialColony, "e1", "crystal-cave");
    // four residents now
    expect(joined.dwarves).toHaveLength(4);
    // last one is the elf
    expect(joined.dwarves[3]).toMatchObject({
      // idle, no job, fed, no tool
      name: "Sylwen Mossfoot", species: "elf", status: "idle", assignment: null, hungry: false, hasTool: false,
    });
    // green entry
    expect(joined.activities[0]).toMatchObject({ tone: "good" });
    // text says she joins
    expect(joined.activities[0].message).toContain("joins Stonehome");
    // normal reward is still paid
    expect(joined.resources.stone).toBe(initialColony.resources.stone + 8);
  });

  // test: she joins only once, however often the cave is visited
  it("she joins only once, however often the cave is visited", () => {
    // first trip
    const first = succeed(initialColony, "e1", "crystal-cave");
    // second trip
    const second = succeed(first, "e2", "crystal-cave");
    // still four residents
    expect(second.dwarves).toHaveLength(4);
    // but both rewards were paid (8 + 8 stone)
    expect(second.resources.stone).toBe(initialColony.resources.stone + 16);
  });

  // test: repeated answer for same expedition does not add her twice
  it("a repeated answer for the same expedition does not add her twice", () => {
    // she joined
    const joined = succeed(initialColony, "e1", "crystal-cave");
    // same answer again = same state back
    expect(colonyReducer(joined, { type: "expeditionSucceeded", expeditionId: "e1", result })).toBe(joined);
  });

  // test: other destinations and failed expeditions do not bring her
  it("other destinations and failed expeditions do not bring her", () => {
    // old mine: still three
    expect(succeed(initialColony, "e1", "old-mine").dwarves).toHaveLength(3);

    // leave for crystal cave
    const away = colonyReducer(initialColony, { type: "expeditionDeparted", expeditionId: "e1", dwarfId: "dwarf-3", destination: "crystal-cave" });
    // expedition fails
    const failed = colonyReducer(away, { type: "expeditionFailed", expeditionId: "e1", reason: "Rockfall." });
    // still three
    expect(failed.dwarves).toHaveLength(3);
  });

  // test: new colony after restart starts without her
  it("a new colony after a restart starts without her", () => {
    // she joined
    const joined = succeed(initialColony, "e1", "crystal-cave");
    // restart: three residents
    expect(colonyReducer(joined, { type: "colonyRestarted" }).dwarves).toHaveLength(3);
  });
});

// group: same rules as everyone
describe("D6: the elf lives by the same rules", () => {
  // colony with the elf (4 residents), shared by tests in this group
  const joined = succeed(initialColony, "e1", "crystal-cave");

  // test: she eats too
  it("eats like everyone: four meals are needed", () => {
    // four meals
    expect(mealsNeeded(joined)).toBe(4);
    // food drops by 4 per day
    expect(advanceDay(joined).resources.food).toBe(joined.resources.food - 4);
  });

  // test: she goes hungry, strikes and is reported when food is short
  it("goes hungry, strikes and is reported when the food is short", () => {
    // 3 food for 4
    const short = advanceDay({ ...joined, resources: { ...joined.resources, food: 3 } });
    // elf is last in roster, so she gets no meal
    expect(short.dwarves[3].hungry).toBe(true);
    // report must be acknowledged
    expect(short.activities[0]).toMatchObject({ needsAck: true });
    // with her name
    expect(short.activities[0].message).toContain("Sylwen Mossfoot");

    // hungry elf as farmer
    const striking = { ...short.dwarves[3], assignment: "farming" as const, status: "working" as const };
    // produces nothing (strike)
    expect(expectedProduction(colony({ dwarves: [striking] })).food).toBe(0);
  });

  // test: she counts for game over
  it("counts for the lost colony: all four must be hungry", () => {
    // no food
    const starved = advanceDay({ ...joined, resources: { ...joined.resources, food: 0 } });
    // all four hungry
    expect(starved.dwarves.every((item) => item.hungry)).toBe(true);
    // game over
    expect(hasStarved(starved)).toBe(true);
  });

  // test: she can carry a tool and travel, tool stays behind
  it("can carry a tool and can travel; the tool stays behind", () => {
    // give her the tool
    const equipped = equipTool(joined, newcomer.id);
    // she has it
    expect(equipped.dwarves[3].hasTool).toBe(true);

    // she leaves
    const away = colonyReducer(equipped, { type: "expeditionDeparted", expeditionId: "e2", dwarfId: newcomer.id, destination: "crystal-cave" });
    // away, tool back in stores
    expect(away.dwarves[3]).toMatchObject({ status: "expedition", hasTool: false });

    // she comes back
    const back = colonyReducer(away, { type: "expeditionSucceeded", expeditionId: "e2", result });
    // still four residents (no second elf)
    expect(back.dwarves).toHaveLength(4);
    // home, idle
    expect(back.dwarves[3].status).toBe("idle");
  });
});
