export const optionsWithTransientValue = (current, options) => {
  const seen = new Set();
  const values = [];
  const source = (options || []).filter(Boolean);
  const orderedValues = current && !source.includes(current)
    ? [current, ...source]
    : source;

  for (const value of orderedValues) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }

  return values;
};
