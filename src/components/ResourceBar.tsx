import type { ResourceKey, Resources } from "../types";

const details: Record<ResourceKey, readonly [string, string]> = {
  wood: ["🪵", "Timber"],
  stone: ["🪨", "Stone"],
  food: ["🍄", "Rations"],
  tools: ["⚒️", "Free tools"],
  weapons: ["⚔️", "Weapons"],
};

const order: ResourceKey[] = ["wood", "stone", "food", "tools", "weapons"];

interface Props {
  resources: Resources;
  /** Tools carried by dwarves; shown next to the free tools in the stores. */
  equippedTools: number;
}

export function ResourceBar({ resources, equippedTools }: Props) {
  return (
    <section className="resource-bar">
      {order.map((key) => {
        const [icon, label] = details[key];

        return (
          <article key={key}>
            <span>{icon}</span>
            <div>
              <small>{label}</small>
              <strong>{resources[key]}</strong>
              {key === "tools" && <em>{equippedTools} equipped</em>}
            </div>
          </article>
        );
      })}
    </section>
  );
}
