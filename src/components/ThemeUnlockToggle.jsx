import { useEffect, useState } from 'react';
import { getCachedCollection } from '../utils/firestoreCache';
import { useActiveTheme } from '../context/ThemeContext';

// Falls back to this if the matching `unlockables` doc is missing entirely
// (not yet created, or someone deleted it) — the toggle still works, just
// locked at a sensible default instead of unlocking for everyone by accident.
const DEFAULT_CALMA_UNLOCK_POINTS = 10000;

// Pill toggle in the student header: "Clásico" / "🏝️ Calma". The student's
// choice lives only in ThemeContext's localStorage-backed manual override
// (see setManualTheme) — never written to Firestore. Unlocking is driven by
// an `unlockables` doc (type: 'theme', targetId: 'calma') so Scott can raise
// the threshold, or add more unlockable rewards later, without touching
// this component.
export default function ThemeUnlockToggle({ totalPoints, isLoggedIn }) {
  const { manualThemeId, setManualTheme, loaded: themeLoaded } = useActiveTheme() || {};
  const [unlockPoints, setUnlockPoints] = useState(DEFAULT_CALMA_UNLOCK_POINTS);

  useEffect(() => {
    getCachedCollection('unlockables')
      .then((items) => {
        const calma = items.find((u) => u.type === 'theme' && u.targetId === 'calma');
        if (calma?.unlockPoints) setUnlockPoints(calma.unlockPoints);
      })
      .catch((err) => console.error('Error loading unlockables:', err));
  }, []);

  const unlocked = isLoggedIn && totalPoints >= unlockPoints;
  const isCalma = manualThemeId === 'calma';

  const pick = (which) => {
    if (!themeLoaded) return;
    if (which === 'calma' && !unlocked) return;
    setManualTheme(which === 'calma' ? 'calma' : null);
  };

  return (
    <div className="flex items-center bg-white/10 border border-white/20 rounded-full p-1 gap-0.5 text-[10px] font-black uppercase tracking-wider">
      <button
        type="button"
        onClick={() => pick('classic')}
        className={`px-3 py-1.5 rounded-full transition-all ${
          !isCalma ? 'bg-white text-slate-900 shadow' : 'text-white/70 hover:text-white'
        }`}
      >
        Clásico
      </button>
      <button
        type="button"
        onClick={() => pick('calma')}
        disabled={!unlocked}
        title={unlocked ? '' : `Se desbloquea a los ${unlockPoints.toLocaleString('es-ES')} puntos`}
        className={`relative flex flex-col items-center leading-none px-3 py-1.5 rounded-full transition-all ${
          isCalma
            ? 'bg-white text-slate-900 shadow'
            : unlocked
            ? 'text-white/70 hover:text-white'
            : 'text-white/30 cursor-not-allowed'
        }`}
      >
        <span className="flex items-center gap-1">
          {!unlocked && <span aria-hidden="true">🔒</span>}
          🏝️ Calma
        </span>
        {!unlocked && (
          <span className="text-[8px] font-bold normal-case tracking-normal text-white/50 mt-0.5">
            {unlockPoints.toLocaleString('es-ES')} pts
          </span>
        )}
      </button>
    </div>
  );
}
