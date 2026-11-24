# Quality Goals – Dwarfhold

Besides the functional requirements D1–D7, we chose four qualitative goals.
They follow from how the game is used: a small colony simulation that runs on its own clock in the browser, talks to an unreliable server, and must stay understandable for the player.

| # | Goal | In one sentence |
|---|------|-----------------|
| Q1 | **Consistency** | The game never ends up in an impossible or contradictory state. |
| Q2 | **Robustness** | Network problems, a page refresh or broken save data never corrupt the colony or crash the game. |
| Q3 | **Transparency** | The player can always see what happens and why. |
| Q4 | **Maintainability** | New rules can be added in one place and checked by tests. |

---

## Q1 – Consistency (correct, deterministic simulation)

**Why it matters**
The simulation runs every 8 seconds, while the player also acts and server answers arrive at any time. If these changes are not coordinated, a resident could, for example, work and travel at once, a tool could exist twice, or the screen could show a different production than the simulation actually uses.

**Decisions**
- **One place for every change.** All changes to the colony go through one reducer (`state/colonyReducer.ts`). The provider only sends actions.
- **Rules are pure functions** (state in, new state out). They have no randomness and no side effects. The same input always gives the same result.
- **One status per resident** (`idle`, `working`, `crafting`, `expedition`) guarantees at most one activity (D1). Availability is checked by one function, `isAvailable`, which is used for expeditions and forging.
- **Derived instead of duplicated state.** "On strike" is derived from `hungry`, and "the elf has already joined" from the roster. There is no second flag that could disagree.
- **The UI asks the same functions as the rules**: `expectedProduction` for the shift ledger, `craftingProblem` for the forge button. The display cannot contradict the simulation.
- **Invalid actions change nothing.** Each rule returns the unchanged state if the action is not allowed.
- **Deterministic tie-breaks.** When food is short, hungry residents eat first, then in roster order. Raids depend only on the number of weapons.

**Trade-offs**
- There is more code than in the starter, because every action needs a type, a reducer case and a function.
- There is no randomness in the rules, so the game is less surprising but fully predictable and testable. The only random value is the expedition id, which is used for identification, not for gameplay.

**How we evaluate it**
- Unit tests for every rule: `simulation.test.ts`, `forge.test.ts`, `equipment.test.ts`, `species.test.ts`, `raid.test.ts`, `colonyReducer.test.ts`.
- Invariant tests, e.g. "the total number of tools never changes by equipping or returning" (`equipment.test.ts`) and "a busy or hungry resident cannot start anything" (`forge.test.ts`, `colonyReducer.test.ts`).
- `npx tsc -b` (strict TypeScript) must report no errors.

---

## Q2 – Robustness (network, refresh and save data)

**Why it matters**
Expeditions depend on a server that can be slow, fail or be unreachable. Players refresh pages or close the browser. The saved data in `localStorage` can be outdated or edited. None of this may break the game or create resources out of nowhere.

**Decisions**
- **Rewards exactly once (D4).** Every expedition gets an id and is stored as pending. An answer is applied only if its id is still pending, and then removed. Duplicate, late or unknown answers are ignored (double click, an answer after a timeout, an answer after a restart).
- **Timeout of 10 seconds.** No resident can stay away forever.
- **Every failure has the same safe result:** the resident returns home, no rewards, and a message appears in the chronicle. This covers server errors, an unreachable server, a timeout and an unreadable response.
- **Versioned and validated save (D5).** The full colony is saved after every change as `{ version, state }`. On loading, every field is checked (`isColonyState`). Broken or incompatible data leads to a new colony with a visible warning instead of a crash. A full or blocked storage does not stop the game.
- **Refresh policy.** An expedition interrupted by a refresh counts as failed, because the server does not keep track of running expeditions, so its answer is lost. It uses the same function as a D4 failure (`failExpedition`). Forge work continues, because its remaining days are part of the save.
- **Failed expeditions never cause a raid (D7).** The raid logic is only reached after a success.

