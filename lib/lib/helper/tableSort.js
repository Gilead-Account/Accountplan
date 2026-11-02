export const normalizeTableSortDirection = (direction) => (direction === 'desc' ? 'desc' : 'asc');

export const nextTableSort = (current, key) => ({
  key,
  direction:
    current && current.key === key && normalizeTableSortDirection(current.direction) === 'asc'
      ? 'desc'
      : 'asc',
});

export const toDateSortValue = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
};

const isEmptySortValue = (value) => value === null || value === undefined || value === '';

export const compareTableSortValues = (left, right, direction = 'asc') => {
  const leftEmpty = isEmptySortValue(left);
  const rightEmpty = isEmptySortValue(right);
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;

  const result =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });

  return normalizeTableSortDirection(direction) === 'desc' ? result * -1 : result;
};

export const stableSortRows = (rows, sort, valueForRow) => {
  const list = rows || [];
  if (!sort || !sort.key || typeof valueForRow !== 'function') return list;

  return list
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const result = compareTableSortValues(
        valueForRow(left.row, sort.key),
        valueForRow(right.row, sort.key),
        sort.direction
      );
      return result || left.index - right.index;
    })
    .map(({ row }) => row);
};
