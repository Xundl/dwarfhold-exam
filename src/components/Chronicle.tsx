import type { Activity } from "../types";

interface Props {
  activities: Activity[];
  onAcknowledge: (activityId: string) => void;
}

export function Chronicle({ activities, onAcknowledge }: Props) {
  // Reports that wait for the player stay pinned on top.
  const ordered = [
    ...activities.filter((activity) => activity.needsAck),
    ...activities.filter((activity) => !activity.needsAck),
  ];

  return (
    <section className="panel chronicle">
      <header>
        <div>
          <small>HOLD CHRONICLE</small>
          <h2>Recent activity</h2>
        </div>
      </header>

      {ordered.map((activity) => (
        <article
          className={[activity.tone, activity.needsAck && "pending"]
            .filter(Boolean)
            .join(" ")}
          key={activity.id}
        >
          <span>DAY {activity.day}</span>
          <p>{activity.message}</p>
          {activity.needsAck && (
            <button onClick={() => onAcknowledge(activity.id)}>
              Acknowledge
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
