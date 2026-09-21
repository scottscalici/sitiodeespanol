import React from 'react';
import BadgeIcon from './BadgeIcon';
import { BADGE_TIER_LABELS } from '../utils/gamification';

// Pops up unannounced the moment a title or badge is freshly earned — no
// "X points to go" hint anywhere, so it stays a genuine surprise. Header.jsx
// detects the transition and feeds one celebration at a time through here.
export default function RewardCelebration({ celebration, onContinue }) {
  if (!celebration) return null;

  const isBadge = celebration.kind === 'badge';
  const heading = isBadge
    ? celebration.tier
      ? `¡Subiste a ${BADGE_TIER_LABELS[celebration.tier]}!`
      : '¡Nueva Insignia!'
    : '¡Subiste de Nivel!';
  const subheading = isBadge ? celebration.badge.name : celebration.title;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4"
      onClick={onContinue}
    >
      <div
        className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="absolute top-3 left-4 text-2xl animate-bounce">✨</span>
        <span className="absolute top-6 right-6 text-2xl animate-bounce [animation-delay:150ms]">🎉</span>
        <span className="absolute bottom-4 left-8 text-xl animate-bounce [animation-delay:300ms]">⭐</span>
        <span className="absolute bottom-6 right-4 text-2xl animate-bounce [animation-delay:450ms]">🎊</span>

        <p className="text-xs font-black uppercase tracking-widest text-white/70 mb-2">{heading}</p>

        {isBadge ? (
          <div className="flex justify-center my-4">
            <BadgeIcon icon={celebration.badge.icon} tier={celebration.tier} size="lg" />
          </div>
        ) : (
          <div className="text-6xl my-4 animate-bounce">🏅</div>
        )}

        <p className="text-2xl font-black mb-4">{subheading}</p>

        <button
          onClick={onContinue}
          className="bg-white text-indigo-700 font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl shadow-lg hover:bg-white/90 active:scale-95 transition-all"
        >
          ¡Genial! 🎉
        </button>
      </div>
    </div>
  );
}
