import {
  buildAccountPlanExportTitle,
} from '@/lib/export/accountPlanPptSections';
import { loadAccountPlanPptData } from '@/lib/export/accountPlanPpt';
import { buildAccountPlanExecutiveSummary } from '@/lib/export/accountPlanExecutiveSummary';
import { createAccountPlanPdfDocument, PDF_MIME } from '@/lib/export/accountPlanPdfRenderer';
import kiteLogoPngUrl from '@/lib/export/templates/cover/kiteLogo.png?url';
import {
  formatPptDeliveryDiagnostic,
  getPptDeliveryEnvironment,
  shouldBypassWebShare,
  shouldOfferManualPptOpen,
  shouldTryWebShare,
} from '@/lib/export/accountPlanPptDelivery';

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

const dataUrlToBytes = (dataUrl) => {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  if (!base64 || typeof atob === 'undefined') return null;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const loadImage = (src) => new Promise((resolve, reject) => {
  if (typeof Image === 'undefined') {
    reject(new Error('Image is unavailable.'));
    return;
  }
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Unable to load PDF footer logo.'));
  image.src = src;
});

const loadKiteLogoForPdf = async () => {
  if (typeof document === 'undefined') return null;
  const image = await loadImage(kiteLogoPngUrl);
  const canvas = document.createElement('canvas');
  const width = 360;
  const height = Math.max(1, Math.round((image.naturalHeight || image.height || 1) * (width / (image.naturalWidth || image.width || width))));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  const data = dataUrlToBytes(dataUrl);
  if (!data) return null;
  return { data, width, height };
};

const countPdfPages = async (blob) => {
  if (!blob || typeof blob.text !== 'function') return 0;
  const pdf = await blob.text();
  return [...pdf.matchAll(/\/Type \/Page\b/g)].length;
};

const writeReadyPdfExportWindow = (targetWindow, { fileName, url, diagnostic }) => {
  targetWindow.document.open();
  targetWindow.document.write(`<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PDF export ready</title>
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
    <h1>PDF export ready</h1>
    <p>If the PDF does not open automatically, tap the button below.</p>
    <a id="openPdf" href="${escapeHtml(url)}" download="${escapeHtml(fileName)}" target="_self">Open PDF</a>
    <pre>${escapeHtml(diagnostic)}</pre>
  </div>
  <script>
    setTimeout(function () {
      var link = document.getElementById('openPdf');
      if (link) link.click();
    }, 100);
  </script>
</body>
</html>`);
  targetWindow.document.close();
};

const shareOrDownloadPdfBlob = (blob, title, { onProgress, targetWindow, directShare = false, fileName: preparedFileName } = {}) => {
  const fileName = preparedFileName || `${safeFilePart(title)}.pdf`;
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
      throw new Error('document is unavailable; PDF export must run in a browser view.');
    }

    const file = typeof File !== 'undefined'
      ? new File([blob], fileName, { type: PDF_MIME })
      : null;
    const env = getPptDeliveryEnvironment({ file });
    let shareError = null;
    const bypassWebShare = shouldBypassWebShare(env);

    onProgress?.(`PDF generated (${Math.round(blob.size / 1024)} KB). Preparing iPad share/download...`);

    if (targetWindow && !targetWindow.closed) {
      try {
        onProgress?.('PDF ready. Opening the export window...');
        mode = 'open-window';
        shouldRevokeUrl = false;
        const diagnostic = formatPptDeliveryDiagnostic(env);
        writeReadyPdfExportWindow(targetWindow, { fileName, url, diagnostic });
        return {
          fileName,
          mode,
          manualUrl: url,
          diagnostic,
        };
      } catch (error) {
        shareError = error;
        console.info('[export] Pre-opened PDF window failed; continuing fallback.', error);
      }
    }

    if (shouldTryWebShare(env, { directShare }) && file) {
      onProgress?.('Opening iPad share sheet...');
      return navigator.share({
        files: [file],
        title,
        text: 'Here is the account plan PDF export.',
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
        console.info('[export] Web Share unavailable; offering manual PDF open.', error);
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
      onProgress?.('Starting PDF download...');
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
      onProgress?.('Starting PDF download...');
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

    throw new Error(`PDF generated, but this browser blocked share, download, and open.\n${formatPptDeliveryDiagnostic(env, shareError)}`);
  } catch (error) {
    revokeObjectUrl();
    throw error;
  }
};

export const prepareAccountPlanPdf = async ({
  cachedPageData = {},
  title,
  onProgress,
} = {}) => {
  onProgress?.('Starting PDF export...');
  const data = await loadAccountPlanPptData(cachedPageData, { onProgress });
  const resolvedTitle = title || buildAccountPlanExportTitle(data);
  onProgress?.('Building A4 executive summary PDF...');
  const summary = buildAccountPlanExecutiveSummary(data);
  let logoImage = null;
  try {
    logoImage = await loadKiteLogoForPdf();
  } catch (error) {
    console.info('[export] PDF footer logo image could not be prepared; using text logo fallback.', error);
  }
  const blob = createAccountPlanPdfDocument(summary, { title: resolvedTitle, logoImage });
  const fileName = `${safeFilePart(resolvedTitle)}.pdf`;
  const pageCount = await countPdfPages(blob);

  return {
    blob,
    fileName,
    pageCount,
    slideCount: pageCount,
    title: resolvedTitle,
  };
};

export const deliverPreparedAccountPlanPdf = (prepared, { onProgress, targetWindow, directShare = false } = {}) =>
  Promise.resolve(shareOrDownloadPdfBlob(prepared.blob, prepared.title, {
    onProgress,
    targetWindow,
    directShare,
    fileName: prepared.fileName,
  })).then((result) => ({
    ...result,
    pageCount: prepared.pageCount,
    slideCount: prepared.slideCount,
    title: prepared.title,
  }));

export const exportAccountPlanToPdf = async ({ cachedPageData = {}, title, onProgress, targetWindow } = {}) => {
  const prepared = await prepareAccountPlanPdf({ cachedPageData, title, onProgress });
  return deliverPreparedAccountPlanPdf(prepared, { onProgress, targetWindow });
};
