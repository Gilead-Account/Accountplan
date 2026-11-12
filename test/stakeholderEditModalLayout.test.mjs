import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modalPath = new URL('../src/pages/Stakeholders/StakeholderEditModal.jsx', import.meta.url);
const editModalCssPath = new URL('../src/styles/edit-modal.css', import.meta.url);

test('stakeholder edit DLBCL section does not render the influence definition chart', async () => {
  const modalSource = await readFile(modalPath, 'utf8');
  const cssSource = await readFile(editModalCssPath, 'utf8');

  assert.doesNotMatch(modalSource, /InfluenceDefinitionTable/);
  assert.doesNotMatch(modalSource, /Interest Definition/);
  assert.doesNotMatch(modalSource, /Systematic Influence Definition/);
  assert.doesNotMatch(modalSource, /stakeholder-influence-reference/);
  assert.doesNotMatch(cssSource, /stakeholder-influence-definition-table/);
});

test('stakeholder edit modal gates Other Role behind the Other role picklist value', async () => {
  const modalSource = await readFile(modalPath, 'utf8');

  assert.match(modalSource, /const OTHER_ROLE_VALUE = 'Other';/);
  assert.match(modalSource, /const isOtherRole = \(value\) =>/);
  assert.match(modalSource, /if \(key === 'role' && !isOtherRole\(value\)\)/);
  assert.match(modalSource, /next\.otherRole = '';/);
  assert.match(modalSource, /const isOtherRoleEditable = isOtherRole\(form\.role\);/);
  assert.match(modalSource, /f\.key === 'otherRole' && !isOtherRoleEditable/);
  assert.match(modalSource, /readOnly: true/);
});

test('stakeholder role picklist options are sorted alphabetically in the modal', async () => {
  const modalSource = await readFile(modalPath, 'utf8');

  assert.match(modalSource, /const sortAlphabetically = \(values\) =>/);
  assert.match(modalSource, /localeCompare\(String\(right\), undefined, \{ sensitivity: 'base' \}\)/);
  assert.match(modalSource, /const mergeSortedOptions = \(current, options\) => sortAlphabetically\(mergeOptions\(current, options\)\);/);
  assert.match(modalSource, /if \(field\.key === 'role'\) return mergeSortedOptions\(form\[field\.key\], roleOptions\);/);
});

