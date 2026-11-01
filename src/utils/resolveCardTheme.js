import { getThemedCardStyle } from './getThemedCardStyle';

// Deterministic, so the same card key always lands on the same rotation
// slot across reloads instead of jumping around — picking a "random" style
// every render would look like a bug, not a feature.
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return hash;
};

// A theme-default/per-card-override/per-card-none layer (cornerDecorations,
// cardOverlays) shares the same precedence rule everywhere it's used: an
// explicit `null` for a card key means "never show this on this card," which
// is different from the key being absent entirely (inherit the theme
// default). Object key lookup is how that distinction survives — a plain
// `layer.perCard[cardKey] || layer.default` can't tell "explicitly off" from
// "not mentioned."
const resolveLayer = (layer, cardKey) => {
  if (!layer) return null;
  if (layer.perCard && cardKey in layer.perCard) return layer.perCard[cardKey];
  return layer.default || null;
};

// One-stop resolver for everything a themed card can show: background (a
// named cardStyle's color takes priority over the older flat cardOverrides,
// both get the same texture-blend treatment via getThemedCardStyle), text/
// heading color (only set when the resolved cardStyle actually defines one —
// a card with no cardStyle keeps its own hardcoded colors untouched), a
// border built from the style's border color plus the theme's shared
// cardBorderDefault for width/radius/shadow, and the corner-decoration/
// overlay layer this specific card should render.
export const resolveCardTheme = (theme, cardKey) => {
  const styles = theme?.styles || {};
  const assignedName = styles.cardStyleAssignments?.[cardKey];
  const rotation = styles.cardStyleRotation;
  const rotatedName = !assignedName && rotation?.length ? rotation[simpleHash(cardKey) % rotation.length] : null;
  const cardStyle = styles.cardStyles?.[assignedName || rotatedName] || null;

  const backgroundColor = cardStyle?.background || styles.cardOverrides?.[cardKey];
  const backgroundStyle = getThemedCardStyle(backgroundColor, styles.accent, styles.textures?.[cardKey]);

  const borderColor = cardStyle?.border || styles.cardBorderDefault?.color;
  const borderDefault = styles.cardBorderDefault;
  const borderStyle = borderColor
    ? {
        borderStyle: 'solid',
        borderColor,
        borderWidth: borderDefault?.width ?? 2,
        ...(borderDefault?.leftAccent ? { borderLeftWidth: 6 } : {}),
        ...(borderDefault?.radius != null ? { borderRadius: borderDefault.radius } : {}),
        ...(borderDefault?.glow ? { boxShadow: borderDefault.glow } : {}),
      }
    : undefined;

  return {
    style: { ...backgroundStyle, ...borderStyle },
    textColor: cardStyle?.text,
    headingColor: cardStyle?.heading,
    cornerDecoration: resolveLayer(styles.cornerDecorations, cardKey),
    overlay: resolveLayer(styles.cardOverlays, cardKey),
  };
};
