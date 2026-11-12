import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  homeUrgentActivities,
  homeSummaryTables,
  recordIdMatches,
} from '@/lib/helper/utils';
import {
  DUPLICATE_TEAM_MEMBER_MESSAGE,
  filterExistingTeamMemberUsers,
  hasDuplicateTeamMemberUser,
  teamMemberRawUserIds,
  teamMemberUserIds,
} from '@/lib/helper/teamMemberUsers';
import {
  addBarrierDriver,
  addCriticalActivity,
  deleteCriticalActivity,
  deleteTeamMember,
  saveBarrierDriver,
  saveBarrierDriverStatus,
  saveCriticalActivity,
  saveCustomerGoals,
  searchUsers as searchTeamUsers,
  sortTeamMembersByParticipation,
} from '@/lib/dataservice/accountPlan/home';
import { formatCriticalActivitySaveError } from '@/lib/dataservice/accountPlan/errorMessages';
import {
  buildOpenActivityCountByBarrier,
  barrierDriverUsesStrategy,
  categoryPrefix,
  normalizeBarrierDriverStatusForDisplay,
} from '@/lib/dataservice/accountPlan/shared';
import '@/styles/edit-modal.css';
import '@/pages/Overview/Overview.css';
import AccountStrip from '@/pages/Overview/AccountStrip';
import ServiceLineGoals from '@/pages/Overview/ServiceLineGoals';
import ServiceLineGoalsEditModal from '@/pages/Overview/ServiceLineGoalsEditModal';
import KiteStrategy from '@/pages/Overview/KiteStrategy';
import BarriersDriversSummary from '@/pages/Overview/BarriersDriversSummary';
import HomeBarrierDriverActivities from '@/pages/Overview/HomeBarrierDriverActivities';
import UrgentActivities from '@/pages/Overview/UrgentActivities';
import PodUsers from '@/pages/Overview/PodUsers';
import BarrierDriverEditModal from '@/pages/BarriersDrivers/BarrierDriverEditModal';
import { sortActivitiesByCriticality } from '@/pages/BarriersDrivers/criticalActivityPrioritySort';
import CriticalActivityEditModal from '@/pages/CriticalActivities/CriticalActivityEditModal';
import { criticalActivityClosedParentEditReason } from '@/pages/CriticalActivities/linkedBarrierDriverOptions';
import {
  buildLinkedBarrierDriverStatusPrompt,
  linkedBarrierDriverCloseBlockedMessage,
  LinkedBarrierDriverStatusConfirmModal,
  LinkedBarrierDriverStatusPromptModal,
  mergeBarrierDriverStatusOptions,
} from '@/pages/CriticalActivities/LinkedBarrierDriverStatusPrompt';
import TeamMemberEditModal from '@/pages/TeamMembers/TeamMemberEditModal';
import PreAuthStatusPhase from '../PreAuthStatusPhase';
import { AccountPhaseContext, DryRunDateContext, PotentialAtcContext } from '../../lib/dataservice/accountPlan/PotentialAtcContext';

const recordValue = (value) =>
  value && typeof value === 'object' && 'value' in value ? value.value : value;

