import { isAccountPlanReadOnly } from './accountPlanReadOnly.js';

export const MPD_APPROVAL_RESTRICTED_PROFILES = [
  'KPH-Key Account Director',
  'KPH-CTAM Manager',
];

export const CTAM_MANAGER_PROFILE = 'KPH-CTAM Manager';

const normalizeProfileName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const RESTRICTED_PROFILE_NAMES = new Set(
  MPD_APPROVAL_RESTRICTED_PROFILES.map(normalizeProfileName)
);

export const isMpdApprovalRestrictedProfile = (profileName) =>
  RESTRICTED_PROFILE_NAMES.has(normalizeProfileName(profileName));

export const isCtamManagerProfile = (profileName) =>
  normalizeProfileName(profileName) === normalizeProfileName(CTAM_MANAGER_PROFILE);

export const isAccountPlanReadOnlyForProfile = (plan, profileName) =>
  !isCtamManagerProfile(profileName) && isAccountPlanReadOnly(plan);
