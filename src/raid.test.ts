// tests for goblin attack (d7): loot, defence, what must not cause an attack, report stops the day
// test tools: describe = group of tests, it = one test, expect = check a value
import { describe, expect, it } from "vitest";
// functions and constants under test
import { lootOf, openRaid, RAID_DESTINATION, WEAPONS_TO_DEFEND } from "./raid";
// reducer and start colony
import { colonyReducer, initialColony } from "./state/colonyReducer";
// types only
import type { ColonyState, ExpeditionResult } from "./types";

// what the server answers for the goblin warren
const result: ExpeditionResult = {
  // 10 wood and 6 food as reward
  expeditionId: "exp-17", status: "completed", rewards: { wood: 10, food: 6 }, message: "Timber and stolen rations.",
};

// helper: start colony with a chosen number of weapons
const withWeapons = (weapons: number): ColonyState => ({
  // copy start colony
  ...initialColony,
  // only weapons are different
  resources: { ...initialColony.resources, weapons },
});

// helper: someone leaves (default: dori to the goblin warren)
const depart = (state: ColonyState, expeditionId: string, destination = RAID_DESTINATION, dwarfId = "dwarf-3") =>
  // departure action
  colonyReducer(state, { type: "expeditionDeparted", expeditionId, dwarfId, destination });
// helper: successful answer arrives
const succeed = (state: ColonyState, expeditionId: string) =>
  // success action
  colonyReducer(state, { type: "expeditionSucceeded", expeditionId, result });
// helper: whole trip = leave and come back with success
const trip = (state: ColonyState, expeditionId: string, destination = RAID_DESTINATION) =>
  // depart, then succeed
  succeed(depart(state, expeditionId, destination), expeditionId);

// start colony has 14 wood, 9 stone, 18 food, with reward: 24 wood, 9 stone, 24 food
// group: loot is deterministic
describe("D7: loot is deterministic", () => {
  // test: half of wood, stone and food, rounded down
  it("takes half of timber, stone and rations, rounded down", () => {
    // 24 / 9 / 21 gives 12 / 4 / 10, tools and weapons are not touched
    expect(lootOf({ wood: 24, stone: 9, food: 21, tools: 3, weapons: 1 })).toEqual({ wood: 12, stone: 4, food: 10 });
    // small numbers: 1 / 0 / 3 gives 0 / 0 / 1
    expect(lootOf({ wood: 1, stone: 0, food: 3, tools: 0, weapons: 0 })).toEqual({ wood: 0, stone: 0, food: 1 });
  });

  // test: same colony always gets same result
  it("the same colony always gets the same outcome", () => {
    // two runs, same content
    expect(trip(initialColony, "e1")).toEqual(trip(initialColony, "e1"));
  });
});

// group: colony without enough weapons is looted
describe("D7: an undefended colony is looted", () => {
  // trip with only 1 weapon (2 needed), shared by tests in this group
  const looted = trip(withWeapons(1), "e1");

  // test: loses half of stores, counted after reward came in
  it("loses half of the stores, counted after the reward came in", () => {
    // 24 - 12 wood, 9 - 4 stone, 24 - 12 food
    expect(looted.resources).toMatchObject({ wood: 12, stone: 5, food: 12 });
  });

  // test: keeps tools and weapons
  it("keeps its tools and weapons", () => {
    // tools unchanged
    expect(looted.resources.tools).toBe(initialColony.resources.tools);
    // weapon still there
    expect(looted.resources.weapons).toBe(1);
  });

  // test: report with exact losses and chronicle entry
  it("files a report with the exact losses and writes the chronicle", () => {
    // report on screen
    expect(openRaid(looted)).toEqual({
      // who, not defended, 1 weapon, none lost
      scout: "Dori Ashmantle", defended: false, weaponsBefore: 1, weaponsLost: 0,
      // exact loot
      loot: { wood: 12, stone: 4, food: 12 },
    });
    // red entry
    expect(looted.activities[0]).toMatchObject({ tone: "warning" });
    // with the numbers
    expect(looted.activities[0].message).toContain("-12 timber, -4 stone, -12 rations");
  });

  // test: scout is home again
  it("the scout is home again", () => {
    // idle
    expect(looted.dwarves[2].status).toBe("idle");
    // nothing pending
    expect(looted.expeditions).toHaveLength(0);
  });
});

