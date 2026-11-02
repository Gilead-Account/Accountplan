import { useEffect, useRef, useState } from 'react';
import { FieldHelpButton } from '@/components/EditModalField';
import HomeFieldHelp from '@/components/HomeFieldHelp';
import { formatDate } from '@/lib/helper/utils';
import { salesforceRecordBaseUrl } from '@/lib/salesforceRecordLinks';
import {
  isSubmittedOrReassignedApprovalStatus,
  isSubmittedForApprovalStatus,
  isReviseAndResubmitStatus,
  SUBMITTED_FOR_APPROVAL_STATUS,
  REVISE_AND_RESUBMIT_STATUS,
} from '@/lib/accountPlanReadOnly';
import { deliverPreparedAccountPlanPdf } from '@/lib/export/accountPlanPdf';
import { PDF_MIME } from '@/lib/export/accountPlanPdfRenderer';
import PdfAllPagesViewer from '@/components/PdfAllPagesViewer';
import accountPlanUserGuidePdf from '@/assets/account-plan-user-guide.pdf?url';
import accountPlanningQualityRubricPdf from '@/assets/account-planning-quality-rubric.pdf?url';
import accountPlanLegalCompliancePdf from '@/assets/account-plan-legal-compliance-guidance.pdf?url';
import accountPlanningPlaybookPpt from '@/assets/account-planning-playbook.pdf?url';
import accountPlanningmdppdf from '@/assets/account-plan-approvel-Mdp.pdf?url';
import '@/styles/edit-modal.css';
import '@/components/Sidebar.css';

const EXPORT_MENU_OPTIONS = [
  { key: 'submit-mpd-approval', label: 'Submit for MPD Approval' },
  { key: 'export-ppt', label: 'Export to PPT' },
  { key: 'export-pdf', label: 'Export to PDF' },
  { key: 'executive-summary', label: 'Executive Summary' },
];

const MANAGER_APPROVAL_HISTORY_OPTION = { key: 'approval-history', label: 'Approval History' };
const MANAGER_REVIEW_OPTION = { key: 'review-approval', label: 'Review & Decide' };
const RECALL_APPROVAL_OPTION = { key: 'recall-approval', label: 'Recall' };
const MANAGER_APPROVAL_SECTION = { key: 'approval-section', label: 'Approvals', isSection: true };
const EXPORT_AND_SUBMIT_SECTION = { key: 'export-section', label: 'Export & Submit', isSection: true };

const COMPLIANCE_REMINDERS = [
  { text: 'This information is confidential and may not be disclosed externally.' },
  { text: 'For internal strategic planning purposes only.' },
  {
    text: 'Functions may align at a high level but remain responsible for their own tactics and must not direct or influence other functions.',
  },
  { text: 'All activities must comply with applicable legal, regulatory, and policy requirements.' },
  {
    text: 'For full compliance guidance, please refer to ',
    linkLabel: 'Compliance Atlas',
    linkUrl: 'https://gileadcomplianceatlas.com/kite',
  },
];

const HELP_GUIDANCE = [
  { text: 'Account Plan User Guide', opensUserGuide: true },
  { text: 'MPD Account Planning Approval', openMpdApproval:true,},
  { text: 'Account Planning Playbook', openPlaybook:true, tbd: true },
  { text: 'Account Planning Quality Rubric', opensQualityRubric: true },
  { text: 'Account Plan Legal & Compliance Guidance', opensComplianceGuidance: true },
  {
    text: 'Field Alignment Dashboard',
    linkUrl: 'https://gtp.gilead.com/#/site/Kite/views/FieldAlignmentDashboard_17845723815430/FieldAlignment?:iid=1',
  },
];


const HELP_AND_GUARDRAILS_INLINE_HELP = 'Help: User Guide';

const legacyAccountPlanRecordUrl = (planId, currentUserUsername) => {
  const id = String(planId || '').trim();
  const baseUrl = salesforceRecordBaseUrl('Account_Plan_vod__c', undefined, currentUserUsername);
  return id ? `${baseUrl}/${encodeURIComponent(id)}/view` : null;
};

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3.5v3M16 3.5v3" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" />
      <ellipse cx="12" cy="12" rx="4" ry="8.5" />
      <path d="M3.5 12h17" />
    </svg>
  );
}

