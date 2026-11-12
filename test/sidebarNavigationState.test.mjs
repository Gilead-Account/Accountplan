import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const sidebarSource = await readFile(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');
const sidebarCss = await readFile(new URL('../src/components/Sidebar.css', import.meta.url), 'utf8');
const pdfViewerSource = await readFile(new URL('../src/components/PdfAllPagesViewer.jsx', import.meta.url), 'utf8');
const userGuidePdfPath = new URL('../src/assets/account-plan-user-guide.pdf', import.meta.url);
const qualityRubricPdfPath = new URL('../src/assets/account-planning-quality-rubric.pdf', import.meta.url);
const compliancePdfPath = new URL('../src/assets/account-plan-legal-compliance-guidance.pdf', import.meta.url);

test('sidebar active item follows App activeKey instead of pointerdown-only optimistic state', () => {
  assert.doesNotMatch(sidebarSource, /optimisticActiveKey/);
  assert.doesNotMatch(sidebarSource, /flushSync/);
  assert.doesNotMatch(sidebarSource, /setOptimisticActiveKey/);
  assert.doesNotMatch(sidebarSource, /markPageActive/);
  assert.match(sidebarSource, /const isActive = page\.key === activeKey/);
});

test('sidebar navigation has a pointer-completion path for touch taps plus click fallback', () => {
  assert.match(sidebarSource, /navPressRef/);
  assert.match(sidebarSource, /lastPointerNavigationRef/);
  assert.match(sidebarSource, /const handleNavPointerDown = \(event, page\) =>/);
  assert.match(sidebarSource, /const handleNavPointerUp = \(event, page\) =>/);
  assert.match(sidebarSource, /const handleNavPointerCancel = \(event\) =>/);
  assert.match(sidebarSource, /Math\.hypot\(event\.clientX - press\.x, event\.clientY - press\.y\)/);
  assert.match(sidebarSource, /if \(distance > 14\) return/);
  assert.match(sidebarSource, /navigateToPage\(page, 'pointer'\)/);
  assert.match(sidebarSource, /onPointerDown=\{\(event\) => handleNavPointerDown\(event, page\)\}/);
  assert.match(sidebarSource, /onPointerUp=\{\(event\) => handleNavPointerUp\(event, page\)\}/);
  assert.match(sidebarSource, /onPointerCancel=\{handleNavPointerCancel\}/);
  assert.match(sidebarSource, /onClick=\{\(\) => choosePage\(page\)\}/);
});

test('sidebar policy helper is labeled Help and Compliance Reminder with two popup sections', () => {
  assert.match(sidebarSource, /Help &amp; Compliance Reminder/);
  assert.doesNotMatch(sidebarSource, /Role Separation/);
  assert.doesNotMatch(sidebarSource, /Medical \/ Commercial guardrails/);
  assert.match(sidebarSource, /HELP_GUIDANCE/);
  assert.match(sidebarSource, /COMPLIANCE_REMINDERS/);
  assert.match(sidebarSource, /FieldHelpButton/);
  assert.match(sidebarSource, /User Guide/);
  assert.match(sidebarSource, /account-plan-user-guide\.pdf\?url/);
  assert.match(sidebarSource, /opensUserGuide/);
  assert.doesNotMatch(sidebarSource, /\{\s*text:\s*'FAQs'/);
  assert.doesNotMatch(sidebarSource, /\{ text: 'User Guide', tbd: true \}/);
  assert.doesNotMatch(sidebarSource, /User Guides and Support Documents/);
  // Compliance reminder bullets + the Compliance Atlas link.
  assert.match(sidebarSource, /This information is confidential and may not be disclosed externally\./);
  assert.match(sidebarSource, /All activities must comply with applicable legal, regulatory, and policy requirements\./);
  assert.match(sidebarSource, /Compliance Atlas/);
  assert.match(sidebarSource, /https:\/\/gileadcomplianceatlas\.com\/kite/);
  assert.match(sidebarSource, /sidebar-policy-help-copy[\s\S]*FieldHelpButton/);
  assert.match(sidebarSource, /sidebar-policy-help-inline-help/);
  assert.doesNotMatch(sidebarSource, /sidebar-policy-help-icon/);
  assert.match(sidebarSource, /<h4>Compliance Reminder<\/h4>/);
  assert.match(sidebarSource, /<h4>Documents &amp; Guides<\/h4>/);
  assert.match(sidebarSource, /sidebar-policy-help-section is-guardrails/);
  assert.match(sidebarSource, /sidebar-policy-help-section is-help/);
});

test('sidebar User Guide uses the bundled PDF asset', async () => {
  assert.match(sidebarSource, /Account Plan User Guide/);
  assert.match(sidebarSource, /Account-Plan-User-Guide\.pdf/);

  const file = await stat(userGuidePdfPath);
  assert.ok(file.size > 100000, 'user guide PDF should be a bundled document');
});

test('sidebar Account Planning Playbook is marked TBD without a document link', () => {
  assert.match(sidebarSource, /\{ text: 'Account Planning Playbook', tbd: true \}/);
  assert.doesNotMatch(sidebarSource, /account-planning-playbook\.pdf\?url/);
  assert.doesNotMatch(sidebarSource, /opensPlaybook/);
});

test('sidebar Playbook TBD badge is a compact pill aligned with document text', () => {
  const tbdRule = sidebarCss.match(/\.sidebar-help-tbd\s*\{[\s\S]*?\}/)?.[0] || '';
  assert.match(tbdRule, /box-sizing:\s*border-box/);
  assert.match(tbdRule, /height:\s*15px/);
  assert.match(tbdRule, /width:\s*auto/);
  assert.match(tbdRule, /padding:\s*0 5px/);
  assert.match(tbdRule, /border-radius:\s*999px/);
  assert.doesNotMatch(tbdRule, /width:\s*30px|height:\s*30px|border-radius:\s*50%/);
});

test('sidebar Account Planning Quality Rubric uses the supplied bundled PDF asset', async () => {
  assert.match(sidebarSource, /account-planning-quality-rubric\.pdf\?url/);
  assert.match(sidebarSource, /Account Planning Quality Rubric/);
  assert.match(sidebarSource, /Account-Planning-Quality-Rubric\.pdf/);
  assert.match(sidebarSource, /opensQualityRubric/);
  assert.match(sidebarSource, /QualityRubricModal/);

  const file = await stat(qualityRubricPdfPath);
  assert.equal(file.size, 220994, 'quality rubric PDF should match the supplied document');
});

test('sidebar Account Plan Legal and Compliance Guidance uses the bundled PDF asset', async () => {
  assert.match(sidebarSource, /account-plan-legal-compliance-guidance\.pdf\?url/);
  assert.match(sidebarSource, /Account Plan Legal & Compliance Guidance/);
  assert.match(sidebarSource, /Account-Plan-Legal-Compliance-Guidance\.pdf/);

  const file = await stat(compliancePdfPath);
  assert.ok(file.size > 100000, 'compliance guidance PDF should be a bundled document');
});

test('sidebar Documents and Guides includes the Field Alignment Dashboard external link', () => {
  assert.match(sidebarSource, /text: 'Field Alignment Dashboard'/);
  assert.match(
    sidebarSource,
    /https:\/\/gtp\.gilead\.com\/#\/site\/Kite\/views\/FieldAlignmentDashboard_17845723815430\/FieldAlignment\?:iid=1/
  );
  assert.match(sidebarSource, /item\.linkUrl[\s\S]*?href=\{item\.linkUrl\}[\s\S]*?target="_blank"/);
  assert.match(sidebarSource, /rel="noopener noreferrer"/);
});

test('PDF viewer renders clickable links and normalizes email annotations', () => {
  assert.match(pdfViewerSource, /page\.getAnnotations\(\{ intent: 'display' \}\)/);
  assert.match(pdfViewerSource, /className = 'pdf-annotation-link'/);
  assert.match(pdfViewerSource, /recipient\.replace\(\/\^\[\\s<>\]/);
  assert.match(pdfViewerSource, /link\.href = href/);
});
