import { useContext, useEffect, useMemo, useState } from 'react';
import {
  BARRIER_DRIVER_STATUS_ORDER,
  barrierDriverUsesStrategy,
  categoryPrefix,
  filterBarrierDriverIndicationsForType,
  isBarrierDriverIndicationAllowedForType,
  isClosedBarrierDriverStatus,
} from '@/lib/dataservice/accountPlan/shared';
import { optionsForControllerValue } from '@/lib/dataservice/accountPlan/dependentPicklists';
import Field, { FieldHelpButton } from '@/components/EditModalField';
import { optionsWithTransientValue } from '@/pages/BarriersDrivers/barrierDriverModalOptions';
import { PotentialAtcContext } from '../../lib/dataservice/accountPlan/PotentialAtcContext';

const BARRIER_DRIVER_TITLE_MAX_LENGTH = 55;

const BARRIER_DRIVER_HELP = {
  title: 'Enter a concise description of the barrier or driver.',
  status: 'Indicates the current stage (e.g., identified, in progress, etc).',
  type: 'Read-only shows if record is a barrier or a driver.',
  indication: 'Select the relevant disease area this barrier or driver applies to.',
  strategy: 'Select the strategic focus aligned to this barrier or driver (e.g., Win Brand, Grow Class).',
  category: 'Classifies the barrier or driver by primary area for consistency and reporting.',
  businessImpact: 'Indicate the business impact',
  comments:
    'Provide relevant context or observations to help explain the barrier or driver and its impact on the account.',
  tacticalActionsGuide: 'Reference guidance on recommended actions aligned to the selected barrier or driver.',
};

const POTENTIAL_ATC_STRATEGY = 'Pre Activation Build Account Readiness';

const buildInitialForm = (record, defaultType, isPotentialAtc) => ({
  id: record?.id || null,
  type: record?.type || defaultType || 'Barrier',
  name: record?.name || '',
  status: record?.status || BARRIER_DRIVER_STATUS_ORDER[0],
  indication: record?.indication || (isPotentialAtc ? 'Portfolio' : ''),
  strategy: record?.strategy || (isPotentialAtc ? POTENTIAL_ATC_STRATEGY : ''),
  //strategy: barrierDriverUsesStrategy(record?.indication) ? (record?.strategy || '') : '',
  category: record?.categoryValue || record?.category || '',
  businessImpact: record?.businessImpact || '',
  comments: record?.comments || '',
});

const mergeOptions = (current, options) => {
  const seen = new Set();
  const out = [];
  for (const value of [current, ...(options || [])]) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

const restrictedOptions = (current, options) => {
  const source = (options || []).filter(Boolean);
  return source.length ? source : mergeOptions(current, source);
};

const firstOptionList = (...lists) => lists.find((list) => Array.isArray(list) && list.length) || [];

const categoryLabelForValue = (picklists, value) => {
  const labels = picklists?.categoryLabels;
  if (value && labels && typeof labels === 'object' && Object.prototype.hasOwnProperty.call(labels, value)) {
    return labels[value] || value;
  }
  return categoryPrefix(value) || value;
};

const categoryOptionItems = (picklists, current, options) => {
  const seen = new Set();
  const out = [];
  for (const value of [current, ...(options || [])]) {
    const label = categoryLabelForValue(picklists, value);
    if (!value || !label) continue;
    const key = String(label).trim().toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ value, label });
  }
  return out;
};

const strategyLabelForValue = (picklists, value) => {
  const labels = picklists?.strategyLabels;
  if (!value || !labels || typeof labels !== 'object') return value;
  return Object.prototype.hasOwnProperty.call(labels, value) ? (labels[value] || value) : value;
};

