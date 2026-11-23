// roster component: one card per resident with species, hunger bar, job select, forge note and tool buttons
// may tool be returned
import { canReturnTool } from "../equipment";
// is at home, display name of job
import { isAtHome, jobLabel } from "../simulation";
// resource per job, species table, traits text, amount per job
import { jobResource, speciesInfo, traits, yieldOf } from "../species";
// types only
import type { Dwarf, JobType } from "../types";

// the three jobs for the select (exclude = job type without null)
const jobs: Exclude<JobType, null>[] = [
  "woodcutting",
  "mining",
  "farming",
];

// props
interface Props {
  // residents
  dwarves: Dwarf[];
  // gives text for a resident who works at forge, like forging a weapon · ready on day 14
  craftingNote: (dwarf: Dwarf) => string | null;
  // free tools in stores
  freeTools: number;
  // called when job is changed
  onAssign: (id: string, job: JobType) => void;
  // called on equip
  onEquipTool: (id: string) => void;
  // called on return
  onReturnTool: (id: string) => void;
}

// component, takes props apart
export function DwarfRoster({
  dwarves,
  craftingNote,
  freeTools,
  onAssign,
  onEquipTool,
  onReturnTool,
}: Props) {
  // how many are not on expedition
  const presentDwarves = dwarves.filter(
    (dwarf) => dwarf.status !== "expedition",
  ).length;
  // how many are hungry (on strike)
  const strikers = dwarves.filter((dwarf) => dwarf.hungry).length;

  return (
    // panel
    <section className="panel roster">
      {/* heading */}
      <header>
        <div>
          <small>THE COMPANY</small>
          <h2>Holdfolk</h2>
        </div>
        {/* counter text: present of all, and strikers if any */}
        <span>
          {presentDwarves} / {dwarves.length} present
          {strikers > 0 ? ` · ${strikers} on strike` : ""}
        </span>
      </header>

      {/* list of cards */}
      <div className="dwarf-list">
        {/* one card per resident */}
        {dwarves.map((dwarf) => {
          // away on expedition
          const isAway = dwarf.status === "expedition";
          // on strike = hungry and at home
          const onStrike = dwarf.hungry && isAtHome(dwarf);
          // forge text or null
          const forging = craftingNote(dwarf);
          // status text: on strike wins, crafting is shown as forging, otherwise status itself
          const statusLabel = onStrike
            ? "on strike"
            : dwarf.status === "crafting"
              ? "forging"
              : dwarf.status;
          // skill text (display only)
          const specialty = dwarf.specialty
            ? `Skilled in ${jobLabel(dwarf.specialty)}`
            : "Generalist";

          return (
            // card
            <article
              // greyed when away
              className={isAway ? "dwarf away" : "dwarf"}
              // key for react
              key={dwarf.id}
            >
              {/* portrait with species colour */}
              <div className={`portrait kin-${dwarf.species}`}>
                {/* emoji */}
                {dwarf.icon}
                {/* small status dot */}
                <i className={onStrike ? "strike" : dwarf.status} />
              </div>

              {/* details */}
              <div className="dwarf-details">
                {/* name with species badge (d6: see who is what) */}
                <h3>
                  {dwarf.name}
                  <span className={`species kin-${dwarf.species}`}>
                    {speciesInfo[dwarf.species].label}
                  </span>
                </h3>
                {/* title and skill */}
                <p>
                  {dwarf.title} · {specialty}
                </p>
                {/* values of species (production, forge rights), so player can decide who gets which job (d6) */}
                <p className="traits">{traits(dwarf.species)}</p>

                {/* hunger bar (d1): full or empty */}
                <div
                  // css class empty when hungry
                  className={dwarf.hungry ? "hunger empty" : "hunger"}
                  // role img and label = screen reader reads bar as one picture with text
                  role="img"
                  aria-label={dwarf.hungry ? "Hunger bar empty" : "Hunger bar full"}
                >
                  {/* bar itself (drawn with css) */}
                  <i />
                  {/* text next to bar */}
                  {dwarf.hungry ? "Hungry" : "Fed"}
                </div>

                {/* job select */}
                <select
                  // current job, empty text for none
                  value={dwarf.assignment ?? ""}
                  // locked unless at home (away or forging = cannot be reassigned)
                  disabled={!isAtHome(dwarf)}
                  // on change
                  onChange={(event) =>
                    // call on-assign
                    onAssign(
                      // with id
                      dwarf.id,
                      // and new job, empty text becomes null
                      (event.target.value || null) as JobType,
                    )
                  }
                >
                  {/* no job */}
                  <option value="">Unassigned</option>
                  {/* one option per job */}
                  {jobs.map((job) => (
                    // option
                    <option value={job} key={job}>
                      {/* label with amount this resident would produce (d6: informed decision) */}
                      {jobLabel(job)} (+{yieldOf(dwarf, job)} {jobResource[job]})
                    </option>
                  ))}
                </select>

                {/* forge note, only while forging (d3: who forges, when ready) */}
                {forging && <p className="task">🔥 {forging}</p>}

                {/* tool area (d2) */}
                <div className="gear">
                  {/* has tool? */}
                  {dwarf.hasTool ? (
                    // yes: fragment = two elements without extra box
                    <>
                      {/* badge shows who owns a tool */}
                      <span className="tool-badge">⚒ Tool · +1 / day</span>
                      {/* return button */}
                      <button
                        // locked if return is not allowed
                        disabled={!canReturnTool(dwarf)}
                        // click returns tool
                        onClick={() => onReturnTool(dwarf.id)}
                      >
                        Return tool
                      </button>
                    </>
                  ) : (
                    // no: equip button
                    <button
                      // locked when away or no free tool
                      disabled={isAway || freeTools === 0}
                      // hover text explains why
                      title={
                        freeTools === 0 ? "No free tool in the stores" : undefined
                      }
                      // click equips
                      onClick={() => onEquipTool(dwarf.id)}
                    >
                      Equip tool
                    </button>
                  )}
                </div>
              </div>

              {/* status label on the right */}
              <span className={onStrike ? "status strike" : "status"}>
                {statusLabel}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
