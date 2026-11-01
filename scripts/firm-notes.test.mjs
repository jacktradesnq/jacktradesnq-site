import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFirmNotes } from '../lib/firm-notes.mjs';

test('the shipped firm-notes.md is empty: nothing is written in Angelo’s place', () => {
  const notes = parseFirmNotes(readFileSync(new URL('../content/prop-firms/firm-notes.md', import.meta.url), 'utf8'));
  assert.ok(Object.keys(notes).length >= 6);
  for (const [id, n] of Object.entries(notes)) {
    assert.equal(n.intro, '', `${id} intro`);
    assert.equal(n.take, '', `${id} take`);
  }
});

test('reads each firm’s intro and take, paragraphs kept, other titles ignored', () => {
  const md = [
    '# Explanation',
    'Some help text with ## inside.',
    '## blusky',
    '### intro',
    'One sentence.',
    '### take',
    'First paragraph.',
    '',
    'Second paragraph.',
    '## e8-markets',
    '### Intro',
    '',
    '### take',
    'Only a take.',
    '# Footer',
    'Not a note.',
  ].join('\n');
  assert.deepEqual(parseFirmNotes(md), {
    blusky: { intro: 'One sentence.', take: 'First paragraph.\n\nSecond paragraph.' },
    'e8-markets': { intro: '', take: 'Only a take.' },
  });
});
