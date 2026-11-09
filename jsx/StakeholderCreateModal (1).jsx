import { useEffect, useState } from 'react';
import AccountLookupField from '@/pages/AccountProfile/AccountLookupField';

// Scenario 1: modal mirrors the Veeva "new Account" screens.
// Field list + max lengths come from the Stakeholder Mapping sheet.
const FIRST_NAME_MAX = 40;
const LAST_NAME_MAX = 80;

const buildEmptyForm = (defaultCountry = '') => ({
  salutation: '',
  firstName: '',
  lastName: '',
  credential: '',
  country: defaultCountry,
  useParent: true, // "Create from existing parent account?"
  primaryParent: '',
  primaryParentId: '',
  addressId: '',
});

// Pure validation so it is easy to unit test. Returns { field: message }.
export const validateCreateForm = (form, addresses = []) => {
  const errors = {};
  const text = (v) => String(v || '').trim();
  if (!text(form.lastName)) errors.lastName = 'Last Name is required.';
  else if (text(form.lastName).length > LAST_NAME_MAX) errors.lastName = `Max ${LAST_NAME_MAX} characters.`;
  if (text(form.firstName).length > FIRST_NAME_MAX) errors.firstName = `Max ${FIRST_NAME_MAX} characters.`;
  if (!text(form.credential)) errors.credential = 'Credential is required.';
  if (!text(form.country)) errors.country = 'Country is required.';
  if (form.useParent) {
    if (!form.primaryParentId) errors.primaryParent = 'Select a Primary Parent from the search results.';
    else if (addresses.length > 0 && !form.addressId) errors.address = 'At least one address must be selected.';
    else if (addresses.length === 0) errors.address = 'The selected parent has no address to copy.';
  }
  return errors;
};

function Field({ id, label, required, error, children }) {
  return (
    <div className={`stakeholder-edit-field${required ? ' is-required' : ''}${error ? ' has-error' : ''}`}>
      <div className="stakeholder-edit-field-label-row">
        <label className="stakeholder-edit-field-label" htmlFor={id}>
          {label}
        </label>
      </div>
      {children}
      {error && <small className="stakeholder-field-error">{error}</small>}
    </div>
  );
}

function SelectField({ id, label, required, error, value, options, onChange }) {
  const merged = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <Field id={id} label={label} required={required} error={error}>
      <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">--None--</option>
        {merged.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </Field>
  );
}

