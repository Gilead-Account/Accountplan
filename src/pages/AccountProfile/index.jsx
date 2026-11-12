import { useContext, useEffect, useState } from 'react';
import ProfileTab from '@/pages/AccountProfile/ProfileTab';
import ReferralDynamicsTab from '@/pages/AccountProfile/ReferralDynamicsTab';
import AccountInsightsTab from '@/pages/AccountProfile/AccountInsightsTab';
import AccountIntelligenceTab from '@/pages/AccountProfile/AccountIntelligenceTab';
import ReferralAccountEditModal from '@/pages/AccountProfile/ReferralAccountEditModal';
import HealthcareNetworkEditModal from '@/pages/AccountProfile/HealthcareNetworkEditModal';
import AccountInsightEditModal from '@/pages/AccountProfile/AccountInsightEditModal';
import RegionalDynamicsEditModal from '@/pages/AccountProfile/RegionalDynamicsEditModal';
import {
  addAccountInsight,
  addHealthcareNetwork,
  addReferralAccount,
  deleteAccountInsight,
  deleteHealthcareNetwork,
  deleteReferralAccount,
  saveAccountInsight,
  saveHealthcareNetwork,
  saveProfileAnswer,
  saveReferralAccount,
  searchHealthcareNetworkAccounts,
  searchReferralSiteAccounts,
} from '@/lib/dataservice/accountPlan/accountProfile';
import { updateAccountProfileField } from '@/lib/dataservice/accountPlan/shared';
import '@/styles/edit-modal.css';
import '@/pages/AccountProfile/AccountProfile.css';
import { PotentialAtcContext } from '../../lib/dataservice/accountPlan/PotentialAtcContext';

const TABS = [
  { key: 'account-intelligence', label: 'MM Profile' },
  { key: 'profile', label: 'DLBCL Profile' },
  { key: 'referral-dynamics', label: 'Referral & Dynamics' },
];

const ACCOUNT_INSIGHTS_TAB = 'account-insights';

const resolveInitialTab = (initialTab) => {
  if (initialTab === ACCOUNT_INSIGHTS_TAB) return ACCOUNT_INSIGHTS_TAB;
  return TABS.some((t) => t.key === initialTab) ? initialTab : 'account-intelligence';
};

const recordValue = (value) =>
  value && typeof value === 'object' && 'value' in value ? value.value : value;

const createdRecordId = (result, prefix) =>
  recordValue(result && result.data && (result.data.id || result.data.Id)) ||
  recordValue(result && (result.id || result.Id || result.recordId)) ||
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

