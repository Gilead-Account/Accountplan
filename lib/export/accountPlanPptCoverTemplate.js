const escapeXmlText = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[char]));

const replaceTextRun = (xml, search, replacement) =>
  xml.replaceAll(`<a:t>${search}</a:t>`, `<a:t>${escapeXmlText(replacement)}</a:t>`);

const ensureContentType = (xml, marker, tag) =>
  xml.includes(marker) ? xml : xml.replace('</Types>', `${tag}</Types>`);

const removeThinkCellGraphicFrames = (xml) =>
  String(xml || '').replace(/<p:graphicFrame\b[\s\S]*?<\/p:graphicFrame>/g, (block) =>
    /think-cell|TCLayout\.ActiveDocument|<p:tags\b|THINKCELLSHAPEDONOTDELETE/i.test(block)
      ? ''
      : block
  );

const relationshipId = (relationship) =>
  String(relationship || '').match(/\bId="([^"]+)"/)?.[1];

const keepRelationships = (relsXml, keepIds) => {
  const relationships = String(relsXml || '').match(/<Relationship[^>]+\/>/g) || [];
  const kept = relationships.filter((relationship) => keepIds.has(relationshipId(relationship)));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${kept.join('')}</Relationships>`;
};

export const formatCoverDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

export const getCoverAccountName = (data = {}, fallbackTitle = '') => {
  const accountName = data?.home?.account?.name || data?.account?.name;
  if (accountName) return accountName;
  return String(fallbackTitle || 'Account Plan').replace(/\s+Account Plan\s*$/i, '') || 'Account Plan';
};

export const applyCoverTemplateContentTypes = (contentTypesXml) => {
  let xml = String(contentTypesXml || '');
  xml = ensureContentType(xml, 'Extension="emf"', '<Default Extension="emf" ContentType="image/x-emf"/>');
  xml = ensureContentType(xml, 'Extension="png"', '<Default Extension="png" ContentType="image/png"/>');
  xml = ensureContentType(xml, 'PartName="/ppt/slideLayouts/slideLayout200.xml"', '<Override PartName="/ppt/slideLayouts/slideLayout200.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>');
  xml = ensureContentType(xml, 'PartName="/ppt/slideMasters/slideMaster8.xml"', '<Override PartName="/ppt/slideMasters/slideMaster8.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>');
  xml = ensureContentType(xml, 'PartName="/ppt/theme/theme8.xml"', '<Override PartName="/ppt/theme/theme8.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>');
  return xml;
};

export const sanitizeCoverSlideMasterXml = (masterXml) => {
  const xml = removeThinkCellGraphicFrames(masterXml);
  const layoutRef = xml.match(/<p:sldLayoutId[^>]+r:id="rId6"\/>/)?.[0];
  if (!layoutRef) return xml;
  return xml.replace(
    /<p:sldLayoutIdLst>[\s\S]*?<\/p:sldLayoutIdLst>/,
    `<p:sldLayoutIdLst>${layoutRef}</p:sldLayoutIdLst>`,
  );
};

export const sanitizeCoverSlideRelsXml = (relsXml) =>
  keepRelationships(relsXml, new Set(['rId2', 'rId5']));

export const sanitizeCoverSlideMasterRelsXml = (relsXml) =>
  keepRelationships(relsXml, new Set(['rId6', 'rId54', 'rId58']));

export const buildCoverSlideXml = (
  templateXml,
  { title, accountName, generatedDate = formatCoverDate() } = {},
) => {
  let xml = removeThinkCellGraphicFrames(templateXml);
  xml = xml.replace(
    /<a:t>BANNER GATEWAY MEDICAL CENTER Account Plan\s*Date:\s*5\/27\/2026<\/a:t>/,
    `<a:t>${escapeXmlText(`${title || `${accountName || 'Account'} Account Plan`}\r\nDate: ${generatedDate}`)}</a:t>`,
  );
  xml = replaceTextRun(xml, 'BANNER GATEWAY MEDICAL CENTER Account Plan', title || 'Account Plan');
  xml = replaceTextRun(xml, 'BANNER GATEWAY MEDICAL CENTER', accountName || 'Account Plan');
  xml = xml.replace(
    /<a:t>Generated [^<]+?\s+\|\s+1<\/a:t>/,
    `<a:t>${escapeXmlText(`Generated ${generatedDate}  |  1`)}</a:t>`,
  );
  return xml;
};
