import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');
const artifactPath = path.join(rootDir, 'dist', 'mock-account-plan-export.pptx');

test('generated PPT content slides do not include the removed footer logo', async () => {
  const buffer = await fs.readFile(artifactPath);
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await Promise.all(
    Object.keys(zip.files)
      .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry))
      .map((entry) => zip.file(entry).async('string')),
  );
  const slideRelsXml = await Promise.all(
    Object.keys(zip.files)
      .filter((entry) => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(entry))
      .map((entry) => zip.file(entry).async('string')),
  );

  assert.ok(slideXml.length > 1);
  assert.doesNotMatch(slideXml.join('\n'), /Kite Logo Footer/);
  assert.doesNotMatch(slideRelsXml.join('\n'), /Target="\.\.\/media\/kiteLogo\.png"/);
});
