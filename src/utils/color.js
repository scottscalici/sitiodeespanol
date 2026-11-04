// Darkens a #rgb/#rrggbb hex color by `amount` (0-1 fraction of each channel
// to remove), for deriving a border/ring shade from a single theme-picked
// fill color instead of asking a teacher to pick two coordinated colors.
export const darkenHex = (hex, amount = 0.35) => {
  if (!hex) return hex;
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (full.length !== 6) return hex;
  const channel = (i) => {
    const value = parseInt(full.slice(i, i + 2), 16);
    if (Number.isNaN(value)) return '00';
    return Math.max(0, Math.round(value * (1 - amount))).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
};
