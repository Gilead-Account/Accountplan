import { useEffect, useRef, useState } from 'react';
// Legacy build avoids top-level await (unsupported by the es2020/Safari 14
// build target). Inlined worker keeps the single-file Veeva bundle self-contained.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&inline';

let workerReady = false;
const ensureWorker = () => {
  if (workerReady) return;
  pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
  workerReady = true;
};

const normalizeAnnotationUrl = (annotation) => {
  const rawUrl = String(annotation?.url || annotation?.unsafeUrl || '').trim();
  if (!rawUrl) return null;

  if (/^mailto:/i.test(rawUrl)) {
    let recipient = rawUrl.slice(rawUrl.indexOf(':') + 1);
    try { recipient = decodeURIComponent(recipient); } catch { /* keep original */ }
    recipient = recipient.replace(/^[\s<>]+|[\s<>]+$/g, '');
    return recipient ? `mailto:${recipient}` : null;
  }

  return /^https?:\/\//i.test(rawUrl) ? rawUrl : null;
};

const appendLinkAnnotations = async (page, viewport, pageContainer) => {
  const annotations = await page.getAnnotations({ intent: 'display' });

  annotations.forEach((annotation) => {
    if (annotation.subtype !== 'Link') return;
    const href = normalizeAnnotationUrl(annotation);
    if (!href || !Array.isArray(annotation.rect)) return;

    const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(annotation.rect);
    const link = document.createElement('a');
    link.className = 'pdf-annotation-link';
    link.href = href;
    link.style.left = `${(Math.min(x1, x2) / viewport.width) * 100}%`;
    link.style.top = `${(Math.min(y1, y2) / viewport.height) * 100}%`;
    link.style.width = `${(Math.abs(x2 - x1) / viewport.width) * 100}%`;
    link.style.height = `${(Math.abs(y2 - y1) / viewport.height) * 100}%`;

    if (/^mailto:/i.test(href)) {
      const recipient = href.slice(href.indexOf(':') + 1);
      link.setAttribute('aria-label', `Email ${recipient}`);
      link.title = `Email ${recipient}`;
    } else {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', annotation.title || 'Open linked document');
    }

    pageContainer.appendChild(link);
  });
};

// Renders every page of a PDF as a stacked canvas. iOS WKWebView only shows
// the first page of a PDF embedded in an <iframe>, so larger multi-page PDFs
// (e.g. the legal & compliance guidance) are drawn here instead.
export default function PdfAllPagesViewer({ src, className = '' }) {
  const pagesRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let pdfDoc = null;
    const pages = pagesRef.current;
    if (pages) pages.innerHTML = '';
    setStatus('loading');
    setError('');

    (async () => {
      try {
        ensureWorker();
        const response = await fetch(src);
        const data = await response.arrayBuffer();
        if (cancelled) return;
        pdfDoc = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const availWidth = (pages?.clientWidth || 800) - 4;

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1) {
          if (cancelled) return;
          // eslint-disable-next-line no-await-in-loop
          const page = await pdfDoc.getPage(pageNum);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.max(0.2, availWidth / baseViewport.width);
          const viewport = page.getViewport({ scale });

          const pageContainer = document.createElement('div');
          pageContainer.className = 'pdf-page-container';

          const canvas = document.createElement('canvas');
          canvas.className = 'pdf-page-canvas';
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          const ctx = canvas.getContext('2d');

          // eslint-disable-next-line no-await-in-loop
          await page.render({
            canvasContext: ctx,
            viewport,
            transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
          }).promise;
          if (cancelled) return;
          pageContainer.appendChild(canvas);
          // Preserve links from the source PDF above the rendered canvas.
          // eslint-disable-next-line no-await-in-loop
          await appendLinkAnnotations(page, viewport, pageContainer);
          if (cancelled) return;
          pages.appendChild(pageContainer);
          page.cleanup();
        }
        if (!cancelled) setStatus('done');
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Unable to display the PDF.');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (pdfDoc) {
        try { pdfDoc.destroy(); } catch { /* ignore */ }
      }
    };
  }, [src]);

  return (
    <div className={`pdf-all-pages-viewer ${className}`.trim()}>
      {status === 'loading' && <div className="pdf-viewer-status">Loading PDF…</div>}
      {status === 'error' && <div className="pdf-viewer-status is-error">{error}</div>}
      <div className="pdf-all-pages" ref={pagesRef} />
    </div>
  );
}
