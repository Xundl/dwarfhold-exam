// colony page: roster, shift ledger (daily production), expedition panel, chronicle
// use state = small local state of this component
import { useState } from "react";
// chronicle
import { Chronicle } from "../components/Chronicle";
// roster
import { DwarfRoster } from "../components/DwarfRoster";
// forge text per resident
import { craftingSummary } from "../forge";
// same functions the daily simulation uses
import {
  activeJob,
  expectedProduction,
  isAvailable,
  jobLabel,
  mealsNeeded,
  toolBonus,
} from "../simulation";
// raid constants for warning text
import {
  RAID_DESTINATION,
  WEAPONS_LOST_IN_DEFENCE,
  WEAPONS_TO_DEFEND,
} from "../raid";
// elf: has she joined, her data, amount per job
import { hasNewcomerJoined, newcomer, yieldOf } from "../species";
// state and actions from context
import { useColony } from "../state/ColonyContext";

// component
export function ColonyPage() {
  // take what is needed from context
  const {
    colony,
    activities,
    assignDwarf,
    sendExpedition,
    acknowledgeActivity,
    equipTool,
    returnTool,
  } = useColony();
  // chosen destination (only a ui choice = local state), starts with crystal cave
  const [destination, setDestination] = useState("crystal-cave");
  // chosen scout, starts with third resident (the one without job)
  const [expeditionDwarf, setExpeditionDwarf] = useState("dwarf-3");

  // meals needed tonight, same functions as simulation so ledger can never disagree with it
  const meals = mealsNeeded(colony);
  // food made today minus food eaten tonight
  const netFood = expectedProduction(colony).food - meals;
  // true if stores plus today's food do not cover tonight's meals
  const shortageTonight = colony.resources.food + netFood < 0;
  // evenings on which everyone can still be fed if nothing changes, null if food is not shrinking
  const eveningsCovered =
    netFood < 0 ? Math.floor(colony.resources.food / -netFood) : null;

  // resident object of chosen scout
  const scout = colony.dwarves.find((dwarf) => dwarf.id === expeditionDwarf);
  // can scout leave (exists, at home, not hungry)
  const scoutAvailable = scout !== undefined && isAvailable(scout);
  // is scout travelling right now
  const scoutAway = scout?.status === "expedition";

  return (
    // page with three columns
    <div className="dashboard">
      {/* left: roster */}
      <DwarfRoster
        // residents
        dwarves={colony.dwarves}
        // forge text per resident
        craftingNote={(dwarf) => craftingSummary(colony, dwarf)}
        // free tools
        freeTools={colony.resources.tools}
        // job change
        onAssign={assignDwarf}
        // equip
        onEquipTool={equipTool}
        // return
        onReturnTool={returnTool}
      />

      {/* middle column */}
      <section className="center-stack">
        {/* shift ledger: what will be produced today (d1: display matches simulation) */}
        <section className="panel production">
          {/* heading */}
          <header>
            <div>
              <small>SHIFT LEDGER</small>
              <h2>Daily Production</h2>
            </div>
            <span>updates each day</span>
          </header>

          {/* three job boxes */}
          <div className="job-grid">
            {/* one box per job */}
            {(["woodcutting", "mining", "farming"] as const).map((job) => {
              // how many have this job assigned
              const assigned = colony.dwarves.filter(
                (dwarf) => dwarf.assignment === job,
              ).length;
              // who really works in it today (not away, not hungry, not forging)
              const workers = colony.dwarves.filter(
                (dwarf) => activeJob(dwarf) === job,
              );
              // number of real workers
              const working = workers.length;
              // base production: every worker brings own species value (d6), reduce = add up
              const base = workers.reduce(
                // sum so far plus amount of this worker
                (sum, dwarf) => sum + yieldOf(dwarf, job),
                // start at 0
                0,
              );
              // how many with this job are at forge right now
              const forging = colony.dwarves.filter(
                (dwarf) =>
                  dwarf.assignment === job && dwarf.status === "crafting",
              ).length;
              // extra from tools of real workers (d2)
              const fromTools = workers.reduce(
                // sum so far plus bonus of this worker
                (sum, dwarf) => sum + toolBonus(dwarf),
                // start at 0
                0,
              );
              // how many with this job are on strike
              const striking = colony.dwarves.filter(
                (dwarf) =>
                  dwarf.assignment === job &&
                  dwarf.status === "working" &&
                  dwarf.hungry,
              ).length;

              return (
                // box
                <article key={job}>
                  {/* emoji of job */}
                  <b>
                    {job === "woodcutting"
                      ? "🌲"
                      : job === "mining"
                        ? "⛏️"
                        : "🍄"}
                  </b>
                  {/* name of job */}
                  <h3>{jobLabel(job)}</h3>
                  {/* working of assigned, plus strikers and smiths if any (explains why fewer work) */}
                  <p>
                    {working} of {assigned} working
                    {striking > 0 ? ` · ${striking} on strike` : ""}
                    {forging > 0 ? ` · ${forging} forging` : ""}
                  </p>
                  {/* amount per day, tool part shown extra */}
                  <strong>
                    +{base + fromTools} / day
                    {fromTools > 0 ? ` · incl. +${fromTools} from tools` : ""}
                  </strong>
                </article>
              );
            })}
          </div>

          {/* food balance line */}
          <div className="net-line">
            {/* label with meals per day */}
            <span>NET FOOD AFTER MEALS ({meals} EATEN PER DAY)</span>
            {/* green when plus, red when minus */}
            <strong className={netFood >= 0 ? "gain" : "loss"}>
              {/* plus sign for positive numbers */}
              {netFood >= 0 ? "+" : ""}
              {/* the number */}
              {netFood}
            </strong>
          </div>

          {/* warning before it happens (d1): tonight not enough, or only few evenings left */}
          {shortageTonight ? (
            // tonight someone goes hungry
            <p className="rule-note warning">
              The stores will not cover tonight's meals: someone will go hungry
              and strike. Assign more farmers before the day ends.
            </p>
          ) : (
            // otherwise: only if food is shrinking
            eveningsCovered !== null &&
            // and three evenings or fewer are left
            eveningsCovered <= 3 && (
              // evenings left
              <p className="rule-note warning">
                At this rate the stores cover only {eveningsCovered} more{" "}
                {eveningsCovered === 1 ? "evening" : "evenings"}.
              </p>
            )
          )}
          {/* rules explained in the interface (d1, d2, d6) */}
          <p className="rule-note">
            Only residents at home with a job produce; how much depends on
            their kind (see the roster). A resident at the forge produces
            nothing meanwhile. A tool gives its carrier +1 per day in any job.
            Each evening everyone eats 1 food, travellers included. Whoever
            gets no meal is hungry and refuses all work until fed; the hungry
            are served first. If everyone is hungry and the stores are empty,
            Stonehome has starved.
          </p>
        </section>
      </section>

      {/* right column */}
      <aside className="side-stack">
        {/* expedition panel */}
        <section className="panel expedition">
          {/* heading */}
          <header>
            <div>
              <small>BEYOND THE GATE</small>
              <h2>Expedition</h2>
            </div>
            <b>🗺️</b>
          </header>

          {/* scout select */}
          <label>
            Scout
            {/* select */}
            <select
              // chosen scout
              value={expeditionDwarf}
              // on change remember new id
              onChange={(event) => setExpeditionDwarf(event.target.value)}
            >
              {/* one option per resident */}
              {colony.dwarves.map((dwarf) => (
                // option
                <option key={dwarf.id} value={dwarf.id}>
                  {/* name */}
                  {dwarf.name}
                  {/* state in brackets: away, forging, on strike or nothing */}
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

          {/* destination select */}
          <label>
            Destination
            {/* select */}
            <select
              // chosen destination
              value={destination}
              // on change remember
              onChange={(event) => setDestination(event.target.value)}
            >
              {/* crystal cave (elf can join here) */}
              <option value="crystal-cave">Crystal Cave</option>
              {/* old mine */}
              <option value="old-mine">The Old Mine</option>
              {/* blocked pass (always fails, built into server) */}
              <option value="blocked-pass">Blocked Pass</option>
              {/* goblin warren (d7) */}
              <option value={RAID_DESTINATION}>Goblin Warren ⚠</option>
            </select>
          </label>

          {/* warning box before departure (d7): rule and current weapons, only for goblin warren */}
          {destination === RAID_DESTINATION && (
            // box
            <p
              // green variant when enough weapons
              className={
                colony.resources.weapons >= WEAPONS_TO_DEFEND
                  ? "raid-warning ready"
                  : "raid-warning"
              }
            >
              ⚠ Rich pickings (timber and rations), but on success goblins
              follow the scout home and attack at once. With{" "}
              {WEAPONS_TO_DEFEND} or more weapons Stonehome defends itself and{" "}
              {WEAPONS_LOST_IN_DEFENCE} weapon breaks. With fewer, the goblins
              loot half of the stored timber, stone and rations. Weapons in
              the armoury: <b>{colony.resources.weapons}</b>
              {/* ready or not */}
              {colony.resources.weapons >= WEAPONS_TO_DEFEND
                ? " (ready to defend)."
                : " (not enough)."}
            </p>
          )}

          {/* send button */}
          <button
            // locked when scout cannot leave
            disabled={!scoutAvailable}
            // click sends expedition (provider creates id and calls server)
            onClick={() => sendExpedition(expeditionDwarf, destination)}
          >
            {/* other text while scout is away */}
            {scoutAway ? "Beyond the gate…" : "Send expedition"}
          </button>
          {/* hint about the elf (d6): rumour before, fact after */}
          <p className="rumour">
            {hasNewcomerJoined(colony)
              ? `✦ ${newcomer.name} joined Stonehome from the Crystal Cave.`
              : "✦ Rumour: a stranger was seen among the glowing crystals of the Crystal Cave. A successful expedition there may bring a new resident."}
          </p>
          {/* rules of d4 explained */}
          <p>
            The selected scout is unavailable while travelling. Several
            residents may travel at once, but each only once. With no answer after 10
            seconds the expedition fails: no rewards, and the scout returns home.
          </p>
          {/* rule of d5 explained (refresh) */}
          <p>
            💾 Progress is saved automatically. After a page refresh, an
            expedition still on the road counts as failed (no loot, no raid);
            forge work continues where it stopped.
          </p>
        </section>

        {/* chronicle */}
        <Chronicle
          // entries
          activities={activities}
          // acknowledge action
          onAcknowledge={acknowledgeActivity}
        />
      </aside>
    </div>
  );
}
