import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const sidebarSource = await readFile(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');

test('Executive Summary sidebar option opens a modal instead of logging only', () => {
  assert.match(sidebarSource, /onExecutiveSummary/);
  assert.match(sidebarSource, /option\.key === 'executive-summary'/);
  assert.doesNotMatch(
    sidebarSource,
    /option\.key === 'executive-summary'[\s\S]{0,180}console\.info/
  );
  assert.match(appSource, /ExecutiveSummaryModal/);
  assert.match(appSource, /onExecutiveSummary=\{handleOpenExecutiveSummary\}/);
  assert.match(appSource, /loadAccountPlanPptData\(pageData/);
  assert.match(appSource, /buildAccountPlanExecutiveSummary/);
});

test('Executive Summary modal shares the existing iPad-safe PDF delivery flow', () => {
  assert.match(appSource, /handleSaveExecutiveSummaryPdf/);
  assert.match(appSource, /onSavePdf=\{handleSaveExecutiveSummaryPdf\}/);
  assert.match(appSource, /isSavingPdf=\{isExportingPdf \|\| pdfPrepareStatus === 'preparing'\}/);
  assert.match(appSource, /deliverPreparedPdfFromTap/);
});
