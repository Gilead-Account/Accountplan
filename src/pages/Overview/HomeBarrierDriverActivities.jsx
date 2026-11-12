import { useState } from 'react';
import {
  activityDueDetail,
  activityIsOpen,
  activityStatusLabel,
  daysFromNow,
  formatDateLabel,
} from '@/lib/helper/utils';

const CLOSED_ACTIVITY_STATUSES = new Set(['complete', 'completed', 'closed', 'archived']);

const ACTIVITY_FILTERS = [
  { id: 'all', label: 'All Activities' },
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
];

const isHomeModalActivityOpen = (activity) =>
  activityIsOpen(activity) &&
  !CLOSED_ACTIVITY_STATUSES.has(String(activity?.status || '').trim().toLowerCase());

const activitiesForHomeModalFilter = (rows, filter) => rows.filter((activity) => {
  if (filter === 'open') return isHomeModalActivityOpen(activity);
  if (filter === 'closed') return !isHomeModalActivityOpen(activity);
  return true;
});

const activityPriorityMeta = (activity) => {
  if (!isHomeModalActivityOpen(activity)) {
    return { label: 'Complete', tone: 'complete' };
  }

  const daysUntilDue = daysFromNow(activity?.dueDate);
  if (daysUntilDue !== null && daysUntilDue < 0) {
    return { label: 'Overdue', tone: 'overdue' };
  }
  if (daysUntilDue !== null && daysUntilDue <= 30) {
    return { label: daysUntilDue === 0 ? 'Due today' : 'Due soon', tone: 'due-soon' };
  }
  if (daysUntilDue === null) {
    return { label: 'No due date', tone: 'unscheduled' };
  }
  return { label: 'On track', tone: 'on-track' };
};

const ActivityMeta = ({ label, value }) => (
  <span className="home-bd-activity-meta-item">
    <small>{label}</small>
    <strong>{value || 'Not entered'}</strong>
  </span>
);

export default function HomeBarrierDriverActivities({ record, activities, onEditActivity }) {
  const rows = activities || [];
  const firstOpenActivity = rows.find(isHomeModalActivityOpen);
  const [expandedId, setExpandedId] = useState(() => firstOpenActivity?.id || rows[0]?.id || null);
  const [activityFilter, setActivityFilter] = useState('all');
  const openCount = rows.reduce(
    (count, activity) => count + (isHomeModalActivityOpen(activity) ? 1 : 0),
    0
  );
  const filterCounts = {
    all: rows.length,
    open: openCount,
    closed: rows.length - openCount,
  };
  const visibleRows = activitiesForHomeModalFilter(rows, activityFilter);

  const toggleActivity = (activityId) => {
    setExpandedId((current) => (current === activityId ? null : activityId));
  };

  const selectActivityFilter = (nextFilter) => {
    const nextRows = activitiesForHomeModalFilter(rows, nextFilter);
    setActivityFilter(nextFilter);
    setExpandedId(nextRows[0]?.id || null);
  };

  return (
    <section className="home-bd-activities" aria-labelledby="home-bd-activities-title">
      <div className="home-bd-activities-head">
        <div className="home-bd-activities-title-group">
          <span className="home-bd-activities-title-icon" aria-hidden="true">
            <i />
          </span>
          <h4 id="home-bd-activities-title">Linked Critical Activities</h4>
        </div>
        <div className="home-bd-activity-filters" role="group" aria-label="Filter linked critical activities">
          {ACTIVITY_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`home-bd-activity-filter is-${filter.id} ${activityFilter === filter.id ? 'is-selected' : ''}`}
              aria-pressed={activityFilter === filter.id}
              onClick={() => selectActivityFilter(filter.id)}
            >
              <span>{filter.label}</span>
              <strong aria-label={`${filterCounts[filter.id]} activities`}>{filterCounts[filter.id]}</strong>
            </button>
          ))}
        </div>
      </div>

      {visibleRows.length ? (
        <div className="home-bd-activity-list">
          {visibleRows.map((activity, index) => {
            const isExpanded = expandedId === activity.id;
            const panelId = `home-bd-activity-panel-${activity.id}`;
            const priority = activityPriorityMeta(activity);
            return (
              <article
                key={activity.id}
                className={`home-bd-activity-accordion is-${priority.tone} ${isExpanded ? 'is-expanded' : ''}`}
                style={{ '--home-bd-activity-order': index }}
              >
                <div className="home-bd-activity-summary-row">
                  <button
                    type="button"
                    className="home-bd-activity-toggle"
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    onClick={() => toggleActivity(activity.id)}
                  >
                    <span className="home-bd-activity-index" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="home-bd-activity-title-block">
                      <span className="home-bd-activity-title-line">
                        <strong>{activity.name || 'Untitled Critical Activity'}</strong>
                        <span className={`home-bd-activity-priority is-${priority.tone}`}>{priority.label}</span>
                      </span>
                      <span className="home-bd-activity-glance">
                        <span>{activityStatusLabel(activity)}</span>
                        <span aria-hidden="true">•</span>
                        <span>{activityDueDetail(activity)}</span>
                        <span aria-hidden="true">•</span>
                        <span>{activity.ownerLabel || 'Unassigned'}</span>
                      </span>
                    </span>
                    <span className="home-bd-activity-chevron" aria-hidden="true" />
                  </button>
                  {onEditActivity ? (
                    <button
                      type="button"
                      className="home-bd-activity-edit"
                      onClick={() => onEditActivity(activity)}
                      aria-label={`Edit ${activity.name || 'critical activity'}`}
                    >
                      Edit
                    </button>
                  ) : null}
                </div>

                {isExpanded ? (
                  <div id={panelId} className="home-bd-activity-panel">
                    <div className="home-bd-activity-detail-copy">
                      <span>Activity details</span>
                      <p>{activity.details || 'No additional details have been entered.'}</p>
                    </div>
                    <div className="home-bd-activity-meta-grid">
                      <ActivityMeta label="Status" value={activityStatusLabel(activity)} />
                      <ActivityMeta label="Due date" value={formatDateLabel(activity.dueDate, 'Not entered')} />
                      <ActivityMeta label="Accountable" value={activity.ownerLabel || 'Unassigned'} />
                      <ActivityMeta label="Indication" value={activity.indication} />
                      <ActivityMeta label="Created by" value={activity.createdBy} />
                      <ActivityMeta label="Last modified" value={formatDateLabel(activity.lastModifiedDate, 'Not entered')} />
                    </div>
                    {activity.comments ? (
                      <div className="home-bd-activity-comment">
                        <span>Comments</span>
                        <p>{activity.comments}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="home-bd-activities-empty">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>{rows.length ? `No ${activityFilter} activities` : 'No linked critical activities'}</strong>
            <p>
              {rows.length
                ? `This ${record?.type?.toLowerCase() || 'record'} has no activities in this view.`
                : `This ${record?.type?.toLowerCase() || 'record'} does not have any active or completed activities yet.`}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
