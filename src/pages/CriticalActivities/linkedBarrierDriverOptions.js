const barrierDriverStatusKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const isClosedBarrierDriverStatusValue = (value) => {
  const key = barrierDriverStatusKey(value);
  return key === 'close' || key === 'closed' || key === 'complete' || key === 'completed';
};

const sameRecordId = (left, right) => {
  const leftId = String(left || '').trim();
  const rightId = String(right || '').trim();
  if (!leftId || !rightId) return false;
  if (leftId === rightId) return true;
  const isSalesforceId = (value) => /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/.test(value);
  return isSalesforceId(leftId) &&
    isSalesforceId(rightId) &&
    leftId.slice(0, 15) === rightId.slice(0, 15);
};

export const isCompletedCriticalActivityStatusValue = (value) => {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return key === 'complete' || key === 'completed' || key === 'closed';
};

export const optionForId = (options, id) =>
  (options || []).find((option) => option && sameRecordId(option.id, id)) || null;

export const mergeBarrierDriverOptionsWithActivityParents = (options, activities) => {
  const merged = [...(options || [])];

  for (const activity of activities || []) {
    const id = activity?.barrierDriverId;
    if (!id || optionForId(merged, id)) continue;

    merged.push({
      id,
      type: activity?.parentType || '',
      name: activity?.parentName || 'Linked record',
      indication: activity?.indication || '',
      status: activity?.parentStatus || '',
      recordTypeId: activity?.parentRecordTypeId || '',
      isRecoveredFromActivity: true,
    });
  }

  return merged;
};

export const isOpenBarrierDriverOption = (option) =>
  Boolean(option?.id) && !isClosedBarrierDriverStatusValue(option?.status);

export const criticalActivityClosedParentEditReason = (activity, parentRecord) => {
  if (!activity?.barrierDriverId || !parentRecord?.id) return '';
  return isOpenBarrierDriverOption(parentRecord) ||
    isCompletedCriticalActivityStatusValue(activity.status)
    ? ''
    : 'Reopen linked Barrier/Driver before editing this critical activity.';
};

export const linkedBarrierDriverSelectOptions = (options, currentParentId = '') => {
  const currentId = String(currentParentId || '');
  const openOptions = [];
  const seen = new Set();
  let currentClosedSelection = null;

  for (const option of options || []) {
    if (!option?.id || seen.has(option.id)) continue;
    seen.add(option.id);

    if (isOpenBarrierDriverOption(option)) {
      openOptions.push({ ...option, isCurrentClosedSelection: false });
      continue;
    }

    if (currentId && sameRecordId(option.id, currentId)) {
      currentClosedSelection = { ...option, isCurrentClosedSelection: true };
    }
  }

  return currentClosedSelection
    ? [currentClosedSelection, ...openOptions]
    : openOptions;
};
