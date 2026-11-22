import { useState } from "react";
import { Chronicle } from "../components/Chronicle";
import {
  craftingProblem,
  craftingSummary,
  recipes,
  type RecipeId,
} from "../forge";
import { useColony } from "../state/ColonyContext";

export function ForgePage() {
  const { colony, activities, startCrafting, acknowledgeActivity } =
    useColony();
  const [smithId, setSmithId] = useState(colony.dwarves[0]?.id ?? "");

  const smith = colony.dwarves.find((dwarf) => dwarf.id === smithId);
  const atTheAnvil = colony.dwarves.filter(
    (dwarf) => dwarf.status === "crafting",
  );

  return (
    <div className="forge-layout">
      <div className="forge-recipes">
        <section className="panel smith">
          <label>
            Smith
            <select
              value={smithId}
              onChange={(event) => setSmithId(event.target.value)}
            >
              {colony.dwarves.map((dwarf) => (
                <option key={dwarf.id} value={dwarf.id}>
                  {dwarf.name}
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
          <p>
            Forging needs materials, a free dwarf and time. The materials are
            taken when the work starts. The smith leaves their job until the
            item is ready, and a hungry smith pauses.
          </p>
        </section>

        {(Object.keys(recipes) as RecipeId[]).map((id) => {
          const recipe = recipes[id];
          const problem = craftingProblem(colony, smith, id);

          return (
            <section className="panel forge" key={id}>
              <div>
                <small>EMBER FORGE</small>
                <h2>Craft a {recipe.label.toLowerCase()}</h2>
                <p>{recipe.purpose}</p>
              </div>
              <div className="recipe">
                <span>{recipe.cost.wood} 🪵</span>
                <i>+</i>
                <span>{recipe.cost.stone} 🪨</span>
                <i>→</i>
                <span>1 {recipe.icon}</span>
                <span className="duration">
                  takes {recipe.days} {recipe.days === 1 ? "day" : "days"}
                </span>
                <button
                  disabled={problem !== null}
                  onClick={() => startCrafting(smithId, id)}
                >
                  Start forging
                </button>
                {problem && <em>{problem}</em>}
              </div>
            </section>
          );
        })}

        <section className="panel anvil">
          <header>
            <div>
              <small>WORK IN PROGRESS</small>
              <h2>At the anvil</h2>
            </div>
            <span>{atTheAnvil.length} at work</span>
          </header>
          {atTheAnvil.length === 0 ? (
            <p>The anvil is silent.</p>
          ) : (
            <ul>
              {atTheAnvil.map((dwarf) => (
                <li key={dwarf.id}>
                  <b>{dwarf.name}</b>
                  <span>{craftingSummary(colony, dwarf)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Chronicle
        activities={activities}
        onAcknowledge={acknowledgeActivity}
      />
    </div>
  );
}
