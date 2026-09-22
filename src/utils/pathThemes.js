// Color identity for the Dashboard's Learning Path cards when more than one
// Dominio unit is assigned at once. Not chosen per-path by an admin — just a
// fixed rotation assigned by position (oldest assignment = red, then green,
// blue, purple, ...), so simultaneous units are visually distinct without
// needing any new admin configuration. Cycles via modulo if there are ever
// more assigned units than colors.

const CARD_THEME_ROTATION = [
  { title: 'from-rose-400 to-red-400', bar: 'from-rose-500 to-red-400', button: 'bg-rose-600 group-hover:bg-rose-500', hoverBorder: 'hover:border-rose-500', hoverGlow: 'hover:shadow-rose-500/20' },
  { title: 'from-emerald-400 to-green-400', bar: 'from-emerald-500 to-green-400', button: 'bg-emerald-600 group-hover:bg-emerald-500', hoverBorder: 'hover:border-emerald-500', hoverGlow: 'hover:shadow-emerald-500/20' },
  { title: 'from-blue-400 to-sky-400', bar: 'from-blue-500 to-sky-400', button: 'bg-blue-600 group-hover:bg-blue-500', hoverBorder: 'hover:border-blue-500', hoverGlow: 'hover:shadow-blue-500/20' },
  { title: 'from-violet-400 to-purple-400', bar: 'from-violet-500 to-purple-400', button: 'bg-violet-600 group-hover:bg-violet-500', hoverBorder: 'hover:border-violet-500', hoverGlow: 'hover:shadow-violet-500/20' },
  { title: 'from-amber-400 to-orange-400', bar: 'from-amber-500 to-orange-400', button: 'bg-amber-600 group-hover:bg-amber-500', hoverBorder: 'hover:border-amber-500', hoverGlow: 'hover:shadow-amber-500/20' },
  { title: 'from-teal-400 to-cyan-400', bar: 'from-teal-500 to-cyan-400', button: 'bg-teal-600 group-hover:bg-teal-500', hoverBorder: 'hover:border-teal-500', hoverGlow: 'hover:shadow-teal-500/20' },
];

export const getPathCardTheme = (index) => CARD_THEME_ROTATION[index % CARD_THEME_ROTATION.length];
