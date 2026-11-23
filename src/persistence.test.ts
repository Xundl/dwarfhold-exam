// tests for save and restore (d5): save, load, broken saves, refresh policy
// test tools: describe = group of tests, it = one test, expect = check a value
import { describe, expect, it } from "vitest";
// functions under test
import { SAVE_KEY, SAVE_VERSION, loadColony, saveColony, startingColony, type SaveStorage } from "./persistence";
// reducer and start colony
import { colonyReducer, initialColony } from "./state/colonyReducer";

// helper: stand-in for local storage, so tests need no browser (possible because storage is passed in as parameter)
function fakeStorage(initial: Record<string, string> = {}): SaveStorage & { data: Record<string, string> } {
  // plain object as storage
  const data = { ...initial };
  // same two methods as local storage
  return {
    // data visible for tests
    data,
    // read, null if nothing there
    getItem: (key) => data[key] ?? null,
    // write
    setItem: (key, value) => { data[key] = value; },
  };
}

// group: all d5 rules
describe("D5: save and restore", () => {
  // test: nothing saved = start colony
  it("starts a new colony when nothing is saved", () => {
    // exactly the start colony object
    expect(startingColony(fakeStorage())).toBe(initialColony);
  });

  // test: saved colony comes back after refresh
  it("a saved colony comes back after a refresh", () => {
    // empty storage
    const storage = fakeStorage();
    // play one day
    const played = colonyReducer(initialColony, { type: "dayPassed" });
    // save
    saveColony(played, storage);

    // load
    const loaded = loadColony(storage);
    // usable, with same state
    expect(loaded).toEqual({ kind: "loaded", state: played });

    // start game from storage
    const restored = startingColony(storage);
    // same day
    expect(restored.day).toBe(played.day);
    // same stores
    expect(restored.resources).toEqual(played.resources);
    // chronicle says restored
    expect(restored.activities[0].message).toContain("restored");
  });

  // one test for each broken save (it.each = runs same test with every row)
  it.each([
    // text that is not json
    ["not JSON", "{oops"],
    // unknown version
    ["wrong version", JSON.stringify({ version: 999, state: initialColony })],
    // fields missing
    ["missing fields", JSON.stringify({ version: SAVE_VERSION, state: { day: 3 } })],
    // negative food
    ["negative resources", JSON.stringify({ version: SAVE_VERSION, state: { ...initialColony, resources: { ...initialColony.resources, food: -5 } } })],
    // resident without needed fields
    ["broken resident", JSON.stringify({ version: SAVE_VERSION, state: { ...initialColony, dwarves: [{ name: "?" }] } })],
  // %s = name of row in test title
  ])("corrupt save (%s) falls back to a new colony with a visible message", (_label, raw) => {
    // storage with this broken save
    const storage = fakeStorage({ [SAVE_KEY]: raw });
    // recognised as corrupt
    expect(loadColony(storage).kind).toBe("corrupt");

    // start game from it
    const state = startingColony(storage);
    // start day
    expect(state.day).toBe(initialColony.day);
    // start residents
    expect(state.dwarves).toEqual(initialColony.dwarves);
    // red entry tells player why
    expect(state.activities[0]).toMatchObject({ tone: "warning" });
  });

  // test: expedition interrupted by refresh fails
  it("an expedition interrupted by the refresh fails: traveller home, no loot", () => {
    // dori leaves
    const away = colonyReducer(initialColony, {
      // departure action
      type: "expeditionDeparted", expeditionId: "e1", dwarfId: "dwarf-3", destination: "old-mine",
    });
    // empty storage
    const storage = fakeStorage();
    // save while she is away
    saveColony(away, storage);

    // start game from storage (= refresh)
    const restored = startingColony(storage);
    // nothing pending
    expect(restored.expeditions).toHaveLength(0);
    // dori is home
    expect(restored.dwarves[2].status).toBe("idle");
    // no reward
    expect(restored.resources).toEqual(away.resources);
    // chronicle gives the reason
    expect(restored.activities[0].message).toContain("interrupted by the refresh");

    // late answer to old expedition can change nothing anymore
    const late = colonyReducer(restored, {
      // success for e1
      type: "expeditionSucceeded", expeditionId: "e1",
      // with reward
      result: { expeditionId: "x", status: "completed", rewards: { stone: 12 }, message: "Stone!" },
    });
    // same state back
    expect(late).toBe(restored);
  });

  // test: forge work continues after refresh
  it("forge work continues after a refresh", () => {
    // dori starts a tool
    const smithing = colonyReducer(initialColony, { type: "craftingStarted", dwarfId: "dwarf-3", recipe: "tool" });
    // status crafting
    expect(smithing.dwarves[2].status).toBe("crafting");

    // empty storage
    const storage = fakeStorage();
    // save
    saveColony(smithing, storage);
    // start game from storage
    const restored = startingColony(storage);
    // still crafting with same order (days left kept)
    expect(restored.dwarves[2]).toMatchObject({ status: "crafting", crafting: smithing.dwarves[2].crafting });
  });

  // test: full or blocked storage does not crash
  it("a full or blocked storage does not crash the game", () => {
    // storage where everything fails
    const broken: SaveStorage = {
      // reading throws
      getItem: () => { throw new Error("blocked"); },
      // writing throws
      setItem: () => { throw new Error("quota exceeded"); },
    };
    // save does not throw
    expect(() => saveColony(initialColony, broken)).not.toThrow();
    // load falls back to start colony
    expect(startingColony(broken)).toBe(initialColony);
  });
});