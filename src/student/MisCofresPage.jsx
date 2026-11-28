import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useActiveTheme } from '../context/ThemeContext';
import { parseHeaderGradientStyle } from '../utils/parseHeaderGradient';
import { getCachedCollection } from '../utils/firestoreCache';
import { awardPoints } from '../utils/pointsHelper';
import { getChestConfig, DEFAULT_CHEST_CONFIG, pickRandomItem } from '../utils/chests';

// Visual flourish by rarity RANK (array index), not a hardcoded id, since
// tiers are fully admin-configurable (UnlockablesManager.jsx) — rank 0 is
// whatever's currently rarest. The LAST tier (the guaranteed fallback) is
// always styled plain, however many tiers exist above it.
const RANK_STYLES = [
  { emoji: '👑📦', border: 'border-amber-400', bg: 'bg-amber-400/10 hover:bg-amber-400/20' },
  { emoji: '🌟📦', border: 'border-fuchsia-400', bg: 'bg-fuchsia-400/10 hover:bg-fuchsia-400/20' },
  { emoji: '✨📦', border: 'border-violet-400', bg: 'bg-violet-400/10 hover:bg-violet-400/20' },
  { emoji: '💠📦', border: 'border-sky-400', bg: 'bg-sky-400/10 hover:bg-sky-400/20' },
];
const DEFAULT_STYLE = { emoji: '📦', border: 'border-white/20', bg: 'bg-white/5 hover:bg-white/10' };

export default function MisCofresPage() {
  const { currentUser, userData } = useAuth();
  const { theme } = useActiveTheme() || {};
  const pageBgClass = theme?.styles?.pageBackground || 'bg-slate-900';
  const pageBgStyle = parseHeaderGradientStyle(pageBgClass);

  const [accessories, setAccessories] = useState([]);
  const [chestConfig, setChestConfig] = useState(DEFAULT_CHEST_CONFIG);
  const [opening, setOpening] = useState(null); // chest id currently being opened
  const [result, setResult] = useState(null); // { rarity, item?, isDupe?, points }

  useEffect(() => {
    getCachedCollection('unlockables')
      .then((items) => setAccessories(items.filter((u) => u.type === 'avatar_accessory')))
      .catch((err) => console.error('Error loading avatar accessories:', err));
    getChestConfig()
      .then(setChestConfig)
      .catch((err) => console.error('Error loading chest config:', err));
  }, []);

  const pendingChests = userData?.pendingChests || [];
  const ownedAccessoryIds = userData?.ownedAccessoryIds || [];

  const tierLabel = (rarityId) => chestConfig.tiers.find((t) => t.id === rarityId)?.label || rarityId;
  const styleForTier = (rarityId) => {
    const idx = chestConfig.tiers.findIndex((t) => t.id === rarityId);
    if (idx === -1 || idx === chestConfig.tiers.length - 1) return DEFAULT_STYLE;
    return RANK_STYLES[idx] || RANK_STYLES[RANK_STYLES.length - 1];
  };

  const handleOpen = async (chest) => {
    if (!currentUser?.uid) return;
    setOpening(chest.id);
    try {
      const tierConfig = chestConfig.tiers.find((t) => t.id === chest.rarity) || chestConfig.tiers[chestConfig.tiers.length - 1];
      const basePoints = tierConfig?.points || 0;
      // active !== false excludes a seasonal item an admin has temporarily
      // turned off (e.g. a Halloween pumpkin after October) from the drop
      // pool — it can still be WORN by anyone who already owns it, it just
      // can't be newly rolled while inactive.
      const pool = accessories.filter((a) => a.rarity === chest.rarity && a.active !== false);
      const userRef = doc(db, 'users', currentUser.uid);

      await updateDoc(userRef, { pendingChests: arrayRemove(chest) });

      if (pool.length === 0) {
        // No accessories configured for this rarity yet — don't strand the
        // chest, just pay out its points with no item. countsTowardChest:
        // false so this payout can't re-trigger the chest threshold itself
        // (see pointsHelper.js's awardPoints for why).
        await awardPoints(currentUser.uid, basePoints, { countsTowardChest: false });
        setResult({ rarity: chest.rarity, points: basePoints });
        return;
      }

      const picked = pickRandomItem(pool);
      const isDupe = ownedAccessoryIds.includes(picked.id);
      const pointsAwarded = isDupe ? basePoints * (chestConfig.dupeMultiplier || 2) : basePoints;

      await awardPoints(currentUser.uid, pointsAwarded, { countsTowardChest: false });
      if (!isDupe) {
        await updateDoc(userRef, { ownedAccessoryIds: arrayUnion(picked.id) });
      }
      setResult({ rarity: chest.rarity, item: picked, isDupe, points: pointsAwarded });
    } catch (error) {
      console.error('Error opening chest:', error);
    } finally {
      setOpening(null);
    }
  };

  return (
    <div
      className={`min-h-screen text-white font-sans relative ${pageBgStyle ? '' : pageBgClass}`}
      style={pageBgStyle || undefined}
    >
      <div className="w-full max-w-3xl mx-auto px-4 py-8 relative z-10">
        <Link
          to="/"
          className="text-indigo-400 font-bold mb-8 inline-flex items-center gap-2 hover:text-indigo-300 transition-colors group"
        >
          <span className="text-xl leading-none group-hover:-translate-x-1 transition-transform">←</span>
          Volver al Dashboard
        </Link>

        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter mt-6 mb-2">Mis Cofres</h1>
        <p className="text-sm text-slate-400 mb-8">
          Gana un cofre por cada 100 puntos que consigas en un día. Entre más larga tu racha 🔥, mayor la probabilidad
          de que sea un cofre de nivel más raro.
        </p>

        {pendingChests.length === 0 ? (
          <p className="text-slate-500 italic">No tienes cofres por abrir todavía — ¡sigue ganando puntos!</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {pendingChests.map((chest) => {
              const style = styleForTier(chest.rarity);
              return (
                <button
                  key={chest.id}
                  type="button"
                  disabled={opening === chest.id}
                  onClick={() => handleOpen(chest)}
                  className={`flex flex-col items-center gap-2 rounded-2xl p-6 border-2 transition-all disabled:opacity-50 ${style.border} ${style.bg}`}
                >
                  <span className="text-5xl">{style.emoji}</span>
                  <span className="text-xs font-black uppercase tracking-widest">
                    {opening === chest.id ? 'Abriendo...' : tierLabel(chest.rarity)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {result && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setResult(null)}>
          <div
            className="bg-slate-800 border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
              Cofre {tierLabel(result.rarity)}
            </p>
            {result.item && (
              <img src={result.item.imageUrl} alt={result.item.label} className="w-24 h-24 object-contain mx-auto" />
            )}
            {result.item && !result.isDupe && <p className="text-xl font-black">¡Nuevo! {result.item.label}</p>}
            <p className="text-2xl font-black text-amber-400">+{result.points} puntos</p>
            {result.item && result.isDupe && (
              <p className="text-sm text-slate-400">
                Ya tenías "{result.item.label}", así que te dimos el doble de puntos en su lugar.
              </p>
            )}
            {!result.item && <p className="text-sm text-slate-400">Bono de cofre.</p>}
            <button
              type="button"
              onClick={() => setResult(null)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-colors w-full"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
