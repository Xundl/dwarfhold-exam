import { isAtHome, jobLabel } from "../simulation";
import type { Dwarf, JobType } from "../types";

const jobs: Exclude<JobType, null>[] = [
  "woodcutting",
  "mining",
  "farming",
];

interface Props {
  dwarves: Dwarf[];
  onAssign: (id: string, job: JobType) => void;
}

export function DwarfRoster({ dwarves, onAssign }: Props) {
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
                  disabled={isAway}
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
              </div>

              <span className={onStrike ? "status strike" : "status"}>
                {onStrike ? "on strike" : dwarf.status}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
