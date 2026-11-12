// Builds the real React UI as one shareable HTML file backed by the local
// Salesforce-shaped fixtures. The normal production build remains live-data-only.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'vite';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMP_DIR = path.join(PROJECT_ROOT, '.mock-preview-build');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'outputs');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'kite-account-plan-mock-preview.html');
const STATIC_SCRIPTS = ['q.js', 'MyInsightsLibrary.js'];

function inlineVeevaRuntime(html) {
  for (const fileName of STATIC_SCRIPTS) {
    const sourcePath = path.join(TEMP_DIR, 'static', fileName);
    if (!fs.existsSync(sourcePath)) continue;

    const source = fs.readFileSync(sourcePath, 'utf8');
    const base64 = Buffer.from(source, 'utf8').toString('base64');
    const escapedName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `<script[^>]*src=["']\\.?/?static/${escapedName}(?:\\?[^"']*)?["'][^>]*></script>`
    );
    html = html.replace(
      pattern,
      `<script src="data:text/javascript;base64,${base64}"></script>`
    );
  }
  return html;
}

async function main() {
  const resolvedTemp = path.resolve(TEMP_DIR);
  if (resolvedTemp !== path.join(PROJECT_ROOT, '.mock-preview-build')) {
    throw new Error(`Refusing to clean unexpected build directory: ${resolvedTemp}`);
  }

  fs.rmSync(resolvedTemp, { recursive: true, force: true });

  try {
    await build({
      root: PROJECT_ROOT,
      mode: 'mock',
      build: {
        outDir: resolvedTemp,
        emptyOutDir: true,
      },
    });

    const builtIndex = path.join(resolvedTemp, 'index.html');
    const html = inlineVeevaRuntime(fs.readFileSync(builtIndex, 'utf8'));
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, html, 'utf8');

    const sizeMb = (fs.statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(1);
    console.log(`\nMock screenshot preview: ${OUTPUT_PATH} (${sizeMb} MB)`);
  } finally {
    fs.rmSync(resolvedTemp, { recursive: true, force: true });
  }
}

main();
