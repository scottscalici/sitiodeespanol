import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import BadgeIcon from './BadgeIcon';
import { BADGE_TIER_LABELS } from '../utils/gamification';

// Full badge collection view. Kept out of the header on purpose — the header
// only ever shows one featured badge, no matter how many (even 50+) a
// student has earned; this modal is where the whole trophy case lives.
export default function TrophyCase({ uid, currentTitle, totalPoints, earnedBadges, featuredBadgeId, onClose }) {
  const [savingId, setSavingId] = useState(null);

  const handleFeature = async (badgeId) => {
    if (!uid || savingId) return;
    setSavingId(badgeId);
    try {
      await setDoc(doc(db, 'users', uid), { featuredBadgeId: badgeId }, { merge: true });
    } catch (err) {
      console.error('Error setting featured badge:', err);
    } finally {
      setSavingId(null);
    }
  };

  const chapterBadges = earnedBadges.filter((b) => b.type === 'chapter');
  const skillBadges = earnedBadges.filter((b) => b.type === 'skill');
  const specialTrophies = earnedBadges.filter((b) => b.type === 'special');

  return (
    <div
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-5 flex justify-between items-center">
          <h2 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
            🏆 Mi Vitrina de Trofeos
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-bold px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
          >
            Cerrar ✕
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* TITLE PROGRESS */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Título Actual</p>
            <p className="text-2xl font-black text-emerald-400">{currentTitle}</p>
            <p className="text-xs text-slate-400 mt-1">{totalPoints} puntos totales</p>
          </div>

          {/* CHAPTER BADGES */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-3">
              Insignias de Capítulo ({chapterBadges.length})
            </h3>
            {chapterBadges.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Aún no has ganado ninguna. ¡Completa pods en tu Learning Path!</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {chapterBadges.map((badge) => (
                  <div key={badge.id} className="flex flex-col items-center gap-1.5 text-center">
                    <BadgeIcon
                      icon={badge.icon}
                      tier={badge.tier}
                      size="lg"
                      title={`${badge.name} (${BADGE_TIER_LABELS[badge.tier]})`}
                      onClick={() => handleFeature(badge.id)}
                    />
                    <span className="text-[11px] font-bold text-slate-200 leading-tight">{badge.name}</span>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                      {BADGE_TIER_LABELS[badge.tier]}
                    </span>
                    {featuredBadgeId === badge.id ? (
                      <span className="text-[9px] font-black text-emerald-400 uppercase">✓ Destacada</span>
                    ) : (
                      <button
                        onClick={() => handleFeature(badge.id)}
                        disabled={savingId === badge.id}
                        className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 uppercase disabled:opacity-50"
                      >
                        {savingId === badge.id ? '...' : 'Destacar'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SPECIAL TROPHIES — hand-awarded, not tied to points or progress */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-rose-400 mb-3">
              Trofeos Especiales ({specialTrophies.length})
            </h3>
            {specialTrophies.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Ninguno todavía — tu profesor/a puede otorgar uno.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {specialTrophies.map((trophy) => (
                  <div key={trophy.id} className="flex flex-col items-center gap-1.5 text-center">
                    <BadgeIcon
                      icon={trophy.icon}
                      size="lg"
                      title={trophy.note ? `${trophy.name} — ${trophy.note}` : trophy.name}
                      onClick={() => handleFeature(trophy.id)}
                    />
                    <span className="text-[11px] font-bold text-slate-200 leading-tight">{trophy.name}</span>
                    {trophy.note && <span className="text-[10px] text-slate-400 italic leading-tight">{trophy.note}</span>}
                    {featuredBadgeId === trophy.id ? (
                      <span className="text-[9px] font-black text-emerald-400 uppercase">✓ Destacada</span>
                    ) : (
                      <button
                        onClick={() => handleFeature(trophy.id)}
                        disabled={savingId === trophy.id}
                        className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 uppercase disabled:opacity-50"
                      >
                        {savingId === trophy.id ? '...' : 'Destacar'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SKILL BADGES */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-3">
              Insignias de Destreza ({skillBadges.length})
            </h3>
            {skillBadges.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Aún no has ganado ninguna.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {skillBadges.map((badge) => (
                  <div key={badge.id} className="flex flex-col items-center gap-1.5 text-center">
                    <BadgeIcon icon={badge.icon} size="lg" title={badge.name} onClick={() => handleFeature(badge.id)} />
                    <span className="text-[11px] font-bold text-slate-200 leading-tight">{badge.name}</span>
                    {featuredBadgeId === badge.id ? (
                      <span className="text-[9px] font-black text-emerald-400 uppercase">✓ Destacada</span>
                    ) : (
                      <button
                        onClick={() => handleFeature(badge.id)}
                        disabled={savingId === badge.id}
                        className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 uppercase disabled:opacity-50"
                      >
                        {savingId === badge.id ? '...' : 'Destacar'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
