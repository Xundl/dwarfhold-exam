import { NavLink, Outlet } from "react-router";
import { awaitingAcknowledgement } from "../activityLog";
import { ResourceBar } from "../components/ResourceBar";
import { hasStarved } from "../simulation";
import { useColony } from "../state/ColonyContext";

export function Layout() {
  const { colony, paused, togglePaused, restartColony } = useColony();

  const starved = hasStarved(colony);
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

      <ResourceBar resources={colony.resources} />
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
        <span>🔥 Forge: burning</span>
        <span>
          {starved || waiting || paused
            ? "Day clock stopped"
            : "Next deep day in ~8 seconds"}
        </span>
        <span>
          {starved
            ? "The colony is lost"
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
            The stores are empty and every dwarf is hungry, so nobody will
            farm again. The colony is lost.
          </p>
          <button autoFocus onClick={restartColony}>
            Start a new colony
          </button>
        </div>
      )}
    </main>
  );
}
