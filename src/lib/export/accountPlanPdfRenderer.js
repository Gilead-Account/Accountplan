export const PDF_MIME = 'application/pdf';

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 36;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const HEADER_BOTTOM = 92;
const CONTENT_BOTTOM = 766;

const COLORS = {
  ink: '172B3A',
  muted: '5B6E7D',
  faint: 'EEF6FA',
  line: 'D1E2EA',
  blue: '005F9E',
  blueDark: '073047',
  teal: '0083A7',
  green: '19705D',
  white: 'FFFFFF',
  paper: 'FBFDFF',
  panel: 'F8FBFD',
  row: 'F6FAFD',
  danger: '8A2C1F',
};

const FONT = {
  regular: 'F1',
  bold: 'F2',
};

const cleanText = (value, fallback = '-') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value)
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim() || fallback;
};

const escapePdfText = (value) =>
  cleanText(value, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const hexToRgb = (hex) => {
  const normalized = String(hex || '000000').replace('#', '');
  return [0, 2, 4].map((start) => parseInt(normalized.slice(start, start + 2), 16) / 255);
};

const rgb = (hex) => hexToRgb(hex).map((value) => value.toFixed(3)).join(' ');

const bottomY = (y, h = 0) => PAGE.height - y - h;

const textWidth = (text, size) => {
  const value = cleanText(text, '');
  let units = 0;
  for (const char of value) {
    if (char === ' ') units += 0.26;
    else if (/[ilI.,']/u.test(char)) units += 0.28;
    else if (/[MW@#%]/u.test(char)) units += 0.82;
    else units += 0.52;
  }
  return units * size;
};

const splitLongWord = (word, maxWidth, size) => {
  const chunks = [];
  let current = '';
  for (const char of word) {
    const next = `${current}${char}`;
    if (current && textWidth(next, size) > maxWidth) {
      chunks.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
};

const wrapText = (value, maxWidth, size) => {
  const text = cleanText(value, '');
  if (!text) return [];
  return String(text).split(/\n+/).flatMap((paragraph) => {
    const lines = [];
    let current = '';
    paragraph.split(/\s+/).filter(Boolean).forEach((word) => {
      const candidates = textWidth(word, size) > maxWidth
        ? splitLongWord(word, maxWidth, size)
        : [word];
      candidates.forEach((candidate) => {
        const next = current ? `${current} ${candidate}` : candidate;
        if (current && textWidth(next, size) > maxWidth) {
          lines.push(current);
          current = candidate;
        } else {
          current = next;
        }
      });
    });
    if (current) lines.push(current);
    return lines;
  });
};

const bytesToHex = (input) => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  let hex = '';
  bytes.forEach((byte) => {
    hex += byte.toString(16).padStart(2, '0').toUpperCase();
  });
  return `${hex}>`;
};

const normalizeWidths = (columns) => {
  const total = columns.reduce((sum, col) => sum + Number(col.width || 1), 0) || 1;
  return columns.map((col) => ({
    ...col,
    w: (Number(col.width || 1) / total) * CONTENT_WIDTH,
  }));
};

class PdfPage {
  constructor(pageNumber, hasLogo) {
    this.pageNumber = pageNumber;
    this.hasLogo = hasLogo;
    this.ops = [];
  }

  rect(x, y, w, h, { fill = null, stroke = null, width = 1 } = {}) {
    if (fill) this.ops.push(`${rgb(fill)} rg`);
    if (stroke) this.ops.push(`${rgb(stroke)} RG ${width.toFixed(2)} w`);
    this.ops.push(`${x.toFixed(2)} ${bottomY(y, h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
    if (fill && stroke) this.ops.push('B');
    else if (fill) this.ops.push('f');
    else if (stroke) this.ops.push('S');
  }

  line(x1, y1, x2, y2, { stroke = COLORS.line, width = 1 } = {}) {
    this.ops.push(`${rgb(stroke)} RG ${width.toFixed(2)} w`);
    this.ops.push(`${x1.toFixed(2)} ${bottomY(y1).toFixed(2)} m ${x2.toFixed(2)} ${bottomY(y2).toFixed(2)} l S`);
  }

  imageLogo(x, y, w, h) {
    if (!this.hasLogo) return;
    this.ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${bottomY(y, h).toFixed(2)} cm /Logo Do Q`);
  }

  text(value, x, y, {
    size = 10,
    color = COLORS.ink,
    bold = false,
    align = 'left',
    maxWidth = null,
  } = {}) {
    const line = cleanText(value, '');
    if (!line) return;
    const measured = textWidth(line, size);
    let tx = x;
    if (align === 'center' && maxWidth) tx = x + Math.max(0, (maxWidth - measured) / 2);
    if (align === 'right' && maxWidth) tx = x + Math.max(0, maxWidth - measured);
    const ty = bottomY(y + size * 0.86);
    this.ops.push(`${rgb(color)} rg`);
    this.ops.push(`BT /${bold ? FONT.bold : FONT.regular} ${size.toFixed(2)} Tf ${tx.toFixed(2)} ${ty.toFixed(2)} Td (${escapePdfText(line)}) Tj ET`);
  }

  textBlock(value, x, y, w, h, {
    size = 10,
    lineHeight = size * 1.28,
    color = COLORS.ink,
    bold = false,
    align = 'left',
    maxLines = null,
  } = {}) {
    const capacity = maxLines || Math.max(1, Math.floor(h / lineHeight));
    const lines = wrapText(value, w, size);
    const visible = lines.slice(0, capacity);
    if (lines.length > capacity && visible.length) {
      const last = visible[visible.length - 1];
      visible[visible.length - 1] = `${last.replace(/\s+\S*$/, '') || last.slice(0, 22)}...`;
    }
    visible.forEach((line, index) => {
      this.text(line, x, y + index * lineHeight, {
        size,
        color,
        bold,
        align,
        maxWidth: w,
      });
    });
    return Math.max(lineHeight, visible.length * lineHeight);
  }

  content() {
    return this.ops.join('\n');
  }
}

const pageHeaderMeta = (summary) => {
  const eid = cleanText(summary?.eid, '');
  if (eid) return `EID: ${eid}`;
  const generatedDate = cleanText(summary?.generatedDate, '');
  return generatedDate ? `Generated ${generatedDate}` : '';
};

const drawChrome = (page, summary, title) => {
  page.rect(0, 0, PAGE.width, PAGE.height, { fill: COLORS.paper });
  page.rect(0, 0, 6, PAGE.height, { fill: COLORS.blue });
  page.text('Executive Summary', MARGIN, 28, {
    size: 9,
    color: COLORS.blue,
    bold: true,
  });
  page.textBlock(cleanText(title || summary?.title, 'Account Plan'), MARGIN, 45, 358, 34, {
    size: 13.2,
    lineHeight: 15.2,
    color: COLORS.blueDark,
    bold: true,
    maxLines: 2,
  });
  page.textBlock(pageHeaderMeta(summary), PAGE.width - MARGIN - 132, 50, 132, 12, {
    size: 7.6,
    lineHeight: 9,
    color: COLORS.muted,
    bold: true,
    align: 'right',
    maxLines: 1,
  });
  page.line(MARGIN, HEADER_BOTTOM, PAGE.width - MARGIN, HEADER_BOTTOM, { stroke: COLORS.line, width: 0.8 });

  page.line(MARGIN, 786, PAGE.width - MARGIN, 786, { stroke: COLORS.line, width: 0.7 });
  page.text('Confidential - Internal Use Only', MARGIN, 806, {
    size: 7.5,
    color: COLORS.muted,
  });
  page.text(`Page ${page.pageNumber}`, MARGIN + 190, 806, {
    size: 7.5,
    color: COLORS.muted,
  });
  if (page.hasLogo) {
    page.imageLogo(PAGE.width - MARGIN - 54, 798, 54, 17);
  } else {
    page.text('KITE', PAGE.width - MARGIN - 54, 804, {
      size: 13,
      color: COLORS.blue,
      bold: true,
      align: 'right',
      maxWidth: 54,
    });
  }
};

const createDoc = (summary, options) => {
  const doc = {
    pages: [],
    page: null,
    y: HEADER_BOTTOM + 18,
    summary,
    title: options.title || summary?.title || 'Account Plan Executive Summary',
    hasLogo: Boolean(options.logoImage?.data),
  };
  doc.newPage = () => {
    const page = new PdfPage(doc.pages.length + 1, doc.hasLogo);
    drawChrome(page, summary, doc.title);
    doc.pages.push(page);
    doc.page = page;
    doc.y = HEADER_BOTTOM + 18;
  };
  doc.ensure = (height) => {
    if (!doc.page || doc.y + height > CONTENT_BOTTOM) doc.newPage();
  };
  doc.newPage();
  return doc;
};

const sectionTitle = (doc, title, height = 28) => {
  doc.ensure(height);
  doc.page.text(title, MARGIN, doc.y, {
    size: 13,
    color: COLORS.blueDark,
    bold: true,
  });
  doc.page.line(MARGIN, doc.y + 18, PAGE.width - MARGIN, doc.y + 18, { stroke: COLORS.line, width: 0.7 });
  doc.y += height;
};

const drawHero = (doc) => {
  doc.ensure(102);
  doc.page.rect(MARGIN, doc.y, CONTENT_WIDTH, 88, {
    fill: COLORS.white,
    stroke: COLORS.line,
    width: 0.9,
  });
  doc.page.rect(MARGIN, doc.y, 7, 88, { fill: COLORS.blue });
  doc.page.textBlock(doc.summary.title, MARGIN + 18, doc.y + 14, CONTENT_WIDTH - 36, 42, {
    size: 16,
    lineHeight: 18.5,
    color: COLORS.blueDark,
    bold: true,
    maxLines: 2,
  });
  doc.page.text('ATC Account Name', MARGIN + 18, doc.y + 60, {
    size: 8,
    color: COLORS.muted,
    bold: true,
  });
  doc.page.textBlock(doc.summary.accountLine, MARGIN + 110, doc.y + 58, CONTENT_WIDTH - 132, 18, {
    size: 10.5,
    color: COLORS.ink,
    bold: true,
    maxLines: 1,
  });
  doc.y += 104;
};

const drawKeyInfo = (doc) => {
  sectionTitle(doc, 'Account Key Information');
  const items = doc.summary.keyInfo || [];
  const gap = 8;
  const cols = 4;
  const w = (CONTENT_WIDTH - gap * (cols - 1)) / cols;
  const h = 50;
  items.forEach((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    if (col === 0) doc.ensure(h + 10);
    const x = MARGIN + col * (w + gap);
    const y = doc.y + row * (h + gap);
    doc.page.rect(x, y, w, h, {
      fill: index % 2 ? COLORS.white : COLORS.faint,
      stroke: COLORS.line,
      width: 0.6,
    });
    doc.page.textBlock(item.label, x + 8, y + 9, w - 16, 11, {
      size: 6.8,
      color: COLORS.muted,
      bold: true,
      maxLines: 1,
    });
    doc.page.textBlock(item.value, x + 8, y + 28, w - 16, 16, {
      size: 8.8,
      color: COLORS.blueDark,
      bold: true,
      maxLines: 1,
    });
    if (col === cols - 1 || index === items.length - 1) {
      if (index === items.length - 1) doc.y += (row + 1) * (h + gap);
    }
  });
  doc.y += 8;
};

const drawCardGrid = (doc, title, items, { columns = 2, cardHeight = 104 } = {}) => {
  sectionTitle(doc, title);
  const gap = 10;
  const w = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
  (items || []).forEach((item, index) => {
    const col = index % columns;
    if (col === 0) doc.ensure(cardHeight + 8);
    const x = MARGIN + col * (w + gap);
    const y = doc.y;
    doc.page.rect(x, y, w, cardHeight, {
      fill: COLORS.white,
      stroke: COLORS.line,
      width: 0.7,
    });
    doc.page.rect(x, y, w, 4, { fill: index % 2 ? COLORS.green : COLORS.teal });
    doc.page.textBlock(item.title, x + 12, y + 16, w - 24, 28, {
      size: 10.2,
      lineHeight: 12.4,
      color: COLORS.blueDark,
      bold: true,
      maxLines: 2,
    });
    doc.page.textBlock(item.body, x + 12, y + 48, w - 24, cardHeight - 58, {
      size: 8.6,
      lineHeight: 11.2,
      color: COLORS.ink,
    });
    if (col === columns - 1 || index === items.length - 1) doc.y += cardHeight + gap;
  });
  doc.y += 4;
};

const drawCountSection = (doc) => {
  const columns = [
    ['Barriers with Open Critical Activities', doc.summary.barrierDriverCounts?.barriers || []],
    ['Drivers with Open Critical Activities', doc.summary.barrierDriverCounts?.drivers || []],
  ];
  const gap = 12;
  const w = (CONTENT_WIDTH - gap) / 2;
  const xValues = [MARGIN, MARGIN + w + gap];
  const rowHeight = 60;
  const rowGap = 10;
  const headerHeight = 38;
  const columnPadding = 14;

  // Normalize each column to a non-empty list (placeholder row when empty).
  const columnRows = columns.map(([, rows]) =>
    rows.length ? rows : [{ title: 'No records available.', category: '', indication: '', openActivities: '-' }]
  );
  const totalRows = Math.max(...columnRows.map((rows) => rows.length));

  // How many rows fit in a column body starting at `fromY` on the current page.
  const rowsThatFit = (fromY) => {
    const body = CONTENT_BOTTOM - fromY - headerHeight - columnPadding * 2 - 4;
    return Math.max(1, Math.floor((body + rowGap) / (rowHeight + rowGap)));
  };

  // Section title drawn once, at the top of the section.
  sectionTitle(doc, 'Barriers & Drivers with Critical Activities');

  // Paginate the rows: pack as many as fit per page, then continue on a fresh
  // page (re-drawing the column headers) until every row is rendered.
  let start = 0;
  let firstChunk = true;
  while (start < totalRows) {
    if (!firstChunk) doc.newPage();
    const perPage = rowsThatFit(doc.y);
    const end = Math.min(totalRows, start + perPage);
    const rowsOnPage = end - start;
    const columnHeight =
      headerHeight + columnPadding + rowsOnPage * rowHeight + (rowsOnPage - 1) * rowGap + columnPadding;
    const top = doc.y;

    columnRows.forEach((rows, index) => {
      const x = xValues[index];
      const [title] = columns[index];
      doc.page.rect(x, top, w, columnHeight, {
        fill: COLORS.panel,
        stroke: COLORS.line,
        width: 0.7,
      });
      doc.page.textBlock(title, x + 12, top + 12, w - 24, 12, {
        size: 8.8,
        color: COLORS.blueDark,
        bold: true,
        maxLines: 1,
      });
      for (let i = start; i < end; i += 1) {
        const row = rows[i];
        if (!row) continue; // this column has fewer rows than the other
        const y = top + headerHeight + (i - start) * (rowHeight + rowGap);
        doc.page.rect(x + 10, y, w - 20, rowHeight, {
          fill: COLORS.white,
          stroke: COLORS.line,
          width: 0.45,
        });
        doc.page.textBlock(row.title, x + 20, y + 11, w - 40, 12, {
          size: 8.2,
          color: COLORS.ink,
          bold: true,
          maxLines: 1,
        });
        doc.page.textBlock(`${row.indication || ''} ${row.category || ''}`.trim(), x + 20, y + 30, w - 40, 9, {
          size: 7.2,
          color: COLORS.muted,
          maxLines: 1,
        });
        doc.page.text(`${row.openActivities} Open Critical Activities`, x + 20, y + 47, {
          size: 7.3,
          color: COLORS.blue,
          bold: true,
        });
      }
    });

    doc.y = top + columnHeight + 12;
    start = end;
    firstChunk = false;
  }
};

const columnPadX = (column) => Number(column.padX ?? 6);
const columnPadY = (column) => Number(column.padY ?? 8);
const columnLineHeight = (column, fontSize) => Number(column.lineHeight ?? fontSize * 1.26);
const columnTextWidth = (column) => Math.max(16, column.w - columnPadX(column) * 2);

const rowHeightFor = (row, columns, fontSize) => {
  const maxLines = Math.max(...columns.map((column) => {
    const value = cleanText(row[column.key], '');
    if (!value) return 1;
    return wrapText(value, columnTextWidth(column), fontSize).length || 1;
  }));
  const tallest = Math.max(...columns.map((column) =>
    maxLines * columnLineHeight(column, fontSize) + columnPadY(column) * 2
  ));
  return Math.min(150, Math.max(28, tallest));
};

const drawTableHeader = (doc, columns, title = '', { showTitle = false } = {}) => {
  doc.ensure(showTitle ? 58 : 34);
  if (showTitle && title) {
    doc.page.text(title, MARGIN, doc.y, {
      size: 12.2,
      color: COLORS.blueDark,
      bold: true,
    });
    doc.y += 22;
  }
  doc.page.rect(MARGIN, doc.y, CONTENT_WIDTH, 24, {
    fill: COLORS.blueDark,
    stroke: COLORS.blueDark,
    width: 0.5,
  });
  let x = MARGIN;
  columns.forEach((column) => {
    doc.page.textBlock(column.label, x + 6, doc.y + 8, column.w - 12, 9, {
      size: 6.8,
      color: COLORS.white,
      bold: true,
      maxLines: 1,
    });
    x += column.w;
  });
  doc.y += 24;
};

const drawTable = (doc, title, sourceColumns, rows, { fontSize = 7.2 } = {}) => {
  const columns = normalizeWidths(sourceColumns);
  sectionTitle(doc, title, 22);
  drawTableHeader(doc, columns);
  const visibleRows = rows?.length ? rows : [{ __empty: 'No records available.' }];
  visibleRows.forEach((row, rowIndex) => {
    if (row.__empty) {
      doc.ensure(34);
      doc.page.rect(MARGIN, doc.y, CONTENT_WIDTH, 30, {
        fill: COLORS.white,
        stroke: COLORS.line,
        width: 0.5,
      });
      doc.page.text(row.__empty, MARGIN + 10, doc.y + 11, {
        size: 8,
        color: COLORS.muted,
        bold: true,
      });
      doc.y += 34;
      return;
    }
    const h = rowHeightFor(row, columns, fontSize);
    if (doc.y + h > CONTENT_BOTTOM) {
      doc.newPage();
      drawTableHeader(doc, columns, `${title} continued`, { showTitle: true });
    }
    doc.page.rect(MARGIN, doc.y, CONTENT_WIDTH, h, {
      fill: rowIndex % 2 ? COLORS.white : COLORS.row,
      stroke: COLORS.line,
      width: 0.4,
    });
    let x = MARGIN;
    columns.forEach((column, colIndex) => {
      const padX = columnPadX(column);
      const padY = columnPadY(column);
      const lineHeight = columnLineHeight(column, fontSize);
      doc.page.textBlock(row[column.key], x + padX, doc.y + padY, columnTextWidth(column), h - padY * 2, {
        size: fontSize,
        lineHeight,
        color: colIndex === 0 ? COLORS.ink : COLORS.muted,
        bold: column.bold || colIndex === 0,
        maxLines: Math.max(1, Math.floor((h - padY * 2) / lineHeight)),
      });
      x += column.w;
    });
    doc.y += h;
  });
  doc.y += 12;
};

const renderSummary = (summary, options) => {
  const doc = createDoc(summary, options);
  drawHero(doc);
  drawKeyInfo(doc);
  drawCardGrid(doc, 'Customer Goals & Kite Strategy', summary.goalsAndStrategy, { columns: 2, cardHeight: 112 });
  drawCardGrid(doc, 'Plan of Action', summary.planOfAction, { columns: 2, cardHeight: 92 });
  drawCountSection(doc);
  drawTable(doc, 'Top Stakeholders', [
    { key: 'name', label: 'Name', width: 1.15, bold: true },
    { key: 'dlbclInfluence', label: 'DLBCL Influence', width: 0.9 },
    { key: 'mmInfluence', label: 'MM Influence', width: 0.9 },
    { key: 'driversBarriers', label: 'Stakeholder Drivers / Barriers', width: 2.5 },
  ], summary.topStakeholders);
  drawTable(doc, 'Critical Activities', [
    { key: 'title', label: 'Title', width: 1.5, bold: true },
    { key: 'relatedBarrier', label: 'Related Barrier', width: 1.25 },
    { key: 'indication', label: 'Indication', width: 0.65 },
    { key: 'status', label: 'Status', width: 0.78 },
    { key: 'accountable', label: 'Accountable', width: 1.05 },
    { key: 'dueDate', label: 'Due Date', width: 0.72 },
    { key: 'lastModifiedDate', label: 'Last Modified', width: 0.82 },
  ], summary.criticalActivities, { fontSize: 7 });
  drawTable(doc, 'Open Barriers / Drivers', [
    { key: 'type', label: 'Type', width: 0.72 },
    { key: 'title', label: 'Title', width: 1, bold: true },
    { key: 'indication', label: 'Indication', width: 0.72 },
    { key: 'strategy', label: 'Strategy', width: 0.88 },
    { key: 'category', label: 'Category', width: 0.82 },
    { key: 'businessImpact', label: 'Business Impact', width: 0.58 },
    { key: 'comments', label: 'Comments', width: 3.2, padX: 12, padY: 12, lineHeight: 9.3 },
  ], summary.openBarrierDrivers, { fontSize: 6.9 });
  drawTable(doc, 'Kite Team Members', [
    { key: 'name', label: 'Name', width: 1.3, bold: true },
    { key: 'role', label: 'Role', width: 1.6 },
    { key: 'status', label: 'Status', width: 0.72 },
    { key: 'participation', label: 'Participation', width: 0.9 },
  ], summary.teamMembers);
  return doc.pages.map((page) => page.content());
};

const byteLength = (value) => new TextEncoder().encode(value).length;

const createPdfBlob = (pages, title, { logoImage = null } = {}) => {
  const objects = [];
  const pageIds = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  let nextObjectId = 5;
  let logoObjectId = null;
  if (logoImage?.data && logoImage.width && logoImage.height) {
    logoObjectId = nextObjectId;
    nextObjectId += 1;
    const hexData = bytesToHex(logoImage.data);
    objects[logoObjectId] = [
      '<< /Type /XObject /Subtype /Image',
      `/Width ${Math.round(logoImage.width)}`,
      `/Height ${Math.round(logoImage.height)}`,
      '/ColorSpace /DeviceRGB',
      '/BitsPerComponent 8',
      '/Filter [/ASCIIHexDecode /DCTDecode]',
      `/Length ${byteLength(hexData)}`,
      '>>',
      'stream',
      hexData,
      'endstream',
    ].join('\n');
  }

  pages.forEach((content) => {
    const contentId = nextObjectId;
    nextObjectId += 1;
    const pageId = nextObjectId;
    nextObjectId += 1;
    objects[contentId] = `<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`;
    const xObjects = logoObjectId ? `/XObject << /Logo ${logoObjectId} 0 R >>` : '';
    objects[pageId] = [
      '<< /Type /Page',
      '/Parent 2 0 R',
      `/MediaBox [0 0 ${PAGE.width} ${PAGE.height}]`,
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xObjects} >>`,
      `/Contents ${contentId} 0 R`,
      '>>',
    ].join(' ');
    pageIds.push(pageId);
  });

  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  const escapedTitle = escapePdfText(title);
  const infoId = nextObjectId;
  objects[infoId] = `<< /Title (${escapedTitle}) /Producer (Kite MyInsights A4 PDF Export) >>`;

  let output = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) continue;
    offsets[id] = byteLength(output);
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = byteLength(output);
  output += `xref\n0 ${objects.length}\n`;
  output += '0000000000 65535 f \n';
  for (let id = 1; id < objects.length; id += 1) {
    output += `${String(offsets[id] || 0).padStart(10, '0')} 00000 n \n`;
  }
  output += [
    'trailer',
    `<< /Size ${objects.length} /Root 1 0 R /Info ${infoId} 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
    '',
  ].join('\n');

  return new Blob([output], { type: PDF_MIME });
};

export const createAccountPlanPdfDocument = (summary, options = {}) => {
  const resolvedSummary = summary && typeof summary === 'object'
    ? summary
    : { title: cleanText(options.title, 'Account Plan Executive Summary'), keyInfo: [] };
  const title = cleanText(options.title || resolvedSummary.title, 'Account Plan Executive Summary');
  const pages = renderSummary(resolvedSummary, {
    ...options,
    title,
  });
  return createPdfBlob(pages, title, { logoImage: options.logoImage });
};
