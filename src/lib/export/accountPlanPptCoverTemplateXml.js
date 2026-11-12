import mockCoverSlideXml from './templates/mockCoverSlide1.xml?raw';
import coverSlideRelsXml from './templates/cover/slide1.xml.rels?raw';
import coverSlideLayoutXml from './templates/cover/slideLayout200.xml?raw';
import coverSlideLayoutRelsXml from './templates/cover/slideLayout200.xml.rels?raw';
import coverSlideMasterXml from './templates/cover/slideMaster8.xml?raw';
import coverSlideMasterRelsXml from './templates/cover/slideMaster8.xml.rels?raw';
import coverThemeXml from './templates/cover/theme8.xml?raw';
import coverImage3Url from './templates/cover/image3.emf?url';
import coverImage9Url from './templates/cover/image9.png?url';
import coverImage68Url from './templates/cover/image68.png?url';
import kiteLogoPngUrl from './templates/cover/kiteLogo.png?url';

export default mockCoverSlideXml;

export const coverTemplatePackageTextParts = [
  { path: 'ppt/slides/_rels/slide1.xml.rels', content: coverSlideRelsXml },
  { path: 'ppt/slideLayouts/slideLayout200.xml', content: coverSlideLayoutXml },
  { path: 'ppt/slideLayouts/_rels/slideLayout200.xml.rels', content: coverSlideLayoutRelsXml },
  { path: 'ppt/slideMasters/slideMaster8.xml', content: coverSlideMasterXml, sanitize: 'coverMaster' },
  { path: 'ppt/slideMasters/_rels/slideMaster8.xml.rels', content: coverSlideMasterRelsXml, sanitize: 'coverMasterRels' },
  { path: 'ppt/theme/theme8.xml', content: coverThemeXml },
];

export const coverTemplatePackageBinaryParts = [
  { path: 'ppt/media/image3.emf', url: coverImage3Url },
  { path: 'ppt/media/image9.png', url: coverImage9Url },
  { path: 'ppt/media/image68.png', url: coverImage68Url },
  { path: 'ppt/media/kiteLogo.png', url: kiteLogoPngUrl },
];
