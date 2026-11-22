import { Chronicle } from "../components/Chronicle";
import { canAfford, recipes, type RecipeId } from "../forge";
import { useColony } from "../state/ColonyContext";

export function ForgePage() {
  const { colony, activities, craftItem, acknowledgeActivity } = useColony();

  return (
    <div className="forge-layout">
      <div className="forge-recipes">
        {(Object.keys(recipes) as RecipeId[]).map((id) => {
          const recipe = recipes[id];
          const affordable = canAfford(colony, id);

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
                <button disabled={!affordable} onClick={() => craftItem(id)}>
                  Forge {recipe.label.toLowerCase()}
                </button>
                {!affordable && <em>Not enough materials</em>}
              </div>
            </section>
          );
        })}
      </div>

      <Chronicle
        activities={activities}
        onAcknowledge={acknowledgeActivity}
      />
    </div>
  );
}