function NavIcon({ pageKey }) {
  switch (pageKey) {
    case 'overview':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 11.5 12 4l8 7.5" />
          <path d="M6.5 10.5V20h11v-9.5" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    case 'barriers-drivers':
      // Opposing forces: an up arrow (driver) and a down arrow (barrier).
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M8 20V6" />
          <path d="M5 9l3-3 3 3" />
          <path d="M16 4v14" />
          <path d="M13 15l3 3 3-3" />
        </svg>
      );
    case 'critical-activities':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="4.5" y="4.5" width="15" height="15" rx="3" />
          <path d="m8 12.5 3 3 5-7" />
        </svg>
      );
    case 'linked-opportunities':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="M8.5 9h7" />
          <path d="M8.5 13h7" />
          <path d="M8.5 17h4" />
        </svg>
      );
    case 'kpi':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="8" r="3.2" />
          <path d="M6.5 19c.7-3.2 2.6-5 5.5-5s4.8 1.8 5.5 5" />
        </svg>
      );
    case 'account-insights':
      // Lightbulb — the "insight" metaphor.
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4.9 1 .9 1.7v.4h5.2v-.4c0-.7.3-1.3.9-1.7A6 6 0 0 0 12 3z" />
          <path d="M9.5 19h5" />
          <path d="M10.5 21.5h3" />
        </svg>
      );
    case 'stakeholders':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="9" cy="9" r="2.6" />
          <circle cx="16" cy="10" r="2.2" />
          <path d="M4.5 18c.7-3 2.2-4.5 4.5-4.5s3.8 1.5 4.5 4.5" />
          <path d="M13.5 17.5c.5-2 1.6-3.1 3.3-3.1 1.5 0 2.6 1 3.2 3.1" />
        </svg>
      );
    case 'team-members':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="5" y="5" width="14" height="14" rx="2.5" />
          <path d="M9 9h.01" />
          <path d="M15 9h.01" />
          <path d="M9 15h.01" />
          <path d="M15 15h.01" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
  }
}

const COMPLIANCE_PDF_TITLE = 'Account Plan Legal & Compliance Guidance';
const COMPLIANCE_PDF_FILE_NAME = 'account-plan-legal-compliance-guidance.pdf';
const USER_GUIDE_PDF_TITLE = 'Account Plan User Guide';
const USER_GUIDE_PDF_FILE_NAME = 'Account-Plan-User-Guide.pdf';
const ACCOUNT_PLAYBOOK_PDF_TITLE = 'Account Planning Playbook';
const ACCOUNT_PLAYBOOK_FILE_NAME = 'Account-Planning-Playbook.pdf';
const QUALITY_RUBRIC_PDF_TITLE = 'Account Planning Quality Rubric';
const QUALITY_RUBRIC_PDF_FILE_NAME = 'Account-Planning-Quality-Rubric.pdf';
const MPD_ACCOUNT_APPROVAL_PDF_TITLE = 'MPD Account Planning Approval';
const MPD_ACCOUNT_APPROVAL_FILE_NAME = 'MPD-Account-Planning-Approval.pdf';

