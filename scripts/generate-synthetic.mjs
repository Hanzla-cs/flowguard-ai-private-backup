import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { generateSynthetic, verifySynthetic } from '../src/synthetic/generate.ts';

const mode = process.argv[2] ?? '--write';
if (!['--write', '--check', '--stdout'].includes(mode) || process.argv.length > 3) {
  throw new Error('Usage: node scripts/generate-synthetic.mjs [--write|--check|--stdout]');
}
const generated = await generateSynthetic();
const directory = new URL('../data/synthetic/', import.meta.url);
const csvPath = new URL('flowguard-paired-wait-shift-v1.csv', directory);
const manifestPath = new URL('flowguard-paired-wait-shift-v1.manifest.json', directory);
if (mode === '--stdout') {
  process.stdout.write(JSON.stringify(generated));
} else if (mode === '--check') {
  await verifySynthetic(await readFile(csvPath), await readFile(manifestPath));
  console.log('CSV and manifest match the versioned generator and approved seed.');
} else {
  await mkdir(directory, { recursive: true });
  await writeFile(csvPath, generated.csv, 'utf8');
  await writeFile(manifestPath, generated.manifest, 'utf8');
  console.log('Wrote fictional CSV and manifest to data/synthetic/.');
}
