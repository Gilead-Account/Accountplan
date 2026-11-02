import { activityIsOpen, recordIdMatches } from '../../lib/helper/utils.js';

const activityQualifiesForDriverPriority = (activity) => {
  const status = String(activity?.status || '').trim().toLowerCase();
  return activityIsOpen(activity) && status !== 'completed' && status !== 'closed';
};

const parseDueDate = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const parsed = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3])
      )
    : new Date(text);

  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed.getTime();
};

const COMPLETED_ACTIVITY_STATUSES = new Set(['complete', 'completed', 'closed']);

const priorityForActivity = (activity, todayTimestamp) => {
  const status = String(activity?.status || '').trim().toLowerCase();
  if (COMPLETED_ACTIVITY_STATUSES.has(status)) {
    return { group: 3, dueTimestamp: Number.POSITIVE_INFINITY };
  }

  const dueTimestamp = parseDueDate(activity?.dueDate);
  if (dueTimestamp === null) {
    return { group: 2, dueTimestamp: Number.POSITIVE_INFINITY };
  }
  return {
    group: dueTimestamp < todayTimestamp ? 0 : 1,
    dueTimestamp,
  };
};

export const sortActivitiesByCriticality = (activities, now = new Date()) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();

  return (activities || []).map((activity, index) => ({
    activity,
    index,
    priority: priorityForActivity(activity, todayTimestamp),
  }))
    .sort((left, right) => (
      left.priority.group - right.priority.group ||
      left.priority.dueTimestamp - right.priority.dueTimestamp ||
      left.index - right.index
    ))
    .map(({ activity }) => activity);
};

const priorityForRecord = (record, activities, todayTimestamp) => {
  let oldestOverdue = Number.POSITIVE_INFINITY;
  let nearestDue = Number.POSITIVE_INFINITY;
  let hasQualifyingActivity = false;

  for (const activity of activities) {
    if (
      !activityQualifiesForDriverPriority(activity) ||
      !recordIdMatches(activity.barrierDriverId, record?.id)
    ) continue;
    hasQualifyingActivity = true;

    const dueTimestamp = parseDueDate(activity.dueDate);
    if (dueTimestamp === null) continue;
    if (dueTimestamp < todayTimestamp) {
      oldestOverdue = Math.min(oldestOverdue, dueTimestamp);
    } else {
      nearestDue = Math.min(nearestDue, dueTimestamp);
    }
  }

  if (oldestOverdue !== Number.POSITIVE_INFINITY) {
    return { group: 0, dueTimestamp: oldestOverdue };
  }
  if (nearestDue !== Number.POSITIVE_INFINITY) {
    return { group: 1, dueTimestamp: nearestDue };
  }
  if (hasQualifyingActivity) {
    return { group: 2, dueTimestamp: Number.POSITIVE_INFINITY };
  }
  return { group: 3, dueTimestamp: Number.POSITIVE_INFINITY };
};

export const sortRecordsByCriticalActivityPriority = (
  records,
  activities,
  now = new Date()
) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();
  const activityRows = activities || [];

  return (records || []).map((record, index) => ({
    record,
    index,
    priority: priorityForRecord(record, activityRows, todayTimestamp),
  }))
    .sort((left, right) => (
      left.priority.group - right.priority.group ||
      left.priority.dueTimestamp - right.priority.dueTimestamp ||
      left.index - right.index
    ))
    .map(({ record }) => record);
};

export const sortDriversByCriticalActivityPriority = sortRecordsByCriticalActivityPriority;
