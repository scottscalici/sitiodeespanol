import React from 'react';

// Tiering is done here, in code, on a single shared icon per chapter — not by
// swapping in three separately-colored image files. `icon` can be an emoji
// string (works immediately, zero asset pipeline) or an image URL (for the
// custom SVG/PNG art planned per chapter later) — both render the same way.
const TIER_STYLES = {
  bronze: 'bg-gradient-to-br from-amber-600 to-amber-800 ring-amber-950',
  silver: 'bg-gradient-to-br from-slate-300 to-slate-500 ring-slate-600',
  gold: 'bg-gradient-to-br from-yellow-300 to-yellow-500 ring-yellow-600',
};
const DEFAULT_STYLE = 'bg-gradient-to-br from-indigo-500 to-purple-600 ring-indigo-700';

const SIZE_CLASSES = {
  sm: 'w-9 h-9 text-base',
  md: 'w-14 h-14 text-2xl',
  lg: 'w-24 h-24 text-4xl',
};

export default function BadgeIcon({ icon, tier, size = 'md', title, onClick, className = '' }) {
  const isUrl = typeof icon === 'string' && /^https?:\/\//.test(icon);
  const tierClass = tier ? TIER_STYLES[tier] || DEFAULT_STYLE : DEFAULT_STYLE;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={`rounded-full ring-2 flex items-center justify-center shadow-lg shrink-0 ${SIZE_CLASSES[size]} ${tierClass} ${
        onClick ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : ''
      } ${className}`}
    >
      {isUrl ? (
        <img src={icon} alt={title || 'badge'} className="w-2/3 h-2/3 object-contain drop-shadow" />
      ) : (
        <span className="drop-shadow">{icon || '🏅'}</span>
      )}
    </Tag>
  );
}
