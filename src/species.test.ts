import { describe, expect, it } from "vitest";
import { equipTool } from "./equipment";
import { craftingProblem, startCrafting } from "./forge";
import { advanceDay, expectedProduction, hasStarved, mealsNeeded } from "./simulation";
import { hasNewcomerJoined, newcomer, speciesInfo, traits } from "./species";
import { colonyReducer, initialColony } from "./state/colonyReducer";
import type { ColonyState, Dwarf, ExpeditionResult, Job } from "./types";

const elf = (overrides: Partial<Dwarf> = {}): Dwarf => ({ ...newcomer, ...overrides });
const dwarf = (id: string, overrides: Partial<Dwarf> = {}): Dwarf => ({
  id, name: id, title: "", icon: "", species: "dwarf", assignment: null, status: "idle", hungry: false, hasTool: false, ...overrides,
});

const colony = (overrides: Partial<ColonyState> = {}): ColonyState => ({
  day: 12,
  resources: { wood: 10, stone: 10, food: 30, tools: 1, weapons: 0 },
  dwarves: [],
  activities: [],
  activityCount: 0,
  expeditions: [],
  raids: [],
  ...overrides,
});

const result: ExpeditionResult = {
  expeditionId: "exp-17", status: "completed", rewards: { stone: 8, tools: 1 }, message: "Found a crystal seam.",
};

/** Sends dwarf-3 to a destination and delivers a successful answer. */
const succeed = (state: ColonyState, expeditionId: string, destination: string, dwarfId = "dwarf-3") => {
  const away = colonyReducer(state, { type: "expeditionDeparted", expeditionId, dwarfId, destination });
  return colonyReducer(away, { type: "expeditionSucceeded", expeditionId, result });
};

describe("D6: the elf has her own production", () => {
  const working = (who: Dwarf, job: Job) => colony({ dwarves: [{ ...who, assignment: job, status: "working" }] });

  it("produces 4 wood, 1 stone and 5 food where a dwarf produces 3, 2 and 4", () => {
    expect(expectedProduction(working(elf(), "woodcutting")).wood).toBe(4);
    expect(expectedProduction(working(elf(), "mining")).stone).toBe(1);
    expect(expectedProduction(working(elf(), "farming")).food).toBe(5);

    expect(expectedProduction(working(dwarf("d1"), "woodcutting")).wood).toBe(3);
    expect(expectedProduction(working(dwarf("d1"), "mining")).stone).toBe(2);
    expect(expectedProduction(working(dwarf("d1"), "farming")).food).toBe(4);
  });

  it("gets the same +1 from a tool as everyone", () => {
    expect(expectedProduction(working(elf({ hasTool: true }), "farming")).food).toBe(6);
  });

  it("a mixed crew adds up per worker", () => {
    const state = colony({
      dwarves: [
        dwarf("d1", { assignment: "farming", status: "working" }),
        elf({ assignment: "farming", status: "working" }),
      ],
    });
    expect(expectedProduction(state).food).toBe(9);
    expect(advanceDay(state).resources.food).toBe(30 + 9 - 2);
  });

  it("the roster line names the differences", () => {
    expect(traits("elf")).toBe("Wood 4 · Stone 1 · Food 5 · forges tools only");
    expect(traits("dwarf")).toBe("Wood 3 · Stone 2 · Food 4 · forges tools and weapons");
  });
});

describe("D6: the elf has her own forge limit", () => {
  const state = colony({ dwarves: [elf(), dwarf("d1")] });

  it("forges tools", () => {
    expect(craftingProblem(state, state.dwarves[0], "tool")).toBeNull();
    const done = advanceDay(startCrafting(state, newcomer.id, "tool"));
    expect(done.resources.tools).toBe(2);
  });

  it("does not forge weapons, and the attempt changes nothing", () => {
    expect(speciesInfo.elf.canForge).toEqual(["tool"]);
    expect(craftingProblem(state, state.dwarves[0], "weapon")).toBe("Elves do not forge weapons.");
    expect(startCrafting(state, newcomer.id, "weapon")).toBe(state);
  });

  it("a dwarf still forges weapons", () => {
    expect(craftingProblem(state, state.dwarves[1], "weapon")).toBeNull();
  });
});

