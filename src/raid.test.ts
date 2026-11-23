import { describe, expect, it } from "vitest";
import { lootOf, openRaid, RAID_DESTINATION, WEAPONS_TO_DEFEND } from "./raid";
import { colonyReducer, initialColony } from "./state/colonyReducer";
import type { ColonyState, ExpeditionResult } from "./types";

// What the server answers for the goblin warren.
const result: ExpeditionResult = {
  expeditionId: "exp-17", status: "completed", rewards: { wood: 10, food: 6 }, message: "Timber and stolen rations.",
};

const withWeapons = (weapons: number): ColonyState => ({
  ...initialColony,
  resources: { ...initialColony.resources, weapons },
});

const depart = (state: ColonyState, expeditionId: string, destination = RAID_DESTINATION, dwarfId = "dwarf-3") =>
  colonyReducer(state, { type: "expeditionDeparted", expeditionId, dwarfId, destination });
const succeed = (state: ColonyState, expeditionId: string) =>
  colonyReducer(state, { type: "expeditionSucceeded", expeditionId, result });
/** Sends Dori to a destination and delivers a successful answer. */
const trip = (state: ColonyState, expeditionId: string, destination = RAID_DESTINATION) =>
  succeed(depart(state, expeditionId, destination), expeditionId);

// initialColony: 14 wood, 9 stone, 18 food. With the reward: 24 wood, 9 stone, 24 food.

describe("D7: loot is deterministic", () => {
  it("takes half of timber, stone and rations, rounded down", () => {
    expect(lootOf({ wood: 24, stone: 9, food: 21, tools: 3, weapons: 1 })).toEqual({ wood: 12, stone: 4, food: 10 });
    expect(lootOf({ wood: 1, stone: 0, food: 3, tools: 0, weapons: 0 })).toEqual({ wood: 0, stone: 0, food: 1 });
  });

  it("the same colony always gets the same outcome", () => {
    expect(trip(initialColony, "e1")).toEqual(trip(initialColony, "e1"));
  });
});

describe("D7: an undefended colony is looted", () => {
  const looted = trip(withWeapons(1), "e1");

  it("loses half of the stores, counted after the reward came in", () => {
    expect(looted.resources).toMatchObject({ wood: 12, stone: 5, food: 12 });
  });

  it("keeps its tools and weapons", () => {
    expect(looted.resources.tools).toBe(initialColony.resources.tools);
    expect(looted.resources.weapons).toBe(1);
  });

  it("files a report with the exact losses and writes the chronicle", () => {
    expect(openRaid(looted)).toEqual({
      scout: "Dori Ashmantle", defended: false, weaponsBefore: 1, weaponsLost: 0,
      loot: { wood: 12, stone: 4, food: 12 },
    });
    expect(looted.activities[0]).toMatchObject({ tone: "warning" });
    expect(looted.activities[0].message).toContain("-12 timber, -4 stone, -12 rations");
  });

  it("the scout is home again", () => {
    expect(looted.dwarves[2].status).toBe("idle");
    expect(looted.expeditions).toHaveLength(0);
  });
});

describe("D7: enough weapons defend the colony", () => {
  it("at the threshold nothing is stolen and one weapon breaks", () => {
    const defended = trip(withWeapons(WEAPONS_TO_DEFEND), "e1");
    expect(defended.resources).toMatchObject({ wood: 24, stone: 9, food: 24, weapons: 1 });
    expect(openRaid(defended)).toMatchObject({ defended: true, weaponsBefore: 2, weaponsLost: 1, loot: { wood: 0, stone: 0, food: 0 } });
    expect(defended.activities[0]).toMatchObject({ tone: "good" });
  });

  it("above the threshold still only one weapon breaks", () => {
    expect(trip(withWeapons(5), "e1").resources.weapons).toBe(4);
  });

  it("every successful trip brings a new attack: after one defence the colony is below the threshold", () => {
    const first = colonyReducer(trip(withWeapons(2), "e1"), { type: "raidAcknowledged" });
    const second = trip(first, "e2");
    expect(openRaid(second)).toMatchObject({ defended: false, weaponsBefore: 1 });
    expect(second.resources.weapons).toBe(1);
    expect(second.resources.wood).toBe(Math.ceil((24 + 10) / 2));
  });
});

describe("D7: what must not cause an attack", () => {
  it("a failed expedition changes nothing and opens no report", () => {
    const failed = colonyReducer(depart(initialColony, "e1"), { type: "expeditionFailed", expeditionId: "e1", reason: "No word came back." });
    expect(failed.resources).toEqual(initialColony.resources);
    expect(failed.raids).toHaveLength(0);
  });

  it("a late success after a failure (timeout) is ignored", () => {
    const failed = colonyReducer(depart(initialColony, "e1"), { type: "expeditionFailed", expeditionId: "e1", reason: "Timeout." });
    expect(succeed(failed, "e1")).toBe(failed);
  });

  it("a repeated success answer causes one attack, not two", () => {
    const once = trip(initialColony, "e1");
    expect(succeed(once, "e1")).toBe(once);
    expect(once.raids).toHaveLength(1);
  });

  it("other destinations are safe", () => {
    expect(trip(initialColony, "e1", "old-mine").raids).toHaveLength(0);
    expect(trip(initialColony, "e2", "crystal-cave").raids).toHaveLength(0);
  });
});

describe("D7: the report stops the day until it is read", () => {
  const looted = trip(initialColony, "e1");

  it("no day passes while the report is open", () => {
    expect(colonyReducer(looted, { type: "dayPassed" })).toBe(looted);
  });

  it("after Continue the report is gone, the losses stay and the days go on", () => {
    const read = colonyReducer(looted, { type: "raidAcknowledged" });
    expect(openRaid(read)).toBeNull();
    expect(read.resources).toEqual(looted.resources);
    expect(colonyReducer(read, { type: "dayPassed" }).day).toBe(looted.day + 1);
  });

  it("two returning scouts give two reports, read one after the other", () => {
    const bothAway = depart(depart(withWeapons(2), "e1"), "e2", RAID_DESTINATION, "dwarf-1");
    const both = succeed(succeed(bothAway, "e1"), "e2");
    expect(both.raids.map((raid) => raid.defended)).toEqual([true, false]);
    expect(both.raids.map((raid) => raid.scout)).toEqual(["Dori Ashmantle", "Bromli Copperkeg"]);

    const one = colonyReducer(both, { type: "raidAcknowledged" });
    expect(one.raids).toHaveLength(1);
    expect(colonyReducer(one, { type: "raidAcknowledged" }).raids).toHaveLength(0);
  });

  it("a new colony starts without open reports", () => {
    expect(colonyReducer(looted, { type: "colonyRestarted" }).raids).toHaveLength(0);
  });
});
