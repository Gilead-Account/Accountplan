const FALLBACK_CRITICAL_ACTIVITY_SAVE_ERROR = 'Unable to save critical activity.';

const normalizeErrorForDisplay = (value, seen = new Set()) => {
  if (value == null) return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (value instanceof Error) {
    const normalized = {
      name: value.name,
      message: value.message,
    };
    if (value.stack) normalized.stack = value.stack;
    if (value.cause) normalized.cause = normalizeErrorForDisplay(value.cause, seen);
    Object.keys(value).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(normalized, key)) {
        normalized[key] = normalizeErrorForDisplay(value[key], seen);
      }
    });
    return normalized;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeErrorForDisplay(entry, seen));
  }

  return Object.keys(value).reduce((normalized, key) => {
    normalized[key] = normalizeErrorForDisplay(value[key], seen);
    return normalized;
  }, {});
};

const exactErrorText = (error) => {
  if (typeof error === 'string') return error.trim();
  try {
    return JSON.stringify(normalizeErrorForDisplay(error), null, 2);
  } catch {
    return String(error || '').trim();
  }
};

const primaryErrorMessage = (error) => {
  if (typeof error === 'string') return error.trim();
  return (
    error?.message ||
    error?.errorMessage ||
    error?.msg ||
    FALLBACK_CRITICAL_ACTIVITY_SAVE_ERROR
  );
};

export const formatCriticalActivitySaveError = (error) => {
  const summary = primaryErrorMessage(error);
  const exact = exactErrorText(error);
  if (!exact || exact === summary) return summary;
  return `${summary}\n\nExact error:\n${exact}`;
};
