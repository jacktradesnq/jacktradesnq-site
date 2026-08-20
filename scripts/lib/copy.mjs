// The words of the newsletter live in content/newsletter/, not in code.
//
// A block is a "## name" heading followed by its text. Inside the text:
//   {price}      a value, filled from prop-firms.json
//   [ ... ]      dropped whole if a placeholder inside it has no value
//   *text*       bold, in the email only
//
// Anything else is text and ships as typed. An unknown {placeholder} throws
// instead of rendering "undefined" into someone's inbox.

import { readFileSync } from 'node:fs';

const PLACEHOLDER = /\{([a-z_]+)\}/g;
const OPTIONAL = /\[([^[\]]*)\]/g;

// Parses "## name\ntext" blocks. Everything before the first heading is a note
// to whoever edits the file and is ignored.
export function parseCopy(text) {
  const blocks = {};
  let name = null;
  let lines = [];
  const flush = () => {
    if (name) blocks[name] = lines.join('\n').replace(/^\n+|\n+$/g, '');
  };
  for (const line of text.split('\n')) {
    // Firm ids carry hyphens (top-one-futures), so the name charset needs one.
    const heading = /^##\s+([a-z0-9_.-]+)\s*$/.exec(line);
    if (heading) {
      flush();
      name = heading[1];
      lines = [];
    } else if (/^---+\s*$/.test(line) || /^#\s+/.test(line)) {
      // A rule or a level-1 heading closes the current block, so the notes and
      // the placeholder table at the end of the file stay out of the copy.
      flush();
      name = null;
      lines = [];
    } else if (name !== null) {
      lines.push(line);
    }
  }
  flush();
  return blocks;
}

let cached = null;
export function loadCopy(root = new URL('../../content/newsletter/', import.meta.url)) {
  if (cached) return cached;
  const messages = parseCopy(readFileSync(new URL('messages.md', root), 'utf8'));
  const takes = parseCopy(readFileSync(new URL('takes.md', root), 'utf8'));
  const codes = parseLabels(parseCopy(readFileSync(new URL('codes.md', root), 'utf8')).codes);
  cached = { messages, takes, codes };
  return cached;
}

// Test seam: hand in the files as strings instead of reading the disk.
export function useCopy(messagesText, takesText = '', codesText = '') {
  cached = {
    messages: parseCopy(messagesText),
    takes: parseCopy(takesText),
    codes: parseLabels(parseCopy(codesText).codes),
  };
  return cached;
}

export function resetCopy() {
  cached = null;
}

// Renders one block. `values` must hold every placeholder the block uses;
// an empty string counts as "no value" and collapses its [group].
export function fill(template, values, { blockName = 'copy', bold = null } = {}) {
  if (template == null) throw new Error(`missing copy block: ${blockName}`);

  for (const [, key] of template.matchAll(PLACEHOLDER)) {
    if (!(key in values)) {
      throw new Error(
        `${blockName}: unknown placeholder {${key}}. Available: ${Object.keys(values).sort().join(', ')}`
      );
    }
  }

  let out = template.replace(OPTIONAL, (_, inner) => {
    const keys = [...inner.matchAll(PLACEHOLDER)].map((m) => m[1]);
    const empty = keys.some((k) => values[k] === '' || values[k] == null);
    return empty ? '' : inner;
  });

  out = out.replace(PLACEHOLDER, (_, key) => String(values[key] ?? ''));

  // Only the email turns *stars* into markup. Discord treats ** as its own
  // bold and X shows them as typed, so those go out untouched.
  if (bold) out = out.replace(/\*([^*]+)\*/g, (_, t) => bold(t));

  // A dropped [group] can leave a double space or a space before punctuation.
  return out.replace(/[ \t]{2,}/g, ' ').replace(/ ([.,;!?])/g, '$1').trim();
}

// "key = text" lines. Used for the column labels and for codes.md, whose keys
// are firm ids and therefore carry hyphens.
export function parseLabels(block) {
  const out = {};
  for (const line of String(block ?? '').split('\n')) {
    const m = /^([a-z0-9_-]+)\s*=\s*(.+)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

export const REQUIRED_LABELS = ['target', 'maxdd', 'dailyloss', 'size_col', 'now_col', 'before_col'];

// Blocks the renderers rely on. Missing one is a loud failure, not a blank
// section in a live email.
export const REQUIRED_BLOCKS = [
  'email.subject',
  'email.preheader',
  'email.eyebrow',
  'email.ends',
  'email.lead',
  'email.sub',
  'email.specs',
  'email.labels',
  'email.cta',
  'email.code',
  'email.code_in_link',
  'code_line',
  'code_line_in_link',
  'email.catch_title',
  'email.take_title',
  'email.footer',
  'email.unsubscribe',
  'discord',
  'tweet',
  'catch.monthly',
  'catch.consistency',
  'catch.activation',
];

export function assertComplete(messages) {
  const missing = REQUIRED_BLOCKS.filter((b) => !messages[b]);
  if (missing.length) {
    throw new Error(`content/newsletter/messages.md is missing: ${missing.join(', ')}`);
  }
  const labels = parseLabels(messages['email.labels']);
  const missingLabels = REQUIRED_LABELS.filter((l) => !labels[l]);
  if (missingLabels.length) {
    throw new Error(`content/newsletter/messages.md, block email.labels is missing: ${missingLabels.join(', ')}`);
  }
  return true;
}
