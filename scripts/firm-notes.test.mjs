import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFirmNotes } from '../lib/firm-notes.mjs';

test('the shipped firm-notes.md has every firm, and E8 carries the take Angelo gave (01/11/2026)', () => {
  const notes = parseFirmNotes(readFileSync(new URL('../content/prop-firms/firm-notes.md', import.meta.url), 'utf8'));
  assert.ok(Object.keys(notes).length >= 6);
  assert.match(notes['e8-markets'].take, /^I don't have any preferences for E8/);
  assert.equal(notes['e8-perps'].take, notes['e8-markets'].take);
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
