export default function TableSortButton({
  column,
  sort,
  onSort,
  className = 'table-sort-button',
  labelClassName = 'table-sort-label',
  arrowClassName = 'activity-sort-arrow',
}) {
  const isActive = sort && sort.key === column.key;
  const direction = isActive ? sort.direction : '';
  const accessibleLabel = column.ariaLabel || column.label;

  return (
    <button
      type="button"
      className={className}
      onClick={() => onSort(column.key)}
      aria-label={`Sort by ${accessibleLabel}`}
      aria-pressed={!!isActive}
      data-sort-key={column.key}
      data-sort-direction={direction || 'none'}
      title={accessibleLabel}
    >
      <span className="table-sort-copy">
        <span className={labelClassName}>{column.label}</span>
        {column.help && <small>{column.help}</small>}
      </span>
      <i className={`${arrowClassName} ${direction}`} aria-hidden="true" />
    </button>
  );
}
