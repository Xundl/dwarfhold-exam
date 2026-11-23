// resource bar component: shows the five resources at top of page
// types only
import type { ResourceKey, Resources } from "../types";

// emoji and label per resource
const details: Record<ResourceKey, readonly [string, string]> = {
  // wood
  wood: ["🪵", "Timber"],
  // stone
  stone: ["🪨", "Stone"],
  // food
  food: ["🍄", "Rations"],
  // free tools (equipped ones are shown next to it)
  tools: ["⚒️", "Free tools"],
  // weapons
  weapons: ["⚔️", "Weapons"],
};

// order on screen
const order: ResourceKey[] = ["wood", "stone", "food", "tools", "weapons"];

// props
interface Props {
  // stores
  resources: Resources;
  // tools carried by residents
  equippedTools: number;
}

// component
export function ResourceBar({ resources, equippedTools }: Props) {
  return (
    // bar
    <section className="resource-bar">
      {/* one box per resource */}
      {order.map((key) => {
        // emoji and label of this resource
        const [icon, label] = details[key];

        return (
          // box, key for react
          <article key={key}>
            {/* emoji */}
            <span>{icon}</span>
            <div>
              {/* label */}
              <small>{label}</small>
              {/* amount from stores */}
              <strong>{resources[key]}</strong>
              {/* only at tools: number of equipped tools (d2: see where tools are) */}
              {key === "tools" && <em>{equippedTools} equipped</em>}
            </div>
          </article>
        );
      })}
    </section>
  );
}
