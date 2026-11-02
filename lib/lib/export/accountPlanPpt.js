import {
  buildAccountPlanExportTitle,
  buildAccountPlanPptSlides,
} from '@/lib/export/accountPlanPptSections';
import JSZip from 'jszip';
import {
  createAccountPlanPresentation,
  PPTX_MIME,
} from '@/lib/export/accountPlanPptRenderer';
import {
  formatPptDeliveryDiagnostic,
  getPptDeliveryEnvironment,
  shouldBypassWebShare,
  shouldOfferManualPptOpen,
  shouldTryWebShare,
} from '@/lib/export/accountPlanPptDelivery';
import { loadHome } from '@/lib/dataservice/accountPlan/home';
import { loadBarriersDrivers } from '@/lib/dataservice/accountPlan/barriersDrivers';
import { loadCriticalActivities } from '@/lib/dataservice/accountPlan/criticalActivities';
import { loadCrossFunctionalPlan } from '@/lib/dataservice/accountPlan/crossFunctionalPlan';
import { loadAccountProfile } from '@/lib/dataservice/accountPlan/accountProfile';
import { loadStakeholders } from '@/lib/dataservice/accountPlan/stakeholders';
import { loadTeamMembers } from '@/lib/dataservice/accountPlan/teamMembers';

const safeFilePart = (value) =>
  String(value || 'account-plan-export')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 96) || 'account-plan-export';

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

const writeReadyExportWindow = (targetWindow, { fileName, url, diagnostic }) => {
  targetWindow.document.open();
  targetWindow.document.write(`<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PPT export ready</title>
  <style>
    body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #123; background: #f7fbff; }
    .box { max-width: 680px; margin: 8vh auto 0; padding: 20px; border: 1px solid #b9d8ef; border-radius: 14px; background: #fff; }
    h1 { margin: 0 0 10px; font-size: 20px; }
    p { margin: 0 0 16px; line-height: 1.45; color: #456; }
    a { display: inline-block; padding: 11px 18px; border-radius: 10px; background: #0b65b1; color: #fff; text-decoration: none; font-weight: 700; }
    pre { margin-top: 18px; white-space: pre-wrap; word-break: break-word; color: #6b7280; font-size: 12px; line-height: 1.45; }
  </style>
</head>
<body>
  <div class="box">
    <h1>PPT export ready</h1>
    <p>If PowerPoint does not open automatically, tap the button below.</p>
    <a id="openPpt" href="${escapeHtml(url)}" download="${escapeHtml(fileName)}" target="_self">Open PPT</a>
    <pre>${escapeHtml(diagnostic)}</pre>
  </div>
  <script>
    setTimeout(function () {
      var link = document.getElementById('openPpt');
      if (link) link.click();
    }, 100);
  </script>
</body>
</html>`);
  targetWindow.document.close();
};

const clickDownloadLink = (url, fileName) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const loadOrUseCached = (cachedPageData, key, loader) =>
  cachedPageData && cachedPageData[key] ? Promise.resolve(cachedPageData[key]) : loader();

export const loadAccountPlanPptData = async (cachedPageData = {}, { onProgress } = {}) => {
  onProgress?.('Loading export data from all pages...');
  const cachedAccountProfile = cachedPageData.kpi || cachedPageData['account-insights'];
  const [
    home,
    barriersDrivers,
    criticalActivities,
    poa,
    accountProfile,
    stakeholders,
    teamMembers,
  ] = await Promise.all([
    loadOrUseCached(cachedPageData, 'overview', loadHome),
    loadOrUseCached(cachedPageData, 'barriers-drivers', loadBarriersDrivers),
    loadOrUseCached(cachedPageData, 'critical-activities', loadCriticalActivities),
    loadOrUseCached(cachedPageData, 'linked-opportunities', loadCrossFunctionalPlan),
    cachedAccountProfile ? Promise.resolve(cachedAccountProfile) : loadAccountProfile(),
    loadOrUseCached(cachedPageData, 'stakeholders', loadStakeholders),
    loadOrUseCached(cachedPageData, 'team-members', loadTeamMembers),
  ]);

  const data = {
    home,
    barriersDrivers,
    criticalActivities,
    poa,
    accountProfile,
    stakeholders,
    teamMembers,
  };

  onProgress?.('Export data loaded.');
  return data;
};

