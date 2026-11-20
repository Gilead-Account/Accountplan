import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { loadPostLaunchReach, savePostLaunchChecklistItem } from '@/lib/dataservice/accountPlan/postCallExecution';
import {
  CHECKLIST_COMMENT_LIMIT, CHECKLIST_FUNCTIONS, CHECKLIST_STATUSES,
  calculateTrifecta, calendarDay, formatChecklistDate, sortChecklistItems,
} from '@/lib/postLaunchChecklist';
import './PostCallExecution.css';

const COLUMNS = [
  ['description', 'Checklist Item'], ['accountable', 'Accountable'], ['dueDate', 'Due Date'],
  ['status', 'Status'], ['comments', 'Comments'],
];
const RESOURCES = [
  ['Post Launch Checklist Guide', 'Checklist guide'], ['CE / Marketing', 'IVA BTEs'],
  ['Market Access', 'Billing, P&T'], ['Marketing ops', 'New Approvals'],
];

function ChecklistRow({ item, isReadOnly, onItemChange }) {
  const fieldId = useId();
  const [status, setStatus] = useState(item.status);
  const [draft, setDraft] = useState(item.comments);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentSaved, setCommentSaved] = useState(false);
  const savedComment = useRef(item.comments);
  const statusPending = useRef(false);
  const commentPending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!statusPending.current) setStatus(item.status);
  }, [item.status]);
  useEffect(() => {
    if (commentPending.current) return;
    const previous = savedComment.current;
    savedComment.current = item.comments;
    setDraft((current) => current === previous ? item.comments : current);
  }, [item.comments]);

  const saveStatus = async (value) => {
    if (isReadOnly || statusPending.current || value === status) return;
    const previous = status;
    statusPending.current = true;
    setStatus(value);
    setSavingStatus(true);
    setStatusError('');
    try {
      const patch = await savePostLaunchChecklistItem(item, { status: value });
      onItemChange(item.id, patch);
    } catch {
      if (mounted.current) {
        setStatus(previous);
        setStatusError('Status was not saved. Select the status again to retry.');
      }
    } finally {
      statusPending.current = false;
      if (mounted.current) setSavingStatus(false);
    }
  };

  const saveComment = async () => {
    if (isReadOnly || commentPending.current || draft === savedComment.current) return;
    const value = draft;
    commentPending.current = true;
    setSavingComment(true);
    setCommentError('');
    setCommentSaved(false);
    try {
      const patch = await savePostLaunchChecklistItem(item, { comments: value });
      savedComment.current = value;
      onItemChange(item.id, patch);
      if (mounted.current) setCommentSaved(true);
    } catch {
      if (mounted.current) setCommentError('Comment was not saved. Your text is retained. Try again.');
    } finally {
      commentPending.current = false;
      if (mounted.current) setSavingComment(false);
    }
  };

  return (
    <tr className={status === 'Completed' ? 'plc-row-completed' : ''}>
      <td data-label="Checklist Item" className="plc-task"><span>{item.description}</span></td>
      <td data-label="Accountable">{item.accountable || <span className="plc-missing">Not provided</span>}</td>
      <td data-label="Due Date" className="plc-date">{formatChecklistDate(item.dueDate)}</td>
      <td data-label="Status">
        <label className="plc-sr-only" htmlFor={`${fieldId}-status`}>Status for {item.description}</label>
        <div className="plc-status-control">
          <select id={`${fieldId}-status`} className={`plc-status ${status === 'Completed' ? 'is-completed' : ''}`}
            value={status} disabled={isReadOnly || savingStatus}
            aria-describedby={`${fieldId}-status-message`} aria-invalid={Boolean(statusError)}
            onChange={(event) => saveStatus(event.target.value)}>
            {CHECKLIST_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <span className="plc-status-chevron" aria-hidden="true" />
        </div>
        <span id={`${fieldId}-status-message`} className="plc-field-message" role="status">
          {savingStatus ? 'Saving status…' : ''}
        </span>
        {statusError && <p className="plc-error" role="alert">{statusError}</p>}
      </td>
      <td data-label="Comments" className="plc-comment-cell">
        <label className="plc-sr-only" htmlFor={`${fieldId}-comments`}>Comments for {item.description}</label>
        <textarea id={`${fieldId}-comments`} rows={2} maxLength={CHECKLIST_COMMENT_LIMIT}
          value={draft} disabled={isReadOnly || savingComment} placeholder="Add comments"
          aria-describedby={`${fieldId}-comment-help${commentError ? ` ${fieldId}-comment-error` : ''}`}
          aria-invalid={Boolean(commentError)}
          onChange={(event) => { setDraft(event.target.value); setCommentSaved(false); setCommentError(''); }}
          onBlur={saveComment} />
        <div className={`plc-comment-meta${savingComment || commentSaved || commentError || draft !== savedComment.current ? ' is-active' : ''}`} id={`${fieldId}-comment-help`}>
          <span role="status">{savingComment ? 'Saving comment…' : draft !== savedComment.current ? 'Unsaved · saves on blur' : commentSaved ? 'Saved' : isReadOnly ? 'View only' : 'Saves on blur'}</span>
          <span>{draft.length}/{CHECKLIST_COMMENT_LIMIT}</span>
        </div>
        {commentError && <div className="plc-error" id={`${fieldId}-comment-error`} role="alert">
          <p>{commentError}</p>
          <button type="button" className="plc-text-button" onClick={saveComment} disabled={isReadOnly || savingComment}>Retry comment save</button>
        </div>}
      </td>
    </tr>
  );
}