**Trade-offs**
- An expedition interrupted by a refresh loses its possible reward. We accepted this because the alternative (sending the request again) could be exploited: a player could refresh to retry or to avoid a raid.
- A very slow but valid answer after 10 seconds is ignored. The player then sees a failure even though the server succeeded.
- A broken save is replaced by a new colony and is not repaired. Repairing would be more complex and could create invalid states.

**How we evaluate it**
- `expeditions.test.ts`: answer applied once, late answer after a failure ignored, double departure rejected, answer after a restart ignored.
- `persistence.test.ts`: save and restore, five kinds of corrupt saves, interrupted expedition, forge continues, blocked storage.
- Manual checks in the browser:
  1. Choose "Blocked Pass" → failure, the resident comes home, no rewards.
  2. Stop the server and send an expedition → failure message, no crash.
  3. Send an expedition and press F5 immediately → "interrupted by the refresh".
  4. DevTools → Local Storage → change `dwarfhold-save` to invalid text → F5 → new colony with a warning.

---

## Q3 – Transparency (the player understands the game)

**Why it matters**
Several rules work at the same time: hunger, forging time, expeditions, raids. If a consequence happens silently, the game feels random or broken. The requirements explicitly ask for visible rules and consequences.

**Decisions**
- **Every important event is written to the chronicle**, with colour: green for success, orange/red for warnings.
- **Important events stop the day clock**: a strike report must be acknowledged, and a raid report is shown full screen until the player continues. The player cannot miss them.
- **Rules are written next to the controls**: hunger rule, expedition rule and refresh policy in the colony page, cost and duration of each recipe in the forge.
- **Disabled actions explain why**, e.g. "is away on an expedition", "is on strike" or "needs 3 timber and 2 stone" (`craftingProblem`).
- **Forecasts**: the shift ledger shows the net food per day and warns before a shortage, and the forge shows on which day an item will be ready.

**Trade-offs**
- Stopping the clock interrupts the flow of the game. We preferred this to a consequence that goes unnoticed.
- There is more text in the interface.

**How we evaluate it**
- Walkthrough of all seven requirements: for every consequence we check that the player can see **what** happened and **why**, without reading the code.
- Because the UI uses the same functions as the rules (Q1), the shown numbers and reasons match the simulation by construction.

---

## Q4 – Maintainability (easy to change and to check)

**Why it matters**
The game was built by two people working in parallel, and new rules were added step by step (species, weapons, raids). Each change must be possible without breaking the existing rules.

**Decisions**
- **One file per topic**: `simulation.ts`, `dwarves.ts`, `equipment.ts`, `forge.ts`, `expeditions.ts`, `species.ts`, `raid.ts`, `persistence.ts`, `activityLog.ts`. This made parallel work on separate branches possible with few merge conflicts.
- **Rules as data tables**: recipes (`recipes` in `forge.ts`) and species (`speciesInfo` in `species.ts`). A new recipe or species is mostly one new table entry.
- **Named constants** instead of magic numbers: `TOOL_BONUS`, `WEAPONS_TO_DEFEND`, `EXPEDITION_TIMEOUT_MS`, `SAVE_VERSION`.
- **Testable by design**: pure functions need no browser. Even `localStorage` is passed in as a parameter, so the tests can use a fake storage.
- **Feature branches and pull requests** for every requirement.

**Trade-offs**
- More files and more indirection than in the starter.
- The type `Dwarf` and the list `dwarves` kept their starter names even though a resident can now be an elf. Renaming everything would have touched almost every file.
- Changing the shape of the state requires raising `SAVE_VERSION`. Old saves are then discarded instead of migrated.

**How we evaluate it**
- 103 automated tests in 8 files (`npm test`), plus `npx tsc -b`, run before every merge.
- D6 (a new species) as a real example: the differences live in one table, and the simulation, forge and UI read from it.

---

## Summary: how we check all goals

```
npx tsc -b     # no type errors
npm test       # all tests green
npm run dev    # manual walkthrough of D1–D7 and the checks listed above
```
