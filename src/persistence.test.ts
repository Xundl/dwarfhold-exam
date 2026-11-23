import { describe, expect, it } from "vitest";
import { SAVE_KEY, SAVE_VERSION, loadColony, saveColony, startingColony, type SaveStorage } from "./persistence";
import { colonyReducer, initialColony } from "./state/colonyReducer";

/** A stand-in for localStorage, so the tests do not need a browser. */
function fakeStorage(initial: Record<string, string> = {}): SaveStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
  };
}

describe("D5: save and restore", () => {
  it("starts a new colony when nothing is saved", () => {
    expect(startingColony(fakeStorage())).toBe(initialColony);
  });

  it("a saved colony comes back after a refresh", () => {
    const storage = fakeStorage();
    const played = colonyReducer(initialColony, { type: "dayPassed" });
    saveColony(played, storage);

    const loaded = loadColony(storage);
    expect(loaded).toEqual({ kind: "loaded", state: played });

    const restored = startingColony(storage);
    expect(restored.day).toBe(played.day);
    expect(restored.resources).toEqual(played.resources);
    expect(restored.activities[0].message).toContain("restored");
  });

  it.each([
    ["not JSON", "{oops"],
    ["wrong version", JSON.stringify({ version: 999, state: initialColony })],
    ["missing fields", JSON.stringify({ version: SAVE_VERSION, state: { day: 3 } })],
    ["negative resources", JSON.stringify({ version: SAVE_VERSION, state: { ...initialColony, resources: { ...initialColony.resources, food: -5 } } })],
    ["broken resident", JSON.stringify({ version: SAVE_VERSION, state: { ...initialColony, dwarves: [{ name: "?" }] } })],
  ])("corrupt save (%s) falls back to a new colony with a visible message", (_label, raw) => {
    const storage = fakeStorage({ [SAVE_KEY]: raw });
    expect(loadColony(storage).kind).toBe("corrupt");

    const state = startingColony(storage);
    expect(state.day).toBe(initialColony.day);
    expect(state.dwarves).toEqual(initialColony.dwarves);
    expect(state.activities[0]).toMatchObject({ tone: "warning" });
  });

  it("an expedition interrupted by the refresh fails: traveller home, no loot", () => {
    const away = colonyReducer(initialColony, {
      type: "expeditionDeparted", expeditionId: "e1", dwarfId: "dwarf-3", destination: "old-mine",
    });
    const storage = fakeStorage();
    saveColony(away, storage);

    const restored = startingColony(storage);
    expect(restored.expeditions).toHaveLength(0);
    expect(restored.dwarves[2].status).toBe("idle");
    expect(restored.resources).toEqual(away.resources);
    expect(restored.activities[0].message).toContain("interrupted by the refresh");

    // A late answer to the old expedition can no longer change anything.
    const late = colonyReducer(restored, {
      type: "expeditionSucceeded", expeditionId: "e1",
      result: { expeditionId: "x", status: "completed", rewards: { stone: 12 }, message: "Stone!" },
    });
    expect(late).toBe(restored);
  });

  it("forge work continues after a refresh", () => {
    const smithing = colonyReducer(initialColony, { type: "craftingStarted", dwarfId: "dwarf-3", recipe: "tool" });
    expect(smithing.dwarves[2].status).toBe("crafting");

    const storage = fakeStorage();
    saveColony(smithing, storage);
    const restored = startingColony(storage);
    expect(restored.dwarves[2]).toMatchObject({ status: "crafting", crafting: smithing.dwarves[2].crafting });
  });

  it("a full or blocked storage does not crash the game", () => {
    const broken: SaveStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("quota exceeded"); },
    };
    expect(() => saveColony(initialColony, broken)).not.toThrow();
    expect(startingColony(broken)).toBe(initialColony);
  });
});