test('stakeholder edit modal exposes field-level helper guidance', async () => {
  const modalSource = await readFile(modalPath, 'utf8');

  assert.match(modalSource, /FieldHelpButton/);
  assert.match(modalSource, /STAKEHOLDER_FIELD_HELP/);
  assert.match(modalSource, /Select the HCP who has influence on account decisions or patient flow/);
  assert.match(modalSource, /Identify the stakeholder's role within the account/);
  assert.match(modalSource, /Specify additional role details/);
  assert.match(modalSource, /Indicates the primary site or organization/);
  assert.match(modalSource, /impact on treatment decisions/);
  assert.match(modalSource, /impact on financial decisions/);
  assert.match(modalSource, /impact on operational processes/);
  assert.match(modalSource, /Capture key factors that support adoption/);
  assert.match(modalSource, /Capture key challenges limiting adoption/);
});

test('stakeholder edit modal sections are collapsible accordions', async () => {
  const modalSource = await readFile(modalPath, 'utf8');
  const cssSource = await readFile(editModalCssPath, 'utf8');

  assert.match(modalSource, /function AccordionSection/);
  assert.match(modalSource, /details:\s*true/);
  assert.match(modalSource, /dlbcl:\s*false/);
  assert.match(modalSource, /mm:\s*false/);
  assert.match(modalSource, /const \[openSections, setOpenSections\] = useState/);
  assert.match(modalSource, /aria-expanded=\{isOpen\}/);
  assert.match(modalSource, /aria-controls=\{panelId\}/);
  assert.match(modalSource, /hidden=\{!isOpen\}/);
  assert.match(modalSource, /isOpen \? '-' : '\+'/);
  assert.match(modalSource, /<AccordionSection[\s\S]*?title="Details"/);
  assert.match(modalSource, /<AccordionSection[\s\S]*?title="DLBCL"/);
  assert.match(modalSource, /<AccordionSection[\s\S]*?title="MM"/);
  assert.match(cssSource, /stakeholder-edit-section-toggle/);
  assert.match(cssSource, /\.stakeholder-edit-section-head::after\s*\{[\s\S]*?order:\s*1/);
  assert.match(cssSource, /\.stakeholder-edit-section-toggle\s*\{[\s\S]*?order:\s*2/);
  assert.match(cssSource, /stakeholder-edit-section-panel/);
});

test('stakeholder edit modal keeps DLBCL and MM Champion controls commented and hidden', async () => {
  const modalSource = await readFile(modalPath, 'utf8');
  const activeModalSource = modalSource
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  for (const [label, key] of [
    ['DLBCL Administrative Champion', 'dlbclAdministrativeChampion'],
    ['DLBCL Clinical Champion', 'dlbclClinicalChampion'],
    ['MM Administrative Champion', 'mmAdministrativeChampion'],
    ['MM Clinical Champion', 'mmClinicalChampion'],
  ]) {
    assert.match(
      modalSource,
      new RegExp(`//\\s+\\{ label: '${label}', key: '${key}', readOnly: false, type: 'checkbox'`)
    );
    assert.doesNotMatch(activeModalSource, new RegExp(`key: '${key}'`));
  }

  assert.match(modalSource, /\/\/ const DLBCL_CHAMPION_FIELDS = \[/);
  assert.match(modalSource, /\/\/ const MM_CHAMPION_FIELDS = \[/);
  assert.match(modalSource, /\{\/\* Temporarily disabled: DLBCL Stakeholder Champion controls\./);
  assert.match(modalSource, /\{\/\* Temporarily disabled: MM Stakeholder Champion controls\./);
  assert.doesNotMatch(activeModalSource, /<ChampionCheckboxGroup/);
  assert.doesNotMatch(activeModalSource, /\.\.\.DLBCL_CHAMPION_FIELDS/);
  assert.doesNotMatch(activeModalSource, /\.\.\.MM_CHAMPION_FIELDS/);
});

test('MM stakeholder profile renders one single-select and one multi-select dropdown', async () => {
  const modalSource = await readFile(modalPath, 'utf8');
  const cssSource = await readFile(editModalCssPath, 'utf8');

  assert.match(
    modalSource,
    /label: 'Estimated Annual R\/R MM Treatment Volume',[\s\S]*?key: 'estimatedAnnualRrmmTreatmentVolume'[\s\S]*?type: 'select'/
  );
  assert.match(
    modalSource,
    /label: 'Physician-Identified Highest Unmet Needs in R\/R MM',[\s\S]*?key: 'physicianIdentifiedHighestUnmetNeedsRrmm'[\s\S]*?type: 'multiSelect'/
  );
  assert.match(modalSource, /type === 'multiSelect'/);
  assert.match(modalSource, /stakeholder-multiselect-trigger/);
  assert.match(modalSource, /aria-expanded=\{isMultiSelectOpen\}/);
  assert.match(modalSource, /stakeholder-multiselect-menu/);
  assert.match(modalSource, /selectedValues\.length === 1/);
  assert.match(modalSource, /`\$\{selectedValues\.length\} selected`/);
  assert.match(modalSource, /selectedValues\.includes\(option\)/);
  assert.match(modalSource, /onChange\(field\.key, nextValues\)/);
  assert.match(cssSource, /\.stakeholder-multiselect-trigger/);
  assert.match(cssSource, /\.stakeholder-multiselect-menu/);
  assert.match(cssSource, /\.stakeholder-multiselect-option/);
  assert.match(
    cssSource,
    /\.stakeholder-edit-field \.stakeholder-multiselect-option input\[type='checkbox'\]\s*\{[\s\S]*?width:\s*16px[\s\S]*?min-height:\s*16px[\s\S]*?padding:\s*0/
  );
  assert.match(
    cssSource,
    /\.stakeholder-multiselect-options\s*\{[\s\S]*?overflow-x:\s*hidden/
  );
});
