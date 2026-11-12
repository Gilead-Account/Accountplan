import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const pagePath = new URL('../src/pages/BarriersDrivers/index.jsx', import.meta.url);
const modalPath = new URL('../src/pages/BarriersDrivers/BarrierDriverEditModal.jsx', import.meta.url);
const cssPath = new URL('../src/pages/BarriersDrivers/BarriersDrivers.css', import.meta.url);
const pdfPath = new URL('../src/assets/ap-barriers-and-tactical-action.pdf', import.meta.url);

test('barrier driver edit modal exposes the tactical actions PDF from the footer', async () => {
  const modalSource = await readFile(modalPath, 'utf8');
  const pageSource = await readFile(pagePath, 'utf8');

  assert.match(modalSource, /onOpenReferencePdf/);
  assert.match(modalSource, /bd-reference-pdf-footer-link/);
  assert.match(modalSource, /View Tactical Actions Guide/);
  assert.match(pageSource, /onOpenReferencePdf=\{\(\) => setIsReferencePdfOpen\(true\)\}/);
});

test('reference PDF modal uses the app PDF delivery path and a scrollable viewer', async () => {
  const pageSource = await readFile(pagePath, 'utf8');
  const cssSource = await readFile(cssPath, 'utf8');

  assert.match(pageSource, /deliverPreparedAccountPlanPdf/);
  assert.match(pageSource, /PDF_MIME/);
  assert.match(pageSource, /const REFERENCE_PDF_TITLE = 'AP Barriers and Tactical Actions';/);
  assert.match(pageSource, /const REFERENCE_PDF_FILE_NAME = 'AP-Barriers-and-Tactical-Actions\.pdf';/);
  assert.match(pageSource, /Save PDF/);
  assert.match(pageSource, /src=\{\`\$\{src\}#view=FitH`\}/);
  assert.match(cssSource, /\.bd-reference-pdf-overlay[\s\S]*?z-index:\s*340;/);
  assert.match(cssSource, /\.bd-reference-pdf-body[\s\S]*?overflow:\s*auto;/);
  assert.match(cssSource, /\.bd-reference-pdf-frame[\s\S]*?height:\s*100%;/);
});

test('reference PDF asset is present', async () => {
  const file = await stat(pdfPath);
  assert.ok(file.size > 1000);
});
