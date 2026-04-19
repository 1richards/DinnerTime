#!/usr/bin/env node
/**
 * Generate ingredientAliases.seed.json from canonicalIngredients.seed.json.
 *
 * For each canonical, produce:
 *   - plural/singular variant
 *   - receipt abbreviations where applicable
 *   - adjective prefixes: organic, fresh (when fridge/produce)
 *   - hand-curated aliases for common items
 *
 * Output: JSON array of {canonical_name, alias_name, source:'seed', confidence}.
 * Targets ~2000-3000 rows, 3-10 per canonical.
 */

const fs = require('node:fs');
const path = require('node:path');

const CANONICAL_PATH = path.resolve(__dirname, '../src/data/canonicalIngredients.seed.json');
const OUT_PATH = path.resolve(__dirname, '../src/data/ingredientAliases.seed.json');

const canonicals = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));

// Hand-curated aliases keyed by canonical_name. Overrides all auto-generation
// for these items; auto-generation still appends plurals etc. below.
const CURATED = {
  'chicken breast': [
    ['chkn brst', 0.9],
    ['boneless skinless chicken breast', 1.0],
    ['boneless chicken breast', 1.0],
    ['chicken breasts', 1.0],
    ['organic chicken breast', 1.0],
    ['bone-in chicken breast', 0.95],
  ],
  'chicken thigh': [
    ['chicken thighs', 1.0],
    ['boneless skinless chicken thighs', 1.0],
    ['boneless chicken thighs', 1.0],
    ['bone-in chicken thighs', 0.95],
    ['organic chicken thighs', 1.0],
  ],
  'ground beef': [
    ['hamburger', 0.9],
    ['ground chuck', 0.95],
    ['80/20 ground beef', 1.0],
    ['85/15 ground beef', 1.0],
    ['93/7 ground beef', 1.0],
    ['grass fed ground beef', 1.0],
    ['gnd beef', 0.9],
  ],
  'ground turkey': [
    ['gnd turkey', 0.9],
    ['93/7 ground turkey', 1.0],
    ['lean ground turkey', 1.0],
    ['organic ground turkey', 1.0],
  ],
  'whole milk': [
    ['milk, whole', 1.0],
    ['whl milk', 0.9],
    ['gv whl mlk', 0.85],
    ['organic whole milk', 1.0],
    ['vitamin d milk', 1.0],
  ],
  '2% milk': [
    ['2 percent milk', 1.0],
    ['reduced fat milk', 0.95],
    ['2% reduced fat milk', 1.0],
    ['organic 2% milk', 1.0],
  ],
  'skim milk': [
    ['nonfat milk', 1.0],
    ['fat free milk', 1.0],
    ['skim mlk', 0.9],
  ],
  'almond milk': [
    ['unsweetened almond milk', 1.0],
    ['vanilla almond milk', 1.0],
    ['almond mlk', 0.9],
  ],
  'oat milk': [
    ['oatly', 0.85],
    ['planet oat', 0.85],
    ['oat mlk', 0.9],
  ],
  'olive oil': [
    ['evoo', 1.0],
    ['extra virgin olive oil', 1.0],
    ['cold pressed olive oil', 1.0],
    ['olv oil', 0.9],
    ['organic olive oil', 1.0],
  ],
  'extra virgin olive oil': [
    ['evoo', 1.0],
    ['cold pressed evoo', 1.0],
    ['organic extra virgin olive oil', 1.0],
  ],
  'orange juice': [
    ['oj', 1.0],
    ['fresh squeezed orange juice', 1.0],
    ['not from concentrate orange juice', 1.0],
    ['pulp free orange juice', 1.0],
    ['organic orange juice', 1.0],
  ],
  'greek yogurt': [
    ['grk yogurt', 0.9],
    ['plain greek yogurt', 1.0],
    ['nonfat greek yogurt', 1.0],
    ['vanilla greek yogurt', 1.0],
    ['chobani', 0.85],
    ['fage', 0.85],
  ],
  'canned tomatoes': [
    ['diced tomatoes', 0.9],
    ['crushed tomatoes', 0.9],
    ['whole peeled tomatoes', 0.9],
    ['cnd tomatoes', 0.9],
    ['tomatoes, canned', 1.0],
  ],
  'canned black beans': [
    ['black beans', 0.95],
    ['cnd black beans', 0.9],
    ['black beans, canned', 1.0],
  ],
  'canned chickpeas': [
    ['chickpeas', 0.95],
    ['garbanzo beans', 1.0],
    ['canned garbanzo beans', 1.0],
  ],
  'canned tuna': [
    ['tuna', 0.85],
    ['tuna fish', 0.9],
    ['tuna in water', 1.0],
    ['tuna in oil', 1.0],
    ['albacore tuna', 1.0],
  ],
  'frozen peas': [
    ['frozen pea', 1.0],
    ['fzn peas', 0.9],
    ['peas, frozen', 1.0],
    ['bag of frozen peas', 1.0],
  ],
  'frozen corn': [
    ['fzn corn', 0.9],
    ['corn, frozen', 1.0],
    ['sweet corn frozen', 1.0],
  ],
  'frozen mixed vegetables': [
    ['fzn mixed veg', 0.9],
    ['mixed vegetables frozen', 1.0],
    ['frozen veggie mix', 0.95],
  ],
  'ice cream': [
    ['icecream', 0.95],
    ['vanilla ice cream', 1.0],
    ['chocolate ice cream', 1.0],
    ['pint of ice cream', 1.0],
  ],
  banana: [
    ['organic banana', 1.0],
    ['bananas', 1.0],
    ['banana bunch', 1.0],
  ],
  apple: [
    ['apples', 1.0],
    ['organic apple', 1.0],
    ['gala apple', 0.95],
    ['fuji apple', 0.95],
    ['honeycrisp apple', 0.95],
    ['granny smith apple', 0.95],
  ],
  avocado: [
    ['avocados', 1.0],
    ['hass avocado', 1.0],
    ['organic avocado', 1.0],
  ],
  tomato: [
    ['tomatoes', 1.0],
    ['roma tomato', 0.95],
    ['vine tomato', 0.95],
    ['on-the-vine tomato', 0.95],
    ['organic tomato', 1.0],
  ],
  onion: [
    ['onions', 1.0],
    ['whl onion', 0.9],
  ],
  garlic: [
    ['garlic clove', 1.0],
    ['garlic cloves', 1.0],
    ['garlic bulb', 1.0],
    ['garlic head', 1.0],
    ['organic garlic', 1.0],
    ['fresh garlic', 1.0],
  ],
  'bell pepper': [
    ['bell peppers', 1.0],
    ['red bell pepper', 1.0],
    ['green bell pepper', 1.0],
    ['yellow bell pepper', 1.0],
    ['orange bell pepper', 1.0],
    ['organic bell pepper', 1.0],
  ],
  carrot: [
    ['carrots', 1.0],
    ['baby carrots', 0.9],
    ['organic carrots', 1.0],
    ['whole carrots', 1.0],
  ],
  lettuce: [
    ['lettuces', 1.0],
    ['head of lettuce', 1.0],
    ['organic lettuce', 1.0],
  ],
  spinach: [
    ['baby spinach', 1.0],
    ['fresh spinach', 1.0],
    ['organic spinach', 1.0],
    ['spinach leaves', 1.0],
  ],
  kale: [
    ['lacinato kale', 0.95],
    ['curly kale', 0.95],
    ['baby kale', 0.95],
    ['organic kale', 1.0],
  ],
  broccoli: [
    ['broccoli crowns', 0.95],
    ['broccoli florets', 0.95],
    ['organic broccoli', 1.0],
  ],
  cucumber: [
    ['cucumbers', 1.0],
    ['english cucumber', 1.0],
    ['persian cucumber', 1.0],
    ['organic cucumber', 1.0],
  ],
  'salmon fillet': [
    ['salmon', 0.9],
    ['atlantic salmon', 0.95],
    ['wild salmon', 0.95],
    ['sockeye salmon', 0.95],
    ['salmon fillets', 1.0],
  ],
  shrimp: [
    ['large shrimp', 0.95],
    ['peeled and deveined shrimp', 1.0],
    ['jumbo shrimp', 0.95],
    ['cocktail shrimp', 0.95],
  ],
  'heavy cream': [
    ['heavy whipping cream', 1.0],
    ['hvy cream', 0.9],
    ['whipping cream', 0.95],
  ],
  butter: [
    ['salted butter', 1.0],
    ['grass fed butter', 1.0],
    ['stick of butter', 1.0],
    ['butter sticks', 1.0],
  ],
  'unsalted butter': [
    ['sweet cream butter', 0.9],
    ['unslt butter', 0.9],
    ['unsalted sweet cream butter', 1.0],
  ],
  'cheddar cheese': [
    ['cheddar', 0.95],
    ['sharp cheddar', 1.0],
    ['mild cheddar', 1.0],
    ['shredded cheddar', 0.95],
    ['block cheddar', 0.95],
  ],
  'mozzarella cheese': [
    ['mozzarella', 0.95],
    ['fresh mozzarella', 1.0],
    ['low moisture mozzarella', 1.0],
    ['shredded mozzarella', 0.95],
    ['mozz', 0.9],
  ],
  'parmesan cheese': [
    ['parmesan', 0.95],
    ['grated parmesan', 1.0],
    ['shredded parmesan', 1.0],
    ['parmigiano reggiano', 1.0],
  ],
  'cream cheese': [
    ['philadelphia cream cheese', 0.9],
    ['crm cheese', 0.9],
    ['block cream cheese', 1.0],
    ['whipped cream cheese', 0.95],
  ],
  egg: [
    ['eggs', 1.0],
    ['large eggs', 1.0],
    ['cage free eggs', 1.0],
    ['organic eggs', 1.0],
    ['free range eggs', 1.0],
    ['brown eggs', 1.0],
    ['dozen eggs', 1.0],
  ],
  bacon: [
    ['thick cut bacon', 1.0],
    ['center cut bacon', 1.0],
    ['turkey bacon', 0.8],
    ['applewood smoked bacon', 1.0],
    ['bacon strips', 1.0],
  ],
  'white rice': [
    ['long grain white rice', 1.0],
    ['short grain white rice', 1.0],
    ['wht rice', 0.9],
  ],
  'brown rice': [
    ['long grain brown rice', 1.0],
    ['brn rice', 0.9],
    ['whole grain brown rice', 1.0],
  ],
  quinoa: [
    ['white quinoa', 0.95],
    ['red quinoa', 0.95],
    ['tricolor quinoa', 0.95],
    ['organic quinoa', 1.0],
  ],
  oats: [
    ['oatmeal', 0.9],
    ['old fashioned oats', 1.0],
    ['organic oats', 1.0],
  ],
  'rolled oats': [
    ['old fashioned rolled oats', 1.0],
    ['organic rolled oats', 1.0],
    ['rld oats', 0.9],
  ],
  'all-purpose flour': [
    ['ap flour', 0.9],
    ['plain flour', 0.95],
    ['white flour', 0.9],
    ['unbleached all-purpose flour', 1.0],
  ],
  spaghetti: [
    ['spaghetti pasta', 1.0],
    ['thin spaghetti', 1.0],
    ['spaghettini', 0.85],
  ],
  penne: [
    ['penne pasta', 1.0],
    ['penne rigate', 1.0],
  ],
  'peanut butter': [
    ['pnut butter', 0.9],
    ['creamy peanut butter', 1.0],
    ['crunchy peanut butter', 1.0],
    ['natural peanut butter', 1.0],
    ['jif', 0.8],
    ['skippy', 0.8],
    ['pb', 0.9],
  ],
  'almond butter': [
    ['almnd butter', 0.9],
    ['creamy almond butter', 1.0],
    ['crunchy almond butter', 1.0],
  ],
  honey: [
    ['raw honey', 1.0],
    ['local honey', 1.0],
    ['organic honey', 1.0],
    ['clover honey', 1.0],
  ],
  'maple syrup': [
    ['pure maple syrup', 1.0],
    ['grade a maple syrup', 1.0],
    ['mple syrup', 0.9],
    ['vermont maple syrup', 1.0],
  ],
  'soy sauce': [
    ['low sodium soy sauce', 1.0],
    ['tamari', 0.95],
    ['shoyu', 0.9],
    ['kikkoman', 0.85],
  ],
  ketchup: [
    ['tomato ketchup', 1.0],
    ['heinz ketchup', 0.9],
    ['ktchup', 0.9],
    ['organic ketchup', 1.0],
  ],
  mayonnaise: [
    ['mayo', 1.0],
    ['hellmanns', 0.85],
    ['dukes mayo', 0.85],
    ['olive oil mayo', 1.0],
  ],
  mustard: [
    ['yellow mustard', 1.0],
    ['mstrd', 0.9],
  ],
  'dijon mustard': [
    ['dijon', 0.95],
    ['grey poupon', 0.9],
    ['whole grain dijon', 1.0],
  ],
  'bbq sauce': [
    ['barbecue sauce', 1.0],
    ['barbeque sauce', 1.0],
    ['sweet baby rays', 0.85],
  ],
  'hot sauce': [
    ['tabasco', 0.9],
    ['franks red hot', 0.9],
    ['cholula', 0.9],
  ],
  salsa: [
    ['pico de gallo', 0.85],
    ['jarred salsa', 1.0],
    ['fresh salsa', 1.0],
    ['salsa verde', 0.95],
  ],
  'marinara sauce': [
    ['marinara', 0.95],
    ['pasta sauce', 0.9],
    ['jar of marinara', 1.0],
    ['rao\'s marinara', 0.85],
  ],
  bread: [
    ['loaf of bread', 1.0],
    ['sliced bread', 1.0],
  ],
  'white bread': [
    ['wht bread', 0.9],
    ['sliced white bread', 1.0],
  ],
  'whole wheat bread': [
    ['ww bread', 0.9],
    ['100% whole wheat bread', 1.0],
    ['whole grain bread', 0.9],
  ],
  bagel: [
    ['bagels', 1.0],
    ['plain bagel', 1.0],
    ['everything bagel', 1.0],
    ['sesame bagel', 1.0],
  ],
  tortilla: [
    ['tortillas', 1.0],
  ],
  'flour tortilla': [
    ['flour tortillas', 1.0],
    ['burrito tortilla', 0.9],
  ],
  'corn tortilla': [
    ['corn tortillas', 1.0],
    ['taco shell', 0.85],
  ],
  coffee: [
    ['coffee grounds', 0.95],
    ['organic coffee', 1.0],
    ['fair trade coffee', 1.0],
  ],
  'ground coffee': [
    ['gnd coffee', 0.9],
    ['pre-ground coffee', 1.0],
  ],
  'coffee beans': [
    ['whole bean coffee', 1.0],
    ['whole beans', 0.9],
  ],
  'black tea': [
    ['blk tea', 0.9],
    ['earl grey', 0.9],
    ['english breakfast tea', 1.0],
  ],
  'green tea': [
    ['matcha', 0.85],
    ['sencha', 0.9],
  ],
  beer: [
    ['lager', 0.9],
    ['ipa', 0.9],
    ['pilsner', 0.9],
    ['six pack beer', 0.95],
  ],
  'red wine': [
    ['cabernet', 0.9],
    ['merlot', 0.9],
    ['pinot noir', 0.9],
    ['bottle of red wine', 1.0],
  ],
  'white wine': [
    ['chardonnay', 0.9],
    ['sauvignon blanc', 0.9],
    ['pinot grigio', 0.9],
    ['bottle of white wine', 1.0],
  ],
  salt: [
    ['table salt', 1.0],
    ['fine salt', 0.95],
    ['iodized salt', 1.0],
  ],
  'kosher salt': [
    ['koshr salt', 0.9],
    ['diamond crystal salt', 0.85],
    ['mortons kosher salt', 0.85],
  ],
  'black pepper': [
    ['ground black pepper', 1.0],
    ['freshly ground pepper', 1.0],
    ['blk pepper', 0.9],
    ['peppercorns', 0.9],
  ],
  'red pepper flakes': [
    ['crushed red pepper', 1.0],
    ['red chili flakes', 0.95],
    ['chili flakes', 0.9],
  ],
  cinnamon: [
    ['ground cinnamon', 1.0],
    ['cinnamon sticks', 0.9],
    ['ceylon cinnamon', 0.95],
  ],
  'vanilla extract': [
    ['vanilla', 0.9],
    ['pure vanilla extract', 1.0],
    ['madagascar vanilla extract', 1.0],
  ],
  'baking powder': [
    ['bkng pwdr', 0.85],
  ],
  'baking soda': [
    ['bkng soda', 0.85],
    ['sodium bicarbonate', 0.95],
  ],
  sugar: [
    ['white sugar', 1.0],
    ['granulated sugar', 1.0],
    ['cane sugar', 1.0],
    ['organic sugar', 1.0],
  ],
  'brown sugar': [
    ['light brown sugar', 1.0],
    ['dark brown sugar', 1.0],
    ['brn sugar', 0.9],
  ],
  'powdered sugar': [
    ['confectioners sugar', 1.0],
    ['icing sugar', 1.0],
    ['pwdr sugar', 0.9],
  ],
  yeast: [
    ['active dry yeast', 1.0],
    ['instant yeast', 1.0],
    ['rapid rise yeast', 1.0],
  ],
  almonds: [
    ['raw almonds', 1.0],
    ['roasted almonds', 1.0],
    ['slivered almonds', 1.0],
    ['sliced almonds', 1.0],
    ['whole almonds', 1.0],
  ],
  walnuts: [
    ['walnut halves', 1.0],
    ['walnut pieces', 1.0],
    ['english walnuts', 1.0],
  ],
  cashews: [
    ['raw cashews', 1.0],
    ['roasted cashews', 1.0],
    ['whole cashews', 1.0],
  ],
  granola: [
    ['homemade granola', 1.0],
    ['honey granola', 1.0],
    ['vanilla granola', 1.0],
  ],
  cereal: [
    ['breakfast cereal', 1.0],
    ['cheerios', 0.8],
    ['corn flakes', 0.85],
    ['granola cereal', 0.9],
  ],
  'tortilla chips': [
    ['tort chips', 0.9],
    ['corn chips', 0.9],
    ['blue corn tortilla chips', 1.0],
  ],
  'potato chips': [
    ['kettle chips', 0.9],
    ['sea salt chips', 0.95],
    ['lays', 0.8],
  ],
  crackers: [
    ['saltines', 0.9],
    ['ritz crackers', 0.85],
    ['water crackers', 1.0],
  ],
  cookies: [
    ['oreos', 0.8],
    ['chocolate chip cookies', 1.0],
    ['oatmeal cookies', 1.0],
  ],
  'dark chocolate': [
    ['70% dark chocolate', 1.0],
    ['85% dark chocolate', 1.0],
    ['bittersweet chocolate', 0.9],
  ],
  'chocolate chips': [
    ['semi sweet chocolate chips', 1.0],
    ['milk chocolate chips', 1.0],
    ['dark chocolate chips', 1.0],
    ['mini chocolate chips', 1.0],
  ],
};
function pluralize(name) {
  // Simple heuristic: only pluralize if no obvious multi-word, not a mass noun.
  const MASS = new Set([
    'milk', 'butter', 'flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar',
    'rice', 'water', 'juice', 'wine', 'beer', 'coffee', 'tea', 'honey',
    'bread', 'lettuce', 'spinach', 'kale', 'arugula', 'cereal', 'granola',
    'yogurt', 'cream', 'mayonnaise', 'ketchup', 'mustard', 'salsa', 'hummus',
    'pesto', 'jam', 'jelly', 'quinoa', 'couscous', 'farro', 'barley', 'oats',
    'corn', 'bacon', 'ham', 'chocolate', 'popcorn', 'bulgur',
  ]);
  if (MASS.has(name)) return null;
  if (name.endsWith('s') || name.endsWith('x') || name.endsWith('ch') || name.endsWith('sh')) {
    return name + 'es';
  }
  if (name.endsWith('y') && !/[aeiou]y$/.test(name)) {
    return name.slice(0, -1) + 'ies';
  }
  if (name.endsWith('f')) return name.slice(0, -1) + 'ves';
  return name + 's';
}