// group: enough weapons defend
describe("D7: enough weapons defend the colony", () => {
  // test: at threshold nothing is stolen and one weapon breaks
  it("at the threshold nothing is stolen and one weapon breaks", () => {
    // exactly 2 weapons
    const defended = trip(withWeapons(WEAPONS_TO_DEFEND), "e1");
    // reward stays, 1 weapon left
    expect(defended.resources).toMatchObject({ wood: 24, stone: 9, food: 24, weapons: 1 });
    // report: defended, 2 before, 1 lost, no loot
    expect(openRaid(defended)).toMatchObject({ defended: true, weaponsBefore: 2, weaponsLost: 1, loot: { wood: 0, stone: 0, food: 0 } });
    // green entry
    expect(defended.activities[0]).toMatchObject({ tone: "good" });
  });

  // test: above threshold still only one weapon breaks
  it("above the threshold still only one weapon breaks", () => {
    // 5 - 1 = 4
    expect(trip(withWeapons(5), "e1").resources.weapons).toBe(4);
  });

  // test: every successful trip brings a new attack, after one defence colony is below threshold
  it("every successful trip brings a new attack: after one defence the colony is below the threshold", () => {
    // first trip defended (2 weapons, 1 breaks), report closed
    const first = colonyReducer(trip(withWeapons(2), "e1"), { type: "raidAcknowledged" });
    // second trip with 1 weapon
    const second = trip(first, "e2");
    // not defended this time
    expect(openRaid(second)).toMatchObject({ defended: false, weaponsBefore: 1 });
    // weapon stays
    expect(second.resources.weapons).toBe(1);
    // 24 + 10 wood = 34, half is stolen, 17 left
    expect(second.resources.wood).toBe(Math.ceil((24 + 10) / 2));
  });
});

// group: what must not cause an attack
describe("D7: what must not cause an attack", () => {
  // test: failed expedition changes nothing and opens no report
  it("a failed expedition changes nothing and opens no report", () => {
    // leave, then fail
    const failed = colonyReducer(depart(initialColony, "e1"), { type: "expeditionFailed", expeditionId: "e1", reason: "No word came back." });
    // stores unchanged
    expect(failed.resources).toEqual(initialColony.resources);
    // no report
    expect(failed.raids).toHaveLength(0);
  });

  // test: late success after failure (timeout) is ignored
  it("a late success after a failure (timeout) is ignored", () => {
    // leave, then timeout
    const failed = colonyReducer(depart(initialColony, "e1"), { type: "expeditionFailed", expeditionId: "e1", reason: "Timeout." });
    // same state back, no attack
    expect(succeed(failed, "e1")).toBe(failed);
  });

  // test: repeated success answer causes one attack, not two
  it("a repeated success answer causes one attack, not two", () => {
    // one trip
    const once = trip(initialColony, "e1");
    // same answer again = same state back
    expect(succeed(once, "e1")).toBe(once);
    // one report only
    expect(once.raids).toHaveLength(1);
  });

  // test: other destinations are safe
  it("other destinations are safe", () => {
    // old mine
    expect(trip(initialColony, "e1", "old-mine").raids).toHaveLength(0);
    // crystal cave
    expect(trip(initialColony, "e2", "crystal-cave").raids).toHaveLength(0);
  });
});

// group: report stops the day until it is read
describe("D7: the report stops the day until it is read", () => {
  // looted colony with open report, shared by tests in this group
  const looted = trip(initialColony, "e1");

  // test: no day passes while report is open
  it("no day passes while the report is open", () => {
    // same state back
    expect(colonyReducer(looted, { type: "dayPassed" })).toBe(looted);
  });

  // test: after continue report is gone, losses stay, days go on
  it("after Continue the report is gone, the losses stay and the days go on", () => {
    // player clicks continue
    const read = colonyReducer(looted, { type: "raidAcknowledged" });
    // no open report
    expect(openRaid(read)).toBeNull();
    // stores unchanged
    expect(read.resources).toEqual(looted.resources);
    // next day comes
    expect(colonyReducer(read, { type: "dayPassed" }).day).toBe(looted.day + 1);
  });

  // test: two returning scouts give two reports, read one after the other
  it("two returning scouts give two reports, read one after the other", () => {
    // dori and bromli both leave, colony has 2 weapons
    const bothAway = depart(depart(withWeapons(2), "e1"), "e2", RAID_DESTINATION, "dwarf-1");
    // both come back
    const both = succeed(succeed(bothAway, "e1"), "e2");
    // first defended (2 weapons), second not (only 1 left)
    expect(both.raids.map((raid) => raid.defended)).toEqual([true, false]);
    // reports in order of return
    expect(both.raids.map((raid) => raid.scout)).toEqual(["Dori Ashmantle", "Bromli Copperkeg"]);

    // first continue
    const one = colonyReducer(both, { type: "raidAcknowledged" });
    // one report left
    expect(one.raids).toHaveLength(1);
    // second continue: none left
    expect(colonyReducer(one, { type: "raidAcknowledged" }).raids).toHaveLength(0);
  });

  // test: new colony starts without open reports
  it("a new colony starts without open reports", () => {
    // restart: empty queue
    expect(colonyReducer(looted, { type: "colonyRestarted" }).raids).toHaveLength(0);
  });
});