export default function BarrierDriverEditModal({
  record,
  defaultType,
  picklists,
  isSaving,
  error,
  onBarrierOpenReferencePdf,
  onDriverOpenReferencePdf,
  onClose,
  onOpenReferencePdf,
  onSave,
  modalClassName = '',
  hideSubtitle = false,
  headerSubtitle,
  children,
  isPotentialAtc,
}) {
  //const isPotentialAtc = useContext(PotentialAtcContext);
  const isEdit = !!record?.id;
  const kiteDataAdminStatusOnlyMode = isEdit && record?.isKiteDataAdminPreLaunch === true;
  const statusOnlyMode = isEdit && (
    isClosedBarrierDriverStatus(record?.status) || kiteDataAdminStatusOnlyMode
  );
  const nonStatusFieldsDisabled = statusOnlyMode || isSaving;
  const [form, setForm] = useState(buildInitialForm(record, defaultType, isPotentialAtc));
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setForm(buildInitialForm(record, defaultType,isPotentialAtc));
    setValidationError('');
  }, [record?.id, defaultType,isPotentialAtc]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSaving, onClose]);
  
 useEffect(() => {
  if (isPotentialAtc) {
    setForm(current => ({
      ...current,
      indication: current.indication || 'Portfolio',
      strategy: current.strategy || 'Pre Activation Build Account Readiness'
    }));
  }
}, [isPotentialAtc]);
  
  const statusOptions = picklists?.barrierStatuses || ['Open', 'Closed'];
  const hasIndication = !!form.indication;
  const usesStrategy = barrierDriverUsesStrategy(form.indication);
  const isDriver = form.type === 'Driver';
  const categoryOptionsByIndication = isDriver
    ? picklists?.driverCategoryOptionsByIndication
    : picklists?.barrierCategoryOptionsByIndication;
  const dependentStrategySource = optionsForControllerValue(
    picklists?.strategyOptionsByIndication,
    form.indication
  );
  const dependentCategorySource = optionsForControllerValue(
    categoryOptionsByIndication,
    form.indication
  );
  const strategySource = !usesStrategy
    ? []
    : dependentStrategySource ||
      firstOptionList(picklists?.barrierStrategies, picklists?.dlbclStrategies, picklists?.portfolioStrategies);
  const categorySource = !hasIndication
    ? []
    : dependentCategorySource ||
      (isDriver ? picklists?.dlbclDriverCategories : picklists?.dlbclBarrierCategories);
  // const indicationOptions = useMemo(
  //   () => filterBarrierDriverIndicationsForType(picklists?.barrierDriverIndications, form.type),
  //   [form.type, picklists?.barrierDriverIndications]
  // );
  const indicationOptions = useMemo(() => {
  const allOptions = filterBarrierDriverIndicationsForType( picklists?.barrierDriverIndications,form.type );
  return allOptions; // show all values for both conditions
  }, [form.type, picklists?.barrierDriverIndications]);

  // const strategyOptions = useMemo(
  //   () => (usesStrategy ? optionsWithTransientValue(form.strategy, strategySource || picklists?.barrierStrategies) : []),
  //   [form.strategy, strategySource, picklists?.barrierStrategies, usesStrategy]
  // );
const strategyOptions = useMemo(() => {
  const options =
    usesStrategy
      ? optionsWithTransientValue(
          form.strategy,
          strategySource || picklists?.barrierStrategies
        )
      : [];

  const filtered = options.filter(option => {
    const label = strategyLabelForValue(picklists, option);

    if (isPotentialAtc) {
      return label === 'Pre Activation Build Account Readiness';
    }

    return label !== 'Pre Activation Build Account Readiness';
  });

  const seenLabels = new Set();

  return filtered.filter(option => {
    const label = strategyLabelForValue(picklists, option);

    if (seenLabels.has(label)) {
      return false;
    }

    seenLabels.add(label);
    return true;
  });
}, [
  form.strategy,
  strategySource,
  picklists?.barrierStrategies,
  usesStrategy,
  isPotentialAtc,
  picklists
]);

  const categoryOptions = useMemo(
    () => restrictedOptions(form.category, categorySource || picklists?.barrierCategories),
    [form.category, categorySource, picklists?.barrierCategories]
  );

  // const categoryItems = useMemo(
  //   () => categoryOptionItems(picklists, form.category, categoryOptions),
  //   [picklists, form.category, categoryOptions]
  // );
 