function singularize(name) {
  // For canonicals already pluralized, we'd produce a singular. None of ours
  // are pluralized except a handful. Short-circuit to null; plural handling
  // above covers the reverse direction.
  return null;
}

function pickAbbreviation(name) {
  // Generate a receipt-style abbreviation by dropping vowels from a word >4 chars.
  // Only return if result differs meaningfully from original.
  const parts = name.split(/\s+/);
  const abbr = parts.map(p => {
    if (p.length <= 4) return p;
    // keep first char + consonants
    const first = p[0];
    const rest = p.slice(1).replace(/[aeiou]/g, '');
    return first + rest;
  }).join(' ');
  if (abbr === name) return null;
  return abbr;
}

function adjectivePrefixes(name, category, location) {
  const prefixes = [];
  if (category === 'produce' || location === 'fridge') {
    prefixes.push('organic ' + name);
    prefixes.push('fresh ' + name);
  } else if (category === 'protein') {
    prefixes.push('organic ' + name);
  } else if (category === 'dairy') {
    prefixes.push('organic ' + name);
  } else if (category === 'grain' || category === 'condiment') {
    prefixes.push('organic ' + name);
  }
  return prefixes;
}

const rows = [];
const seen = new Set();

function addAlias(canonical_name, alias_name, confidence) {
  const key = canonical_name + '||' + alias_name;
  if (seen.has(key)) return;
  if (alias_name === canonical_name) return; // identity is not an alias
  if (!alias_name || alias_name.trim().length === 0) return;
  seen.add(key);
  rows.push({ canonical_name, alias_name, source: 'seed', confidence });
}

