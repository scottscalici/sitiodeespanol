const CORNER_POSITION = {
  'top-left': 'top-1 left-1',
  'top-right': 'top-1 right-1',
  'bottom-left': 'bottom-1 left-1',
  'bottom-right': 'bottom-1 right-1',
};

const ANCHOR_POSITION = {
  'top-left': 'top-0 left-0',
  'top-right': 'top-0 right-0',
  'bottom-left': 'bottom-0 left-0',
  'bottom-right': 'bottom-0 right-0',
  full: 'inset-0',
};

// A small, low-opacity emoji or image tucked into one corner of a card —
// resolveCardTheme already decided WHICH decoration (if any) this specific
// card should show, so this just renders it. The host card needs `relative`
// (and usually `overflow-hidden`) for the absolute positioning to land
// inside its own bounds rather than the page.
//
// `useCurrentColor` recolors an arbitrary SVG via a CSS mask instead of
// trying to inject or fetch its markup — an <img src> can't be recolored
// with currentColor (that only works for inline <svg>), but ANY image can
// be used as a mask shape filled with a solid color, which is what lets the
// same bat silhouette be orange in one theme and green in another.
export function CardCornerDecoration({ decoration }) {
  if (!decoration) return null;
  const position = CORNER_POSITION[decoration.corner] || 'top-1 right-1';
  const size = decoration.size || 28;
  const opacity = decoration.opacity ?? 0.18;

  if (decoration.type === 'svg' && decoration.value) {
    if (decoration.useCurrentColor) {
      return (
        <span
          aria-hidden="true"
          className={`absolute ${position} pointer-events-none select-none`}
          style={{
            width: size,
            height: size,
            opacity,
            display: 'inline-block',
            backgroundColor: decoration.color || 'var(--accent)',
            // Double-quoted: an SVG data URI always uses single quotes for
            // its own attributes, which would terminate url('...') early
            // and silently drop the whole property.
            maskImage: `url("${decoration.value}")`,
            WebkitMaskImage: `url("${decoration.value}")`,
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
          }}
        />
      );
    }
    return (
      <img
        src={decoration.value}
        alt=""
        aria-hidden="true"
        className={`absolute ${position} pointer-events-none select-none`}
        style={{ width: size, height: size, opacity }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`absolute ${position} pointer-events-none select-none`}
      style={{ fontSize: size, opacity, lineHeight: 1 }}
    >
      {decoration.value}
    </span>
  );
}

// The bigger, cobweb-style decorative layer — same theme-default/per-card
// precedence as corner decorations, but anchored to a corner (or the whole
// card) at a configurable size rather than a small fixed badge. `tint`
// washes a color over the image's own shading (mix-blend-mode) rather than
// fully recoloring it, which suits a textured asset like a cobweb better
// than the flat mask recolor corner decorations use.
export function CardOverlay({ overlay }) {
  if (!overlay?.url) return null;
  const isFull = overlay.anchor === 'full';
  const position = ANCHOR_POSITION[overlay.anchor] || 'top-0 left-0';
  const dimension = isFull ? '100%' : overlay.size || '50%';
  const backgroundPosition = (overlay.anchor || 'top-left').replace('-', ' ');

  return (
    <div
      aria-hidden="true"
      className={`absolute ${position} pointer-events-none`}
      style={{ width: dimension, height: dimension }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("${overlay.url}")`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition,
          opacity: overlay.opacity ?? 0.2,
          transform: overlay.flip ? 'scaleX(-1)' : undefined,
        }}
      />
      {overlay.tint && (
        // Masked by the SAME image rather than a plain rectangle — a flat
        // tinted square would wash over the overlay's transparent padding
        // too, not just the artwork itself (confirmed visually: without the
        // mask here, a cobweb's whole bounding box turns solid-colored
        // instead of just the webbing).
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: overlay.tint,
            mixBlendMode: 'multiply',
            opacity: overlay.opacity ?? 0.2,
            transform: overlay.flip ? 'scaleX(-1)' : undefined,
            maskImage: `url("${overlay.url}")`,
            WebkitMaskImage: `url("${overlay.url}")`,
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: backgroundPosition,
            WebkitMaskPosition: backgroundPosition,
          }}
        />
      )}
    </div>
  );
}
