// scripts/sync-files.mjs
// Scans a local source directory of mixed image/document assets and mirrors
// it into public/files/ alongside a public/files/manifest.json index file.
// Idempotent — re-runs only copy files whose recorded size has changed.
//
// Usage:
//   node scripts/sync-files.mjs                 (default source path)
//   SYNC_SOURCE_DIR=/path/to/src node scripts/sync-files.mjs
//   node scripts/sync-files.mjs --force         (rewrite all files)
//
// Default source: D:/WorkSpace/LinkedIn_AI_TechStack_Images
// Override:       SYNC_SOURCE_DIR=...
//
// Output layout:
//   public/files/image/<original-name>     (jpg/jpeg/png/gif/webp/svg/avif)
//   public/files/docs/<original-name>      (pdf/doc/docx/ppt/pptx/xls/xlsx/txt/md/ipynb/odt/rtf)
//   public/files/other/<original-name>     (everything else)
//   public/files/manifest.json             (one entry per file)

import { readFileSync, existsSync, mkdirSync, statSync, copyFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PUBLIC_FILES = join(PROJECT_ROOT, 'public', 'files');
const MANIFEST = join(PUBLIC_FILES, 'manifest.json');

const DEFAULT_SOURCE = 'D:/WorkSpace/LinkedIn_AI_TechStack_Images';
const SOURCE = process.env.SYNC_SOURCE_DIR || DEFAULT_SOURCE;

const FORCE = process.argv.includes('--force');

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico']);
const DOC_EXTS = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md', 'ipynb', 'odt', 'rtf', 'csv', 'json', 'log']);
const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v']);

function classify(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (IMAGE_EXTS.has(ext)) return { ext, category: 'image', mime: mimeForImage(ext), kind: 'image' };
  if (DOC_EXTS.has(ext)) return { ext, category: 'docs', mime: mimeForDoc(ext), kind: 'docs' };
  if (VIDEO_EXTS.has(ext)) return { ext, category: 'video', mime: mimeForVideo(ext), kind: 'video' };
  return { ext, category: 'other', mime: 'application/octet-stream', kind: 'other' };
}

function mimeForImage(ext) {
  return {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif',
    bmp: 'image/bmp', ico: 'image/x-icon',
  }[ext] || 'image/*';
}
function mimeForDoc(ext) {
  return {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain', md: 'text/markdown',
    ipynb: 'application/x-ipynb+json',
    odt: 'application/vnd.oasis.opendocument.text',
    rtf: 'application/rtf', csv: 'text/csv', json: 'application/json', log: 'text/plain',
  }[ext] || 'application/octet-stream';
}
function mimeForVideo(ext) {
  return { mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', webm: 'video/webm', mkv: 'video/x-matroska', m4v: 'video/x-m4v' }[ext] || 'video/*';
}

// Ensure dest dirs exist
for (const cat of ['image', 'docs', 'video', 'other']) mkdirSync(join(PUBLIC_FILES, cat), { recursive: true });

function loadOldManifest() {
  if (!existsSync(MANIFEST) || FORCE) return { files: {} };
  try {
    const raw = readFileSync(MANIFEST, 'utf8');
    const map = {};
    for (const entry of JSON.parse(raw).files || []) {
      map[entry.name] = entry;
    }
    return { files: map };
  } catch (e) {
    console.warn('[sync-files] WARNING: could not read existing manifest, treating as fresh sync.');
    return { files: {} };
  }
}

function listSourceFiles(source) {
  if (!existsSync(source)) throw new Error(`SYNC_SOURCE_DIR does not exist: ${source}`);
  return readdirSync(source).filter(n => !n.startsWith('.')).map(name => ({ name, src: join(source, name) }));
}

function buildManifest(source, items, startedAt) {
  const counts = { image: 0, docs: 0, video: 0, other: 0 };
  for (const it of items) counts[it.kind] += 1;
  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    startedAt,
    source,
    counts,
    total: items.length,
    files: items,
  };
}

function shortenFilename(name) {
  // Keep the original filename (e.g., '1765098421838.jpg'). The library page groups by year/month,
  // which gives meaningful visual organization without renaming.
  return name;
}

function main() {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const old = loadOldManifest();

  let entries;
  try {
    const listed = listSourceFiles(SOURCE);
    entries = listed.map(({ name, src }) => ({ name, src }));
  } catch (err) {
    console.error(`[sync-files] ERROR: ${err.message}`);
    process.exit(1);
  }

  // Remove files from previous sync that no longer exist in source.
  const keepNames = new Set(entries.map(e => e.name));
  let staleRemoved = 0;
  for (const oldName of Object.keys(old.files)) {
    if (!keepNames.has(oldName)) {
      // Best-effort delete; ignore errors
      const oldEntry = old.files[oldName];
      if (oldEntry && oldEntry.path) {
        const onDisk = join(PROJECT_ROOT, 'public', oldEntry.path.replace(/^\//, ''));
        try {
          // Node doesn't have unlinkSync in top-level fs import in some setups, readFileSync is fine, but we used readdir / read.
          // Use unlink via standard fs:
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { unlinkSync } = require('node:fs');
          unlinkSync(onDisk);
          staleRemoved++;
        } catch (e) {
          // ignore
        }
      }
    }
  }
  if (staleRemoved > 0) console.log(`[sync-files] removed ${staleRemoved} files no longer in source`);

  let copied = 0;
  let skipped = 0;
  const items = [];

  for (const { name, src } of entries) {
    let st;
    try { st = statSync(src); } catch (e) { continue; }
    if (!st.isFile()) continue;
    const cls = classify(name);
    const destPath = join(PUBLIC_FILES, cls.category, name);
    const webPath = `/files/${cls.category}/${name}`;

    const needCopy = FORCE
      || !existsSync(destPath)
      || (old.files[name] && old.files[name].sizeBytes !== st.size);

    if (needCopy) {
      try {
        copyFileSync(src, destPath);
        copied++;
      } catch (e) {
        console.warn(`[sync-files] SKIP (copy failed): ${name} — ${e.message}`);
        continue;
      }
    } else {
      skipped++;
    }

    items.push({
      name,
      path: webPath,
      ext: cls.ext,
      kind: cls.kind,
      category: cls.category,
      mime: cls.mime,
      sizeBytes: st.size,
      uploadedAt: new Date(st.mtimeMs).toISOString(),
    });
  }

  // Sort: newest uploads first
  items.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  writeFileSync(MANIFEST, JSON.stringify(buildManifest(SOURCE, items, startedAt), null, 0));
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[sync-files] OK in ${elapsed}s — total ${items.length}, copied ${copied}, skipped ${skipped}`);
  console.log(`[sync-files] counts: image=${items.filter(i => i.kind === 'image').length} docs=${items.filter(i => i.kind === 'docs').length} video=${items.filter(i => i.kind === 'video').length} other=${items.filter(i => i.kind === 'other').length}`);
}

main();
