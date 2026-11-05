// Default palette for a grammar category tile/tag that has no teacher-picked
// color yet. Hashed off the category NAME (not its position in a sorted
// list), so a category's color stays the same even as other categories are
// added or removed around it — important now that color is meant to signal
// something (a grouping), not just decorate a tile.
const DEFAULT_PALETTE = [
  '#4f46e5', // indigo-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#e11d48', // rose-600
  '#0284c7', // sky-600
  '#7c3aed', // violet-600
  '#0d9488', // teal-600
  '#ea580c', // orange-600
];

const fallbackCategoryColor = (name) => {
  const clean = name || 'General';
  let hash = 0;
  for (let i = 0; i < clean.length; i++) hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  return DEFAULT_PALETTE[hash % DEFAULT_PALETTE.length];
};

// `colorMap`: { [categoryName]: '#rrggbb' } — config/grammar_categories.
// A category without an explicit entry falls back to its stable hashed
// default instead of a plain gray, so the gallery stays colorful even
// before a teacher has customized anything.
export const resolveCategoryColor = (categoryName, colorMap) =>
  colorMap?.[categoryName] || fallbackCategoryColor(categoryName);
