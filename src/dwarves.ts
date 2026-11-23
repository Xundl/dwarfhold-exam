// small questions about one resident, own file so simulation, forge and expeditions can all use them without importing each other (no circular import)
// types only (import type = removed at build, no runtime code)
import type { Dwarf, DwarfStatus, JobType } from "./types";

// at home = idle or working, every other status means busy elsewhere
export const isAtHome = (dwarf: Dwarf) =>
  dwarf.status === "idle" || dwarf.status === "working";

// available = can start something new (expedition, forge), must be at home and not hungry (not on strike)
export const isAvailable = (dwarf: Dwarf) => isAtHome(dwarf) && !dwarf.hungry;

// status a resident at home gets for a job: with job = working, without job = idle
export const homeStatus = (assignment: JobType): DwarfStatus =>
  assignment ? "working" : "idle";