export default function StakeholderCreateModal({
  salutationOptions = [],
  credentialOptions = [],
  countryOptions = [],
  defaultCountry = 'US',
  searchSites, // Scenario 2: parent lookup (existing searchSiteAccounts)
  loadAddresses, // Scenario 2: fetchParentAddresses(parentId)
  onClose,
  onCreate, // Scenario 3: createStakeholderAccount(payload) -> account option
}) {
  const [form, setForm] = useState(() =>
    buildEmptyForm(countryOptions.includes(defaultCountry) ? defaultCountry : '')
  );
  const [addresses, setAddresses] = useState([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const errors = validateCreateForm(form, addresses);
  const show = (key) => (submitted ? errors[key] : '');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, isSaving]);

  // Load the parent's addresses whenever a parent is picked.
  useEffect(() => {
    let cancelled = false;
    if (!form.useParent || !form.primaryParentId || !loadAddresses) {
      setAddresses([]);
      return undefined;
    }
    setIsLoadingAddresses(true);
    Promise.resolve(loadAddresses(form.primaryParentId))
      .then((rows) => {
        if (cancelled) return;
        const list = rows || [];
        setAddresses(list);
        // Auto-select the primary (or only) address, like the Veeva screen.
        const preferred = list.find((a) => a.primary) || (list.length === 1 ? list[0] : null);
        setForm((f) => ({ ...f, addressId: preferred ? preferred.id : '' }));
      })
      .catch(() => !cancelled && setAddresses([]))
      .finally(() => !cancelled && setIsLoadingAddresses(false));
    return () => {
      cancelled = true;
    };
  }, [form.useParent, form.primaryParentId, loadAddresses]);

  const set = (key) => (value) => {
    setSaveError('');
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setSaveError('');
    if (Object.keys(errors).length) return;
    setIsSaving(true);
    try {
      const address = addresses.find((a) => a.id === form.addressId) || null;
      await onCreate({
        salutation: form.salutation,
        firstName: form.firstName,
        lastName: form.lastName,
        credential: form.credential,
        country: form.country,
        primaryParentId: form.useParent ? form.primaryParentId : '',
        primaryParent: form.useParent ? form.primaryParent : '',
        address: form.useParent ? address : null,
      });
    } catch (error) {
      setSaveError(error?.message || 'Unable to create stakeholder.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="stakeholder-edit-overlay" onClick={isSaving ? undefined : onClose} role="presentation">
      <form className="stakeholder-edit-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} noValidate>
        <header className="stakeholder-edit-head">
          <div className="stakeholder-edit-title">
            <span className="stakeholder-edit-eyebrow">Stakeholder</span>
            <h3>Create Stakeholder</h3>
            <p>Create a new HCP account in Veeva CRM</p>
          </div>
          <button type="button" className="stakeholder-edit-close" onClick={isSaving ? undefined : onClose} aria-label="Close" disabled={isSaving} />
        </header>

        <div className="stakeholder-edit-body">
          <section className="stakeholder-edit-section">
            <div className="stakeholder-edit-section-head"><h4>Details</h4></div>
            <div className="stakeholder-edit-grid">
              <SelectField id="stk-new-salutation" label="Salutation" value={form.salutation} options={salutationOptions} onChange={set('salutation')} />
              <Field id="stk-new-first" label="First Name" error={show('firstName')}>
                <input id="stk-new-first" type="text" maxLength={FIRST_NAME_MAX} value={form.firstName} onChange={(e) => set('firstName')(e.target.value)} />
              </Field>
              <Field id="stk-new-last" label="Last Name" required error={show('lastName')}>
                <input id="stk-new-last" type="text" maxLength={LAST_NAME_MAX} value={form.lastName} onChange={(e) => set('lastName')(e.target.value)} />
              </Field>
              <SelectField id="stk-new-credential" label="Credential" required error={show('credential')} value={form.credential} options={credentialOptions} onChange={set('credential')} />
              <SelectField id="stk-new-country" label="Country" required error={show('country')} value={form.country} options={countryOptions} onChange={set('country')} />
            </div>
          </section>

          <section className="stakeholder-edit-section">
            <div className="stakeholder-edit-section-head"><h4>Parent Account and Address Information</h4></div>
            <label className="stakeholder-create-checkbox">
              <input
                type="checkbox"
                checked={form.useParent}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    useParent: e.target.checked,
                    ...(e.target.checked ? {} : { primaryParent: '', primaryParentId: '', addressId: '' }),
                  }))
                }
              />
              <span>Create from existing parent account?</span>
            </label>

            {form.useParent && (
              <>
                <div className={`stakeholder-create-lookup${show('primaryParent') ? ' has-error' : ''}`}>
                  <AccountLookupField
                    label="Primary Parent"
                    query={form.primaryParent}
                    placeholder="Search parent account"
                    searchAccounts={searchSites}
                    loadingText="Searching accounts..."
                    emptyText="No matches found."
                    className="stakeholder-site-lookup-field"
                    onQueryChange={(value) => setForm((f) => ({ ...f, primaryParent: value, primaryParentId: '', addressId: '' }))}
                    onSelect={(account) =>
                      setForm((f) => ({ ...f, primaryParent: account?.name || '', primaryParentId: account?.id || '', addressId: '' }))
                    }
                  />
                  {show('primaryParent') && <small className="stakeholder-field-error">{errors.primaryParent}</small>}
                </div>

                <p className="stakeholder-create-hint">Add an address from the list. At least one address must be selected.</p>
                <div className="stakeholder-create-address-wrap">
                  <table className="stakeholder-create-address-table">
                    <thead>
                      <tr><th>Select</th><th>Address</th><th>Address Type</th><th>Primary</th></tr>
                    </thead>
                    <tbody>
                      {isLoadingAddresses && <tr><td colSpan={4}>Loading addresses...</td></tr>}
                      {!isLoadingAddresses && addresses.length === 0 && (
                        <tr><td colSpan={4}>{form.primaryParentId ? 'No addresses found.' : 'Select a parent to see its addresses.'}</td></tr>
                      )}
                      {addresses.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <input type="radio" name="stk-new-address" aria-label={`Select ${a.display}`} checked={form.addressId === a.id} onChange={() => set('addressId')(a.id)} />
                          </td>
                          <td>{a.display}</td>
                          <td>{a.type || '-'}</td>
                          <td><input type="radio" checked={!!a.primary} readOnly disabled aria-label="Primary" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {show('address') && <small className="stakeholder-field-error">{errors.address}</small>}
                </div>
              </>
            )}
          </section>

          {saveError && <div className="critical-activity-edit-error">{saveError}</div>}
        </div>

        <footer className="stakeholder-edit-foot">
          <button type="button" className="stakeholder-edit-button-secondary" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" className="stakeholder-edit-button-primary" disabled={isSaving}>
            {isSaving ? 'Creating...' : 'Continue'}
          </button>
        </footer>
      </form>
    </div>
  );
}
