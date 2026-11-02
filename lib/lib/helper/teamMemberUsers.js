export const DUPLICATE_TEAM_MEMBER_MESSAGE =
  'This team member is already added to the account plan.';

const SF_ID_PATTERN = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;

export const normalizeTeamMemberUserId = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return SF_ID_PATTERN.test(text) ? text.slice(0, 15).toLowerCase() : text.toLowerCase();
};

export const teamMemberUserIds = (members = [], exceptMemberId = null) =>
  new Set(
    (members || [])
      .filter((member) => !exceptMemberId || member?.id !== exceptMemberId)
      .map((member) => normalizeTeamMemberUserId(member?.userId))
      .filter(Boolean)
  );

export const teamMemberRawUserIds = (members = [], exceptMemberId = null) =>
  (members || [])
    .filter((member) => !exceptMemberId || member?.id !== exceptMemberId)
    .map((member) => String(member?.userId || '').trim())
    .filter(Boolean);

export const hasDuplicateTeamMemberUser = (members, userId, exceptMemberId = null) =>
  teamMemberUserIds(members, exceptMemberId).has(normalizeTeamMemberUserId(userId));

export const filterExistingTeamMemberUsers = (users = [], excludedUserIds = new Set()) =>
  (users || []).filter((user) => !excludedUserIds.has(normalizeTeamMemberUserId(user?.id)));
