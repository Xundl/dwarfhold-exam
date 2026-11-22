import { useState } from "react";
import { Chronicle } from "../components/Chronicle";
import { DwarfRoster } from "../components/DwarfRoster";
import { craftingSummary } from "../forge";
import {
  activeJob,
  expectedProduction,
  isAvailable,
  jobLabel,
  mealsNeeded,
  production,
  toolBonus,
} from "../simulation";
import { useColony } from "../state/ColonyContext";

export function ColonyPage() {
  const {
    colony,
    activities,
    //expeditionPending,
    assignDwarf,
    sendExpedition,
    acknowledgeActivity,
    equipTool,
    returnTool,
  } = useColony();
  const [destination, setDestination] = useState("crystal-cave");
  const [expeditionDwarf, setExpeditionDwarf] = useState("dwarf-3");

  // Same functions as the simulation itself, so the ledger can never disagree with it.
  const meals = mealsNeeded(colony);
  const netFood = expectedProduction(colony).food - meals;
  const shortageTonight = colony.resources.food + netFood < 0;
  // Evenings on which everyone can still be fed if nothing changes.
  const eveningsCovered =
    netFood < 0 ? Math.floor(colony.resources.food / -netFood) : null;

  const scout = colony.dwarves.find((dwarf) => dwarf.id === expeditionDwarf);
  const scoutAvailable = scout !== undefined && isAvailable(scout);
  const scoutAway = scout?.status === "expedition";

  return (
    <div className="dashboard">
      <DwarfRoster
        dwarves={colony.dwarves}
        craftingNote={(dwarf) => craftingSummary(colony, dwarf)}
        freeTools={colony.resources.tools}
        onAssign={assignDwarf}
        onEquipTool={equipTool}
        onReturnTool={returnTool}
      />

      <section className="center-stack">
        <section className="panel production">
          <header>
            <div>
              <small>SHIFT LEDGER</small>
              <h2>Daily Production</h2>
            </div>
            <span>updates each day</span>
          </header>

          <div className="job-grid">
            {(["woodcutting", "mining", "farming"] as const).map((job) => {
              const perWorker = Object.values(production[job])[0] ?? 0;
              const assigned = colony.dwarves.filter(
                (dwarf) => dwarf.assignment === job,
              ).length;
              const workers = colony.dwarves.filter(
                (dwarf) => activeJob(dwarf) === job,
              );
              const working = workers.length;
              const forging = colony.dwarves.filter(
                (dwarf) =>
                  dwarf.assignment === job && dwarf.status === "crafting",
              ).length;
              const fromTools = workers.reduce(
                (sum, dwarf) => sum + toolBonus(dwarf),
                0,
              );
              const striking = colony.dwarves.filter(
                (dwarf) =>
                  dwarf.assignment === job &&
                  dwarf.status === "working" &&
                  dwarf.hungry,
              ).length;

              return (
                <article key={job}>
                  <b>
                    {job === "woodcutting"
                      ? "🌲"
                      : job === "mining"
                        ? "⛏️"
                        : "🍄"}
                  </b>
                  <h3>{jobLabel(job)}</h3>
                  <p>
                    {working} of {assigned} working
                    {striking > 0 ? ` · ${striking} on strike` : ""}
                    {forging > 0 ? ` · ${forging} forging` : ""}
                  </p>
                  <strong>
                    +{working * perWorker + fromTools} / day
                    {fromTools > 0 ? ` · incl. +${fromTools} from tools` : ""}
                  </strong>
                </article>
              );
            })}
          </div>

          <div className="net-line">
            <span>NET FOOD AFTER MEALS ({meals} EATEN PER DAY)</span>
            <strong className={netFood >= 0 ? "gain" : "loss"}>
              {netFood >= 0 ? "+" : ""}
              {netFood}
            </strong>
          </div>

          {shortageTonight ? (
            <p className="rule-note warning">
              The stores will not cover tonight's meals: someone will go hungry
              and strike. Assign more farmers before the day ends.
            </p>
          ) : (
            eveningsCovered !== null &&
            eveningsCovered <= 3 && (
              <p className="rule-note warning">
                At this rate the stores cover only {eveningsCovered} more{" "}
                {eveningsCovered === 1 ? "evening" : "evenings"}.
              </p>
            )
          )}
          <p className="rule-note">
            Only dwarves at home with a job produce; a dwarf at the forge
            produces nothing meanwhile. A tool gives its carrier +1 per day in
            any job. Each evening everyone
            eats 1 food, travellers included. A dwarf who gets no meal is
            hungry and refuses all work until fed; hungry dwarves are served
            first. If everyone is hungry and the stores are empty, Stonehome
            has starved.
          </p>
        </section>
      </section>

      <aside className="side-stack">
        <section className="panel expedition">
          <header>
            <div>
              <small>BEYOND THE GATE</small>
              <h2>Expedition</h2>
            </div>
            <b>🗺️</b>
          </header>

          <label>
            Scout
            <select
              value={expeditionDwarf}
              onChange={(event) => setExpeditionDwarf(event.target.value)}
            >
              {colony.dwarves.map((dwarf) => (
                <option key={dwarf.id} value={dwarf.id}>
                  {dwarf.name}
                  {dwarf.status === "expedition"
                    ? " (away)"
                    : dwarf.status === "crafting"
                      ? " (forging)"
                      : dwarf.hungry
                        ? " (on strike)"
                        : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            Destination
            <select
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            >
              <option value="crystal-cave">Crystal Cave</option>
              <option value="old-mine">The Old Mine</option>
              <option value="blocked-pass">Blocked Pass</option>
            </select>
          </label>

          <button
            disabled={!scoutAvailable}
            onClick={() => sendExpedition(expeditionDwarf, destination)}
          >
            {scoutAway ? "Beyond the gate…" : "Send expedition"}
          </button>
          <p>
            The selected dwarf is unavailable while travelling. Several dwarves
            may travel at once, but each only once. With no answer after 10
            seconds the expedition fails: no rewards, and the dwarf returns home.
          </p>
        </section>

        <Chronicle
          activities={activities}
          onAcknowledge={acknowledgeActivity}
        />
      </aside>
    </div>
  );
}