for (const c of canonicals) {
  const name = c.canonical_name;

  // 1) Curated aliases (if any)
  const curated = CURATED[name] || [];
  for (const [alias, conf] of curated) {
    addAlias(name, alias, conf);
  }

  // 2) Plural variant
  const plural = pluralize(name);
  if (plural) addAlias(name, plural, 1.0);

  // 3) Receipt abbreviation (may collide with curated; addAlias dedups)
  const abbr = pickAbbreviation(name);
  if (abbr && abbr.length >= 3) addAlias(name, abbr, 0.85);

  // 4) Adjective prefixes (organic/fresh). Curated often already has 'organic X';
  //    addAlias dedups silently.
  for (const prefix of adjectivePrefixes(name, c.category, c.default_source_location)) {
    addAlias(name, prefix, 1.0);
  }

  // 5) "X, <descriptor>" receipt style (reverse phrase)
  const parts = name.split(/\s+/);
  if (parts.length === 2) {
    const reversed = `${parts[1]}, ${parts[0]}`;
    addAlias(name, reversed, 0.9);
  }
}

fs.writeFileSync(OUT_PATH, JSON.stringify(rows, null, 2) + '\n');
console.log('wrote', rows.length, 'alias rows to', OUT_PATH);

// Sanity: count per canonical.
const perCanonical = {};
for (const r of rows) perCanonical[r.canonical_name] = (perCanonical[r.canonical_name] || 0) + 1;
const counts = Object.values(perCanonical);
console.log('per-canonical min/avg/max:', Math.min(...counts), (counts.reduce((a,b)=>a+b,0)/counts.length).toFixed(1), Math.max(...counts));
console.log('canonicals with >=3 aliases:', counts.filter(n => n >= 3).length, '/', canonicals.length);
