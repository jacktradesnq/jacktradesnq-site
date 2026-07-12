import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

const contentDir = path.join(process.cwd(), 'content', 'backtested-data');

export type Category = 'tradingview' | 'data';

export interface EntryMeta {
  title: string;
  titleNq?: string;
  titleGc?: string;
  category: Category;
  date: string;
  excerpt: string;
  excerptNq?: string;
  excerptGc?: string;
  tradingviewUrl: string;
  pdfFile?: string;
  pdfLabel?: string;
  pdfFileNq?: string;
  pdfFileGc?: string;
  group?: string;
}

export interface Entry extends EntryMeta {
  slug: string;
}

export interface EntryDetail extends EntryMeta {
  slug: string;
  explanationHtml: string;
  explanationHtmlNq: string;
  explanationHtmlGc: string;
  pdfFileNq: string;
  pdfFileGc: string;
  mobileHtml?: string;
  mobileHtmlNq?: string;
  mobileHtmlGc?: string;
}

export function getAllEntries(): Entry[] {
  if (!fs.existsSync(contentDir)) return [];

  const slugs = fs
    .readdirSync(contentDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  return slugs
    .map((slug) => {
      const metaPath = path.join(contentDir, slug, 'meta.json');
      if (!fs.existsSync(metaPath)) return null;
      const raw = fs.readFileSync(metaPath, 'utf-8');
      const meta = JSON.parse(raw) as EntryMeta;
      return { slug, ...meta };
    })
    .filter((entry): entry is Entry => entry !== null);
}

export function getEntry(slug: string): EntryDetail | null {
  const entryDir = path.join(contentDir, slug);
  if (!fs.existsSync(entryDir)) return null;

  const metaPath = path.join(entryDir, 'meta.json');
  if (!fs.existsSync(metaPath)) return null;

  const rawMeta = fs.readFileSync(metaPath, 'utf-8');
  const meta = JSON.parse(rawMeta) as EntryMeta;

  // Bilingual explanation: use explanation_nq.md + explanation_gc.md if both exist
  const mdNqPath = path.join(entryDir, 'explanation_nq.md');
  const mdGcPath = path.join(entryDir, 'explanation_gc.md');
  const hasBilingualMd = fs.existsSync(mdNqPath) && fs.existsSync(mdGcPath);

  const explanationHtmlNq = hasBilingualMd
    ? (marked.parse(fs.readFileSync(mdNqPath, 'utf-8')) as string)
    : (() => {
        const mdPath = path.join(entryDir, 'explanation.md');
        return fs.existsSync(mdPath)
          ? (marked.parse(fs.readFileSync(mdPath, 'utf-8')) as string)
          : '';
      })();

  const explanationHtmlGc = hasBilingualMd
    ? (marked.parse(fs.readFileSync(mdGcPath, 'utf-8')) as string)
    : explanationHtmlNq;

  // Bilingual PDF file: use pdfFileNq + pdfFileGc from meta if both present
  const pdfFileNq = meta.pdfFileNq ?? meta.pdfFile ?? '';
  const pdfFileGc = meta.pdfFileGc ?? meta.pdfFile ?? '';

  const mobilePath = path.join(entryDir, 'mobile.md');
  const mobileNqPath = path.join(entryDir, 'mobile_nq.md');
  const mobileGcPath = path.join(entryDir, 'mobile_gc.md');
  const hasBilingualMobile = fs.existsSync(mobileNqPath) && fs.existsSync(mobileGcPath);

  const mobileHtmlNq = hasBilingualMobile
    ? (marked.parse(fs.readFileSync(mobileNqPath, 'utf-8')) as string)
    : undefined;
  const mobileHtmlGc = hasBilingualMobile
    ? (marked.parse(fs.readFileSync(mobileGcPath, 'utf-8')) as string)
    : undefined;

  const mobileHtml = hasBilingualMobile
    ? mobileHtmlNq
    : fs.existsSync(mobilePath)
      ? (marked.parse(fs.readFileSync(mobilePath, 'utf-8')) as string)
      : undefined;

  return {
    slug,
    ...meta,
    explanationHtml: explanationHtmlNq,
    explanationHtmlNq,
    explanationHtmlGc,
    pdfFileNq,
    pdfFileGc,
    mobileHtml,
    mobileHtmlNq,
    mobileHtmlGc,
  };
}
