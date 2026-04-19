#!/usr/bin/env node
/**
 * Splice seed JSON arrays into migration 00011 + 00012 DO blocks.
 * Replaces __CANONICAL_SEED_PLACEHOLDER__ and __ALIAS_SEED_PLACEHOLDER__.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const canonicalJson = fs.readFileSync(path.join(ROOT, 'packages/server/src/data/canonicalIngredients.seed.json'), 'utf8').trim();
const aliasJson = fs.readFileSync(path.join(ROOT, 'packages/server/src/data/ingredientAliases.seed.json'), 'utf8').trim();

const m11Path = path.join(ROOT, 'supabase/migrations/00011_canonical_ingredients.sql');
const m12Path = path.join(ROOT, 'supabase/migrations/00012_ingredient_aliases.sql');

let m11 = fs.readFileSync(m11Path, 'utf8');
let m12 = fs.readFileSync(m12Path, 'utf8');

if (!m11.includes('__CANONICAL_SEED_PLACEHOLDER__')) {
  console.error('00011 already spliced (no placeholder found). Aborting.');
  process.exit(1);
}
if (!m12.includes('__ALIAS_SEED_PLACEHOLDER__')) {
  console.error('00012 already spliced (no placeholder found). Aborting.');
  process.exit(1);
}

m11 = m11.replace('__CANONICAL_SEED_PLACEHOLDER__', canonicalJson);
m12 = m12.replace('__ALIAS_SEED_PLACEHOLDER__', aliasJson);

fs.writeFileSync(m11Path, m11);
fs.writeFileSync(m12Path, m12);

console.log('Spliced canonical seed into 00011 and alias seed into 00012');