function DashboardIcon({ type }) {
  return (
    <span className="plc-metric-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {type === 'reach' && <><circle cx="8" cy="7" r="3" /><circle cx="17" cy="8" r="2.6" /><path d="M2.5 20c.4-4.3 2.3-6.5 5.5-6.5s5.1 2.2 5.5 6.5M14 14c3.9-1.4 6.8.8 7.5 6" /></>}
        {type === 'message' && <><path d="M3 4h18v13H11l-5 4v-4H3z" /><path d="M7 10h.01M12 10h.01M17 10h.01" /></>}
        {type === 'certification' && <><rect x="2" y="5" width="20" height="15" rx="1.5" /><path d="m3 6 9 8 9-8" /></>}
        {type === 'apheresis' && <><path d="m3 21 7-15 5 9 2-5 4 11zM15 13V2m0 0h6l-3 3 3 3h-6" /><path d="m8 10 2 4 2-3" /></>}
      </svg>
    </span>
  );
}

function GuidanceResources() {
  return (
    <aside className="plc-resources" aria-labelledby="plc-resources-title">
      <h3 id="plc-resources-title"><span className="plc-resource-book" aria-hidden="true" />Guidance &amp; Resources</h3>
      <ul className="plc-resource-list">{RESOURCES.map(([category, description], index) => <li key={category} className={`plc-resource plc-resource-${index}`}>
        <span className="plc-resource-name">{category}<span className="plc-sr-only">: {description}</span></span>
        <span className="plc-resource-unavailable">Work in Progress</span>
      </li>)}</ul>
    </aside>
  );
}

