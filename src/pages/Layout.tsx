import { NavLink, Outlet } from "react-router";
import { awaitingAcknowledgement } from "../activityLog";
import { ResourceBar } from "../components/ResourceBar";
import { equippedTools } from "../equipment";
import { openRaid, WEAPONS_TO_DEFEND } from "../raid";
import { hasStarved } from "../simulation";
import { useColony } from "../state/ColonyContext";

export function Layout() {
  const { colony, paused, togglePaused, restartColony, dismissRaid } =
    useColony();

  const smiths = colony.dwarves.filter(
    (dwarf) => dwarf.status === "crafting",
  ).length;
  const starved = hasStarved(colony);
  const raid = openRaid(colony);
  const waiting = awaitingAcknowledgement(colony);
  const strikers = colony.dwarves
    .filter((dwarf) => dwarf.hungry)
    .map((dwarf) => dwarf.name)
    .join(", ");

  return (
    <main>
      <header className="masthead">
        <div className="brand">
          <b>⛏</b>
          <div>
            <small>THE DEEP REALMS OF</small>
            <h1>
              Dwarf<span>hold</span>
            </h1>
          </div>
        </div>

        <div className="hold-title">
          <small>COLONY</small>
          <strong>STONEHOME</strong>
          <span>Founded beneath Emberpeak</span>
        </div>

        <div className="day">
          <small>DEEP DAY</small>
          <strong>{colony.day}</strong>
          <button onClick={togglePaused}>
            {paused ? "Wake the hold" : "Pause"}
          </button>
        </div>
      </header>

      <nav className="main-nav" aria-label="Colony navigation">
        <NavLink to="/" end>
          Colony
        </NavLink>
        <NavLink to="/forge">Forge</NavLink>
      </nav>

      <ResourceBar
        resources={colony.resources}
        equippedTools={equippedTools(colony)}
      />
      {starved ? null : waiting ? (
        <p className="hunger-alert" role="alert">
          <b>⚠ The day clock is stopped.</b> On strike: {strikers}. Acknowledge
          the report in the Hold Chronicle to continue.
        </p>
      ) : (
        strikers && (
          <p className="hunger-alert" role="alert">
            <b>⚠ On strike: {strikers}.</b> Hungry dwarves refuse all work
            until they get a meal.
          </p>
        )
      )}
      <Outlet />

      <footer>
        <span>
          🔥 Forge:{" "}
          {smiths === 0
            ? "the anvil is silent"
            : `${smiths} at the anvil`}
        </span>
        <span>
          {starved || waiting || paused || raid
            ? "Day clock stopped"
            : "Next deep day in ~8 seconds"}
        </span>
        <span>
          {starved
            ? "The colony is lost"
            : raid
              ? "A raid report is open"
              : waiting
                ? "Waiting for your acknowledgement"
              : paused
                ? "The hold is resting"
                : "⚙ Simulation active"}
        </span>
      </footer>

      {starved && (
        <div
          className="game-over"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="game-over-title"
        >
          <small>DEEP DAY {colony.day}</small>
          <h2 id="game-over-title">Game over</h2>
          <strong>Stonehome has starved</strong>
          <p>
            The stores are empty and everyone is hungry, so nobody will
            farm again. The colony is lost.
          </p>
          <button autoFocus onClick={restartColony}>
            Start a new colony
          </button>
        </div>
      )}

      {raid && !starved && (
        <div
          className={raid.defended ? "game-over raid won" : "game-over raid"}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="raid-title"
        >
          <small>GOBLINS FOLLOWED {raid.scout.toUpperCase()} HOME</small>
          <h2 id="raid-title">{raid.defended ? "Defended!" : "Raid!"}</h2>
          {raid.defended ? (
            <>
              <strong>Stonehome held the gate</strong>
              <p>
                The armoury held {raid.weaponsBefore} weapons, and{" "}
                {WEAPONS_TO_DEFEND} are needed to defend. Nothing was stolen.{" "}
                {raid.weaponsLost} weapon broke in the fight; weapons left:{" "}
                {raid.weaponsBefore - raid.weaponsLost}.
              </p>
            </>
          ) : (
            <>
              <strong>Stonehome was looted</strong>
              <p>
                The armoury held {raid.weaponsBefore} of the{" "}
                {WEAPONS_TO_DEFEND} weapons needed to defend. The goblins
                carried off half of the stores:
              </p>
              <ul>
                <li>🪵 −{raid.loot.wood} timber</li>
                <li>🪨 −{raid.loot.stone} stone</li>
                <li>🍄 −{raid.loot.food} rations</li>
              </ul>
            </>
          )}
          {colony.raids.length > 1 && (
            <small>{colony.raids.length - 1} more report follows</small>
          )}
          <button autoFocus onClick={dismissRaid}>
            Continue
          </button>
        </div>
      )}
    </main>
  );
}
