// Compare a rebuilt snapshot with an existing refresh branch. Only the
// top-level build timestamp is incidental; all published content still counts.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const ref = process.argv[2];
if (!ref) throw new Error('A pending snapshot Git ref is required');
// guides.json is past Node's 1 MB default maxBuffer, so git show must be
// allowed a larger buffer or it is killed with ENOBUFS.
const pending = JSON.parse(execFileSync('git', ['show', `${ref}:data/guides.json`], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
}));
const rebuilt = JSON.parse(readFileSync('data/guides.json', 'utf8'));
function content(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('Snapshot must be a JSON object');
  }
  const { generatedAt, ...rest } = snapshot;
  return rest;
}
console.log(isDeepStrictEqual(content(pending), content(rebuilt)) ? 'equal' : 'different');
