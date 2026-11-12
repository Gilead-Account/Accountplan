import { useEffect, useId, useRef, useState } from 'react';
import { FieldHelpButton } from '@/components/EditModalField';

const lookupMeta = (account) =>
  [account?.eid || account?.accountIdentifier, account?.territory].filter(Boolean).join(' | ');

const highlightLookupMatch = (value, query) => {
  const text = String(value || '');
  const term = String(query || '').trim();
  if (!term) return text;

  const parts = [];
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  let cursor = 0;
  let matchIndex = lowerText.indexOf(lowerTerm, cursor);

  while (matchIndex >= 0) {
    if (matchIndex > cursor) parts.push(text.slice(cursor, matchIndex));
    parts.push(
      <strong className="lookup-match" key={`${matchIndex}-${text.slice(matchIndex, matchIndex + term.length)}`}>
        {text.slice(matchIndex, matchIndex + term.length)}
      </strong>
    );
    cursor = matchIndex + term.length;
    matchIndex = lowerText.indexOf(lowerTerm, cursor);
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.length ? parts : text;
};

export default function AccountLookupField({
  label,
  query,
  placeholder,
  searchAccounts,
  onQueryChange,
  onSelect,
  loadingText = 'Searching accounts...',
  emptyText = 'No accounts found.',
  className = '',
  resultLimit = 25,
  required = true,
  disabled = false,
  highlightMatches = false,
  help = '',
  helpLabel,
}) {
  const inputId = useId();
  const rootRef = useRef(null);
  const requestRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current || rootRef.current.contains(event.target)) return;
      setOpen(false);
      setResults([]);
      setError('');
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError('');
    const timer = window.setTimeout(() => {
      Promise.resolve(searchAccounts ? searchAccounts(query || '', resultLimit) : [])
        .then((rows) => {
          if (requestRef.current !== requestId) return;
          setResults(rows || []);
          setLoading(false);
        })
        .catch((err) => {
          if (requestRef.current !== requestId) return;
          setResults([]);
          setLoading(false);
          setError(err?.message || 'Account search failed.');
        });
    }, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [open, query, searchAccounts, resultLimit]);

  const handleSelect = (account, event) => {
    event.preventDefault();
    event.stopPropagation();
    if (onSelect) onSelect(account);
    setOpen(false);
    setResults([]);
    setError('');
  };

  return (
    <div className={`stakeholder-edit-field account-profile-lookup-field ${className}`.trim()} ref={rootRef}>
      <div className="stakeholder-edit-field-label-row">
        <label className="stakeholder-edit-field-label" htmlFor={inputId}>
          {label}
        </label>
        {help && (
          <FieldHelpButton
            className="stakeholder-edit-field-help"
            label={helpLabel || `${label} guidance`}
            text={help}
          />
        )}
      </div>
      <div className={`lookup-combobox ${open ? 'is-open' : ''} ${loading ? 'is-loading' : ''}`.trim()}>
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          value={query || ''}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            if (onQueryChange) onQueryChange(event.target.value);
            setOpen(true);
          }}
        />
        {open && (
          <div className="lookup-results">
            {results.map((account) => (
              <button
                key={account.id}
                className="lookup-result"
                type="button"
                disabled={disabled}
                onMouseDown={(event) => handleSelect(account, event)}
                onClick={(event) => handleSelect(account, event)}
              >
                {highlightMatches ? (
                  <span className="lookup-result-name">
                    {highlightLookupMatch(account.name, query)}
                  </span>
                ) : (
                  <strong>{account.name}</strong>
                )}
                {lookupMeta(account) && <small>{lookupMeta(account)}</small>}
              </button>
            ))}
            {loading && <div className="lookup-empty">{loadingText}</div>}
            {!loading && !results.length && !error && <div className="lookup-empty">{emptyText}</div>}
            {error && <div className="lookup-empty error">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
