import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);
const stakeholdersModulePath = new URL('../src/lib/dataservice/accountPlan/stakeholders.js', import.meta.url);
const stakeholdersPagePath = new URL('../src/pages/Stakeholders/index.jsx', import.meta.url);
const stakeholderModalPath = new URL('../src/pages/Stakeholders/StakeholderEditModal.jsx', import.meta.url);
const teamMembersModulePath = new URL('../src/lib/dataservice/accountPlan/teamMembers.js', import.meta.url);
const teamMembersPagePath = new URL('../src/pages/TeamMembers/index.jsx', import.meta.url);
const teamMemberModalPath = new URL('../src/pages/TeamMembers/TeamMemberEditModal.jsx', import.meta.url);
const overviewPagePath = new URL('../src/pages/Overview/index.jsx', import.meta.url);
const referralModalPath = new URL('../src/pages/AccountProfile/ReferralAccountEditModal.jsx', import.meta.url);
const accountProfileModulePath = new URL('../src/lib/dataservice/accountPlan/accountProfile.js', import.meta.url);
const healthcareNetworkModalPath = new URL('../src/pages/AccountProfile/HealthcareNetworkEditModal.jsx', import.meta.url);
const accountInsightModalPath = new URL('../src/pages/AccountProfile/AccountInsightEditModal.jsx', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const desktopRecordNotFoundError = () => ({
  actions: [
    {
      state: 'ERROR',
      error: [
        {
          event: {
            descriptor: 'markup://aura:serverActionError',
            attributes: {
              values: {
                error: {
                  message: 'The requested resource does not exist',
                  data: {
                    message: 'The requested resource does not exist',
                    statusCode: 404,
                    errorCode: 'NOT_FOUND',
                  },
                },
              },
            },
          },
        },
      ],
    },
  ],
});

const loadSharedModule = async ({ online = false, updateError = null, teamMemberRows = null } = {}) => {
  globalThis.__stakeholderSoftDeleteQueries = [];
  globalThis.__stakeholderSoftDeleteUpdates = [];
  globalThis.__stakeholderSoftDeleteUpdateError = updateError;
  globalThis.__stakeholderSoftDeleteTeamMemberRows = teamMemberRows;

  const queryStubUrl = dataModule(`
    export const runQuery = (params) => {
      globalThis.__stakeholderSoftDeleteQueries.push(params);
      if (params.object === 'Account') {
        return Promise.resolve([{ Id: '0038C00000MockHcp1', Name: 'Elena Martin', IsPersonAccount: true }]);
      }
      if (params.object === 'Account_Team_Member_vod__c') {
        return Promise.resolve(globalThis.__stakeholderSoftDeleteTeamMemberRows || []);
      }
      return Promise.resolve([
        {
          Id: 'stk-visible',
          KPH_Account_Plan__c: 'plan-001',
          KPH_Account__c: '0038C00000MockHcp1',
          KPH_First_Name__c: 'Elena',
          KPH_Last_Name__c: 'Martin',
          KPH_Is_Deleted__c: false,
        },
        {
          Id: 'stk-non-person',
          KPH_Account_Plan__c: 'plan-001',
          KPH_Account__c: '0018C00000SiteOnly',
          KPH_First_Name__c: 'Site',
          KPH_Last_Name__c: 'Account',
          KPH_Is_Deleted__c: false,
        },
      ]);
    };
    export const getDataForCurrentObject = () => Promise.resolve(null);
    export const unwrap = (row) => row || null;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const toCanonicalSalesforceId = (id) => {
      if (!id) return null;
      return String(id).length === 15 ? String(id) + 'XYZ' : String(id);
    };
    export const salesforceIdVariants = (id) => id ? [id] : [];
    export const createRecord = () => Promise.resolve({ data: { id: 'new-stakeholder-id' } });
    export const updateRecord = (object, id, fields) => {
      globalThis.__stakeholderSoftDeleteUpdates.push({ object, id, fields });
      if (globalThis.__stakeholderSoftDeleteUpdateError) {
        return Promise.reject(globalThis.__stakeholderSoftDeleteUpdateError);
      }
      return Promise.resolve({ data: { id } });
    };
  `);
  const clientStubUrl = dataModule(`export const isOnline = () => ${online ? 'true' : 'false'};`);
  const utilsStubUrl = dataModule('export const normalizeCrmBoolean = (value) => Boolean(value);');

  const source = (await readFile(sharedModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/client['"]/g, `from '${clientStubUrl}'`)
    .replace(/from ['"]@\/lib\/helper\/utils['"]/g, `from '${utilsStubUrl}'`);

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return {
    mod,
    queries: globalThis.__stakeholderSoftDeleteQueries,
    updates: globalThis.__stakeholderSoftDeleteUpdates,
  };
};

test('fetchStakeholders excludes soft-deleted KPH_Stakeholder_Map__c records', async () => {
  const { mod, queries } = await loadSharedModule();

  const rows = await mod.fetchStakeholders('plan-001');

  const stakeholderQuery = queries.find((query) => query.object === 'KPH_Stakeholder_Map__c');
  assert.ok(stakeholderQuery);
  assert.equal(stakeholderQuery.fields.includes('KPH_Account_Plan__c'), false);
  assert.equal(stakeholderQuery.fields.includes('KPH_Key_Stakeholder__c'), false);
  assert.equal(stakeholderQuery.fields.includes('KPH_Is_Deleted__c'), false);
  assert.ok(stakeholderQuery.fields.includes('Stakeholder_NPI__c'));
  assert.ok(stakeholderQuery.fields.includes('Stakeholder_Account_Class__c'));
  assert.equal(stakeholderQuery.fields.includes('KPH_DLBCL_Influence__c'), false);
  assert.ok(stakeholderQuery.fields.includes('KPH_DLBCL_Clinical_Influence__c'));
  assert.ok(stakeholderQuery.fields.includes('KPH_DLBCL_Operational_Influence__c'));
  assert.ok(stakeholderQuery.fields.includes('KPH_DLBCL_Financial_Influence__c'));
  assert.equal(stakeholderQuery.fields.includes('KPH_DLBCL_Administrative_Champion__c'), false);
  assert.equal(stakeholderQuery.fields.includes('KPH_DLBCL_Clinical_Champion__c'), false);
  assert.equal(stakeholderQuery.fields.includes('KPH_MM_Influence__c'), false);
  assert.ok(stakeholderQuery.fields.includes('KPH_MM_Clinical_Influence__c'));
  assert.ok(stakeholderQuery.fields.includes('KPH_MM_Operational_Influence__c'));
  assert.ok(stakeholderQuery.fields.includes('KPH_MM_Financial_Influence__c'));
  assert.equal(stakeholderQuery.fields.includes('KPH_MM_Administrative_Champion__c'), false);
  assert.equal(stakeholderQuery.fields.includes('KPH_MM_Clinical_Champion__c'), false);
  assert.match(stakeholderQuery.where, /KPH_Account_Plan__c = 'plan-001'/);
  assert.doesNotMatch(stakeholderQuery.where, /KPH_Account__r\.IsPersonAccount/);
  assert.match(stakeholderQuery.where, /KPH_Is_Deleted__c\s*=\s*false/);
  assert.match(stakeholderQuery.where, /KPH_Is_Deleted__c\s*=\s*null/);

  const accountQuery = queries.find((query) => query.object === 'Account');
  assert.ok(accountQuery);
  assert.match(accountQuery.where, /IsPersonAccount\s*=\s*true/);
  assert.deepEqual(rows.map((row) => row.id), ['stk-visible']);
});

test('deleteStakeholder soft deletes the stakeholder map record', async () => {
  const { mod, updates } = await loadSharedModule();

  await mod.deleteStakeholder('stk-001');

  assert.deepEqual(updates[0], {
    object: 'KPH_Stakeholder_Map__c',
    id: 'stk-001',
    fields: { KPH_Is_Deleted__c: true },
  });
});

test('fetchTeamMembersByPlan excludes soft-deleted Account_Team_Member_vod__c records', async () => {
  const { mod, queries } = await loadSharedModule();

  await mod.fetchTeamMembersByPlan('plan-001');

  const teamMemberQuery = queries.find((query) => query.object === 'Account_Team_Member_vod__c');
  assert.ok(teamMemberQuery);
  assert.ok(teamMemberQuery.fields.includes('KPH_Is_Deleted__c'));
  assert.match(teamMemberQuery.where, /Account_Plan_vod__c = 'plan-001'/);
  assert.match(teamMemberQuery.where, /KPH_Is_Deleted__c\s*=\s*false/);
  assert.match(teamMemberQuery.where, /KPH_Is_Deleted__c\s*=\s*null/);
});

test('fetchTeamMembersByPlan maps wrapped CRM active flag into team member status', async () => {
  const { mod } = await loadSharedModule({
    teamMemberRows: [
      {
        Id: 'tm-active',
        Name: 'Priya Kumar',
        Account_Team_Member_Active__c: { value: true, display: 'Active' },
      },
      {
        Id: 'tm-inactive',
        Name: 'James Chen',
        Account_Team_Member_Active__c: { value: false, display: 'Inactive' },
      },
    ],
  });

  const rows = await mod.fetchTeamMembersByPlan('plan-001');
  const activeById = Object.fromEntries(rows.map((row) => [row.id, row.isPrimary]));

  assert.equal(activeById['tm-active'], true);
  assert.equal(activeById['tm-inactive'], false);
});

test('deleteTeamMember soft deletes the team member record', async () => {
  const { mod, updates } = await loadSharedModule();

  await mod.deleteTeamMember('tm-001');

  assert.deepEqual(updates[0], {
    object: 'Account_Team_Member_vod__c',
    id: 'tm-001',
    fields: { KPH_Is_Deleted__c: true },
  });
});

test('fetchReferralAccounts excludes soft-deleted referral mapping records', async () => {
  const { mod, queries } = await loadSharedModule();

  await mod.fetchReferralAccounts('plan-001', 'profile-001');

  const referralQuery = queries.find((query) => query.object === 'KPH_Ecosystem_Map_Dynamics__c');
  assert.ok(referralQuery);
  assert.deepEqual(referralQuery.fields, [
    'Id',
    'Name',
    'Indication__c',
    'KPH_HCO_Classification__c',
    'KPH_of_HCP_Targets_within_a_Site__c',
    'KPH_Referral_Count__c',
    'KPH_Referral_Priority__c',
    'KPH_X2L_DLBCL_Treated_Patients__c',
    'KPH_Comments__c',
    'Name_of_Site__c',
  ]);
  assert.match(referralQuery.where, /Account_Plan_vod__c = 'plan-001'/);
  assert.match(referralQuery.where, /KPH_Account_Profile__c = 'profile-001'/);
  assert.match(referralQuery.where, /KPH_Is_Deleted__c\s*=\s*false/);
  assert.match(referralQuery.where, /KPH_Is_Deleted__c\s*=\s*null/);
});

test('deleteReferralAccount soft deletes the referral mapping record', async () => {
  const { mod, updates } = await loadSharedModule();

  await mod.deleteReferralAccount('ref-001');

  assert.deepEqual(updates[0], {
    object: 'KPH_Ecosystem_Map_Dynamics__c',
    id: 'ref-001',
    fields: { KPH_Is_Deleted__c: true },
  });
});

test('fetchHealthcareNetworks excludes soft-deleted other healthcare network records', async () => {
  const { mod, queries } = await loadSharedModule();

  await mod.fetchHealthcareNetworks('profile-001');

  const healthcareNetworkQuery = queries.find((query) => query.object === 'KPH_Other_Healthcare_Networks__c');
  assert.ok(healthcareNetworkQuery);
  assert.deepEqual(healthcareNetworkQuery.fields, [
    'Id',
    'Name',
    'KPH_Account_Name__c',
    'KPH_Kite_Accountable__c',
  ]);
  assert.doesNotMatch(healthcareNetworkQuery.where, /KPH_Account_Name__c/);
  assert.match(healthcareNetworkQuery.where, /KPH_Account_Profile__c = 'profile-001'/);
  assert.match(healthcareNetworkQuery.where, /KPH_Is_Deleted__c\s*=\s*false/);
  assert.match(healthcareNetworkQuery.where, /KPH_Is_Deleted__c\s*=\s*null/);
});

test('deleteHealthcareNetwork soft deletes the other healthcare network record', async () => {
  const { mod, updates } = await loadSharedModule();

  await mod.deleteHealthcareNetwork('net-001');

  assert.deepEqual(updates[0], {
    object: 'KPH_Other_Healthcare_Networks__c',
    id: 'net-001',
    fields: { KPH_Is_Deleted__c: true },
  });
});

test('fetchAccountInsights excludes soft-deleted monthly executive summary records', async () => {
  const { mod, queries } = await loadSharedModule();

  await mod.fetchAccountInsights('plan-001', 'profile-001');

  const accountInsightQuery = queries.find((query) => query.object === 'KPH_Monthly_Executive_Summary__c');
  assert.ok(accountInsightQuery);
  assert.equal(accountInsightQuery.fields.includes('KPH_Is_Deleted__c'), false);
  assert.equal(accountInsightQuery.fields.includes('KPH_Account_Plan__c'), false);
  assert.equal(accountInsightQuery.fields.includes('KPH_Account_Profile__c'), false);
  assert.equal(accountInsightQuery.fields.includes('LastModifiedDate'), false);
  assert.doesNotMatch(accountInsightQuery.where, /KPH_Account_Plan__c/);
  assert.match(accountInsightQuery.where, /KPH_Account_Profile__c = 'profile-001'/);
  assert.match(accountInsightQuery.where, /KPH_Is_Deleted__c\s*=\s*false/);
  assert.match(accountInsightQuery.where, /KPH_Is_Deleted__c\s*=\s*null/);
});

test('deleteAccountInsight soft deletes the monthly executive summary record', async () => {
  const { mod, updates } = await loadSharedModule();

  await mod.deleteAccountInsight('insight-001');

  assert.deepEqual(updates[0], {
    object: 'KPH_Monthly_Executive_Summary__c',
    id: 'insight-001',
    fields: { KPH_Is_Deleted__c: true },
  });
});

test('desktop soft deletes canonicalize 15-character record ids for online updateRecord', async () => {
  const { mod, updates } = await loadSharedModule({ online: true });

  await mod.deleteTeamMember('a4D8C00000ABCDE');
  await mod.deleteStakeholder('a5E8C00000ABCDE');
  await mod.deleteReferralAccount('a5k8C00000ABCDE');
  await mod.deleteHealthcareNetwork('a5n8C00000ABCDE');
  await mod.deleteAccountInsight('a5s8C00000ABCDE');

  assert.deepEqual(
    updates.map((update) => [update.object, update.id]),
    [
      ['Account_Team_Member_vod__c', 'a4D8C00000ABCDEXYZ'],
      ['KPH_Stakeholder_Map__c', 'a5E8C00000ABCDEXYZ'],
      ['KPH_Ecosystem_Map_Dynamics__c', 'a5k8C00000ABCDEXYZ'],
      ['KPH_Other_Healthcare_Networks__c', 'a5n8C00000ABCDEXYZ'],
      ['KPH_Monthly_Executive_Summary__c', 'a5s8C00000ABCDEXYZ'],
    ]
  );
  assert.ok(updates.every((update) => update.fields.KPH_Is_Deleted__c === true));
});

test('desktop soft delete treats Aura NOT_FOUND after update as successful delete', async () => {
  const { mod, updates } = await loadSharedModule({
    online: true,
    updateError: desktopRecordNotFoundError(),
  });

  const result = await mod.deleteStakeholder('a5E8C00000ABCDE');

  assert.deepEqual(updates[0], {
    object: 'KPH_Stakeholder_Map__c',
    id: 'a5E8C00000ABCDEXYZ',
    fields: { KPH_Is_Deleted__c: true },
  });
  assert.equal(result.success, true);
  assert.equal(result.desktopNotFoundAfterDelete, true);
  assert.deepEqual(result.data, { id: 'a5E8C00000ABCDEXYZ' });
});

test('iPad soft delete does not swallow Aura NOT_FOUND update errors', async () => {
  const error = desktopRecordNotFoundError();
  const { mod, updates } = await loadSharedModule({ updateError: error });

  await assert.rejects(() => mod.deleteStakeholder('a5E8C00000ABCDE'), (actual) => actual === error);

  assert.deepEqual(updates[0], {
    object: 'KPH_Stakeholder_Map__c',
    id: 'a5E8C00000ABCDE',
    fields: { KPH_Is_Deleted__c: true },
  });
});

test('desktop soft delete still surfaces non-NOT_FOUND update errors', async () => {
  const error = new Error('Validation failed');
  const { mod } = await loadSharedModule({ online: true, updateError: error });

  await assert.rejects(() => mod.deleteStakeholder('a5E8C00000ABCDE'), (actual) => actual === error);
});

test('Stakeholders page wires delete through the edit modal and local row removal', async () => {
  const pageSource = await readFile(stakeholdersPagePath, 'utf8');
  const dataModuleSource = await readFile(stakeholdersModulePath, 'utf8');

  assert.match(dataModuleSource, /deleteStakeholder/);
  assert.match(pageSource, /deleteStakeholder/);
  assert.match(pageSource, /const deleteStakeholderRow = async \(stakeholder\) =>/);
  assert.match(pageSource, /setStakeholders\(\(current\) => current\.filter\(\(row\) => row\.id !== stakeholder\.id\)\)/);
  assert.match(pageSource, /onDelete=\{deleteStakeholderRow\}/);
});

test('Team Members page and Home modal wire delete through TeamMemberEditModal', async () => {
  const teamMembersModuleSource = await readFile(teamMembersModulePath, 'utf8');
  const teamMembersPageSource = await readFile(teamMembersPagePath, 'utf8');
  const teamMemberModalSource = await readFile(teamMemberModalPath, 'utf8');
  const overviewPageSource = await readFile(overviewPagePath, 'utf8');

  assert.match(teamMembersModuleSource, /deleteTeamMember/);
  assert.match(teamMembersPageSource, /deleteTeamMember/);
  assert.match(teamMembersPageSource, /const deleteMember = async \(member\) =>/);
  assert.match(teamMembersPageSource, /setRows\(\(current\) => current\.filter\(\(row\) => row\.id !== member\.id\)\)/);
  assert.match(teamMembersPageSource, /onDelete=\{deleteMember\}/);
  assert.match(overviewPageSource, /deleteTeamMember/);
  assert.match(overviewPageSource, /const handleDeleteMember = async \(member\) =>/);
  assert.match(overviewPageSource, /onDelete=\{handleDeleteMember\}/);
  assert.match(teamMemberModalSource, /Confirm delete for this team member record/);
  assert.match(teamMemberModalSource, /Confirm Delete/);
  assert.match(teamMemberModalSource, /Keep Record/);
});

test('Stakeholder delete confirmation hides generic Cancel and Save actions', async () => {
  const modalSource = await readFile(stakeholderModalPath, 'utf8');

  assert.match(modalSource, /const \[deleteConfirm, setDeleteConfirm\] = useState\(false\);/);
  assert.match(modalSource, /Confirm delete for this stakeholder record/);
  assert.match(modalSource, /Confirm Delete/);
  assert.match(modalSource, /Keep Record/);
  assert.match(modalSource, /isEdit && !deleteConfirm/);
  assert.match(
    modalSource,
    /!deleteConfirm && \(\s*<>\s*<button[\s\S]*?>\s*Cancel\s*<\/button>[\s\S]*<button type="submit"[\s\S]*>\s*\{isSaving \? 'Saving\.\.\.' : isNew \? 'Add Stakeholder' : 'Save'\}\s*<\/button>\s*<\/>\s*\)/
  );
});

test('Referral Mapping delete confirmation also hides generic Cancel and Save actions', async () => {
  const modalSource = await readFile(referralModalPath, 'utf8');

  assert.match(modalSource, /deleteConfirm && \(/);
  assert.match(modalSource, /!deleteConfirm && \(/);
  assert.match(modalSource, /Confirm delete for this referral mapping record/);
  assert.match(modalSource, /Confirm Delete/);
  assert.match(modalSource, /Keep Record/);
  assert.match(
    modalSource,
    /!deleteConfirm && \(\s*<>\s*<button[\s\S]*?>\s*Cancel\s*<\/button>[\s\S]*<button type="submit"[\s\S]*>\s*\{isSaving \? 'Saving' : 'Save'\}\s*<\/button>\s*<\/>\s*\)/
  );
});

test('Healthcare Network delete uses soft delete export and confirmation UI', async () => {
  const moduleSource = await readFile(accountProfileModulePath, 'utf8');
  const modalSource = await readFile(healthcareNetworkModalPath, 'utf8');

  assert.match(moduleSource, /deleteHealthcareNetwork as softDeleteHealthcareNetwork/);
  assert.match(moduleSource, /export const deleteHealthcareNetwork = softDeleteHealthcareNetwork/);
  assert.doesNotMatch(moduleSource, /deleteRecord\('KPH_Other_Healthcare_Networks__c'/);
  assert.match(modalSource, /const \[deleteConfirm, setDeleteConfirm\] = useState\(false\);/);
  assert.match(modalSource, /Confirm delete for this healthcare network record/);
  assert.match(modalSource, /Confirm Delete/);
  assert.match(modalSource, /Keep Record/);
  assert.match(
    modalSource,
    /!deleteConfirm && \(\s*<>\s*<button[\s\S]*?>\s*Cancel\s*<\/button>[\s\S]*<button type="submit"[\s\S]*>\s*\{isSaving \? 'Saving' : 'Save'\}\s*<\/button>\s*<\/>\s*\)/
  );
});

test('Account Insight delete confirmation also hides generic Cancel and Save actions', async () => {
  const modalSource = await readFile(accountInsightModalPath, 'utf8');

  assert.match(modalSource, /const \[deleteConfirm, setDeleteConfirm\] = useState\(false\);/);
  assert.match(modalSource, /deleteConfirm && \(/);
  assert.match(modalSource, /!deleteConfirm && \(/);
  assert.match(modalSource, /Confirm delete for this account insight record/);
  assert.match(modalSource, /Confirm Delete/);
  assert.match(modalSource, /Keep Record/);
  assert.match(
    modalSource,
    /!deleteConfirm && \(\s*<>\s*<button[\s\S]*?>\s*Cancel\s*<\/button>[\s\S]*<button type="submit"[\s\S]*>\s*\{isSaving \? 'Saving' : 'Save'\}\s*<\/button>\s*<\/>\s*\)/
  );
});
