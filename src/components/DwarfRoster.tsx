import { canReturnTool } from "../equipment";
import { isAtHome, jobLabel } from "../simulation";
import type { Dwarf, JobType } from "../types";

const jobs: Exclude<JobType, null>[] = [
  "woodcutting",
  "mining",
  "farming",
];

interface Props {
  dwarves: Dwarf[];
  /** Text for a dwarf who works at the forge, e.g. "Forging a weapon · ready on day 14". */
  craftingNote: (dwarf: Dwarf) => string | null;
  /** Tools lying in the stores, ready to be handed out. */
  freeTools: number;
  onAssign: (id: string, job: JobType) => void;
  onEquipTool: (id: string) => void;
  onReturnTool: (id: string) => void;
}

export function DwarfRoster({
  dwarves,
  craftingNote,
  freeTools,
  onAssign,
  onEquipTool,
  onReturnTool,
}: Props) {
  const presentDwarves = dwarves.filter(
    (dwarf) => dwarf.status !== "expedition",
  ).length;
  const strikers = dwarves.filter((dwarf) => dwarf.hungry).length;

  return (
    <section className="panel roster">
      <header>
        <div>
          <small>THE COMPANY</small>
          <h2>Holdfolk</h2>
        </div>
        <span>
          {presentDwarves} / {dwarves.length} present
          {strikers > 0 ? ` · ${strikers} on strike` : ""}
        </span>
      </header>

      <div className="dwarf-list">
        {dwarves.map((dwarf) => {
          const isAway = dwarf.status === "expedition";
          const onStrike = dwarf.hungry && isAtHome(dwarf);
          const forging = craftingNote(dwarf);
          const statusLabel = onStrike
            ? "on strike"
            : dwarf.status === "crafting"
              ? "forging"
              : dwarf.status;
          const specialty = dwarf.specialty
            ? `Skilled in ${jobLabel(dwarf.specialty)}`
            : "Generalist";

          return (
            <article
              className={isAway ? "dwarf away" : "dwarf"}
              key={dwarf.id}
            >
              <div className="portrait">
                {dwarf.icon}
                <i className={onStrike ? "strike" : dwarf.status} />
              </div>

              <div className="dwarf-details">
                <h3>{dwarf.name}</h3>
                <p>
                  {dwarf.title} · {specialty}
                </p>

                <div
                  className={dwarf.hungry ? "hunger empty" : "hunger"}
                  role="img"
                  aria-label={dwarf.hungry ? "Hunger bar empty" : "Hunger bar full"}
                >
                  <i />
                  {dwarf.hungry ? "Hungry" : "Fed"}
                </div>

                <select
                  value={dwarf.assignment ?? ""}
                  disabled={!isAtHome(dwarf)}
                  onChange={(event) =>
                    onAssign(
                      dwarf.id,
                      (event.target.value || null) as JobType,
                    )
                  }
                >
                  <option value="">Unassigned</option>
                  {jobs.map((job) => (
                    <option value={job} key={job}>
                      {jobLabel(job)}
                    </option>
                  ))}
                </select>

                {forging && <p className="task">🔥 {forging}</p>}

                <div className="gear">
                  {dwarf.hasTool ? (
                    <>
                      <span className="tool-badge">⚒ Tool · +1 / day</span>
                      <button
                        disabled={!canReturnTool(dwarf)}
                        onClick={() => onReturnTool(dwarf.id)}
                      >
                        Return tool
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={isAway || freeTools === 0}
                      title={
                        freeTools === 0 ? "No free tool in the stores" : undefined
                      }
                      onClick={() => onEquipTool(dwarf.id)}
                    >
                      Equip tool
                    </button>
                  )}
                </div>
              </div>

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
