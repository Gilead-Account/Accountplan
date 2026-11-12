import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithEsbuild } from 'vite';

const poaPagePath = new URL('../src/pages/CrossFunctionalPlan/index.jsx', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadPoaPageModule = async () => {
  const utilsStubUrl = dataModule(`
    export const formatDateLabel = (value, fallback) => value || fallback;
  `);
  const serviceStubUrl = dataModule(`
    export const savePoaBlock = () => Promise.resolve({});
  `);
  const fieldStubUrl = dataModule(`
    export const FieldHelpButton = () => ({});
  `);
  const reactStubUrl = dataModule(`
    export const useEffect = () => {};
    export const useMemo = (factory) => factory();
    export const useRef = () => ({ current: null });
    export const useState = (initialValue) => [
      typeof initialValue === 'function' ? initialValue() : initialValue,
      () => {}
    ];
  `);
  const jsxRuntimeStubUrl = dataModule(`
    export const Fragment = Symbol('Fragment');
    export const jsx = () => ({});
    export const jsxs = () => ({});
  `);

  const source = (await readFile(poaPagePath, 'utf8'))
    .replace(/from ['"]@\/components\/EditModalField['"]/g, `from '${fieldStubUrl}'`)
    .replace(/from ['"]@\/lib\/helper\/utils['"]/g, `from '${utilsStubUrl}'`)
    .replace(
      /from ['"]@\/lib\/dataservice\/accountPlan\/crossFunctionalPlan['"]/g,
      `from '${serviceStubUrl}'`
    );

  const transformed = await transformWithEsbuild(source, 'CrossFunctionalPlan/index.jsx', {
    loader: 'jsx',
    jsx: 'automatic',
  });
  const code = transformed.code
    .replace(/from ['"]react['"]/g, `from '${reactStubUrl}'`)
    .replace(/from ['"]react\/jsx-runtime['"]/g, `from '${jsxRuntimeStubUrl}'`);

  return import(`${dataModule(code)}#${Date.now()}-${Math.random()}`);
};

const poaBlock = (functionName) => ({ key: functionName, functionName });

test('POA visibility and edit access follow function rules', async () => {
  const mod = await loadPoaPageModule();
  const commercialUser = { profileName: 'Commercial Profile' };
  const marketAccessUser = { role: 'Market Access Director' };
  const marketAccessProfileUser = { profileName: 'KPH-Key Account Director' };
  const medicalUser = { role: 'Medical Science Liaison' };
  const commercialBlock = poaBlock('Customer Engagement');
  const marketAccessBlock = poaBlock('Market Access');
  const medicalBlock = poaBlock('Medical Affairs');

  assert.equal(mod.canViewPoaBlock(commercialUser, commercialBlock), true);
  assert.equal(mod.canViewPoaBlock(commercialUser, marketAccessBlock), true);
  assert.equal(mod.canViewPoaBlock(commercialUser, medicalBlock), true);
  assert.equal(mod.canEditPoaBlock(commercialUser, commercialBlock), true);
  assert.equal(mod.canEditPoaBlock(commercialUser, marketAccessBlock), false);
  assert.equal(mod.canEditPoaBlock(commercialUser, medicalBlock), false);

  assert.equal(mod.canViewPoaBlock(marketAccessUser, commercialBlock), true);
  assert.equal(mod.canViewPoaBlock(marketAccessUser, marketAccessBlock), true);
  assert.equal(mod.canViewPoaBlock(marketAccessUser, medicalBlock), true);
  assert.equal(mod.canEditPoaBlock(marketAccessUser, marketAccessBlock), true);
  assert.equal(mod.canEditPoaBlock(marketAccessUser, commercialBlock), false);
  assert.equal(mod.canEditPoaBlock(marketAccessUser, medicalBlock), false);

  assert.equal(mod.resolvePoaUserType(marketAccessProfileUser), 'market-access');
  assert.equal(mod.canViewPoaBlock(marketAccessProfileUser, commercialBlock), true);
  assert.equal(mod.canViewPoaBlock(marketAccessProfileUser, marketAccessBlock), true);
  assert.equal(mod.canViewPoaBlock(marketAccessProfileUser, medicalBlock), true);
  assert.equal(mod.canEditPoaBlock(marketAccessProfileUser, marketAccessBlock), true);
  assert.equal(mod.canEditPoaBlock(marketAccessProfileUser, commercialBlock), false);
  assert.equal(mod.canEditPoaBlock(marketAccessProfileUser, medicalBlock), false);

  assert.equal(mod.canViewPoaBlock(medicalUser, medicalBlock), true);
  assert.equal(mod.canViewPoaBlock(medicalUser, commercialBlock), false);
  assert.equal(mod.canViewPoaBlock(medicalUser, marketAccessBlock), false);
  assert.equal(mod.canEditPoaBlock(medicalUser, medicalBlock), false);

  assert.equal(mod.canViewPoaBlock({ profileName: 'Unknown Profile' }, commercialBlock), false);
  assert.equal(mod.canViewPoaBlock({ profileName: 'Unknown Profile' }, medicalBlock), true);
});

test('POA page builds rows from viewable blocks only', async () => {
  const source = await readFile(poaPagePath, 'utf8');

  assert.match(source, /blocks\.filter\(\(block\) => canViewPoaBlock\(currentUser, block\)\)/);
  assert.match(source, /POA_HELP_TEXT/);
  assert.match(source, /className="poa-page-subheader"/);
  assert.match(source, /<p className="poa-page-subheader">{POA_HELP_TEXT\.subheader}<\/p>/);
  assert.doesNotMatch(source, /Cross Functional Account Plan guidance/);
  assert.match(source, /Medical approach and focus areas/);
  assert.match(source, /block\.functionName === MEDICAL_POA_FUNCTION/);
  assert.match(source, /rows\.length === 0/);
  assert.match(source, /rows\.length > 0/);
});
