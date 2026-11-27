import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useActiveTheme } from '../context/ThemeContext';
import { parseHeaderGradientStyle } from '../utils/parseHeaderGradient';
import { getCachedCollection } from '../utils/firestoreCache';
import { AVATAR_STYLE_ID, AVATAR_FEATURES, DEFAULT_AVATAR_OPTIONS } from '../utils/avatarCatalog';
import StudentAvatar from '../components/StudentAvatar';

export default function AvatarBuilderPage() {
  const { currentUser, userData } = useAuth();
  const { theme } = useActiveTheme() || {};
  const pageBgClass = theme?.styles?.pageBackground || 'bg-slate-900';
  const pageBgStyle = parseHeaderGradientStyle(pageBgClass);

  const [options, setOptions] = useState(DEFAULT_AVATAR_OPTIONS);
  const [accessory, setAccessory] = useState(null); // the chosen unlockables doc, or null for "none"
  const [accessories, setAccessories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const totalPoints = userData?.total_points || userData?.current_path_points || 0;

  // Seed the draft from whatever's already saved, once userData arrives —
  // never re-seed after that, so a student's in-progress edits aren't
  // clobbered by the next onSnapshot tick (e.g. a points change elsewhere).
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !userData) return;
    const saved = userData.avatarConfig;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved?.options) setOptions({ ...DEFAULT_AVATAR_OPTIONS, ...saved.options });
    setSeeded(true);
  }, [userData, seeded]);

  useEffect(() => {
    getCachedCollection('unlockables')
      .then((items) => setAccessories(items.filter((u) => u.type === 'avatar_accessory')))
      .catch((err) => console.error('Error loading avatar accessories:', err));
  }, []);

  // Resolve the saved accessoryId against the live catalog once both are
  // available, so a reload shows the previously-chosen accessory selected.
  useEffect(() => {
    const savedId = userData?.avatarConfig?.accessoryId;
    if (!savedId || accessory) return;
    const match = accessories.find((a) => a.id === savedId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (match) setAccessory(match);
  }, [accessories, userData, accessory]);

  const draftConfig = useMemo(
    () => ({ options, accessoryImageUrl: accessory?.imageUrl || null }),
    [options, accessory]
  );

  const cycle = (featureKey, direction) => {
    const feature = AVATAR_FEATURES.find((f) => f.key === featureKey);
    if (!feature) return;
    setOptions((prev) => {
      const list = feature.options;
      const currentIdx = Math.max(0, list.indexOf(prev[featureKey]));
      const nextIdx = (currentIdx + direction + list.length) % list.length;
      return { ...prev, [featureKey]: list[nextIdx] };
    });
  };

  const handleSave = async () => {
    if (!currentUser?.uid) return;
    setSaving(true);
    setStatus('');
    try {
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          avatarConfig: {
            style: AVATAR_STYLE_ID,
            options,
            accessoryId: accessory?.id || null,
            accessoryImageUrl: accessory?.imageUrl || null,
          },
        },
        { merge: true }
      );
      setStatus('✅ Guardado');
    } catch (error) {
      console.error('Error saving avatar:', error);
      setStatus('❌ Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`min-h-screen text-white font-sans relative ${pageBgStyle ? '' : pageBgClass}`}
      style={pageBgStyle || undefined}
    >
      {theme?.styles?.bgTexture && (
        <div
          className="fixed inset-0 pointer-events-none z-[1]"
          style={{ backgroundImage: `url("${theme.styles.bgTexture}")`, backgroundRepeat: 'repeat', opacity: 0.06 }}
        />
      )}

      <div className="w-full max-w-4xl mx-auto px-4 py-8 relative z-10">
        <Link
          to="/"
          className="text-indigo-400 font-bold mb-8 inline-flex items-center gap-2 hover:text-indigo-300 transition-colors group"
        >
          <span className="text-xl leading-none group-hover:-translate-x-1 transition-transform">←</span>
          Volver al Dashboard
        </Link>

        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter mt-6 mb-8">Mi Avatar</h1>

        <div className="grid sm:grid-cols-[auto_1fr] gap-8 items-start">
          <div className="flex flex-col items-center gap-3">
            <StudentAvatar avatarConfig={draftConfig} uid={currentUser?.uid} size={180} />
            <p className="text-xs text-slate-400">⭐ {totalPoints.toLocaleString('es-ES')} puntos</p>
          </div>

          <div className="space-y-3 w-full">
            {AVATAR_FEATURES.map((feature) => (
              <div
                key={feature.key}
                className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5"
              >
                <span className="text-xs font-black uppercase tracking-widest text-slate-300">{feature.label}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => cycle(feature.key, -1)}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 font-black transition-colors"
                  >
                    ‹
                  </button>
                  {feature.kind === 'color' ? (
                    <span
                      className="w-6 h-6 rounded-full border border-white/30 shrink-0"
                      style={{ backgroundColor: `#${options[feature.key]}` }}
                    />
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400 w-16 text-center truncate">
                      {options[feature.key] === 'none' ? 'Ninguno' : options[feature.key]}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => cycle(feature.key, 1)}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 font-black transition-colors"
                  >
                    ›
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-3">Accesorios</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setAccessory(null)}
              className={`w-16 h-16 rounded-xl border-2 flex items-center justify-center text-[10px] font-black uppercase text-center transition-colors ${
                !accessory ? 'border-amber-400 bg-amber-400/10 text-amber-300' : 'border-white/20 bg-white/5 text-slate-400'
              }`}
            >
              Ninguno
            </button>
            {accessories.map((item) => {
              const unlocked = totalPoints >= (item.unlockPoints || 0);
              const selected = accessory?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => setAccessory(item)}
                  title={unlocked ? item.label : `Se desbloquea a los ${item.unlockPoints.toLocaleString('es-ES')} puntos`}
                  className={`relative w-16 h-16 rounded-xl border-2 flex items-center justify-center overflow-hidden transition-colors ${
                    selected
                      ? 'border-amber-400 bg-amber-400/10'
                      : unlocked
                      ? 'border-white/20 bg-white/5 hover:border-white/40'
                      : 'border-white/10 bg-white/5 cursor-not-allowed'
                  }`}
                >
                  <img
                    src={item.imageUrl}
                    alt={item.label}
                    className={`w-10 h-10 object-contain ${unlocked ? '' : 'opacity-30 grayscale'}`}
                  />
                  {!unlocked && (
                    <span className="absolute inset-x-0 bottom-0 bg-black/70 text-[8px] font-bold py-0.5">
                      🔒 {item.unlockPoints.toLocaleString('es-ES')}
                    </span>
                  )}
                </button>
              );
            })}
            {accessories.length === 0 && (
              <p className="text-xs text-slate-500 italic">Todavía no hay accesorios disponibles.</p>
            )}
          </div>
        </div>

        <div className="mt-8 flex items-center gap-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-colors shadow-lg"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          {status && (
            <p className={`text-sm font-bold ${status.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>{status}</p>
          )}
        </div>
      </div>
    </div>
  );
}
