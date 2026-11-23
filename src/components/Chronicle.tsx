// chronicle component: shows log entries, waiting reports pinned on top with acknowledge button
// types only
import type { Activity } from "../types";

// what component gets from outside (props)
interface Props {
  // entries
  activities: Activity[];
  // called when player clicks acknowledge
  onAcknowledge: (activityId: string) => void;
}

// component, takes props apart
export function Chronicle({ activities, onAcknowledge }: Props) {
  // reports that wait for player stay pinned on top
  const ordered = [
    // first those with needs-ack
    ...activities.filter((activity) => activity.needsAck),
    // then all others (order inside stays)
    ...activities.filter((activity) => !activity.needsAck),
  ];

  // what is drawn
  return (
    // panel
    <section className="panel chronicle">
      {/* heading */}
      <header>
        <div>
          <small>HOLD CHRONICLE</small>
          <h2>Recent activity</h2>
        </div>
      </header>

      {/* one article per entry */}
      {ordered.map((activity) => (
        // entry
        <article
          // css classes: colour (good / warning) and pending for waiting reports
          className={[activity.tone, activity.needsAck && "pending"]
            // remove empty values (undefined, false)
            .filter(Boolean)
            // join with space
            .join(" ")}
          // key = react needs a unique id per list item
          key={activity.id}
        >
          {/* day */}
          <span>DAY {activity.day}</span>
          {/* text */}
          <p>{activity.message}</p>
          {/* only waiting reports get a button */}
          {activity.needsAck && (
            // click calls on-acknowledge with id of entry
            <button onClick={() => onAcknowledge(activity.id)}>
              Acknowledge
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
