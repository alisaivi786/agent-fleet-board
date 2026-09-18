import type { SessionActivity } from '../types';
import { ActivityFeed } from '../components/ActivityFeed';

export function ActivityPage({ activity }: { activity: SessionActivity[] }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Activity Log</span>
      </div>
      <ActivityFeed activity={activity} />
    </div>
  );
}