function Dashboard({ items, planId, milestones = {} }) {
  const [reach, setReach] = useState({ planId, status: 'loading' });
  useEffect(() => {
    let active = true;
    setReach({ planId, status: 'loading' });
    loadPostLaunchReach(planId).then(
      (value) => { if (active) setReach({ planId, status: 'ready', ...value }); },
      () => { if (active) setReach({ planId, status: 'error' }); }
    );
    return () => { active = false; };
  }, [planId]);
  const currentReach = reach.planId === planId ? reach : { status: 'loading' };
  const trifecta = calculateTrifecta(items);
  const certificationDate = calendarDay(milestones.mmCertificationDate) !== null
    ? formatChecklistDate(milestones.mmCertificationDate).replaceAll('/', '-') : null;
  const certificationUnavailable = milestones.mmCertificationDateStatus === 'unavailable';
  const firstApheresis = milestones.firstApheresis === true ? 'Yes'
    : milestones.firstApheresis === false ? 'No' : String(milestones.firstApheresis || '').trim();
  return (
    <div className="plc-dashboard" role="region" aria-label="Post-launch dashboard and resources">
      <article className="plc-metric">
        <div className="plc-metric-heading"><h3>Reach to MM CAR T treaters</h3><DashboardIcon type="reach" /></div>
        <div className="plc-metric-value" role="status">
          {currentReach.status === 'ready' ? <>{currentReach.reached} <span>of {currentReach.total}</span></> : <><span aria-hidden="true">— of —</span><span className="plc-sr-only">{currentReach.status === 'loading' ? 'Loading treater reach' : 'Treater reach unavailable. Could not load call or stakeholder data.'}</span></>}
        </div>
        <p className={currentReach.status === 'error' ? 'plc-kpi-error' : 'plc-sr-only'}>{currentReach.status === 'error' ? 'Reach unavailable' : currentReach.status === 'loading' ? 'Loading reach…' : 'Eligible treaters reached in the last 60 days'}</p>
      </article>
      <article className="plc-metric">
        <div className="plc-metric-heading"><h3>“Trifecta” message to MM CAR T treaters</h3><DashboardIcon type="message" /></div>
        <div className="plc-metric-value">{trifecta.completed} <span>of {trifecta.total}</span></div>
        <p className="plc-sr-only">Configured checklist activities completed</p>
      </article>
      <article className="plc-metric">
        <div className="plc-metric-heading"><h3>MM Certification Date</h3><DashboardIcon type="certification" /></div>
        <div className="plc-metric-value is-milestone" aria-label={certificationDate ? undefined : certificationUnavailable ? 'MM certification date unavailable' : 'MM certification date not provided'}>{certificationDate || '—'}</div>
        {certificationUnavailable && <p className="plc-kpi-error" role="status">Certification date unavailable</p>}
      </article>
      <article className="plc-metric">
        <div className="plc-metric-heading"><h3>1st Aph</h3><DashboardIcon type="apheresis" /></div>
        <div className="plc-metric-value is-milestone" aria-label={firstApheresis ? undefined : 'First apheresis unavailable'}>{firstApheresis || '—'}</div>
      </article>
      <GuidanceResources />
    </div>
  );
}

export default function PostCallExecution({ data, onItemChange, isReadOnly = false }) {
  const items = data.checklistItems || [];
  const [sort, setSort] = useState({ key: 'dueDate', direction: 'asc' });
  const visibleItems = useMemo(() => sortChecklistItems(items.filter((item) => item.functionName === CHECKLIST_FUNCTIONS[0]), sort.key, sort.direction), [items, sort]);
  const completed = visibleItems.filter((item) => item.status === 'Completed').length;
  const selectSort = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));

  return (
    <section className="page page-post-launch" aria-labelledby="plc-title">
      <h2 id="plc-title" className="plc-sr-only">Post Launch Checklist</h2>
      {isReadOnly && <p className="plc-readonly" role="status">This account plan is view only. Checklist updates are unavailable.</p>}
      <Dashboard items={items} planId={data.planId} milestones={data.milestones || {}} />
      <section className="plc-checklist-panel" aria-label="Account checklist">
        {visibleItems.length === 0 ? <div className="plc-empty">No checklist items are available for this Account.</div> : <div className="plc-table-container">
          <table className="plc-table" aria-label="Post Launch Checklist">
            <caption className="plc-sr-only">{completed} of {visibleItems.length} completed. Status changes save immediately. Comments save when you leave the field.</caption>
            <thead><tr>{COLUMNS.map(([key, label]) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}>
              <button type="button" onClick={() => selectSort(key)}>{label}<span className={`plc-sort-indicator${sort.key === key && sort.direction === 'desc' ? ' is-descending' : ''}`} aria-hidden="true" /></button>
            </th>)}</tr></thead>
            <tbody>{visibleItems.map((item) => <ChecklistRow key={item.id} item={item} isReadOnly={isReadOnly} onItemChange={onItemChange} />)}</tbody>
          </table>
        </div>}
      </section>
    </section>
  );
}
