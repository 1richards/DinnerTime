import { describe, it, expect } from 'vitest';
import { buildRecipeHtml } from '../recipePdf';

const baseRecipe = {
  title: 'Cacio e Pepe',
  description: 'A 4-ingredient Roman classic.',
  ingredients: [
    { name: 'spaghetti', quantity: 200, unit: 'g', notes: null },
    { name: 'pecorino', quantity: 0.5, unit: 'cup', notes: 'finely grated' },
    { name: 'black pepper', quantity: 1, unit: 'tsp', notes: 'freshly ground' },
    { name: 'salt', quantity: null, unit: null, notes: 'to taste' },
  ],
  steps: ['Boil pasta.', 'Toast pepper.', 'Toss off heat with cheese.'],
  prep_time_minutes: 5,
  cook_time_minutes: 10,
  total_time_minutes: 15,
  servings: 2,
  source_url: null,
  image_url: null,
  calories_per_serving: 520,
  protein_grams_per_serving: 18.5,
  fat_grams_per_serving: 22,
};

describe('buildRecipeHtml', () => {
  it('renders the recipe title in the <h1>', () => {
    const html = buildRecipeHtml(baseRecipe);
    expect(html).toContain('<h1>Cacio e Pepe</h1>');
  });

  it('renders all ingredients with quantities, units, and notes', () => {
    const html = buildRecipeHtml(baseRecipe);
    expect(html).toContain('200 g spaghetti');
    expect(html).toContain('1/2 cup pecorino (finely grated)');
    expect(html).toContain('1 tsp black pepper (freshly ground)');
    expect(html).toContain('salt (to taste)');
  });

  it('renders numbered steps with text', () => {
    const html = buildRecipeHtml(baseRecipe);
    expect(html).toContain('>1.</span>');
    expect(html).toContain('>Boil pasta.<');
    expect(html).toContain('>3.</span>');
  });

  it('renders nutrition pills when values are present', () => {
    const html = buildRecipeHtml(baseRecipe);
    expect(html).toContain('520 kcal');
    expect(html).toContain('18.5g protein');
    expect(html).toContain('22g fat');
  });

  it('omits nutrition block when all values are null', () => {
    const html = buildRecipeHtml({
      ...baseRecipe,
      calories_per_serving: null,
      protein_grams_per_serving: null,
      fat_grams_per_serving: null,
    });
    expect(html).not.toContain('class="nutrition"');
    expect(html).not.toContain('Per serving');
  });

  it('renders source link when source_url is present', () => {
    const html = buildRecipeHtml({
      ...baseRecipe,
      source_url: 'https://example.com/recipe',
    });
    expect(html).toContain('https://example.com/recipe');
    expect(html).toContain('Source:');
  });

  it('omits source link when source_url is null', () => {
    const html = buildRecipeHtml(baseRecipe);
    expect(html).not.toContain('class="source"');
  });

  it('embeds the hero image when image_url is present', () => {
    const html = buildRecipeHtml({
      ...baseRecipe,
      image_url: 'https://example.com/hero.jpg',
    });
    expect(html).toContain('<img class="hero" src="https://example.com/hero.jpg"');
  });

  it('escapes HTML-significant characters in user content (XSS guard)', () => {
    const html = buildRecipeHtml({
      ...baseRecipe,
      title: 'Pasta <script>alert(1)</script>',
      description: 'It\'s "spicy" & savory.',
      ingredients: [
        { name: '<garlic>', quantity: 2, unit: null, notes: null },
      ],
      steps: ['Boil & drain.'],
    });
    expect(html).toContain('Pasta &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&quot;spicy&quot; &amp; savory');
    expect(html).toContain('&lt;garlic&gt;');
    expect(html).toContain('Boil &amp; drain.');
    // Ensure no raw script tag survives
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('handles zero ingredients and zero steps gracefully', () => {
    const html = buildRecipeHtml({
      ...baseRecipe,
      ingredients: [],
      steps: [],
    });
    expect(html).toContain('Ingredients</h2>');
    expect(html).toContain('Steps</h2>');
    expect(html).not.toThrow;
  });

  it('falls back to "Untitled Recipe" when title is empty', () => {
    const html = buildRecipeHtml({ ...baseRecipe, title: '' });
    expect(html).toContain('Untitled Recipe');
  });

  it('shows total_time when present, computes from prep+cook otherwise', () => {
    const html = buildRecipeHtml({
      ...baseRecipe,
      total_time_minutes: null,
      prep_time_minutes: 10,
      cook_time_minutes: 25,
    });
    expect(html).toContain('35 min');
  });

  it('omits the meta block entirely when no time and no servings', () => {
    const html = buildRecipeHtml({
      ...baseRecipe,
      total_time_minutes: 0,
      prep_time_minutes: 0,
      cook_time_minutes: 0,
      servings: null,
    });
    expect(html).not.toContain('class="meta"');
  });
});
