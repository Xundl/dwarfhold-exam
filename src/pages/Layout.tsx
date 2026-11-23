// layout: frame around every page (header, navigation, resource bar, alerts, footer) and the two full screen messages (game over, raid)
// nav link = link that knows if it is active, outlet = place where current page is drawn
import { NavLink, Outlet } from "react-router";
// is a strike report waiting
import { awaitingAcknowledgement } from "../activityLog";
// resource bar
import { ResourceBar } from "../components/ResourceBar";
// number of equipped tools
import { equippedTools } from "../equipment";
// open raid report, weapons threshold
import { openRaid, WEAPONS_TO_DEFEND } from "../raid";
// game over check
import { hasStarved } from "../simulation";
// state and actions from context
import { useColony } from "../state/ColonyContext";

// component
export function Layout() {
  // take what is needed from context
  const { colony, paused, togglePaused, restartColony, dismissRaid } =
    useColony();

  // number of smiths at forge
  const smiths = colony.dwarves.filter(
    (dwarf) => dwarf.status === "crafting",
  ).length;
  // is colony lost (computed from state, not stored)
  const starved = hasStarved(colony);
  // raid report to show, or null
  const raid = openRaid(colony);
  // is a strike report waiting
  const waiting = awaitingAcknowledgement(colony);
  // names of everyone on strike, as one text
  const strikers = colony.dwarves
    // hungry ones
    .filter((dwarf) => dwarf.hungry)
    // only names
    .map((dwarf) => dwarf.name)
    // joined with comma
    .join(", ");

  return (
    // whole page
    <main>
      {/* header */}
      <header className="masthead">
        {/* logo */}
        <div className="brand">
          <b>⛏</b>
          <div>
            <small>THE DEEP REALMS OF</small>
            <h1>
              Dwarf<span>hold</span>
            </h1>
          </div>
        </div>

        {/* colony name */}
        <div className="hold-title">
          <small>COLONY</small>
          <strong>STONEHOME</strong>
          <span>Founded beneath Emberpeak</span>
        </div>

        {/* day counter */}
        <div className="day">
          <small>DEEP DAY</small>
          {/* current day from state */}
          <strong>{colony.day}</strong>
          {/* pause button */}
          <button onClick={togglePaused}>
            {/* text depends on paused */}
            {paused ? "Wake the hold" : "Pause"}
          </button>
        </div>
      </header>

      {/* navigation between the two pages */}
      <nav className="main-nav" aria-label="Colony navigation">
        {/* colony page (end = active only on exactly /) */}
        <NavLink to="/" end>
          Colony
        </NavLink>
        {/* forge page */}
        <NavLink to="/forge">Forge</NavLink>
      </nav>

      {/* resources, shown on every page */}
      <ResourceBar
        // stores
        resources={colony.resources}
        // tools carried by residents
        equippedTools={equippedTools(colony)}
      />
      {/* alert under resource bar: nothing at game over, clock stopped text while a report waits, otherwise strike hint if someone is hungry */}
      {starved ? null : waiting ? (
        // clock stopped, role alert = screen reader announces it
        <p className="hunger-alert" role="alert">
          <b>⚠ The day clock is stopped.</b> On strike: {strikers}. Acknowledge
          the report in the Hold Chronicle to continue.
        </p>
      ) : (
        // no report waiting: hint only if there are strikers
        strikers && (
          // strike hint with rule (d1: consequence explained)
          <p className="hunger-alert" role="alert">
            <b>⚠ On strike: {strikers}.</b> Hungry dwarves refuse all work
            until they get a meal.
          </p>
        )
      )}
      {/* current page (colony or forge) */}
      <Outlet />

      {/* footer with three status texts */}
      <footer>
        {/* forge status */}
        <span>
          🔥 Forge:{" "}
          {/* nobody or number of smiths */}
          {smiths === 0
            ? "the anvil is silent"
            : `${smiths} at the anvil`}
        </span>
        {/* clock status */}
        <span>
          {/* stopped for any of four reasons, otherwise countdown text */}
          {starved || waiting || paused || raid
            ? "Day clock stopped"
            : "Next deep day in ~8 seconds"}
        </span>
        {/* overall status */}
        <span>
          {/* most important reason first */}
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

      {/* game over screen (d1), only when colony starved, covers whole page */}
      {starved && (
        // dialog
        <div
          // css class for full screen
          className="game-over"
          // alertdialog = screen reader treats it as important dialog
          role="alertdialog"
          // modal = rest of page cannot be used meanwhile
          aria-modal="true"
          // which element is the title (for screen reader)
          aria-labelledby="game-over-title"
        >
          {/* day */}
          <small>DEEP DAY {colony.day}</small>
          {/* big title */}
          <h2 id="game-over-title">Game over</h2>
          {/* what happened */}
          <strong>Stonehome has starved</strong>
          {/* why (rule explained) */}
          <p>
            The stores are empty and everyone is hungry, so nobody will
            farm again. The colony is lost.
          </p>
          {/* restart button, auto focus = enter key works right away */}
          <button autoFocus onClick={restartColony}>
            Start a new colony
          </button>
        </div>
      )}

      {/* raid screen (d7), only when a report is open and colony is not lost */}
      {raid && !starved && (
        // dialog
        <div
          // green variant when defended
          className={raid.defended ? "game-over raid won" : "game-over raid"}
          // important dialog
          role="alertdialog"
          // modal
          aria-modal="true"
          // which element is the title
          aria-labelledby="raid-title"
        >
          {/* who was followed */}
          <small>GOBLINS FOLLOWED {raid.scout.toUpperCase()} HOME</small>
          {/* title: defended or raid */}
          <h2 id="raid-title">{raid.defended ? "Defended!" : "Raid!"}</h2>
          {/* defended? */}
          {raid.defended ? (
            // yes
            <>
              {/* headline */}
              <strong>Stonehome held the gate</strong>
              {/* numbers: weapons before, needed, broken, left */}
              <p>
                The armoury held {raid.weaponsBefore} weapons, and{" "}
                {WEAPONS_TO_DEFEND} are needed to defend. Nothing was stolen.{" "}
                {raid.weaponsLost} weapon broke in the fight; weapons left:{" "}
                {raid.weaponsBefore - raid.weaponsLost}.
              </p>
            </>
          ) : (
            // no: looted
            <>
              {/* headline */}
              <strong>Stonehome was looted</strong>
              {/* weapons there and needed */}
              <p>
                The armoury held {raid.weaponsBefore} of the{" "}
                {WEAPONS_TO_DEFEND} weapons needed to defend. The goblins
                carried off half of the stores:
              </p>
              {/* exact losses */}
              <ul>
                {/* wood */}
                <li>🪵 −{raid.loot.wood} timber</li>
                {/* stone */}
                <li>🪨 −{raid.loot.stone} stone</li>
                {/* food */}
                <li>🍄 −{raid.loot.food} rations</li>
              </ul>
            </>
          )}
          {/* hint if more reports wait (queue) */}
          {colony.raids.length > 1 && (
            // number of remaining reports
            <small>{colony.raids.length - 1} more report follows</small>
          )}
          {/* continue button closes this report, auto focus = enter key works */}
          <button autoFocus onClick={dismissRaid}>
            Continue
          </button>
        </div>
      )}
    </main>
  );
}
