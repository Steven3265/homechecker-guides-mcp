import { copyFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillNames = [
  'australian-homebuyer-due-diligence',
  'australian-property-documents',
  'australian-building-risk-reader',
  'australian-home-ownership-planner',
];

for (const name of skillNames) {
  const source = new URL(`../skills/${name}/SKILL.md`, import.meta.url);
  const targets = [
    new URL(`../public/skills/${name}/SKILL.md`, import.meta.url),
    new URL(`../distribution/openai/homechecker/skills/${name}/SKILL.md`, import.meta.url),
  ];
  for (const target of targets) {
    await mkdir(dirname(fileURLToPath(target)), { recursive: true });
    await copyFile(source, target);
  }
}

console.log(`Synced ${skillNames.length} canonical Homechecker skills to public and OpenAI distribution copies.`);
