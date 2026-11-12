import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';
import { createServer } from 'vite';

const root = process.cwd();

const exportData = {
  home: {
    account: { name: 'Desktop Export Test Account' },
    plan: { territoryDescription: 'US Test Territory' },
    header: {
      atcCohort: 'Cohort 4',
      atcSegment: 'Inpatient and Outpatient',
      kltSprintAccount: true,
      kadTargetList: false,
      referralVolume: '24',
      secondLinePlusVolume: '8',
    },
    customerGoals: 'Validate desktop PPT export can be opened by PowerPoint.',
    strategies: { dlbcl: ['Expand Class Share'], mm: ['Defend Market Share'] },
  },
  barriersDrivers: { barriers: [], drivers: [], openActivityCountByBarrier: {} },
  criticalActivities: { activities: [] },
  poa: { blocks: [] },
  accountProfile: {},
  stakeholders: { stakeholders: [] },
  teamMembers: { teamMembers: [] },
};

const installTemplateFetchStub = (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const value = String(url || '');
    const filePath = value.startsWith('/')
      ? path.join(root, value.replace(/^\/+/, ''))
      : (!/^https?:|^data:/i.test(value) ? path.join(root, value) : null);

    if (!filePath) return originalFetch(url, options);

    try {
      const buffer = await fs.readFile(filePath);
      return new Response(new Blob([buffer]), { status: 200 });
    } catch (error) {
      return new Response(String(error), { status: 404 });
    }
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
};

const buildDesktopExportBlob = async (t) => {
  installTemplateFetchStub(t);
  const server = await createServer({ root, logLevel: 'silent', server: { middlewareMode: true } });
  t.after(() => server.close());

  const mod = await server.ssrLoadModule('/src/lib/export/accountPlanPpt.js');
  const built = mod.buildAccountPlanPresentation(exportData, {
    title: 'Desktop Export Test Account Plan',
  });
  const generatedBlob = await built.presentation.write({ outputType: 'blob' });
  const blob = await mod.applyAccountPlanCoverTemplate(generatedBlob, {
    data: exportData,
    title: built.title,
  });

  return blob;
};

test('desktop PPTX export produces a non-empty PowerPoint blob', async (t) => {
  const blob = await buildDesktopExportBlob(t);

  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  assert.ok(blob.size > 30_000);
});

test('desktop PPTX export avoids PowerPoint-unreadable table anchors and cover master injection', async (t) => {
  const blob = await buildDesktopExportBlob(t);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const slideXmlFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  const slideXml = await Promise.all(slideXmlFiles.map((name) => zip.file(name).async('string')));
  const contentTypesXml = await zip.file('[Content_Types].xml').async('string');
  const contentTypeOverrides = [...contentTypesXml.matchAll(/<Override\s+PartName="([^"]+)"/g)]
    .map((match) => match[1].replace(/^\//, ''));

  assert.equal(slideXml.some((xml) => xml.includes('anchor="mid"')), false);
  assert.equal(Boolean(zip.file('ppt/slideMasters/slideMaster8.xml')), false);
  assert.deepEqual(
    contentTypeOverrides.filter((partName) => !zip.file(partName)),
    [],
  );
});
