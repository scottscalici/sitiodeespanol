import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useActiveTheme } from '../context/ThemeContext';
import { parseHeaderGradientStyle } from '../utils/parseHeaderGradient';
import { getCachedCollection } from '../utils/firestoreCache';
import { awardPoints } from '../utils/pointsHelper';
import { DUPE_BONUS_POINTS, pickRandomItem } from '../utils/chests';

const RARITY_LABEL = { common: 'Común', rare: '✨ Rara' };

export default function MisCofresPage() {
  const { currentUser, userData } = useAuth();
  const { theme } = useActiveTheme() || {};
  const pageBgClass = theme?.styles?.pageBackground || 'bg-slate-900';
  const pageBgStyle = parseHeaderGradientStyle(pageBgClass);

  const [accessories, setAccessories] = useState([]);
  const [opening, setOpening] = useState(null); // chest id currently being opened
  const [result, setResult] = useState(null); // { rarity, item?, bonusPoints? }

  useEffect(() => {
    getCachedCollection('unlockables')
      .then((items) => setAccessories(items.filter((u) => u.type === 'avatar_accessory')))
      .catch((err) => console.error('Error loading avatar accessories:', err));
  }, []);

  const pendingChests = userData?.pendingChests || [];
  const ownedAccessoryIds = userData?.ownedAccessoryIds || [];

  const handleOpen = async (chest) => {
    if (!currentUser?.uid) return;
    setOpening(chest.id);
    try {
      const pool = accessories.filter((a) => a.rarity === chest.rarity);
      const userRef = doc(db, 'users', currentUser.uid);

      if (pool.length === 0) {
        // No accessories configured for this rarity yet — don't strand the
        // chest, just pay out the dupe-bonus amount as a fallback.
        await updateDoc(userRef, { pendingChests: arrayRemove(chest) });
        await awardPoints(currentUser.uid, DUPE_BONUS_POINTS[chest.rarity] || 50);
        setResult({ rarity: chest.rarity, bonusPoints: DUPE_BONUS_POINTS[chest.rarity] || 50 });
        return;
      }

      const picked = pickRandomItem(pool);
      const isDupe = ownedAccessoryIds.includes(picked.id);

      await updateDoc(userRef, { pendingChests: arrayRemove(chest) });
      if (isDupe) {
        await awardPoints(currentUser.uid, DUPE_BONUS_POINTS[chest.rarity]);
        setResult({ rarity: chest.rarity, item: picked, bonusPoints: DUPE_BONUS_POINTS[chest.rarity] });
      } else {
        await updateDoc(userRef, { ownedAccessoryIds: arrayUnion(picked.id) });
        setResult({ rarity: chest.rarity, item: picked });
      }
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
          de que sea un cofre raro.
        </p>

        {pendingChests.length === 0 ? (
          <p className="text-slate-500 italic">No tienes cofres por abrir todavía — ¡sigue ganando puntos!</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {pendingChests.map((chest) => (
              <button
                key={chest.id}
                type="button"
                disabled={opening === chest.id}
                onClick={() => handleOpen(chest)}
                className={`flex flex-col items-center gap-2 rounded-2xl p-6 border-2 transition-all disabled:opacity-50 ${
                  chest.rarity === 'rare'
                    ? 'border-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                    : 'border-white/20 bg-white/5 hover:bg-white/10'
                }`}
              >
                <span className="text-5xl">{chest.rarity === 'rare' ? '✨📦' : '📦'}</span>
                <span className="text-xs font-black uppercase tracking-widest">
                  {opening === chest.id ? 'Abriendo...' : RARITY_LABEL[chest.rarity]}
                </span>
              </button>
            ))}
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
              Cofre {RARITY_LABEL[result.rarity]}
            </p>
            {result.item && !result.bonusPoints ? (
              <>
                <img src={result.item.imageUrl} alt={result.item.label} className="w-24 h-24 object-contain mx-auto" />
                <p className="text-xl font-black">¡Nuevo! {result.item.label}</p>
                <p className="text-sm text-slate-400">Ya se puede usar en Mi Avatar.</p>
              </>
            ) : (
              <>
                <p className="text-5xl">⭐</p>
                <p className="text-xl font-black">+{result.bonusPoints} puntos</p>
                <p className="text-sm text-slate-400">
                  {result.item ? `Ya tenías "${result.item.label}", así que te dimos puntos en su lugar.` : 'Bono de cofre.'}
                </p>
              </>
            )}
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
