import PptxGenJS from 'pptxgenjs';

const SLIDE = { width: 13.333, height: 7.5 };
const TABLE_WIDTH = 12.35;

const COLORS = {
  accent: '0065A8',
  accentDark: '004B7C',
  dark: '233243',
  mid: '55565C',
  border: 'BFD6E6',
  pale: '0065A8',
  row: 'F6FAFD',
  white: 'FFFFFF',
  bg: 'FFFFFF',
};

const FONT = 'Trebuchet MS';

const cleanText = (value, fallback = '-') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value).replace(/\s+/g, ' ').trim() || fallback;
};

const limitText = (value, limit = 95) => {
  const text = cleanText(value);
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 3))}...` : text;
};

const normalizeColWidths = (colWidths = [], targetWidth = TABLE_WIDTH) => {
  if (!colWidths.length) return [];
  const total = colWidths.reduce((sum, width) => sum + Number(width || 0), 0);
  if (!total) return colWidths;
  return colWidths.map((width) => (Number(width || 0) / total) * targetWidth);
};

const setSlideBackground = (slide) => {
  slide.background = { color: COLORS.bg };
};

const addKiteRule = (pres, slide) => {
  slide.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.09,
    h: SLIDE.height,
    fill: { color: COLORS.accent },
    line: { color: COLORS.accent },
  });
};

const addHeader = (pres, slide, title, slideTitle, label, chunkLabel) => {
  setSlideBackground(slide);
  addKiteRule(pres, slide);
  slide.addText(slideTitle, {
    x: 0.72,
    y: 0.4,
    w: 11.82,
    h: 0.42,
    fontFace: FONT,
    fontSize: 22,
    color: COLORS.accent,
    bold: true,
    margin: 0,
    breakLine: false,
    fit: 'shrink',
    align: 'center',
  });
  slide.addText(title, {
    x: 0.72,
    y: 0.88,
    w: 7.45,
    h: 0.2,
    fontFace: FONT,
    fontSize: 9.5,
    color: COLORS.mid,
    bold: true,
    margin: 0,
    fit: 'shrink',
    breakLine: false,
  });
  slide.addText([label, chunkLabel].filter(Boolean).join('  |  '), {
    x: 8.45,
    y: 0.88,
    w: 3.98,
    h: 0.2,
    fontFace: FONT,
    fontSize: 8.7,
    color: COLORS.mid,
    bold: true,
    align: 'right',
    margin: 0,
    fit: 'shrink',
  });
  slide.addShape(pres.ShapeType.line, {
    x: 0.72,
    y: 1.18,
    w: 11.8,
    h: 0,
    line: { color: COLORS.border, width: 0.8 },
  });
};

const addFooter = (slide, pageNumber) => {
  slide.addText('Confidential – Internal Use Only', {
    x: 3.35,
    y: 6.96,
    w: 6.65,
    h: 0.22,
    fontFace: FONT,
    fontSize: 9,
    color: COLORS.mid,
    margin: 0,
    align: 'center',
  });
  slide.addText(String(pageNumber), {
    x: 12.0,
    y: 6.95,
    w: 0.45,
    h: 0.24,
    fontFace: FONT,
    fontSize: 9.5,
    color: COLORS.mid,
    margin: 0,
    align: 'right',
  });
};

const addCardBackground = (pres, slide, x, y, w, h) => {
  slide.addShape(pres.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: COLORS.white },
    line: { color: COLORS.border, width: 0.7 },
    shadow: { type: 'outer', color: '000000', blur: 1, angle: 45, distance: 1, opacity: 0.04 },
  });
};

const addTitleSlide = (pres, slide, title, pptSlide) => {
  setSlideBackground(slide);
  slide.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: SLIDE.width,
    h: 0.86,
    fill: { color: COLORS.accent },
    line: { color: COLORS.accent },
  });
  slide.addText(cleanText(pptSlide.label, 'MyInsights Export'), {
    x: 0.62,
    y: 0.24,
    w: 3.0,
    h: 0.2,
    fontFace: FONT,
    fontSize: 10,
    color: COLORS.white,
    bold: true,
    margin: 0,
    charSpace: 1.1,
  });
  slide.addText(title, {
    x: 0.72,
    y: 2.06,
    w: 8.7,
    h: 0.74,
    fontFace: FONT,
    fontSize: 34,
    color: COLORS.dark,
    bold: true,
    margin: 0,
    fit: 'shrink',
    breakLine: false,
  });
  slide.addText(cleanText(pptSlide.accountName, 'Account Plan'), {
    x: 0.76,
    y: 2.96,
    w: 6.8,
    h: 0.34,
    fontFace: FONT,
    fontSize: 15,
    color: COLORS.mid,
    margin: 0,
    fit: 'shrink',
  });

  const fields = pptSlide.fields || [];
  fields.slice(0, 3).forEach((field, index) => {
    const x = 0.76 + index * 3.2;
    slide.addText(cleanText(field.label, '').toUpperCase(), {
      x,
      y: 4.7,
      w: 2.72,
      h: 0.18,
      fontFace: FONT,
      fontSize: 7.5,
      color: COLORS.mid,
      bold: true,
      margin: 0,
      fit: 'shrink',
    });
    slide.addText(cleanText(field.value, 'Not entered'), {
      x,
      y: 5.0,
      w: 2.72,
      h: 0.28,
      fontFace: FONT,
      fontSize: 13,
      color: COLORS.dark,
      bold: true,
      margin: 0,
      fit: 'shrink',
    });
  });

  slide.addShape(pres.ShapeType.rect, {
    x: 0.76,
    y: 5.72,
    w: 11.82,
    h: 0.03,
    fill: { color: COLORS.border },
    line: { color: COLORS.border },
  });
  slide.addText(`Generated ${new Date().toLocaleDateString()}`, {
    x: 0.76,
    y: 6.02,
    w: 4.6,
    h: 0.18,
    fontFace: FONT,
    fontSize: 8,
    color: COLORS.mid,
    margin: 0,
  });
};

const addCardsSlide = (pres, slide, pptSlide) => {
  const cards = pptSlide.cards || [];
  const summaryCards = pptSlide.summaryCards || [];
  if (summaryCards.length) {
    const startX = 0.58;
    const y = 1.44;
    const gap = 0.14;
    const cardWidth = (12.17 - gap * 4) / 5;
    summaryCards.slice(0, 5).forEach((card, index) => {
      const x = startX + index * (cardWidth + gap);
      slide.addShape(pres.ShapeType.roundRect, {
        x,
        y,
        w: cardWidth,
        h: 0.72,
        rectRadius: 0.05,
        fill: { color: COLORS.white },
        line: { color: COLORS.border, width: 0.55 },
      });
      slide.addText(cleanText(card.label, '').toUpperCase(), {
        x: x + 0.13,
        y: y + 0.12,
        w: cardWidth - 0.26,
        h: 0.16,
        fontFace: FONT,
        fontSize: 6.7,
        color: COLORS.mid,
        bold: true,
        margin: 0,
        fit: 'shrink',
        breakLine: false,
      });
      slide.addText(cleanText(card.value, 'Not entered'), {
        x: x + 0.13,
        y: y + 0.36,
        w: cardWidth - 0.26,
        h: 0.22,
        fontFace: FONT,
        fontSize: 10.2,
        color: COLORS.accentDark,
        bold: true,
        margin: 0,
        fit: 'shrink',
        breakLine: false,
      });
    });
  }

  const cardWidth = 5.92;
  const hasSummary = summaryCards.length > 0;
  const cardHeight = hasSummary ? 4.0 : 4.65;
  const cardY = hasSummary ? 2.38 : 1.52;
  cards.slice(0, 2).forEach((card, index) => {
    const x = index === 0 ? 0.58 : 6.82;
    const y = cardY;
    addCardBackground(pres, slide, x, y, cardWidth, cardHeight);
    slide.addText(cleanText(card.label, '').toUpperCase(), {
      x: x + 0.28,
      y: y + 0.28,
      w: cardWidth - 0.56,
      h: 0.2,
      fontFace: FONT,
      fontSize: 8,
      color: COLORS.accent,
      bold: true,
      charSpace: 1.4,
      margin: 0,
    });
    slide.addText(cleanText(card.title, ''), {
      x: x + 0.28,
      y: y + 0.58,
      w: cardWidth - 0.56,
      h: 0.42,
      fontFace: FONT,
      fontSize: 16,
      color: COLORS.accentDark,
      bold: true,
      margin: 0,
      fit: 'shrink',
    });
    slide.addText(cleanText(card.body, 'Not entered'), {
      x: x + 0.28,
      y: y + 1.18,
      w: cardWidth - 0.56,
      h: cardHeight - 1.48,
      fontFace: FONT,
      fontSize: 12.5,
      color: COLORS.dark,
      margin: 0.03,
      valign: 'top',
      fit: 'shrink',
      breakLine: false,
    });
  });
};

const addBoxesSlide = (pres, slide, pptSlide) => {
  const boxes = pptSlide.boxes || [];
  boxes.slice(0, 2).forEach((box, index) => {
    const x = index === 0 ? 0.58 : 6.82;
    const y = 1.55;
    const w = 5.92;
    const h = 4.92;
    addCardBackground(pres, slide, x, y, w, h);
    slide.addText(cleanText(box.title, ''), {
      x: x + 0.28,
      y: y + 0.3,
      w: w - 0.56,
      h: 0.38,
      fontFace: FONT,
      fontSize: 15,
      color: COLORS.accentDark,
      bold: true,
      margin: 0,
      fit: 'shrink',
    });
    slide.addText(cleanText(box.body, 'Not entered'), {
      x: x + 0.28,
      y: y + 0.9,
      w: w - 0.56,
      h: h - 1.24,
      fontFace: FONT,
      fontSize: 10.8,
      color: COLORS.dark,
      margin: 0.02,
      valign: 'top',
      fit: 'shrink',
      breakLine: false,
    });
  });
};

const tableCell = (text, options = {}) => ({
  text: limitText(text, options.limit || 95),
  options: {
    fontFace: FONT,
    fontSize: options.fontSize || 7.6,
    color: options.color || COLORS.dark,
    bold: !!options.bold,
    fill: { color: options.fill || COLORS.white },
    margin: 0.055,
    valign: 'middle',
  },
});

const addTableSlide = (slide, pptSlide) => {
  const headers = pptSlide.headers || [];
  const rows = pptSlide.rows || [];
  if (!rows.length) {
    slide.addText(pptSlide.emptyMessage || 'No records available.', {
      x: 0.58,
      y: 1.72,
      w: 12.1,
      h: 0.42,
      fontFace: FONT,
      fontSize: 14,
      color: COLORS.mid,
      margin: 0,
    });
    return;
  }

  const rowHeight = Math.min(0.46, 5.08 / Math.max(rows.length + 1, 1));
  const colLimits = Array.isArray(pptSlide.colLimits) ? pptSlide.colLimits : [];
  const tableRows = [
    headers.map((header) => tableCell(header, {
      bold: true,
      fontSize: 7.3,
      color: COLORS.white,
      fill: COLORS.pale,
      limit: 42,
    })),
    ...rows.map((row, rowIndex) =>
      row.map((cell, colIndex) => tableCell(cell, {
        fill: rowIndex % 2 === 0 ? COLORS.white : COLORS.row,
        // Wider per-cell limit for columns that wrap heavier content
        // (e.g. Comments on the barrier/driver export) — falls back to
        // the tableCell default (95) when no override is provided.
        limit: colLimits[colIndex],
      }))
    ),
  ];

  slide.addTable(tableRows, {
    x: 0.72,
    y: 1.48,
    w: TABLE_WIDTH,
    h: 5.08,
    colW: normalizeColWidths(pptSlide.colWidths, TABLE_WIDTH),
    rowH: rowHeight,
    border: { pt: 0.5, color: COLORS.border },
    margin: 0.04,
    valign: 'middle',
    autoFit: false,
  });
};

export const createAccountPlanPresentation = (slides, options = {}) => {
  const pres = new PptxGenJS();
  pres.author = 'Kite MyInsights';
  pres.subject = 'Account Plan Export';
  pres.title = options.title || 'Account Plan Export';
  pres.company = 'Kite';
  pres.lang = 'en-US';
  pres.defineLayout({ name: 'KITE_WIDE', width: SLIDE.width, height: SLIDE.height });
  pres.layout = 'KITE_WIDE';
  pres.theme = {
    headFontFace: FONT,
    bodyFontFace: FONT,
    lang: 'en-US',
  };

  (slides || []).forEach((pptSlide, index) => {
    const slide = pres.addSlide();
    if (pptSlide.type === 'title') {
      addTitleSlide(pres, slide, options.title || 'Account Plan Export', pptSlide);
    } else {
      addHeader(pres, slide, options.title || 'Account Plan Export', pptSlide.title, pptSlide.label, pptSlide.chunkLabel);
    }
    if (pptSlide.type === 'title') {
      return;
    } else if (pptSlide.type === 'cards') {
      addCardsSlide(pres, slide, pptSlide);
    } else if (pptSlide.type === 'boxes') {
      addBoxesSlide(pres, slide, pptSlide);
    } else {
      addTableSlide(slide, pptSlide);
    }
    addFooter(slide, index + 1);
  });

  return pres;
};

export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
