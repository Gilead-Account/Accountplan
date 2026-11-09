import { useEffect, useMemo, useState } from 'react';
import {
  stakeholderHasDlbclInfluenceLevel,
  stakeholderHasMmInfluenceLevel,
} from '@/lib/helper/utils';
import { FieldHelpButton } from '@/components/EditModalField';
import '@/styles/edit-modal.css';
import '@/pages/Stakeholders/Stakeholders.css';
import StakeholdersTab from '@/pages/Stakeholders/StakeholdersTab';
import StakeholderEditModal from '@/pages/Stakeholders/StakeholderEditModal';
import StakeholderCreateModal from '@/pages/Stakeholders/StakeholderCreateModal';
import { usePageFilterState } from '@/lib/ui/pageFilterState';
import {
  createStakeholder,
  createStakeholderAccount,
  deleteStakeholder,
  fetchParentAddresses,
  searchSiteAccounts,
  searchStakeholderAccounts,
  updateStakeholder,
} from '@/lib/dataservice/accountPlan/stakeholders';

const DEFAULT_FILTERS = { role: 'All', priority: 'All' };

const HIGH_INFLUENCE_HINT =
  'Shows stakeholders with High in any DLBCL or MM influence category, ordered by the most High ratings across both.';

export default function Stakeholders({ data, onNotify, isReadOnly = false }) {
  const sourceStakeholders = data.stakeholders || [];
  const picklists = data.picklists || {};
  const [stakeholders, setStakeholders] = useState(sourceStakeholders);
  const [filters, setFilters] = usePageFilterState('stakeholders', DEFAULT_FILTERS);
  const [expanded, setExpanded] = useState({});
  const [editingStakeholder, setEditingStakeholder] = useState(null);
  const [isCreatingStakeholder, setIsCreatingStakeholder] = useState(false);

  useEffect(() => {
    setStakeholders(sourceStakeholders);
  }, [sourceStakeholders]);

  useEffect(() => {
    if (isReadOnly) {
      setEditingStakeholder(null);
      setIsCreatingStakeholder(false);
    }
  }, [isReadOnly]);

  // Count stakeholders with High in any DLBCL or MM influence category.
  const highInfluenceCount = useMemo(
    () =>
      stakeholders.filter(
        (s) =>
          stakeholderHasDlbclInfluenceLevel(s, 'High') ||
          stakeholderHasMmInfluenceLevel(s, 'High')
      ).length,
    [stakeholders]
  );

  const excludedStakeholderAccountIds = useMemo(() => {
    const editingId = editingStakeholder?.id || '';
    return stakeholders
      .filter((stakeholder) => stakeholder?.id !== editingId)
      .map((stakeholder) => stakeholder?.profileRecordId)
      .filter(Boolean);
  }, [stakeholders, editingStakeholder?.id]);

  const applyHighInfluenceFilter = () => {
    setFilters((current) => ({
      ...current,
      influence: current.influence === 'High' ? 'All' : 'High',
    }));
  };

  const toggleExpand = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const openAddStakeholder = () => {
    if (isReadOnly) return;
    setEditingStakeholder({});
  };

  const openEditStakeholder = (stakeholder) => {
    if (isReadOnly) return;
    setEditingStakeholder(stakeholder);
  };

  // Edit modal's "Create Stakeholder" button: close edit modal, open create modal.
  const openCreateFromEdit = () => {
    if (isReadOnly) return;
    setEditingStakeholder(null);
    setIsCreatingStakeholder(true);
  };

  // Create modal submit: create the HCP Account in Veeva, then continue into the
  // normal Add Stakeholder flow with that account pre-selected.
  const createStakeholderAccountRow = async (payload) => {
    if (isReadOnly) return;
    const account = await createStakeholderAccount(payload);
    setIsCreatingStakeholder(false);
    setEditingStakeholder({
      name: account.name,
      profileRecordId: account.id,
      stakeholderId: account.eid || account.accountIdentifier || '',
      primaryParent: payload.primaryParent || '',
      primaryParentId: payload.primaryParentId || '',
    });
    onNotify?.({
      title: 'Account created.',
      detail: 'The HCP was created in Veeva CRM. Complete the stakeholder details and save.',
    });
  };

  const saveStakeholder = async (id, form) => {
    if (isReadOnly) return;
    if (id) {
      await updateStakeholder(id, form);
      setStakeholders((current) =>
        current.map((stakeholder) =>
          stakeholder.id === id ? { ...stakeholder, ...form } : stakeholder
        )
      );
      onNotify?.({
        title: 'Stakeholder saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      return;
    }

    const saved = await createStakeholder(data.planId, form);
    const created = { ...saved, ...form, id: saved.id };
    setStakeholders((current) => [created, ...current]);
    onNotify?.({
      title: 'Stakeholder saved.',
      detail: 'Your changes have been saved.',
      refreshPages: true,
    });
  };

  const deleteStakeholderRow = async (stakeholder) => {
    if (isReadOnly || !stakeholder?.id) return;
    await deleteStakeholder(stakeholder.id);
    setStakeholders((current) => current.filter((row) => row.id !== stakeholder.id));
    onNotify?.({
      title: 'Stakeholder deleted.',
      detail: 'The stakeholder has been removed from this account plan.',
      refreshPages: true,
    });
  };

  return (
    <section className="page page-stakeholders-team mock-stakeholder-page">
      <StakeholdersTab
        stakeholders={stakeholders}
        filters={filters}
        onFilterChange={setFilters}
        priorityOptions={picklists.priorityOptions || []}
        expanded={expanded}
        onToggleExpand={toggleExpand}
        onAdd={isReadOnly ? null : openAddStakeholder}
        onOpenEdit={isReadOnly ? null : openEditStakeholder}
        isReadOnly={isReadOnly}
        commandSummary={
          <div
            className={`mock-kpi-card high-influence-kpi ${filters.influence === 'High' ? 'is-active' : ''}`}
            role="button"
            tabIndex={0}
            aria-label="Filter to high DLBCL or MM influence stakeholders"
            aria-pressed={filters.influence === 'High'}
            onClick={applyHighInfluenceFilter}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                applyHighInfluenceFilter();
              }
            }}
          >
            <span className="high-influence-label">High Influence Stakeholder</span>
            <FieldHelpButton
              className="high-influence-kpi-help"
              text={HIGH_INFLUENCE_HINT}
              label="What are High Influencers?"
            />
            <strong>{highInfluenceCount}</strong>
          </div>
        }
      />

      {!isReadOnly && editingStakeholder && (
        <StakeholderEditModal
          stakeholder={editingStakeholder}
          influenceOptions={picklists.influenceOptions || []}
          roleOptions={picklists.roleOptions || []}
          estimatedAnnualRrmmTreatmentVolumeOptions={
            picklists.estimatedAnnualRrmmTreatmentVolumeOptions || []
          }
          physicianIdentifiedHighestUnmetNeedsOptions={
            picklists.physicianIdentifiedHighestUnmetNeedsOptions || []
          }
          searchSites={searchSiteAccounts}
          searchStakeholders={searchStakeholderAccounts}
          excludedStakeholderAccountIds={excludedStakeholderAccountIds}
          onClose={() => setEditingStakeholder(null)}
          onSave={saveStakeholder}
          onDelete={deleteStakeholderRow}
          onCreateStakeholder={openCreateFromEdit}
        />
      )}

      {!isReadOnly && isCreatingStakeholder && (
        <StakeholderCreateModal
          salutationOptions={picklists.salutationOptions || []}
          credentialOptions={picklists.credentialOptions || []}
          countryOptions={picklists.countryOptions || []}
          searchSites={searchSiteAccounts}
          loadAddresses={fetchParentAddresses}
          onClose={() => setIsCreatingStakeholder(false)}
          onCreate={createStakeholderAccountRow}
        />
      )}
    </section>
  );
}