export const buildAccountPlanPresentation = (data, options = {}) => {
  const title = options.title || buildAccountPlanExportTitle(data);
  const slides = buildAccountPlanPptSlides(data, options);
  return {
    title,
    slides,
    presentation: createAccountPlanPresentation(slides, { title }),
  };
};

const normalizePowerPointXml = (xml) =>
  String(xml || '').replaceAll('anchor="mid"', 'anchor="ctr"');

const pruneMissingContentTypeOverrides = (xml, zip) =>
  String(xml || '').replace(
    /<Override\s+PartName="([^"]+)"\s+ContentType="([^"]+)"\s*\/>/g,
    (tag, partName) => (zip.file(partName.replace(/^\//, '')) ? tag : ''),
  );

const sanitizePowerPointPackage = async (zip) => {
  await Promise.all(Object.keys(zip.files)
    .filter((path) => path.endsWith('.xml'))
    .map(async (path) => {
      const file = zip.file(path);
      if (!file) return;
      zip.file(path, normalizePowerPointXml(await file.async('string')));
    }));

  const contentTypes = zip.file('[Content_Types].xml');
  if (contentTypes) {
    zip.file('[Content_Types].xml', pruneMissingContentTypeOverrides(
      await contentTypes.async('string'),
      zip,
    ));
  }
};

export const applyAccountPlanCoverTemplate = async (blob, { data = {}, title } = {}) => {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  await sanitizePowerPointPackage(zip);
  return zip.generateAsync({
    type: 'blob',
    mimeType: PPTX_MIME,
    compression: 'DEFLATE',
  });
};

const shareOrDownloadBlob = (blob, title, { onProgress, targetWindow, directShare = false, fileName: preparedFileName } = {}) => {
  const fileName = preparedFileName || `${safeFilePart(title)}.pptx`;
  const url = URL.createObjectURL(blob);
  let mode = 'download';
  let shouldRevokeUrl = true;
  const revokeObjectUrl = () => {
    if (shouldRevokeUrl) {
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };
  const finish = (result) => {
    revokeObjectUrl();
    return result;
  };

  try {
    if (typeof document === 'undefined') {
      throw new Error('document is unavailable; PPT export must run in a browser view.');
    }

    const file = typeof File !== 'undefined'
      ? new File([blob], fileName, { type: PPTX_MIME })
      : null;
    const env = getPptDeliveryEnvironment({ file });
    let shareError = null;
    const bypassWebShare = shouldBypassWebShare(env);

    onProgress?.(`PPT generated (${Math.round(blob.size / 1024)} KB). Preparing iPad share/download...`);

    if (targetWindow && !targetWindow.closed) {
      try {
        onProgress?.('PPT ready. Opening the export window...');
        mode = 'open-window';
        shouldRevokeUrl = false;
        const diagnostic = formatPptDeliveryDiagnostic(env);
        writeReadyExportWindow(targetWindow, { fileName, url, diagnostic });
        return {
          fileName,
          mode,
          manualUrl: url,
          diagnostic,
        };
      } catch (error) {
        shareError = error;
        console.info('[export] Pre-opened PPT window failed; continuing fallback.', error);
      }
    }

    if (shouldTryWebShare(env, { directShare }) && file) {
      onProgress?.('Opening iPad share sheet...');
      return navigator.share({
        files: [file],
        title,
        text: 'Here is the account plan PowerPoint export.',
      }).then(() => {
        mode = 'share';
        revokeObjectUrl();
        return { fileName, mode, diagnostic: formatPptDeliveryDiagnostic(env) };
      }).catch((error) => {
        shareError = error;
        if (error?.name === 'AbortError') {
          mode = 'share-cancelled';
          revokeObjectUrl();
          return { fileName, mode, diagnostic: formatPptDeliveryDiagnostic(env, error) };
        }
        console.info('[export] Web Share unavailable; offering manual PPT open.', error);
        if (env.hasAnchorDownload) {
          mode = 'download-fallback';
          shouldRevokeUrl = false;
          return {
            fileName,
            mode,
            manualUrl: url,
            diagnostic: formatPptDeliveryDiagnostic(env, error),
          };
        }
        if (shouldOfferManualPptOpen(env, error)) {
          mode = 'manual-open';
          shouldRevokeUrl = false;
          return {
            fileName,
            mode,
            manualUrl: url,
            diagnostic: formatPptDeliveryDiagnostic(env, error),
          };
        }
        throw error;
      });
    }

    if (bypassWebShare && env.hasAnchorDownload) {
      onProgress?.('Starting PPT download...');
      clickDownloadLink(url, fileName);
      mode = 'download-fallback';
      shouldRevokeUrl = false;
      return {
        fileName,
        mode,
        manualUrl: url,
        diagnostic: formatPptDeliveryDiagnostic(env),
      };
    }

    if (env.hasAnchorDownload) {
      onProgress?.('Starting PPT download...');
      clickDownloadLink(url, fileName);
      if (shareError || env.isAppleTouch) {
        mode = 'download-fallback';
        shouldRevokeUrl = false;
        return {
          fileName,
          mode,
          manualUrl: url,
          diagnostic: formatPptDeliveryDiagnostic(env),
        };
      }
      return finish({ fileName, mode, diagnostic: formatPptDeliveryDiagnostic(env) });
    }

    if (shouldOfferManualPptOpen(env, shareError)) {
      mode = 'manual-open';
      shouldRevokeUrl = false;
      return {
        fileName,
        mode,
        manualUrl: url,
        diagnostic: formatPptDeliveryDiagnostic(env, shareError),
      };
    }

    const opened = typeof window !== 'undefined' ? window.open(url, '_blank', 'noopener') : null;
    if (opened) {
      mode = 'open';
      shouldRevokeUrl = false;
      return { fileName, mode, diagnostic: formatPptDeliveryDiagnostic(env) };
    }

    throw new Error(`PPT generated, but this browser blocked share, download, and open.\n${formatPptDeliveryDiagnostic(env, shareError)}`);
  } catch (error) {
    revokeObjectUrl();
    throw error;
  }
};

export const prepareAccountPlanPpt = async ({ cachedPageData = {}, title, onProgress } = {}) => {
  onProgress?.('Starting PPT export...');
  const data = await loadAccountPlanPptData(cachedPageData, { onProgress });
  onProgress?.('Building PPT slides...');
  const built = buildAccountPlanPresentation(data, { title });
  onProgress?.(`Writing ${built.slides.length} PPT slides...`);
  const generatedBlob = await built.presentation.write({ outputType: 'blob' });
  onProgress?.('Applying cover slide template...');
  const blob = await applyAccountPlanCoverTemplate(generatedBlob, { data, title: built.title });
  const fileName = `${safeFilePart(built.title)}.pptx`;

  return {
    blob,
    fileName,
    slideCount: built.slides.length,
    title: built.title,
  };
};

export const deliverPreparedAccountPlanPpt = (prepared, { onProgress, targetWindow, directShare = false } = {}) =>
  Promise.resolve(shareOrDownloadBlob(prepared.blob, prepared.title, {
    onProgress,
    targetWindow,
    directShare,
    fileName: prepared.fileName,
  })).then((result) => ({
    ...result,
    slideCount: prepared.slideCount,
    title: prepared.title,
  }));

export const exportAccountPlanToPpt = async ({ cachedPageData = {}, title, onProgress, targetWindow } = {}) => {
  const prepared = await prepareAccountPlanPpt({ cachedPageData, title, onProgress });
  return deliverPreparedAccountPlanPpt(prepared, { onProgress, targetWindow });
};
