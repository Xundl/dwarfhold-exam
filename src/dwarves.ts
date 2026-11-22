import type { Dwarf, DwarfStatus, JobType } from "./types";

/*
 * Small questions about one dwarf. They live in their own file so that the
 * simulation, the forge and the expeditions can all use them without importing each other.
 */

/** A dwarf is at home when idle or working. Every other status means "busy elsewhere". */
export const isAtHome = (dwarf: Dwarf) =>
  dwarf.status === "idle" || dwarf.status === "working";

/** Can this dwarf start something new (expedition, forge work)? Not when busy and not when on strike. */
export const isAvailable = (dwarf: Dwarf) => isAtHome(dwarf) && !dwarf.hungry;

/** The status a dwarf at home has for a given assignment. */
export const homeStatus = (assignment: JobType): DwarfStatus =>
  assignment ? "working" : "idle";