describe("D6: joining Stonehome", () => {
  it("the first successful expedition to the Crystal Cave brings the elf", () => {
    expect(hasNewcomerJoined(initialColony)).toBe(false);

    const joined = succeed(initialColony, "e1", "crystal-cave");
    expect(joined.dwarves).toHaveLength(4);
    expect(joined.dwarves[3]).toMatchObject({
      name: "Sylwen Mossfoot", species: "elf", status: "idle", assignment: null, hungry: false, hasTool: false,
    });
    expect(joined.activities[0]).toMatchObject({ tone: "good" });
    expect(joined.activities[0].message).toContain("joins Stonehome");
    // The normal reward is still paid.
    expect(joined.resources.stone).toBe(initialColony.resources.stone + 8);
  });

  it("she joins only once, however often the cave is visited", () => {
    const first = succeed(initialColony, "e1", "crystal-cave");
    const second = succeed(first, "e2", "crystal-cave");
    expect(second.dwarves).toHaveLength(4);
    expect(second.resources.stone).toBe(initialColony.resources.stone + 16);
  });

  it("a repeated answer for the same expedition does not add her twice", () => {
    const joined = succeed(initialColony, "e1", "crystal-cave");
    expect(colonyReducer(joined, { type: "expeditionSucceeded", expeditionId: "e1", result })).toBe(joined);
  });

  it("other destinations and failed expeditions do not bring her", () => {
    expect(succeed(initialColony, "e1", "old-mine").dwarves).toHaveLength(3);

    const away = colonyReducer(initialColony, { type: "expeditionDeparted", expeditionId: "e1", dwarfId: "dwarf-3", destination: "crystal-cave" });
    const failed = colonyReducer(away, { type: "expeditionFailed", expeditionId: "e1", reason: "Rockfall." });
    expect(failed.dwarves).toHaveLength(3);
  });

  it("a new colony after a restart starts without her", () => {
    const joined = succeed(initialColony, "e1", "crystal-cave");
    expect(colonyReducer(joined, { type: "colonyRestarted" }).dwarves).toHaveLength(3);
  });
});

describe("D6: the elf lives by the same rules", () => {
  const joined = succeed(initialColony, "e1", "crystal-cave");

  it("eats like everyone: four meals are needed", () => {
    expect(mealsNeeded(joined)).toBe(4);
    expect(advanceDay(joined).resources.food).toBe(joined.resources.food - 4);
  });

  it("goes hungry, strikes and is reported when the food is short", () => {
    const short = advanceDay({ ...joined, resources: { ...joined.resources, food: 3 } });
    expect(short.dwarves[3].hungry).toBe(true); // last in the roster
    expect(short.activities[0]).toMatchObject({ needsAck: true });
    expect(short.activities[0].message).toContain("Sylwen Mossfoot");

    const striking = { ...short.dwarves[3], assignment: "farming" as const, status: "working" as const };
    expect(expectedProduction(colony({ dwarves: [striking] })).food).toBe(0);
  });

  it("counts for the lost colony: all four must be hungry", () => {
    const starved = advanceDay({ ...joined, resources: { ...joined.resources, food: 0 } });
    expect(starved.dwarves.every((item) => item.hungry)).toBe(true);
    expect(hasStarved(starved)).toBe(true);
  });

  it("can carry a tool and can travel; the tool stays behind", () => {
    const equipped = equipTool(joined, newcomer.id);
    expect(equipped.dwarves[3].hasTool).toBe(true);

    const away = colonyReducer(equipped, { type: "expeditionDeparted", expeditionId: "e2", dwarfId: newcomer.id, destination: "crystal-cave" });
    expect(away.dwarves[3]).toMatchObject({ status: "expedition", hasTool: false });

    const back = colonyReducer(away, { type: "expeditionSucceeded", expeditionId: "e2", result });
    expect(back.dwarves).toHaveLength(4);
    expect(back.dwarves[3].status).toBe("idle");
  });
});
