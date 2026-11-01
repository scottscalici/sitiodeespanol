const DIRECTION_MAP = {
  t: 'to top',
  tr: 'to top right',
  r: 'to right',
  br: 'to bottom right',
  b: 'to bottom',
  bl: 'to bottom left',
  l: 'to left',
  tl: 'to top left',
};

// Tailwind's JIT build only generates CSS for a class it finds literally
// written somewhere in the source it scans (see tailwind.config.js's
// `content` globs) — a class that exists only as Firestore data (a
// teacher-typed or AI-generated header gradient) never gets compiled, so
// the className renders with no matching rule at all: an invisible header.
// Arbitrary-value bracket syntax (`from-[#112233]`) is exactly the form
// most likely to be genuinely novel each time, so this pulls the real hex
// stops straight out of the class string and builds an equivalent inline
// `backgroundImage`, which renders correctly for any color without Tailwind
// ever needing to have precompiled it. A class string using named Tailwind
// colors (`from-purple-900`) doesn't match and returns null, leaving the
// caller to fall back to the plain className — unchanged from before.
export const parseHeaderGradientStyle = (classString) => {
  if (!classString) return null;
  const dirMatch = classString.match(/bg-gradient-to-([a-z]{1,2})\b/);
  const direction = DIRECTION_MAP[dirMatch?.[1]] || 'to right';

  const stop = (keyword) => classString.match(new RegExp(`${keyword}-\\[(#[0-9a-fA-F]{3,8})\\]`))?.[1];
  const from = stop('from');
  const via = stop('via');
  const to = stop('to');

  if (!from || !to) return null;

  const stops = [from, via, to].filter(Boolean).join(', ');
  return { backgroundImage: `linear-gradient(${direction}, ${stops})` };
};
