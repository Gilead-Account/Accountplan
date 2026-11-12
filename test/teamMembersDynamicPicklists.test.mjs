import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const teamMembersModulePath = new URL('../src/lib/dataservice/accountPlan/teamMembers.js', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadTeamMembersModule = async () => {
  globalThis.__teamMemberPicklistCalls = [];
  globalThis.__teamMemberPicklistLabels = {
    Account_Team_Member_vod__c: {
      KPH_Participation__c: {
        Core: 'Core',
        Lead: 'Lead',
      },
      Account_Team_Member_Active__c: {
        Active: 'Active',
        Inactive: 'Inactive',
      },
    },
  };

  const sharedStubUrl = dataModule(`
    export const createTeamMember = () => Promise.resolve({});
    export const deleteTeamMember = () => Promise.resolve({});
    export const fetchTeamMembersByPlan = () => Promise.resolve([
      { id: 'tm-001', name: 'Priya Kumar', participation: 'Extended', isPrimary: true },
    ]);
    export const requireCurrentAccountPlanId = () => Promise.resolve('plan-001');
    export const resolveShellContextForPlanId = () => Promise.resolve({
      planId: 'plan-001',
      plan: { id: 'plan-001' },
      account: { id: 'account-001' },
    });
    export const resolveShellContext = resolveShellContextForPlanId;
    export const searchUsers = () => Promise.resolve([]);
    export const sortTeamMembersByParticipation = (members) => members || [];
    export const updateTeamMember = () => Promise.resolve({});
  `);
  const queryStubUrl = dataModule(`
    export const getPicklistValueLabels = (object, field) => {
      globalThis.__teamMemberPicklistCalls.push({ object, field });
      return Promise.resolve(
        (globalThis.__teamMemberPicklistLabels[object] &&
          globalThis.__teamMemberPicklistLabels[object][field]) ||
        {}
      );
    };
    export const viewRecord = () => Promise.resolve({ success: true });
  `);

  const source = (await readFile(teamMembersModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/accountPlan\/shared['"]/g, `from '${sharedStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`);

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return { mod, calls: globalThis.__teamMemberPicklistCalls };
};

test('loadTeamMembers fetches participation and status options from CRM picklist metadata', async () => {
  const { mod, calls } = await loadTeamMembersModule();

  const data = await mod.loadTeamMembers();

  assert.ok(calls.some((call) =>
    call.object === 'Account_Team_Member_vod__c' && call.field === 'KPH_Participation__c'
  ));
  assert.ok(calls.some((call) =>
    call.object === 'Account_Team_Member_vod__c' && call.field === 'Account_Team_Member_Active__c'
  ));
  assert.deepEqual(data.picklists.participationOptions, ['Core', 'Lead', 'Extended']);
  assert.deepEqual(data.picklists.statusOptions, ['Active', 'Inactive']);
});