const categoryItems = useMemo(() => {
  let items = categoryOptionItems(
    picklists,
    form.category,
    categoryOptions
  );

  if (!isPotentialAtc) {
    items = items.filter(item => {
      const label = String(item.label || '').trim().toLowerCase();

      return (
        label !== 'administration' &&
        label !== 'other'
      );
    });
  }

  return items;
}, [
  picklists,
  form.category,
  categoryOptions,
  isPotentialAtc
]);
  
  const impactOptions = useMemo(
    () => mergeOptions(form.businessImpact, picklists?.impactLevels),
    [form.businessImpact, picklists?.impactLevels]
  );

  const updateField = (key, value) => {
    setValidationError('');
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'indication') {
       next.strategy = isPotentialAtc
    ? 'Pre Activation Build Account Readiness'
    : '';
        next.category = current.category;
      }
      if (key === 'type') {
        next.category = '';
      }
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submission = usesStrategy ? form : { ...form, strategy: '', strategyRank: null, planStrategyId: null, isPotentialAtc };
    if (!submission.status) {
      setValidationError('Status is required.');
      return;
    }
    if (statusOnlyMode) {
      if (onSave) {
        onSave({
          id: form.id,
          type: form.type,
          status: form.status,
          statusOnlyUpdate: true,
          isPotentialAtc:isPotentialAtc
        });
      }
      return;
    }
    if (!submission.type) {
      setValidationError('Type is required.');
      return;
    }
    if (!submission.name.trim()) {
      setValidationError('Title is required.');
      return;
    }
    if (submission.name.trim().length > BARRIER_DRIVER_TITLE_MAX_LENGTH) {
      setValidationError(`Title must be ${BARRIER_DRIVER_TITLE_MAX_LENGTH} characters or fewer.`);
      return;
    }
    if (!submission.indication) {
      setValidationError('Indication is required.');
      return;
    }
    if (!isBarrierDriverIndicationAllowedForType(submission.type, submission.indication)) {
      setValidationError('MM indication is available for drivers only.');
      return;
    }
    if (usesStrategy && !submission.strategy) {
      setValidationError('Strategy is required.');
      return;
    }
    if (usesStrategy && strategyOptions.length && !strategyOptions.includes(submission.strategy)) {
      setValidationError('Select a valid strategy.');
      return;
    }
    if (!submission.category) {
      setValidationError('Category is required.');
      return;
    }
    if (categoryItems.length && !categoryItems.some((item) => item.value === submission.category)) {
      setValidationError('Select a valid category.');
      return;
    }
    if (!submission.businessImpact) {
      setValidationError('Business Impact is required.');
      return;
    }
    if (!submission.comments.trim()) {
      setValidationError('Comments are required.');
      return;
    }
    if (
  isPotentialAtc &&
  submission.strategy !==
    'Pre Activation Build Account Readiness'
) {
  setValidationError(
    'Invalid Strategy value.'
  );
  return;
}
    if (onSave) {
      onSave({
        ...submission,
        isPotentialAtc,
      });
    }
  };
 
  const typeLabel = form.type || 'Barrier';
  const typeLower = typeLabel.toLowerCase();
  const title = isEdit ? `Edit ${typeLabel}` : `New ${typeLabel}`;
  const subtitle = isEdit
    ? `${typeLabel} · ${form.name || 'Untitled'}`
    : `Create a new ${typeLower} for this account plan.`;
  const displayedSubtitle = headerSubtitle ?? subtitle;
  const statusOnlyMessage = kiteDataAdminStatusOnlyMode
    ? 'This Pre-launch Driver was created by Kite Data Admin. Only the Status field can be changed.'
    : `This ${typeLower} is Closed. Only the Status field can be changed. ` +
      `Reopen the ${typeLower} to edit other details.`;

  return (
    <>
    <div className="stakeholder-edit-overlay" onClick={isSaving ? undefined : onClose} role="presentation">
      <form
        className={`stakeholder-edit-modal bd-barrier-driver-modal ${modalClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="barrier-driver-modal-title"
      >
        <header className="stakeholder-edit-head">
          <div className="stakeholder-edit-title">
            <h3 id="barrier-driver-modal-title">{title}</h3>
            {!hideSubtitle ? <p>{displayedSubtitle}</p> : null}
          </div>
          <button
            type="button"
            className="stakeholder-edit-close"
            onClick={onClose}
            aria-label="Close"
            disabled={isSaving}
          />
        </header>

        <div className="stakeholder-edit-body">
          {statusOnlyMode ? (
            <div className="bd-status-only-note" role="status">
              {statusOnlyMessage}
            </div>
          ) : null}
          <section className="stakeholder-edit-section">
            <div className="stakeholder-edit-grid">
              <Field label="Title" help={BARRIER_DRIVER_HELP.title}>
                <input
                  type="text"
                  value={form.name}
                  maxLength={BARRIER_DRIVER_TITLE_MAX_LENGTH}
                  required
                  disabled={nonStatusFieldsDisabled}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </Field>

              <Field label="Status" help={BARRIER_DRIVER_HELP.status}>
                <select
                  value={form.status}
                  required
                  disabled={isSaving}
                  onChange={(e) => updateField('status', e.target.value)}
                >
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Type" help={BARRIER_DRIVER_HELP.type}>
                <input
                  type="text"
                  value={form.type}
                  readOnly
                  aria-readonly="true"
                  disabled={nonStatusFieldsDisabled}
                />
              </Field>

              <Field label="Indication" help={BARRIER_DRIVER_HELP.indication}>
                <select
                  value={form.indication}
                  required
                  disabled={nonStatusFieldsDisabled}
                  onChange={(e) => updateField('indication', e.target.value)}
                >
                  <option value="">Select indication</option>
                  {indicationOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Strategy" help={BARRIER_DRIVER_HELP.strategy}>
                {isPotentialAtc ? (
                  <input
                    type="text"
                     value={form.strategy}
                    disabled={nonStatusFieldsDisabled}
                    onChange={(e) =>
                      updateField('strategy', e.target.value)
                    }
                  />
                ) : (<select
                  value={form.strategy}
                  required
                  aria-required="true"
                  disabled={nonStatusFieldsDisabled || !usesStrategy}
                  onChange={(e) => updateField('strategy', e.target.value)}
                >
                  <option value="">
                    {!hasIndication
                      ? 'Select indication first'
                      : usesStrategy
                        ? 'Select strategy'
                        : 'Not applicable'}
                  </option>
                  {strategyOptions.map((option) => (
                    <option key={option} value={option}>
                      {strategyLabelForValue(picklists, option)}
                    </option>
                  ))}
                </select>
                )}
              </Field>

              <Field label="Category" help={BARRIER_DRIVER_HELP.category}>
                <select
                  value={form.category}
                  required
                  disabled={nonStatusFieldsDisabled || !hasIndication}
                  onChange={(e) => updateField('category', e.target.value)}
                >
                  <option value="">
                    {hasIndication ? 'Select category' : 'Select indication first'}
                  </option>
                  {categoryItems.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Business Impact" help={BARRIER_DRIVER_HELP.businessImpact}>
                <select
                  value={form.businessImpact}
                  required
                  disabled={nonStatusFieldsDisabled}
                  onChange={(e) => updateField('businessImpact', e.target.value)}
                >
                  <option value="">Select business impact</option>
                  {impactOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Comments" help={BARRIER_DRIVER_HELP.comments} className="is-textarea">
                <textarea
                  rows={4}
                  value={form.comments}
                  maxLength={1000}
                  required
                  disabled={nonStatusFieldsDisabled}
                  onChange={(e) => updateField('comments', e.target.value)}
                />
              </Field>
            </div>
          </section>
          {children}
          {(validationError || error) && (
            <div className="critical-activity-edit-error">{validationError || error}</div>
          )}
        </div>

        <footer className="stakeholder-edit-foot">
          {form.type === 'Barrier' && onBarrierOpenReferencePdf && (
            
            <div className="bd-reference-pdf-footer-group">
              <button
                type="button"
                className="bd-reference-pdf-footer-link"
                onClick={onBarrierOpenReferencePdf}
                disabled={isSaving}
              >
                View Barrier & Tactical Actions Guide
              </button>
              <FieldHelpButton
                label="View Tactical Actions Guide guidance"
                text={BARRIER_DRIVER_HELP.tacticalActionsGuide}
              />
            </div>
          )}
          { form.type === 'Driver' && onDriverOpenReferencePdf && (
            <div className="bd-reference-pdf-footer-group">
              <button
                type="button"
                className="bd-reference-pdf-footer-link"
                onClick={onDriverOpenReferencePdf}
                disabled={isSaving}
              >
                View Driver & Tactical Actions Guide
              </button>
              <FieldHelpButton
                label="View Tactical Actions Guide guidance"
                text={BARRIER_DRIVER_HELP.tacticalActionsGuide}
              />
            </div>
          )}
          {onOpenReferencePdf && (
            <div className="bd-reference-pdf-footer-group">
              <button
                type="button"
                className="bd-reference-pdf-footer-link"
                onClick={onOpenReferencePdf}
                disabled={isSaving}
              >
                View Tactical Actions Guide
              </button>
              <FieldHelpButton
                label="View Tactical Actions Guide guidance"
                text={BARRIER_DRIVER_HELP.tacticalActionsGuide}
              />
            </div>
          )}
          <button
            type="button"
            className="stakeholder-edit-button-secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button type="submit" className="stakeholder-edit-button-primary" disabled={isSaving}>
            {isSaving ? 'Saving' : statusOnlyMode ? 'Update Status' : 'Save'}
          </button>
        </footer>
      </form>
    </div>
    </>
  );
}