const loadPdfBlob = async (src) => {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Unable to load PDF (${response.status}).`);
  }
  const sourceBlob = await response.blob();
  if (!sourceBlob.size) {
    throw new Error('The PDF file is empty.');
  }
  if (sourceBlob.type === PDF_MIME) return sourceBlob;
  return new Blob([await sourceBlob.arrayBuffer()], { type: PDF_MIME });
};

function UserGuidePdfModal({ onClose }) {
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const handleSavePdf = async () => {
    if (isSavingPdf) return;
    setIsSavingPdf(true);
    setSaveError('');
    try {
      const blob = await loadPdfBlob(accountPlanUserGuidePdf);
      await deliverPreparedAccountPlanPdf({
        blob,
        fileName: USER_GUIDE_PDF_FILE_NAME,
        pageCount: null,
        slideCount: null,
        title: USER_GUIDE_PDF_TITLE,
      }, {
        directShare: true,
      });
    } catch (error) {
      setSaveError(error?.message || 'Unable to save PDF.');
    } finally {
      setIsSavingPdf(false);
    }
  };

  return (
    <div className="bd-reference-pdf-overlay" onClick={onClose} role="presentation">
      <section
        className="bd-reference-pdf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="userGuidePdfTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="bd-reference-pdf-head">
          <h3 id="userGuidePdfTitle">{USER_GUIDE_PDF_TITLE}</h3>
          <div className="bd-reference-pdf-actions">
            <button
              type="button"
              className="button secondary bd-reference-pdf-save"
              onClick={handleSavePdf}
              disabled={isSavingPdf}
            >
              {isSavingPdf ? 'Saving PDF...' : 'Save PDF'}
            </button>
            <button
              type="button"
              className="bd-reference-pdf-close"
              onClick={onClose}
              aria-label={`Close ${USER_GUIDE_PDF_TITLE} PDF`}
            />
          </div>
        </header>
        {saveError && (
          <div className="bd-reference-pdf-error" role="alert">
            {saveError}
          </div>
        )}
        <div className="bd-reference-pdf-body">
          <PdfAllPagesViewer
            src={accountPlanUserGuidePdf}
            className="user-guide-pdf-viewer"
          />
        </div>
      </section>
    </div>
  );
}

function MpdAccountPlanApproval({ onClose }) {
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const handleSavePdf = async () => {
    if (isSavingPdf) return;
    setIsSavingPdf(true);
    setSaveError('');
    try {
      const blob = await loadPdfBlob(accountPlanUserGuidePdf);
      await deliverPreparedAccountPlanPdf({
        blob,
        fileName: MPD_ACCOUNT_APPROVAL_FILE_NAME,
        pageCount: null,
        slideCount: null,
        title: MPD_ACCOUNT_APPROVAL_PDF_TITLE,
      }, {
        directShare: true,
      });
    } catch (error) {
      setSaveError(error?.message || 'Unable to save PDF.');
    } finally {
      setIsSavingPdf(false);
    }
  };

  return (
    <div className="bd-reference-pdf-overlay" onClick={onClose} role="presentation">
      <section
        className="bd-reference-pdf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="userGuidePdfTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="bd-reference-pdf-head">
          <h3 id="userGuidePdfTitle">{MPD_ACCOUNT_APPROVAL_PDF_TITLE}</h3>
          <div className="bd-reference-pdf-actions">
            <button
              type="button"
              className="button secondary bd-reference-pdf-save"
              onClick={handleSavePdf}
              disabled={isSavingPdf}
            >
              {isSavingPdf ? 'Saving PDF...' : 'Save PDF'}
            </button>
            <button
              type="button"
              className="bd-reference-pdf-close"
              onClick={onClose}
              aria-label={`Close ${MPD_ACCOUNT_APPROVAL_PDF_TITLE} PDF`}
            />
          </div>
        </header>
        {saveError && (
          <div className="bd-reference-pdf-error" role="alert">
            {saveError}
          </div>
        )}
        <div className="bd-reference-pdf-body">
          <PdfAllPagesViewer
            src={accountPlanningmdppdf}
            className="user-guide-pdf-viewer"
          />
        </div>
      </section>
    </div>
  );
}


function AccountPlayBookPdfModal({ onClose }) {
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const handleSavePdf = async () => {
    if (isSavingPdf) return;
    setIsSavingPdf(true);
    setSaveError('');
    try {
      const blob = await loadPdfBlob(accountPlanningPlaybookPpt);
      await deliverPreparedAccountPlanPdf({
        blob,
        fileName: ACCOUNT_PLAYBOOK_FILE_NAME,
        pageCount: null,
        slideCount: null,
        title: ACCOUNT_PLAYBOOK_PDF_TITLE,
      }, {
        directShare: true,
      });
    } catch (error) {
      setSaveError(error?.message || 'Unable to save PDF.');
    } finally {
      setIsSavingPdf(false);
    }
  };

  return (
    <div className="bd-reference-pdf-overlay" onClick={onClose} role="presentation">
      <section
        className="bd-reference-pdf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="userGuidePdfTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="bd-reference-pdf-head">
          <h3 id="userGuidePdfTitle">{ACCOUNT_PLAYBOOK_PDF_TITLE}</h3>
          <div className="bd-reference-pdf-actions">
            <button
              type="button"
              className="button secondary bd-reference-pdf-save"
              onClick={handleSavePdf}
              disabled={isSavingPdf}
            >
              {isSavingPdf ? 'Saving PDF...' : 'Save PDF'}
            </button>
            <button
              type="button"
              className="bd-reference-pdf-close"
              onClick={onClose}
              aria-label={`Close ${ACCOUNT_PLAYBOOK_PDF_TITLE} PDF`}
            />
          </div>
        </header>
        {saveError && (
          <div className="bd-reference-pdf-error" role="alert">
            {saveError}
          </div>
        )}
        <div className="bd-reference-pdf-body">
          <PdfAllPagesViewer
            src={accountPlanningPlaybookPpt}
            className="user-guide-pdf-viewer"
          />
        </div>
      </section>
    </div>
  );
}

function ComplianceGuidanceModal({ onClose }) {
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const handleSavePdf = async () => {
    if (isSavingPdf) return;
    setIsSavingPdf(true);
    setSaveError('');
    try {
      const blob = await loadPdfBlob(accountPlanLegalCompliancePdf);
      await deliverPreparedAccountPlanPdf({
        blob,
        fileName: COMPLIANCE_PDF_FILE_NAME,
        pageCount: null,
        slideCount: null,
        title: COMPLIANCE_PDF_TITLE,
      }, {
        directShare: true,
      });
    } catch (error) {
      setSaveError(error?.message || 'Unable to save PDF.');
    } finally {
      setIsSavingPdf(false);
    }
  };

  return (
    <div className="bd-reference-pdf-overlay" onClick={onClose} role="presentation">
      <section
        className="bd-reference-pdf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="complianceGuidanceTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="bd-reference-pdf-head">
          <h3 id="complianceGuidanceTitle">{COMPLIANCE_PDF_TITLE}</h3>
          <div className="bd-reference-pdf-actions">
            <button
              type="button"
              className="button secondary bd-reference-pdf-save"
              onClick={handleSavePdf}
              disabled={isSavingPdf}
            >
              {isSavingPdf ? 'Saving PDF...' : 'Save PDF'}
            </button>
            <button
              type="button"
              className="bd-reference-pdf-close"
              onClick={onClose}
              aria-label={`Close ${COMPLIANCE_PDF_TITLE} PDF`}
            />
          </div>
        </header>
        {saveError && (
          <div className="bd-reference-pdf-error" role="alert">
            {saveError}
          </div>
        )}
        <div className="bd-reference-pdf-body">
          <PdfAllPagesViewer
            src={accountPlanLegalCompliancePdf}
            className="compliance-pdf-viewer"
          />
        </div>
      </section>
    </div>
  );
}

function QualityRubricModal({ onClose }) {
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const handleSavePdf = async () => {
    if (isSavingPdf) return;
    setIsSavingPdf(true);
    setSaveError('');
    try {
      const blob = await loadPdfBlob(accountPlanningQualityRubricPdf);
      await deliverPreparedAccountPlanPdf({
        blob,
        fileName: QUALITY_RUBRIC_PDF_FILE_NAME,
        pageCount: null,
        slideCount: null,
        title: QUALITY_RUBRIC_PDF_TITLE,
      }, {
        directShare: true,
      });
    } catch (error) {
      setSaveError(error?.message || 'Unable to save PDF.');
    } finally {
      setIsSavingPdf(false);
    }
  };

  return (
    <div className="bd-reference-pdf-overlay" onClick={onClose} role="presentation">
      <section
        className="bd-reference-pdf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qualityRubricTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="bd-reference-pdf-head">
          <h3 id="qualityRubricTitle">{QUALITY_RUBRIC_PDF_TITLE}</h3>
          <div className="bd-reference-pdf-actions">
            <button
              type="button"
              className="button secondary bd-reference-pdf-save"
              onClick={handleSavePdf}
              disabled={isSavingPdf}
            >
              {isSavingPdf ? 'Saving PDF...' : 'Save PDF'}
            </button>
            <button
              type="button"
              className="bd-reference-pdf-close"
              onClick={onClose}
              aria-label={`Close ${QUALITY_RUBRIC_PDF_TITLE} PDF`}
            />
          </div>
        </header>
        {saveError && (
          <div className="bd-reference-pdf-error" role="alert">
            {saveError}
          </div>
        )}
        <div className="bd-reference-pdf-body">
          <PdfAllPagesViewer
            src={accountPlanningQualityRubricPdf}
            className="quality-rubric-pdf-viewer"
          />
        </div>
      </section>
    </div>
  );
}

export default function Sidebar({
  pages,
  activeKey,
  onNavigate,
  onPreloadPage,
  onExportPpt,
  onExportPdf,
  onExecutiveSummary,
  legacyAccountPlanId,
  currentUserUsername,
  onPrepareExports,
  onSubmitMpdApproval,
  onRecallApproval,
  onApprovalHistory,
  onReviewApproval,
  onApprovalHistoryForCtam,
  isMpdApprovalDisabled = false,
  isCtamManager = false,
  canRecallApproval = false,
  isExportingPpt = false,
  isExportingPdf = false,
  isPreparingPpt = false,
  isPreparingPdf = false,
  isReadOnly = false,
  plan,
  account,
}) {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isPolicyHelpOpen, setIsPolicyHelpOpen] = useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [isPlayBook, setIsPlayBook] = useState(false);
  const [isMdpApproval, setIsMdpApproval] = useState(false);
  const [isQualityRubricOpen, setIsQualityRubricOpen] = useState(false);
  const [isComplianceGuidanceOpen, setIsComplianceGuidanceOpen] = useState(false);
  const exportMenuRef = useRef(null);
  const policyHelpRef = useRef(null);
  const navPressRef = useRef(null);
  const lastPointerNavigationRef = useRef({ key: null, at: 0 });
  const accountName = (account && account.name) || (plan && plan.accountName) || 'Not entered';
  const eid = account && account.eid;
  const lastMpd = plan && plan.lastMpdApprovalDate;
  // Submitted for Approval / Revise and Resubmit surface the status text;
  // every other status (Approved, Recalled, Submitted But Not Approved by MPD,
  // unset) shows the actual Last MPD Review date.
  const lastMpdReviewValue = isSubmittedForApprovalStatus(plan?.approvalStatus)
    ? SUBMITTED_FOR_APPROVAL_STATUS
    : isReviseAndResubmitStatus(plan?.approvalStatus)
      ? REVISE_AND_RESUBMIT_STATUS
      : formatDate(lastMpd, 'Not entered');
  const territory = (plan && plan.territoryDescription) || (account && account.territory);
  const legacyAccountPlanUrl = legacyAccountPlanRecordUrl(legacyAccountPlanId, currentUserUsername);

  // Close the export dropdown when the user taps outside of it.
  useEffect(() => {
    if (!isExportMenuOpen) return;
    const onDocPointer = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDocPointer);
    return () => document.removeEventListener('pointerdown', onDocPointer);
  }, [isExportMenuOpen]);

  useEffect(() => {
    if (!isPolicyHelpOpen) return;
    const onDocPointer = (event) => {
      if (policyHelpRef.current && !policyHelpRef.current.contains(event.target)) {
        setIsPolicyHelpOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDocPointer);
    return () => document.removeEventListener('pointerdown', onDocPointer);
  }, [isPolicyHelpOpen]);

  const standardExportMenuOptions = isMpdApprovalDisabled
    ? EXPORT_MENU_OPTIONS.filter((option) => option.key !== 'submit-mpd-approval')
    : EXPORT_MENU_OPTIONS;

    const visibleExportMenuOptions =  [
      ...(canRecallApproval?[RECALL_APPROVAL_OPTION]:[]),
        MANAGER_APPROVAL_SECTION,
        MANAGER_APPROVAL_HISTORY_OPTION,

        ...(isCtamManager && isSubmittedForApprovalStatus(plan?.approvalStatus)
          ? [MANAGER_REVIEW_OPTION]
          : []),
        //...(isSubmittedForApprovalStatus(plan?.approvalStatus) ? [MANAGER_REVIEW_OPTION] : []),
        EXPORT_AND_SUBMIT_SECTION,
        ...standardExportMenuOptions,
      ];
  // const visibleExportMenuOptions = isCtamManager
  //   ? [
  //       MANAGER_APPROVAL_SECTION,
  //       MANAGER_APPROVAL_HISTORY_OPTION,
  //       ...(isSubmittedOrReassignedApprovalStatus(plan?.approvalStatus) ? [MANAGER_REVIEW_OPTION] : []),
  //       EXPORT_AND_SUBMIT_SECTION,
  //       ...standardExportMenuOptions,
  //     ]
  // : canRecallApproval
  //   ? [
  //       RECALL_APPROVAL_OPTION,
  //       ...standardExportMenuOptions,
  //     ]
  //   : standardExportMenuOptions;

  const handleExportOption = (option) => {
    if (option.key === 'submit-mpd-approval' && (isReadOnly || isMpdApprovalDisabled)) return;
    setIsExportMenuOpen(false);
    if (option.key === 'submit-mpd-approval' && onSubmitMpdApproval) {
      onSubmitMpdApproval();
      return;
    }
    if (option.key === 'recall-approval') {
      onRecallApproval?.();
      return;
    }
    if (option.key === 'approval-history') {
      onApprovalHistory?.();
      onApprovalHistoryForCtam?.();
      return;
    }
    if (option.key === 'review-approval') {
      onReviewApproval?.();
      return;
    }
    if (option.key === 'export-ppt' && onExportPpt) {
      onExportPpt();
      return;
    }
    if (option.key === 'export-pdf' && onExportPdf) {
      onExportPdf();
      return;
    }
    if (option.key === 'executive-summary') {
      onExecutiveSummary?.();
      return;
    }
  };

  const togglePolicyHelp = () => {
    setIsPolicyHelpOpen((v) => !v);
    setIsExportMenuOpen(false);
  };

  const navigateToPage = (page, source = 'click') => {
    if (!page.implemented) return;
    const now = Date.now();
    if (
      source === 'click' &&
      lastPointerNavigationRef.current.key === page.key &&
      now - lastPointerNavigationRef.current.at < 650
    ) {
      return;
    }
    if (source === 'pointer') {
      lastPointerNavigationRef.current = { key: page.key, at: now };
    }
    setIsPolicyHelpOpen(false);
    onNavigate(page.key);
  };

  const choosePage = (page) => {
    navigateToPage(page, 'click');
  };

  const handleNavPointerDown = (event, page) => {
    if (!page.implemented) return;
    if (event.button !== undefined && event.button !== 0) return;
    onPreloadPage?.(page.key);
    navPressRef.current = {
      pointerId: event.pointerId,
      key: page.key,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handleNavPointerUp = (event, page) => {
    const press = navPressRef.current;
    navPressRef.current = null;
    if (!press || press.pointerId !== event.pointerId || press.key !== page.key) return;
    const distance = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    if (distance > 14) return;
    navigateToPage(page, 'pointer');
  };

  const handleNavPointerCancel = (event) => {
    if (navPressRef.current?.pointerId === event.pointerId) {
      navPressRef.current = null;
    }
  };

  return (
    <aside className="shell-sidebar">
      <section className="sidebar-account-card">
        {/* Account header — name spans the full card width (no icon) and can
            wrap to 2 lines. EID sits below the name with an "EID" label. */}
        <div className="sidebar-account-card-head">
          <div className="sidebar-account-card-copy">
            <strong title={accountName}>{accountName}</strong>
            {eid && (
              <div className="sidebar-account-eid-row">
                <span>EID:</span>
                <small>{eid}</small>
              </div>
            )}
          </div>
        </div>

        {/* Last MPD Review Date + Territory stacked vertically (Last POD removed). */}
        <div className="sidebar-stat-card">
          <span className="sidebar-stat-icon" aria-hidden="true">
            <CalendarIcon />
          </span>
          <div className="sidebar-stat-copy">
            <span className="sidebar-stat-label">
              <span>Last MPD Review Date</span>
              <HomeFieldHelp
                helpKey="lastMpdApprovalDate"
                label="Last MPD Review Date"
                className="sidebar-stat-help"
              />
            </span>
            <strong>{lastMpdReviewValue}</strong>
          </div>
        </div>

        <div className="sidebar-stat-card">
          <span className="sidebar-stat-icon" aria-hidden="true">
            <GlobeIcon />
          </span>
          <div className="sidebar-stat-copy">
            <span>TERRITORY</span>
            <strong title={territory || ''}>{territory || 'Not entered'}</strong>
          </div>
        </div>
      </section>

      <div className="sidebar-nav-list">
        {pages.map((page) => {
          const isActive = page.key === activeKey;
          const isDisabled = !page.implemented;
        
          return (
            <button
              key={page.key}
              type="button"
              className={`rail-link${isActive ? ' active' : ''}${isDisabled ? ' disabled' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onPointerDown={(event) => handleNavPointerDown(event, page)}
              onPointerUp={(event) => handleNavPointerUp(event, page)}
              onPointerCancel={handleNavPointerCancel}
              onMouseEnter={() => onPreloadPage?.(page.key)}
              onClick={() => choosePage(page)}
              disabled={isDisabled}
              title={page.label}
            >
              <span
                className={`nav-icon nav-icon-${page.key}`}
                aria-hidden="true"
              >
                <NavIcon pageKey={page.key} />
              </span>
              <span className="rail-copy">
                <strong>{page.label}</strong>
              </span>
            </button>
          );
        })}
      </div>

      {legacyAccountPlanUrl && (
        <a
          className="sidebar-legacy-account-plan"
          href={legacyAccountPlanUrl}
          target="_top"
          aria-label="Open Legacy Account Plan record in CRM"
          onClick={() => {
            setIsPolicyHelpOpen(false);
            setIsExportMenuOpen(false);
          }}
        >
          Legacy Account Plan
        </a>
      )}

      <div className="sidebar-policy-help" ref={policyHelpRef}>
        <div className={`sidebar-policy-help-button${isPolicyHelpOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="sidebar-policy-help-trigger"
            aria-expanded={isPolicyHelpOpen}
            aria-controls="sidebar-policy-help-popover"
            aria-describedby={isPolicyHelpOpen ? 'sidebar-policy-help-popover' : undefined}
            onClick={togglePolicyHelp}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setIsPolicyHelpOpen(false);
              }
            }}
          >
            <span className="sidebar-policy-help-copy">
              <strong>Help &amp; Compliance Reminder</strong>
            </span>
          </button>
          <span
            className="sidebar-policy-help-inline-help-shell"
            onClickCapture={() => setIsPolicyHelpOpen(false)}
          >
            <FieldHelpButton
              className="sidebar-policy-help-inline-help"
              label="Help and Compliance Reminder guidance"
              text={HELP_AND_GUARDRAILS_INLINE_HELP}
            />
          </span>
        </div>
        {isPolicyHelpOpen && (
          <div
            id="sidebar-policy-help-popover"
            className="sidebar-policy-help-popover"
            role="tooltip"
          >
            <strong>Help &amp; Compliance Reminder</strong>
            <div className="sidebar-policy-help-sections">
              <section className="sidebar-policy-help-section is-guardrails">
                <h4>Compliance Reminder</h4>
                <ul>
                  {COMPLIANCE_REMINDERS.map((item) => (
                    <li key={item.text}>
                      {item.text}
                      {item.linkUrl && (
                        <a href={item.linkUrl} target="_blank" rel="noopener noreferrer">
                          {item.linkLabel}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="sidebar-policy-help-section is-help">
                <h4>Documents &amp; Guides</h4>
                <ul>
                  {HELP_GUIDANCE.filter(item => !(item.openMpdApproval && !isCtamManager))
                  .map(item => (
                    <li key={item.text}>
                      {item.opensUserGuide ? (
                        <button
                          type="button"
                          className="sidebar-policy-help-link"
                          onClick={() => {
                            setIsUserGuideOpen(true);
                            setIsPolicyHelpOpen(false);
                          }}
                        >
                          {item.text}
                        </button>
                      ): item.openMpdApproval ? (
                        <button
                          type="button"
                          className="sidebar-policy-help-link"
                          onClick={() => {
                            setIsMdpApproval(true);
                            setIsPolicyHelpOpen(false);
                          }}
                        >
                          {item.text}
                        </button>
                      ): item.openPlaybook  ? (
                        <button
                          type="button"
                          className="sidebar-policy-help-link"
                          onClick={() => {
                            setIsPlayBook(true);
                            setIsPolicyHelpOpen(false);
                          }}
                        >
                          {item.text}
                        </button>
                      ): item.opensQualityRubric ? (
                        <button
                          type="button"
                          className="sidebar-policy-help-link"
                          onClick={() => {
                            setIsQualityRubricOpen(true);
                            setIsPolicyHelpOpen(false);
                          }}
                        >
                          {item.text}
                        </button>
                      ) : item.opensComplianceGuidance ? (
                        <button
                          type="button"
                          className="sidebar-policy-help-link"
                          onClick={() => {
                            setIsComplianceGuidanceOpen(true);
                            setIsPolicyHelpOpen(false);
                          }}
                        >
                          {item.text}
                        </button>
                      ) : item.linkUrl ? (
                        <a
                          className="sidebar-policy-help-link"
                          href={item.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {item.text}
                        </a>
                      ) : item.tbd ? (
                        <>
                          {item.text}
                          <span className="sidebar-help-tbd">TBD</span>
                        </>
                      ) : (
                        item.text
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}
      </div>

      {/* Export / Submit MPD dropdown — opens upward (drop-up) so the
          options aren't clipped by the bottom of the sidebar. */}
      <div className="sidebar-export-menu" ref={exportMenuRef}>
        <button
          type="button"
          className="sidebar-export-button"
          aria-haspopup="menu"
          aria-expanded={isExportMenuOpen}
          onClick={() => {
            setIsExportMenuOpen((v) => {
              const next = !v;
              if (next) onPrepareExports?.();
              return next;
            });
            setIsPolicyHelpOpen(false);
          }}
        >
          <span>Export / Submit MPD</span>
          <span className="sidebar-export-caret" aria-hidden="true">
            <svg className="sidebar-export-caret-icon" viewBox="0 0 16 16" focusable="false">
              {isExportMenuOpen ? (
                <path d="M5 3.5 12.5 8 5 12.5z" />
              ) : (
                <path d="M3.5 10.5 8 3.5l4.5 7z" />
              )}
            </svg>
          </span>
        </button>
        {isExportMenuOpen && (
          <ul className="sidebar-export-options" role="menu">
            {visibleExportMenuOptions.map((option) => option.isSection ? (
              <li
                key={option.key}
                role="presentation"
                className={`sidebar-export-section ${option.key === 'export-section' ? 'is-export-section' : ''}`.trim()}
              >
                <span className="sidebar-export-section-label">{option.label}</span>
              </li>
            ) : (
              <li key={option.key} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="sidebar-export-option"
                  disabled={
                    (option.key === 'submit-mpd-approval' && isReadOnly)
                    || (option.key === 'export-ppt' && (isExportingPpt || isPreparingPpt))
                    || (option.key === 'export-pdf' && (isExportingPdf || isPreparingPdf))
                  }
                  title={
                    option.key === 'submit-mpd-approval' && isReadOnly
                      ? 'Disabled while submitted for approval'
                      : option.label
                  }
                  onClick={() => handleExportOption(option)}
                >
                  {option.key === 'export-ppt' && isExportingPpt
                    ? 'Generating PPT...'
                    : option.key === 'export-ppt' && isPreparingPpt
                      ? 'Preparing PPT...'
                      : option.key === 'export-pdf' && isExportingPdf
                      ? 'Generating PDF...'
                      : option.key === 'export-pdf' && isPreparingPdf
                        ? 'Preparing PDF...'
                      : option.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {isUserGuideOpen && (
        <UserGuidePdfModal onClose={() => setIsUserGuideOpen(false)} />
      )}
       {isPlayBook && (
        <AccountPlayBookPdfModal onClose={() => setIsPlayBook(false)} />
      )}
      {isMdpApproval && (
        <MpdAccountPlanApproval onClose={() => setIsMdpApproval(false)}/>
      )}
      {isQualityRubricOpen && (
        <QualityRubricModal onClose={() => setIsQualityRubricOpen(false)} />
      )}
      {isComplianceGuidanceOpen && (
        <ComplianceGuidanceModal onClose={() => setIsComplianceGuidanceOpen(false)} />
      )}
    </aside>
  );
}