export default function AccountProfile({ data, initialTab, onNotify, isReadOnly = false }) {
  const [tab, setTab] = useState(() => resolveInitialTab(initialTab));
  const isPotentialAtc = useContext(PotentialAtcContext);

  // When the parent flips initialTab (e.g. user navigates Home → Account
  // Insights nav item → back to Account Profile), jump to that tab.
  useEffect(() => {
    setTab(resolveInitialTab(initialTab));
  }, [initialTab]);

  const [attributeRows, setAttributeRows] = useState(() => data.accountAttributeRows || []);
  const [reimbursementRows, setReimbursementRows] = useState(() => data.reimbursementRows || []);
  const [profileQuestionColumns, setProfileQuestionColumns] = useState(
    () => data.profileQuestionColumns || []
  );
  const [referralAccounts, setReferralAccounts] = useState(() => data.referralAccounts || []);
  const [healthcareNetworks, setHealthcareNetworks] = useState(() => data.healthcareNetworks || []);
  const [regionalDynamics, setRegionalDynamics] = useState(() => data.regionalDynamics || {});
  const [accountInsights, setAccountInsights] = useState(() => data.accountInsights || []);

  const [referralModal, setReferralModal] = useState(null);
  const [networkModal, setNetworkModal] = useState(null);
  const [insightModal, setInsightModal] = useState(null);
  const [regionalModal, setRegionalModal] = useState(null);

  const [isSavingReferral, setIsSavingReferral] = useState(false);
  const [isSavingNetwork, setIsSavingNetwork] = useState(false);
  const [isSavingInsight, setIsSavingInsight] = useState(false);
  const [isSavingRegional, setIsSavingRegional] = useState(false);
  const [mmProfileSaveAction, setMmProfileSaveAction] = useState(null);
  const [referralError, setReferralError] = useState('');
  const [networkError, setNetworkError] = useState('');
  const [insightError, setInsightError] = useState('');
  const [regionalError, setRegionalError] = useState('');

  const planId = data.planId;
  const profileId = data.profileId;
  const regionalFieldMap = data.regionalDynamicsFieldMap || {};
  const accountName = data.account?.name;
  const showAccountProfileTabs = tab !== ACCOUNT_INSIGHTS_TAB;
  const isPotentialAtcFromContext = useContext(PotentialAtcContext);

  useEffect(()=>{
    console.log('[PotentialAtc updateCustomerGoals] Open clicked Payoad:', JSON.stringify(
          {planId:data?.planId,
          contextValue:data?.isPotentialAtcFromContext,}, null, 2));
  }, [isPotentialAtc])
    

  useEffect(() => {
    setAttributeRows(data.accountAttributeRows || []);
    setReimbursementRows(data.reimbursementRows || []);
    setProfileQuestionColumns(data.profileQuestionColumns || []);
    setReferralAccounts(data.referralAccounts || []);
    setHealthcareNetworks(data.healthcareNetworks || []);
    setRegionalDynamics(data.regionalDynamics || {});
    setAccountInsights(data.accountInsights || []);
  }, [data]);

  useEffect(() => {
    if (!isReadOnly) return;
    setReferralModal(null);
    setNetworkModal(null);
    setInsightModal(null);
    setRegionalModal(null);
  }, [isReadOnly]);


  // DLBCL profile inline editor: each question is a single Veeva field, so
  // the save handler just patches that one column on the profile record.
  const handleSaveProfileAnswer = async (item, value) => {
    if (isReadOnly) return;
    setProfileQuestionColumns((columns) =>
      columns.map((column) =>
        column.map((row) => (row.key === item.key ? { ...row, value } : row))
      )
    );
    if (profileId && item.crmField) {
      try {
        await updateAccountProfileField(profileId, item.crmField, value);
      } catch (error) {
        console.warn('[accountProfile] profile answer save failed', error);
      }
    }
  };

  // MM Profile tab "Save" (per section): persist each edited MM field to its
  // KPH_Ecosystem_Plan__c column. `updates` is keyed by CRM API field name.
  const handleSaveMmProfile = async (updates) => {
    if (isReadOnly || !profileId) return;
    const entries = Object.entries(updates || {}).filter(([field]) => field);
    if (!entries.length) return;
    try {
      for (const [field, value] of entries) {
        await updateAccountProfileField(profileId, field, value);
      }
      onNotify?.({
        title: 'MM profile saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
    } catch (error) {
      onNotify?.({
        title: 'Unable to save MM profile.',
        detail: error?.message || 'Please try again.',
        tone: 'danger',
      });
    }
  };

  const handleSaveReferral = async (form) => {
    if (isReadOnly) return;
    setIsSavingReferral(true);
    setReferralError('');
    try {
      if (form.id) {
        await saveReferralAccount(form.id, form);
        setReferralAccounts((rows) => rows.map((r) => (r.id === form.id ? { ...r, ...form } : r)));
      } else {
        const result = await addReferralAccount(planId, profileId, form);
        setReferralAccounts((rows) => [
          { ...form, accountProfileId: profileId, id: createdRecordId(result, 'ref') },
          ...rows,
        ]);
      }
      onNotify?.({
        title: 'Referral account saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      setReferralModal(null);
    } catch (error) {
      setReferralError(error?.message || 'Unable to save referral account.');
    } finally {
      setIsSavingReferral(false);
    }
  };

  const handleDeleteReferral = async (record) => {
    if (isReadOnly) return;
    setIsSavingReferral(true);
    setReferralError('');
    try {
      await deleteReferralAccount(record.id);
      setReferralAccounts((rows) => rows.filter((r) => r.id !== record.id));
      onNotify?.({
        title: 'Referral mapping deleted.',
        detail: 'The referral mapping has been removed from this account plan.',
        refreshPages: true,
      });
      setReferralModal(null);
    } catch (error) {
      setReferralError(error?.message || 'Unable to delete referral account.');
    } finally {
      setIsSavingReferral(false);
    }
  };

  const handleSaveNetwork = async (form) => {
    if (isReadOnly) return;
    setIsSavingNetwork(true);
    setNetworkError('');
    try {
      if (form.id) {
        await saveHealthcareNetwork(form.id, form);
        setHealthcareNetworks((rows) =>
          rows.map((r) => (r.id === form.id ? { ...r, ...form } : r))
        );
      } else {
        const result = await addHealthcareNetwork(profileId, form);
        setHealthcareNetworks((rows) => [
          { ...form, accountProfileId: profileId, id: createdRecordId(result, 'net') },
          ...rows,
        ]);
      }
      onNotify?.({
        title: 'Healthcare network saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      setNetworkModal(null);
    } catch (error) {
      setNetworkError(error?.message || 'Unable to save healthcare network.');
    } finally {
      setIsSavingNetwork(false);
    }
  };

  const handleDeleteNetwork = async (record) => {
    if (isReadOnly) return;
    setIsSavingNetwork(true);
    setNetworkError('');
    try {
      await deleteHealthcareNetwork(record.id);
      setHealthcareNetworks((rows) => rows.filter((r) => r.id !== record.id));
      onNotify?.({
        title: 'Healthcare network deleted.',
        detail: 'The healthcare network has been removed from this account profile.',
        refreshPages: true,
      });
      setNetworkModal(null);
    } catch (error) {
      setNetworkError(error?.message || 'Unable to delete healthcare network.');
    } finally {
      setIsSavingNetwork(false);
    }
  };

  const handleSaveInsight = async (form) => {
    if (isReadOnly) return;
    setIsSavingInsight(true);
    setInsightError('');
    try {
      if (form.id) {
        await saveAccountInsight(form.id, form);
        setAccountInsights((rows) =>
          rows.map((r) => (r.id === form.id ? { ...r, ...form } : r))
        );
      } else {
        const result = await addAccountInsight(planId, profileId, form);
        setAccountInsights((rows) => [
          { ...form, accountProfileId: profileId, id: createdRecordId(result, 'insight'), name: `CI-${rows.length + 1}` },
          ...rows,
        ]);
      }
      onNotify?.({
        title: 'Account insight saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      setInsightModal(null);
    } catch (error) {
      setInsightError(error?.message || 'Unable to save account insight.');
    } finally {
      setIsSavingInsight(false);
    }
  };

  const handleDeleteInsight = async (record) => {
    if (isReadOnly) return;
    setIsSavingInsight(true);
    setInsightError('');
    try {
      await deleteAccountInsight(record.id);
      setAccountInsights((rows) => rows.filter((r) => r.id !== record.id));
      onNotify?.({
        title: 'Account insight deleted.',
        detail: 'The account insight has been removed from this account plan.',
        refreshPages: true,
      });
      setInsightModal(null);
    } catch (error) {
      setInsightError(error?.message || 'Unable to delete account insight.');
    } finally {
      setIsSavingInsight(false);
    }
  };

  const handleSaveRegional = async (indication, content) => {
    if (isReadOnly) return;
    setIsSavingRegional(true);
    setRegionalError('');
    try {
      const field = regionalFieldMap[indication];
      if (profileId && field) {
        await saveProfileAnswer(profileId, field, content);
      }
      setRegionalDynamics((current) => ({ ...current, [indication]: content }));
      onNotify?.({
        title: 'Regional dynamics saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      setRegionalModal(null);
    } catch (error) {
      setRegionalError(error?.message || 'Unable to save regional dynamics.');
    } finally {
      setIsSavingRegional(false);
    }
  };

  return (
    <section className="page page-account-profile mock-profile-page">
      {showAccountProfileTabs && (
        <article className="mock-control-panel account-profile-tabs-card">
          <div className="bd-tab-row account-profile-tabs">
            <div className="account-profile-tab-list" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`bd-tab ${tab === t.key ? 'is-active' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'account-intelligence' && mmProfileSaveAction && (
              <button
                type="button"
                className="account-intelligence-save-button account-profile-tab-save-button"
                onClick={mmProfileSaveAction.onSave}
                disabled={mmProfileSaveAction.isSaving || !mmProfileSaveAction.hasUnsaved}
              >
                {mmProfileSaveAction.label}
              </button>
            )}
          </div>
        </article>
      )}

      {showAccountProfileTabs && tab === 'profile' && (
        <ProfileTab
          account={data.account}
          attributeRows={attributeRows}
          reimbursementRows={reimbursementRows}
          profileQuestionColumns={profileQuestionColumns}
          yesNoOptions={data.profileQuestionYesNoOptions || []}
          onSaveProfileAnswer={handleSaveProfileAnswer}
          onNotify={onNotify}
          isReadOnly={isReadOnly}
        />
      )}

      {showAccountProfileTabs && tab === 'referral-dynamics' && (
        <ReferralDynamicsTab
          referralAccounts={referralAccounts}
          healthcareNetworks={healthcareNetworks}
          regionalDynamics={regionalDynamics}
          accountName={accountName}
          onEditReferral={(record) => {
            if (!isReadOnly) setReferralModal({ record });
          }}
          onAddReferral={() => {
            if (!isReadOnly) setReferralModal({ record: null });
          }}
          onEditHealthcareNetwork={(record) => {
            if (!isReadOnly) setNetworkModal({ record });
          }}
          onAddHealthcareNetwork={() => {
            if (!isReadOnly) setNetworkModal({ record: null });
          }}
          onEditRegionalDynamics={(indication) =>
            !isReadOnly && setRegionalModal({ indication, value: regionalDynamics[indication] || '' })
          }
          isReadOnly={isReadOnly}
        />
      )}

      {showAccountProfileTabs && tab === 'account-intelligence' && (
        <AccountIntelligenceTab
          values={data.mmProfile || {}}
          mmProfilePicklists={data.mmProfilePicklists || {}}
          isReadOnly={isReadOnly}
          onSave={handleSaveMmProfile}
          onSaveActionChange={setMmProfileSaveAction}
        />
      )}

      {tab === 'account-insights' && (
        <AccountInsightsTab
          insights={accountInsights}
          onAdd={() => {
            if (!isReadOnly) setInsightModal({ record: null });
          }}
          onEdit={(record) => {
            if (!isReadOnly) setInsightModal({ record });
          }}
          isReadOnly={isReadOnly}
        />
      )}

      {!isReadOnly && referralModal && (
        <ReferralAccountEditModal
          record={referralModal.record}
          isSaving={isSavingReferral}
          error={referralError}
          onClose={() => setReferralModal(null)}
          onSave={handleSaveReferral}
          onDelete={handleDeleteReferral}
          searchAccounts={searchReferralSiteAccounts}
          indicationOptions={data.referralIndicationOptions || []}
          insightCategoryOptions={data.referralCategoryOptions || []}
        />
      )}

      {!isReadOnly && networkModal && (
        <HealthcareNetworkEditModal
          record={networkModal.record}
          defaultAccount={data.account}
          isSaving={isSavingNetwork}
          error={networkError}
          onClose={() => setNetworkModal(null)}
          onSave={handleSaveNetwork}
          onDelete={handleDeleteNetwork}
          searchAccounts={searchHealthcareNetworkAccounts}
        />
      )}

      {!isReadOnly && insightModal && (
        <AccountInsightEditModal
          record={insightModal.record}
          indicationOptions={data.accountInsightIndicationOptions || []}
          insightCategoryOptions={data.accountInsightCategoryOptions}
          isPotentialAtc={insightModal.isPotentialAtc}
          isSaving={isSavingInsight}
          error={insightError}
          onClose={() => setInsightModal(null)}
          onSave={handleSaveInsight}
          onDelete={handleDeleteInsight}
        />
      )}

      {!isReadOnly && regionalModal && (
        <RegionalDynamicsEditModal
          indication={regionalModal.indication}
          value={regionalModal.value}
          isSaving={isSavingRegional}
          error={regionalError}
          onClose={() => setRegionalModal(null)}
          onSave={handleSaveRegional}
        />
      )}
    </section>
  );
}