const newLocalId = (prefix) =>
  recordValue(`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);

const createdId = (result, prefix) =>
  recordValue(result && result.data && (result.data.id || result.data.Id)) ||
  recordValue(result && (result.id || result.Id || result.recordId)) ||
  newLocalId(prefix);

const COMPLETED_KEYS = new Set(['complete', 'completed', 'closed']);
const ACTIVITY_DEACTIVATE_FIELD = 'KPH_Inactive__c';

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const storedActivityStatus = (status) =>
  status === 'Completed' ? 'Complete' : status || 'Planned';
const isDeactivateChecked = (value) =>
  value === true || ['true', 'yes', '1'].includes(String(value || '').trim().toLowerCase());

const normalizedBarrierDriverType = (type) => (type === 'Driver' ? 'Driver' : 'Barrier');

const barrierDriverTypeLabel = (type) => (normalizedBarrierDriverType(type) === 'Driver' ? 'driver' : 'barrier');

const isClosedBarrierDriverStatus = (status) => {
  const key = String(status || '').trim().toLowerCase();
  return key === 'close' || key === 'closed';
};

const closeBlockedByActivitiesMessage = (type, openActivityCount) => {
  const label = barrierDriverTypeLabel(type);
  const activityLabel = openActivityCount === 1 ? 'activity' : 'activities';
  const activityAction = openActivityCount === 1 ? 'it' : 'them';
  return `This ${label} has ${openActivityCount} open critical ${activityLabel}. Close ${activityAction} before closing the ${label}.`;
};

// Mirror CriticalActivities/index.jsx so the row shape we keep in Home state
// matches what every other consumer expects after an inline save.
const applyActivityForm = (activity, form, saveResult, barrierLookup) => {
  const status = storedActivityStatus(form.status);
  const isComplete = COMPLETED_KEYS.has(String(status || '').toLowerCase());
  const omittedFields = new Set((saveResult && saveResult.omittedOptionalFields) || []);
  const hasDeactivateField = Object.prototype.hasOwnProperty.call(form, 'deactivate');
  const hasParentField = Object.prototype.hasOwnProperty.call(form, 'parentId');
  const parent = hasParentField && form.parentId ? barrierLookup?.get(form.parentId) : null;
  const hasCommentsField = Object.prototype.hasOwnProperty.call(form, 'comments');
  const savedComments =
    activity.canEditComments !== false && !omittedFields.has('KPH_Comments__c');
  const savedDeactivate =
    activity.canDeactivate !== false && !omittedFields.has(ACTIVITY_DEACTIVATE_FIELD);
  return {
    ...activity,
    name: String(form.title || '').trim(),
    details: String(form.details || '').trim(),
    indication: form.indication || '',
    status,
    ownerLabel: form.accountable || '',
    comments: savedComments && hasCommentsField ? (form.comments || '') : (activity.comments || ''),
    dueDate: form.dueDate || null,
    completedDate: isComplete ? (form.completedDate || activity.completedDate || todayIsoDate()) : null,
    isDeactivated: savedDeactivate && hasDeactivateField
      ? isDeactivateChecked(form.deactivate)
      : activity.isDeactivated === true,
    canEditComments: savedComments,
    canDeactivate: savedDeactivate,
    ...(hasParentField
      ? {
          barrierDriverId: form.parentId || null,
          parentName: parent ? parent.name : (form.parentId ? 'Linked record unavailable' : 'Plan-level'),
          parentType: parent ? parent.type : (form.parentType || null),
          parentRecordTypeId: parent ? (parent.recordTypeId || null) : (form.parentRecordTypeId || null),
        }
      : {}),
    lastModifiedDate: new Date().toISOString(),
  };
};

const applyActivityDeactivate = (activity, saveResult) => {
  const omittedFields = new Set((saveResult && saveResult.omittedOptionalFields) || []);
  const savedDeactivate =
    activity.canDeactivate !== false && !omittedFields.has(ACTIVITY_DEACTIVATE_FIELD);
  return {
    ...activity,
    isDeactivated: savedDeactivate ? true : activity.isDeactivated === true,
    canDeactivate: savedDeactivate,
    lastModifiedDate: new Date().toISOString(),
  };
};

const strategyLabelForValue = (picklists, value, fallback = null) => {
  const labels = picklists?.strategyLabels;
  if (!value || !labels || typeof labels !== 'object') return fallback || value || null;
  return Object.prototype.hasOwnProperty.call(labels, value) ? (labels[value] || value) : (fallback || value);
};

const applyBarrierDriverForm = (record, form, picklists = {}) => {
  const strategy = barrierDriverUsesStrategy(form.indication) ? (form.strategy || null) : null;
  const previousLabel = record.strategy === strategy ? record.strategyLabel : null;
  return {
    ...record,
    type: form.type,
    name: String(form.name || '').trim(),
    status: form.status,
    indication: form.indication,
    strategy,
    strategyLabel: strategy ? strategyLabelForValue(picklists, strategy, previousLabel) : null,
    strategyRank: barrierDriverUsesStrategy(form.indication) ? (form.strategyRank || null) : null,
    category: categoryPrefix(form.category) || null,
    categoryValue: form.category || null,
    businessImpact: form.businessImpact || null,
    comments: form.comments || '',
    lastModifiedDate: new Date().toISOString(),
  };
};

const applyTeamMemberForm = (member, form) => ({
  ...member,
  userId: form.userId || member.userId || null,
  name: form.name || member.name,
  participation: form.participation || null,
  isPrimary: form.status ? form.status === 'Active' : member.isPrimary,
});

export default function Overview({
  data,
  onDataChange,
  onActivityChange,
  onMemberChange,
  onMemberDelete,
  onNotify,
  isReadOnly = false,
}) {
  const planId = data.planId;
  const picklists = data.picklists || {};
  const [customerGoals, setCustomerGoals] = useState(data.customerGoals || '');
  const [barriers, setBarriers] = useState(() => data.barriers || []);
  const [drivers, setDrivers] = useState(() => data.drivers || []);
  const [activities, setActivities] = useState(() => data.criticalActivities || []);
  const [teamMembers, setTeamMembers] = useState(() =>
    sortTeamMembersByParticipation(data.teamMembers || [])
  );

  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false);
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const [goalsError, setGoalsError] = useState('');
  const isPotentialAtc = useContext(PotentialAtcContext);
  const accountPhase = useContext(AccountPhaseContext);
  // Three inline edit modals (the user can click any record on Home without
  // navigating to its dedicated page).
  const [bdEditState, setBdEditState] = useState(null); // { record }
  const [isSavingBd, setIsSavingBd] = useState(false);
  const [bdError, setBdError] = useState('');

  const [activityEditState, setActivityEditState] = useState(null); // { activity }
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [pendingBarrierDriverStatusConfirm, setPendingBarrierDriverStatusConfirm] = useState(null);
  const [pendingBarrierDriverStatusPrompt, setPendingBarrierDriverStatusPrompt] = useState(null);
  const [barrierDriverStatusPromptValue, setBarrierDriverStatusPromptValue] = useState('');
  const [barrierDriverStatusPromptError, setBarrierDriverStatusPromptError] = useState('');
  const [isSavingBarrierDriverStatus, setIsSavingBarrierDriverStatus] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState();
  const [memberEditState, setMemberEditState] = useState(null); // { member }
  const editingMemberId = memberEditState?.member?.id || null;
  const dryRundate = useContext(DryRunDateContext);

  useEffect(() => {
    setCustomerGoals(data.customerGoals || '');
    setBarriers(data.barriers || []);
    setDrivers(data.drivers || []);
    setActivities(data.criticalActivities || []);
    setTeamMembers(sortTeamMembersByParticipation(data.teamMembers || []));
  }, [data]);

  useEffect(() => {
    if (!isReadOnly) return;
    setIsGoalsModalOpen(false);
    setBdEditState(null);
    setActivityEditState(null);
    setMemberEditState(null);
    setPendingBarrierDriverStatusConfirm(null);
    setPendingBarrierDriverStatusPrompt(null);
  }, [isReadOnly]);

  useEffect(() => {
    setPendingBarrierDriverStatusConfirm(null);
    setPendingBarrierDriverStatusPrompt(null);
    setBarrierDriverStatusPromptValue('');
    setBarrierDriverStatusPromptError('');
  }, [planId]);

  const allBarrierDriverRecords = useMemo(
    () => [...barriers, ...drivers],
    [barriers, drivers]
  );
  const barrierDriverById = useMemo(
    () => new Map(allBarrierDriverRecords.map((record) => [record.id, record])),
    [allBarrierDriverRecords]
  );
  const closedParentEditReason = (activity) =>
    criticalActivityClosedParentEditReason(
      activity,
      activity?.barrierDriverId ? barrierDriverById.get(activity.barrierDriverId) : null
    );

  const urgentActivities = useMemo(
    () =>
      homeUrgentActivities(activities).map((activity) => ({
        ...activity,
        editDisabledReason: closedParentEditReason(activity),
      })),
    [activities, barrierDriverById]
  );

  const summaryTables = useMemo(
    () => homeSummaryTables(barriers, drivers, activities),
    [barriers, drivers, activities]
  );

  const openActivityCountByBarrier = useMemo(() => {
    return buildOpenActivityCountByBarrier(activities);
  }, [activities]);

  const selectedBarrierDriverActivities = useMemo(() => {
    const selectedRecordId = bdEditState?.record?.id;
    if (!selectedRecordId) return [];
    return sortActivitiesByCriticality(
      activities.filter(
        (activity) =>
          activity.isDeactivated !== true &&
          recordIdMatches(activity.barrierDriverId, selectedRecordId)
      )
    );
  }, [activities, bdEditState?.record?.id]);

  const indicationOptions = useMemo(
    () => picklists.activityIndications || picklists.barrierDriverIndications || [],
    [picklists]
  );
  const accountableOptions = useMemo(
    () => picklists.accountableMembers || [],
    [picklists]
  );
  const barrierDriverStatusOptions = useMemo(
    () => mergeBarrierDriverStatusOptions(picklists.barrierStatuses),
    [picklists.barrierStatuses]
  );
  const excludedLookupUserIds = useMemo(
    () => teamMemberUserIds(teamMembers, editingMemberId),
    [teamMembers, editingMemberId]
  );
  const excludedLookupUserRawIds = useMemo(
    () => teamMemberRawUserIds(teamMembers, editingMemberId),
    [teamMembers, editingMemberId]
  );
  const searchAvailableTeamUsers = useCallback(
    (query, limit) =>
      Promise.resolve(searchTeamUsers(query, limit, excludedLookupUserRawIds))
        .then((results) => filterExistingTeamMemberUsers(results, excludedLookupUserIds)),
    [excludedLookupUserIds, excludedLookupUserRawIds]
  );

  // --- customer goals --------------------------------------------------------
  const handleEditGoals = () => {
    if (isReadOnly) return;
    setGoalsError('');
    setIsGoalsModalOpen(true);
  };

  const handleSaveGoals = async (value) => {
    if (isReadOnly) return;
    const nextValue = value || '';
    setIsSavingGoals(true);
    setGoalsError('');
    try {
      await saveCustomerGoals(planId, nextValue);
      setCustomerGoals(nextValue);
      if (onDataChange) onDataChange({ customerGoals: nextValue });
      onNotify?.({
        title: 'Customer goals saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      setIsGoalsModalOpen(false);
    } catch (error) {
      setGoalsError(error?.message || 'Unable to save customer goals.');
    } finally {
      setIsSavingGoals(false);
    }
  };

  // --- barrier/driver inline editor -----------------------------------------
  const openEditBarrierDriver = (record) => {
    if (isReadOnly) return;
    setBdError('');
    setBdEditState({ record });
  };

  const closeBdModal = () => {
    if (isSavingBd) return;
    setBdEditState(null);
    setBdError('');
  };

  const persistBarrierDriverInState = (record) => {
    if (record.type === 'Driver') {
      setDrivers((rows) => {
        const found = rows.some((r) => r.id === record.id);
        return found ? rows.map((r) => (r.id === record.id ? record : r)) : [record, ...rows];
      });
      setBarriers((rows) => rows.filter((r) => r.id !== record.id));
    } else {
      setBarriers((rows) => {
        const found = rows.some((r) => r.id === record.id);
        return found ? rows.map((r) => (r.id === record.id ? record : r)) : [record, ...rows];
      });
      setDrivers((rows) => rows.filter((r) => r.id !== record.id));
    }
    if (onDataChange) {
      onDataChange((current) => ({
        barriers: record.type === 'Barrier'
          ? mergeRecord(current.barriers, record)
          : (current.barriers || []).filter((r) => r.id !== record.id),
        drivers: record.type === 'Driver'
          ? mergeRecord(current.drivers, record)
          : (current.drivers || []).filter((r) => r.id !== record.id),
      }));
    }
  };

  const handleSaveBarrierDriver = async (form) => {
    if (isReadOnly) return;
    const openActivityCount = bdEditState.record?.id ? (openActivityCountByBarrier[bdEditState.record.id] || 0) : 0;
    if (bdEditState.record?.id && isClosedBarrierDriverStatus(form.status) && openActivityCount > 0) {
      setBdError(closeBlockedByActivitiesMessage(form.type, openActivityCount));
      return;
    }

    setIsSavingBd(true);
    setBdError('');
    try {
      const formWithPlan = { ...form, accountPlanId: planId };
      if (bdEditState.record?.id) {
        const statusOnlyUpdate =
          isClosedBarrierDriverStatus(bdEditState.record.status) ||
          bdEditState.record.isKiteDataAdminPreLaunch === true;
        if (statusOnlyUpdate) {
          await saveBarrierDriverStatus(bdEditState.record.id, form.status);
          persistBarrierDriverInState({
            ...bdEditState.record,
            status: normalizeBarrierDriverStatusForDisplay(form.status),
            lastModifiedDate: new Date().toISOString(),
          });
        } else {
          await saveBarrierDriver(bdEditState.record.id, formWithPlan);
          persistBarrierDriverInState(applyBarrierDriverForm(bdEditState.record, formWithPlan, picklists));
        }
      } else {
        const result = await addBarrierDriver(planId, formWithPlan);
        persistBarrierDriverInState(
          applyBarrierDriverForm({ id: createdId(result, 'bd'), type: formWithPlan.type }, formWithPlan, picklists)
        );
      }
      const recordTypeLabel = formWithPlan.type === 'Driver' ? 'Driver' : 'Barrier';
      onNotify?.({
        title: `${recordTypeLabel} saved.`,
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      setBdEditState(null);
    } catch (error) {
      setBdError(error?.message || 'Unable to save barrier/driver.');
    } finally {
      setIsSavingBd(false);
    }
  };

  // --- critical activity inline editor --------------------------------------
  const openEditActivity = (activity) => {
    if (isReadOnly) return;
    setActivityError('');
    const parentRecord = activity?.barrierDriverId ? barrierDriverById.get(activity.barrierDriverId) : null;
    setActivityEditState({ activity, parentRecord });
  };

  const openActivityFromBarrierDriverModal = (activity) => {
    setBdEditState(null);
    openEditActivity(activity);
  };

  const closeActivityModal = () => {
    if (isSavingActivity) return;
    setActivityEditState(null);
    setActivityError('');
  };

  const handleSaveActivity = async (activity, form) => {
    if (isReadOnly) return;
    setIsSavingActivity(true);
    setActivityError('');
    try {
      if (activity?.id) {
        const parentChanged =
          Object.prototype.hasOwnProperty.call(form, 'parentId') &&
          (form.parentId || '') !== (activity.barrierDriverId || '');
        const payload = parentChanged
          ? form
          : {
              title: form.title,
              details: form.details,
              indication: form.indication,
              status: form.status,
              accountable: form.accountable,
              dueDate: form.dueDate,
              completedDate: form.completedDate,
            };
        if (form.kiteDataAdminLimitedUpdate) payload.kiteDataAdminLimitedUpdate = true;
        if (!parentChanged && Object.prototype.hasOwnProperty.call(form, 'comments')) {
          payload.comments = form.comments;
        }
        if (!parentChanged && Object.prototype.hasOwnProperty.call(form, 'deactivate')) {
          payload.deactivate = form.deactivate;
        }
        const result = await saveCriticalActivity(activity.id, payload);
        const updated = applyActivityForm(
          activity,
          parentChanged ? form : payload,
          result,
          barrierDriverById
        );
        const nextActivities = activities.map((r) => (r.id === activity.id ? updated : r));
        setActivities(nextActivities);
        if (onDataChange) {
          onDataChange((current) => ({
            criticalActivities: (current.criticalActivities || []).map((r) =>
              r.id === activity.id ? updated : r
            ),
          }));
        }
        if (onActivityChange) onActivityChange(updated);
        const parent = updated.barrierDriverId ? barrierDriverById.get(updated.barrierDriverId) : null;
        const prompt = buildLinkedBarrierDriverStatusPrompt({
          activity,
          updated,
          rows: nextActivities,
          parent,
          statusOptions: barrierDriverStatusOptions,
        });
        if (prompt) {
          setPendingBarrierDriverStatusConfirm(prompt);
          setPendingBarrierDriverStatusPrompt(null);
          setBarrierDriverStatusPromptValue('');
          setBarrierDriverStatusPromptError('');
        }
      } else {
        const result = await addCriticalActivity(planId, form);
        const created = applyActivityForm(
          {
            id: createdId(result, 'ca'),
            planId,
            parentName: form.parentId ? 'Linked record unavailable' : 'Plan-level',
            parentType: form.parentType || null,
            barrierDriverId: form.parentId || null,
            parentRecordTypeId: form.parentRecordTypeId || null,
            canEditComments: true,
            canDeactivate: true,
            isDeactivated: false,
          },
          form,
          result,
          barrierDriverById
        );
        setActivities((rows) => [created, ...rows]);
        if (onDataChange) {
          onDataChange((current) => ({
            criticalActivities: [created, ...(current.criticalActivities || [])],
          }));
        }
        if (onActivityChange) onActivityChange(created);
      }
      onNotify?.({
        title: 'Critical activity saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      setActivityEditState(null);
    } catch (error) {
      setActivityError(formatCriticalActivitySaveError(error));
    } finally {
      setIsSavingActivity(false);
    }
  };

  const handleDeleteActivity = async (activity) => {
    if (isReadOnly) return;
    if (activity?.isKiteDataAdminCreated) return;
    if (!activity?.id) return;
    setIsSavingActivity(true);
    setActivityError('');
    try {
      await deleteCriticalActivity(activity.id, activity);
      setActivities((rows) => rows.filter((r) => r.id !== activity.id));
      if (onDataChange) {
        onDataChange((current) => ({
          criticalActivities: (current.criticalActivities || []).filter((r) => !r || r.id !== activity.id),
        }));
      }
      if (onActivityChange) onActivityChange({ ...activity, isDeleted: true, isDeactivated: true });
      onNotify?.({
        title: 'Critical activity deleted.',
        detail: 'The activity has been marked deleted.',
        refreshPages: true,
      });
      setActivityEditState(null);
    } catch (error) {
      setActivityError(error?.message || 'Unable to delete critical activity.');
    } finally {
      setIsSavingActivity(false);
    }
  };

  const handleDismissBarrierDriverStatusPrompt = () => {
    if (isSavingBarrierDriverStatus) return;
    setPendingBarrierDriverStatusPrompt(null);
    setBarrierDriverStatusPromptValue('');
    setBarrierDriverStatusPromptError('');
  };

  const handleDismissBarrierDriverStatusConfirm = () => {
    setPendingBarrierDriverStatusConfirm(null);
    setBarrierDriverStatusPromptValue('');
    setBarrierDriverStatusPromptError('');
  };

  const handleOpenBarrierDriverStatusPrompt = () => {
    if (isReadOnly) return;
    const prompt = pendingBarrierDriverStatusConfirm;
    if (!prompt) return;
    setPendingBarrierDriverStatusConfirm(null);
    setPendingBarrierDriverStatusPrompt(prompt);
    setBarrierDriverStatusPromptValue(prompt.initialStatus);
    setBarrierDriverStatusPromptError('');
  };

  const handleBarrierDriverStatusPromptChange = (value) => {
    setBarrierDriverStatusPromptValue(value);
    setBarrierDriverStatusPromptError('');
  };

  const handleSaveBarrierDriverStatusPrompt = async () => {
    if (isReadOnly) return;
    const prompt = pendingBarrierDriverStatusPrompt;
    const status = normalizeBarrierDriverStatusForDisplay(barrierDriverStatusPromptValue);
    if (!prompt?.parentId || !status) return;
    if (prompt.remainingOpenActivityCount > 0 && isClosedBarrierDriverStatus(status)) {
      setBarrierDriverStatusPromptError(linkedBarrierDriverCloseBlockedMessage(prompt));
      return;
    }

    setIsSavingBarrierDriverStatus(true);
    setBarrierDriverStatusPromptError('');
    try {
      await saveBarrierDriverStatus(prompt.parentId, status);
      const applyStatus = (record) =>
        record.id === prompt.parentId
          ? { ...record, status, lastModifiedDate: new Date().toISOString() }
          : record;
      setBarriers((rows) => rows.map(applyStatus));
      setDrivers((rows) => rows.map(applyStatus));
      if (onDataChange) {
        onDataChange((current) => ({
          barriers: (current.barriers || []).map(applyStatus),
          drivers: (current.drivers || []).map(applyStatus),
        }));
      }
      onNotify?.({
        title: `${prompt.parentType} status updated.`,
        detail: `${prompt.parentType} status updated to ${status}.`,
        refreshPages: true,
      });
      setPendingBarrierDriverStatusConfirm(null);
      setPendingBarrierDriverStatusPrompt(null);
      setBarrierDriverStatusPromptValue('');
    } catch (error) {
      setBarrierDriverStatusPromptError(
        error?.message || `Unable to update ${prompt.parentType} status.`
      );
    } finally {
      setIsSavingBarrierDriverStatus(false);
    }
  };

  // --- team member inline editor --------------------------------------------
  // Team members on the home panel are the same `Account_Team_Member_vod__c`
  // rows surfaced by the Team Members page. Save here
  // updates the selected User/name and participation locally (no Veeva writer
  // wired yet — mirrors the existing TeamMembers page behavior).
  const openEditMember = (member) => {
    if (isReadOnly) return;
    setMemberEditState({ member });
  };
  const closeMemberModal = () => setMemberEditState(null);
  const handleSaveMember = (id, form) => {
    if (isReadOnly) return;
    if (hasDuplicateTeamMemberUser(teamMembers, form.userId, id)) {
      throw new Error(DUPLICATE_TEAM_MEMBER_MESSAGE);
    }
    const existingMember =
      teamMembers.find((member) => member.id === id) ||
      memberEditState?.member ||
      { id };
    const updatedMember = applyTeamMemberForm(existingMember, form);
    setTeamMembers((rows) =>
      sortTeamMembersByParticipation(
        rows.map((member) =>
          member.id === id ? applyTeamMemberForm(member, form) : member
        )
      )
    );
    if (onDataChange) {
      onDataChange((current) => ({
        teamMembers: sortTeamMembersByParticipation(
          (current.teamMembers || []).map((member) =>
            member.id === id ? applyTeamMemberForm(member, form) : member
          )
        ),
      }));
    }
    onMemberChange?.(updatedMember);
    onNotify?.({ title: 'Team member saved.', detail: 'Your changes have been saved.' });
  };

  const handleDeleteMember = async (member) => {
    if (isReadOnly || !member?.id) return;
    await deleteTeamMember(member.id);
    setTeamMembers((rows) => rows.filter((row) => row.id !== member.id));
    onDataChange?.((current) => ({
      teamMembers: (current.teamMembers || []).filter((row) => row.id !== member.id),
    }));
    onMemberDelete?.(member.id);
    onNotify?.({
      title: 'Team member deleted.',
      detail: 'The team member has been removed from this account plan.',
      refreshPages: true,
    });
  };

  return (
    <section className="page page-home mock-home-page">
      <AccountStrip plan={data.plan} account={data.account} header={data.header} />
     
      {isPotentialAtc && (
        <PreAuthStatusPhase
         currentPhase={accountPhase || data?.account?.PreAuthStatusPhases}
         dryRunDate={dryRundate}
        />
      )}
      <div className="mock-home-top-grid">
        <ServiceLineGoals customerGoals={customerGoals} onEdit={isReadOnly ? null : handleEditGoals} />
        <KiteStrategy dlbcl={data.strategies.dlbcl} mm={data.strategies.mm} />
      </div>

      <div className="mock-home-main-grid">
        <BarriersDriversSummary
          tables={summaryTables}
          openActivityCountByBarrier={openActivityCountByBarrier}
          onEditRow={isReadOnly ? null : openEditBarrierDriver}
        />

        <aside className="home-side-stack">
          <UrgentActivities activities={urgentActivities} onEditActivity={isReadOnly ? null : openEditActivity} />
          <PodUsers users={teamMembers} onEditMember={isReadOnly ? null : openEditMember} />
        </aside>
      </div>

      {!isReadOnly && isGoalsModalOpen && (
        <ServiceLineGoalsEditModal
          value={customerGoals}
          isSaving={isSavingGoals}
          error={goalsError}
          onClose={() => setIsGoalsModalOpen(false)}
          onSave={handleSaveGoals}
        />
      )}

      {!isReadOnly && bdEditState && (
        <BarrierDriverEditModal
          record={bdEditState.record}
          defaultType={bdEditState.record?.type || 'Barrier'}
          picklists={picklists}
          isSaving={isSavingBd}
          error={bdError}
          onClose={closeBdModal}
          onSave={handleSaveBarrierDriver}
          modalClassName="home-bd-detail-modal"
          headerSubtitle={bdEditState.record?.name || 'Untitled'}
        >
          <HomeBarrierDriverActivities
            key={bdEditState.record.id}
            record={bdEditState.record}
            activities={selectedBarrierDriverActivities}
            onEditActivity={openActivityFromBarrierDriverModal}
          />
        </BarrierDriverEditModal>
      )}

      {!isReadOnly && activityEditState && (
        <CriticalActivityEditModal
          activity={activityEditState.activity}
          parentRecord={activityEditState.parentRecord}
          barrierDriverOptions={allBarrierDriverRecords}
          indicationOptions={indicationOptions}
          accountableOptions={accountableOptions}
          statusOptions={picklists.activityStatuses || []}
          editDisabledReason={closedParentEditReason(activityEditState.activity)}
          isSaving={isSavingActivity}
          error={activityError}
          onClose={closeActivityModal}
          onSave={(form) => handleSaveActivity(activityEditState.activity, form)}
          onDelete={handleDeleteActivity}
        />
      )}

      {!isReadOnly && pendingBarrierDriverStatusConfirm && (
        <LinkedBarrierDriverStatusConfirmModal
          prompt={pendingBarrierDriverStatusConfirm}
          onDismiss={handleDismissBarrierDriverStatusConfirm}
          onConfirm={handleOpenBarrierDriverStatusPrompt}
        />
      )}

      {!isReadOnly && pendingBarrierDriverStatusPrompt && (
        <LinkedBarrierDriverStatusPromptModal
          prompt={pendingBarrierDriverStatusPrompt}
          value={barrierDriverStatusPromptValue}
          error={barrierDriverStatusPromptError}
          isSaving={isSavingBarrierDriverStatus}
          onChange={handleBarrierDriverStatusPromptChange}
          onDismiss={handleDismissBarrierDriverStatusPrompt}
          onSave={handleSaveBarrierDriverStatusPrompt}
        />
      )}

      {!isReadOnly && memberEditState && (
        <TeamMemberEditModal
          member={memberEditState.member}
          participationOptions={picklists.participationOptions || []}
          statusOptions={picklists.statusOptions || []}
          searchUsers={searchAvailableTeamUsers}
          onClose={closeMemberModal}
          onSave={handleSaveMember}
          onDelete={handleDeleteMember}
        />
      )}
    </section>
  );
}

const mergeRecord = (list, record) => {
  const rows = list || [];
  return rows.some((r) => r.id === record.id)
    ? rows.map((r) => (r.id === record.id ? record : r))
    : [record, ...rows];
};
