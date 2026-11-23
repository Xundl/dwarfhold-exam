// forge page: choose smith, start recipes, see running orders
// use state = small local state of this component
import { useState } from "react";
// chronicle
import { Chronicle } from "../components/Chronicle";
// rule and texts of forge
import {
  craftingProblem,
  craftingSummary,
  recipes,
  type RecipeId,
} from "../forge";
// species names
import { speciesInfo } from "../species";
// state and actions from context
import { useColony } from "../state/ColonyContext";

// component
export function ForgePage() {
  // take what is needed from context
  const { colony, activities, startCrafting, acknowledgeActivity } =
    useColony();
  // chosen smith (only a ui choice, so local state and not part of colony), starts with first resident (?. and ?? = empty text if there is none)
  const [smithId, setSmithId] = useState(colony.dwarves[0]?.id ?? "");

  // resident object of chosen smith (undefined if not found)
  const smith = colony.dwarves.find((dwarf) => dwarf.id === smithId);
  // everyone who is forging right now
  const atTheAnvil = colony.dwarves.filter(
    (dwarf) => dwarf.status === "crafting",
  );

  return (
    // page
    <div className="forge-layout">
      {/* left column */}
      <div className="forge-recipes">
        {/* smith select */}
        <section className="panel smith">
          {/* label */}
          <label>
            Smith
            {/* select */}
            <select
              // chosen id
              value={smithId}
              // on change remember new id
              onChange={(event) => setSmithId(event.target.value)}
            >
              {/* one option per resident */}
              {colony.dwarves.map((dwarf) => (
                // option
                <option key={dwarf.id} value={dwarf.id}>
                  {/* name */}
                  {dwarf.name}
                  {/* species, only if not dwarf */}
                  {dwarf.species === "dwarf"
                    ? ""
                    : ` · ${speciesInfo[dwarf.species].label.toLowerCase()}`}
                  {/* state in brackets: forging, away, on strike or nothing */}
                  {dwarf.status === "crafting"
                    ? " (forging)"
                    : dwarf.status === "expedition"
                      ? " (away)"
                      : dwarf.hungry
                        ? " (on strike)"
                        : ""}
                </option>
              ))}
            </select>
          </label>
          {/* rule explained on page (d3: visible rule) */}
          <p>
            Forging needs materials, a free resident and time. The materials
            are taken when the work starts. The smith leaves their job until
            the item is ready, and a hungry smith pauses. Dwarves forge tools
            and weapons; elves forge tools only.
          </p>
        </section>

        {/* one card per recipe (from recipe table, new recipe would appear automatically) */}
        {(Object.keys(recipes) as RecipeId[]).map((id) => {
          // recipe data
          const recipe = recipes[id];
          // reason why this smith cannot start it, or null (same function the rule uses)
          const problem = craftingProblem(colony, smith, id);

          return (
            // card
            <section className="panel forge" key={id}>
              {/* title and purpose */}
              <div>
                <small>EMBER FORGE</small>
                <h2>Craft a {recipe.label.toLowerCase()}</h2>
                <p>{recipe.purpose}</p>
              </div>
              {/* cost, result, duration and button */}
              <div className="recipe">
                {/* wood cost */}
                <span>{recipe.cost.wood} 🪵</span>
                <i>+</i>
                {/* stone cost */}
                <span>{recipe.cost.stone} 🪨</span>
                <i>→</i>
                {/* result */}
                <span>1 {recipe.icon}</span>
                {/* duration */}
                <span className="duration">
                  takes {recipe.days} {recipe.days === 1 ? "day" : "days"}
                </span>
                {/* start button */}
                <button
                  // locked when there is a problem
                  disabled={problem !== null}
                  // click sends order to reducer
                  onClick={() => startCrafting(smithId, id)}
                >
                  Start forging
                </button>
                {/* reason next to locked button (d3: player sees why nothing happens) */}
                {problem && <em>{problem}</em>}
              </div>
            </section>
          );
        })}

        {/* running orders (d3: who forges and when it is ready) */}
        <section className="panel anvil">
          {/* heading */}
          <header>
            <div>
              <small>WORK IN PROGRESS</small>
              <h2>At the anvil</h2>
            </div>
            {/* number of smiths */}
            <span>{atTheAnvil.length} at work</span>
          </header>
          {/* nobody? */}
          {atTheAnvil.length === 0 ? (
            // empty text
            <p>The anvil is silent.</p>
          ) : (
            // list
            <ul>
              {/* one line per smith */}
              {atTheAnvil.map((dwarf) => (
                // line
                <li key={dwarf.id}>
                  {/* name */}
                  <b>{dwarf.name}</b>
                  {/* what and ready day (or paused) */}
                  <span>{craftingSummary(colony, dwarf)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* chronicle on the right */}
      <Chronicle
        // entries
        activities={activities}
        // acknowledge action
        onAcknowledge={acknowledgeActivity}
      />
    </div>
  );
}
