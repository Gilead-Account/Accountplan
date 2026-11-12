import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {
  applyCoverTemplateContentTypes,
  buildCoverSlideXml,
  sanitizeCoverSlideRelsXml,
  sanitizeCoverSlideMasterRelsXml,
  sanitizeCoverSlideMasterXml,
} from './accountPlanPptCoverTemplate.js';

test('replaces the mock cover title block with the account title and date', async () => {
  const templateXml = await fs.readFile(
    new URL('./templates/mockCoverSlide1.xml', import.meta.url),
    'utf8',
  );
  const xml = buildCoverSlideXml(templateXml, {
    title: 'UCSF Benioff & Children Account Plan',
    accountName: 'UCSF Benioff & Children',
    generatedDate: '7/1/2026',
  });

  assert.match(xml, /UCSF Benioff &amp; Children Account Plan\s+Date: 7\/1\/2026/);
  assert.doesNotMatch(xml, /BANNER GATEWAY MEDICAL CENTER/);
  assert.doesNotMatch(xml, /5\/27\/2026/);
  assert.match(xml, /Confidential/);
  assert.doesNotMatch(xml, /<a:t>Home<\/a:t>/);
  assert.doesNotMatch(xml, /<a:t>CUSTOMER GOALS<\/a:t>/);
  assert.doesNotMatch(xml, /think-cell/i);
  assert.doesNotMatch(xml, /oleObj/);
  assert.doesNotMatch(xml, /<p:tags\b/);
  assert.match(xml, /r:embed="rId5"/);
});

test('adds content type entries for the active mock cover package parts', () => {
  const xml = applyCoverTemplateContentTypes('<Types></Types>');

  assert.match(xml, /Extension="emf"/);
  assert.match(xml, /PartName="\/ppt\/slideLayouts\/slideLayout200\.xml"/);
  assert.match(xml, /PartName="\/ppt\/slideMasters\/slideMaster8\.xml"/);
  assert.match(xml, /PartName="\/ppt\/theme\/theme8\.xml"/);
  assert.doesNotMatch(xml, /Extension="bin"/);
  assert.doesNotMatch(xml, /PartName="\/ppt\/tags\/tag13\.xml"/);
  assert.doesNotMatch(xml, /PartName="\/ppt\/tags\/tag14\.xml"/);
});

test('removes hidden think-cell payload relationships from the cover slide', async () => {
  const relsXml = await fs.readFile(new URL('./templates/cover/slide1.xml.rels', import.meta.url), 'utf8');
  const sanitizedRels = sanitizeCoverSlideRelsXml(relsXml);

  assert.match(sanitizedRels, /slideLayout200\.xml/);
  assert.match(sanitizedRels, /image68\.png/);
  assert.doesNotMatch(sanitizedRels, /oleObject/);
  assert.doesNotMatch(sanitizedRels, /tags/);
  assert.doesNotMatch(sanitizedRels, /image56\.emf/);
});

test('keeps only active title cover dependencies in slide master 8', async () => {
  const masterXml = await fs.readFile(new URL('./templates/cover/slideMaster8.xml', import.meta.url), 'utf8');
  const relsXml = await fs.readFile(new URL('./templates/cover/slideMaster8.xml.rels', import.meta.url), 'utf8');

  const sanitizedMaster = sanitizeCoverSlideMasterXml(masterXml);
  const sanitizedRels = sanitizeCoverSlideMasterRelsXml(relsXml);

  assert.match(sanitizedMaster, /r:id="rId6"/);
  assert.doesNotMatch(sanitizedMaster, /r:id="rId7"/);
  assert.doesNotMatch(sanitizedMaster, /think-cell/i);
  assert.doesNotMatch(sanitizedMaster, /oleObj/);
  assert.doesNotMatch(sanitizedMaster, /<p:tags\b/);
  assert.match(sanitizedRels, /slideLayout200\.xml/);
  assert.doesNotMatch(sanitizedRels, /slideLayout201\.xml/);
  assert.match(sanitizedRels, /theme8\.xml/);
  assert.match(sanitizedRels, /image3\.emf/);
  assert.doesNotMatch(sanitizedRels, /tag13\.xml/);
  assert.doesNotMatch(sanitizedRels, /oleObject9\.bin/);
  assert.doesNotMatch(sanitizedRels, /image56\.emf/);
});
