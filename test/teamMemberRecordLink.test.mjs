import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);
const teamMembersModulePath = new URL('../src/lib/dataservice/accountPlan/teamMembers.js', import.meta.url);
const teamMembersPagePath = new URL('../src/pages/TeamMembers/index.jsx', import.meta.url);
const teamMembersCssPath = new URL('../src/pages/TeamMembers/TeamMembers.css', import.meta.url);

const loadSharedModule = async () => {
  globalThis.__teamMemberLookupQueries = [];

  const queryStubUrl = dataModule(`
    export const runQuery = (params) => {
      globalThis.__teamMemberLookupQueries.push(params);
      return Promise.resolve([{ Id: '0058C00000UserAAA', Name: 'Albin Karimattam' }]);
    };
    export const getDataForCurrentObject = (object, field) =>
      Promise.resolve(object === 'User' && field === 'Username' ? 'medical.user@kitepharma.com.kitefull' : null);
    export const unwrap = (row) => row || null;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const toCanonicalSalesforceId = (id) => id || null;
    export const salesforceIdVariants = (id) => id ? [id] : [];
    export const createRecord = () => Promise.resolve({ data: { id: 'new-record-id' } });
    export const updateRecord = () => Promise.resolve({ data: { id: 'record-id' } });
  `);
  const clientStubUrl = dataModule('export const isOnline = () => false;');
  const utilsStubUrl = dataModule(
    'export const normalizeCrmBoolean = (value) => value;'
  );

  const source = (await readFile(sharedModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/client['"]/g, `from '${clientStubUrl}'`)
    .replace(/from ['"]@\/lib\/helper\/utils['"]/g, `from '${utilsStubUrl}'`);

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return { mod, queries: globalThis.__teamMemberLookupQueries };
};

test('team member popup lookup queries User records', async () => {
  const { mod, queries } = await loadSharedModule();

  const rows = await mod.searchUsers('albin', 60);

  assert.equal(queries[0].object, 'User');
  assert.deepEqual(queries[0].fields, ['Id', 'Name']);
  assert.match(queries[0].where, /Name LIKE '%albin%'/);
  assert.deepEqual(rows, [{ id: '0058C00000UserAAA', name: 'Albin Karimattam' }]);
});

test('current CRM username is fetched from the User object for iPad link routing', async () => {
  const { mod } = await loadSharedModule();

  assert.equal(
    await mod.getCurrentUserUsername(),
    'medical.user@kitepharma.com.kitefull'
  );
});

test('Team Members page renders names as Lightning User record hyperlinks', async () => {
  const moduleSource = await readFile(teamMembersModulePath, 'utf8');
  const pageSource = await readFile(teamMembersPagePath, 'utf8');
  const cssSource = await readFile(teamMembersCssPath, 'utf8');

  assert.doesNotMatch(moduleSource, /viewRecord/);
  assert.doesNotMatch(moduleSource, /viewTeamMemberRecord/);
  assert.doesNotMatch(moduleSource, /teamMemberRecordTarget/);
  assert.doesNotMatch(pageSource, /viewTeamMemberRecord/);
  assert.doesNotMatch(pageSource, /teamMemberRecordTarget/);
  assert.match(pageSource, /salesforceRecordBaseUrl\('User', undefined, currentUserUsername\)/);
  assert.match(pageSource, /teamMemberUserRecordUrl\(member\.userId, currentUserUsername\)/);
  assert.match(pageSource, /team-member-record-link/);
  assert.match(pageSource, /target="_top"/);
  assert.match(pageSource, /<strong>\{member\.name\}<\/strong>/);
  assert.match(cssSource, /team-member-record-link/);
});
