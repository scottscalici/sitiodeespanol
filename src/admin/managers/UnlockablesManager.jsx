import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCachedCollection, invalidateCollectionCache, invalidateDocCache } from '../../utils/firestoreCache';
import ImageUploadField from '../shared/ImageUploadField';
import { getChestConfig, DEFAULT_CHEST_CONFIG } from '../../utils/chests';

// Generic points-gated rewards (the Calma theme toggle in Header.jsx via
// ThemeUnlockToggle.jsx, and avatar accessories in AvatarBuilderPage.jsx) —
// kept as one small collection so a future unlockable (another theme, a
// badge, whatever) is just a new row here, with no new admin page or code
// needed. `imageUrl` only applies to the `avatar_accessory` type.
const TYPE_OPTIONS = [
  { value: 'theme', label: 'Tema (Clásico/Calma toggle)' },
  { value: 'avatar_accessory', label: 'Accesorio de Avatar (imagen personalizada)' },
];

const BLANK_DRAFT = { label: '', type: 'theme', targetId: '', unlockPoints: 10000, imageUrl: '', rarity: '' };

export default function UnlockablesManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(BLANK_DRAFT);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  // Chest tier configuration (src/utils/chests.js) — tiers are ordered
  // rarest-first, the LAST one is the guaranteed fallback. Driving the
  // avatar-accessory rarity dropdown below from this same live list (not a
  // hardcoded common/rare pair) means adding a tier here immediately makes
  // it choosable for accessories too, no code change needed.
  const [chestConfig, setChestConfig] = useState(DEFAULT_CHEST_CONFIG);
  const [chestSaving, setChestSaving] = useState(false);
  const [chestStatus, setChestStatus] = useState('');

  const load = async () => {
    try {
      const data = await getCachedCollection('unlockables');
      setItems(data.sort((a, b) => (a.label || '').localeCompare(b.label || '')));
    } catch (error) {
      console.error('Error loading unlockables:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    getChestConfig()
      .then(setChestConfig)
      .catch((err) => console.error('Error loading chest config:', err));
  }, []);

  const updateTierField = (idx, field, value) => {
    setChestConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t, i) => (i === idx ? { ...t, [field]: value } : t)),
    }));
  };

  const moveTier = (idx, direction) => {
    setChestConfig((prev) => {
      const tiers = [...prev.tiers];
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= tiers.length) return prev;
      [tiers[idx], tiers[newIdx]] = [tiers[newIdx], tiers[idx]];
      return { ...prev, tiers };
    });
  };

  const addTier = () => {
    setChestConfig((prev) => {
      const tiers = [...prev.tiers];
      tiers.splice(tiers.length - 1, 0, {
        id: `tier_${Date.now()}`,
        label: 'Nuevo Nivel',
        ratePerStreakDay: 0,
        cap: 0,
        points: 50,
      });
      return { ...prev, tiers };
    });
  };

  const removeTier = (idx) => {
    setChestConfig((prev) => (prev.tiers.length <= 1 ? prev : { ...prev, tiers: prev.tiers.filter((_, i) => i !== idx) }));
  };

  const handleSaveChestConfig = async () => {
    setChestSaving(true);
    setChestStatus('');
    try {
      const cleaned = {
        tiers: chestConfig.tiers.map((t, i) => ({
          id: t.id,
          label: t.label,
          points: Number(t.points) || 0,
          ...(i < chestConfig.tiers.length - 1
            ? { ratePerStreakDay: Number(t.ratePerStreakDay) || 0, cap: Number(t.cap) || 0 }
            : {}),
        })),
        dupeMultiplier: Number(chestConfig.dupeMultiplier) || 2,
      };
      await setDoc(doc(db, 'config', 'chests'), cleaned);
      invalidateDocCache('config', 'chests');
      setChestConfig(cleaned);
      setChestStatus('✅ Guardado');
    } catch (error) {
      console.error('Error saving chest config:', error);
      setChestStatus('❌ Error al guardar.');
    } finally {
      setChestSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!draft.label.trim() || !draft.targetId.trim() || !draft.unlockPoints) {
      setStatus('❌ Completa etiqueta, id y puntos.');
      return;
    }
    if (draft.type === 'avatar_accessory' && !draft.imageUrl.trim()) {
      setStatus('❌ Un accesorio de avatar necesita una imagen.');
      return;
    }
    setSaving(true);
    setStatus('');
    try {
      await addDoc(collection(db, 'unlockables'), {
        label: draft.label.trim(),
        type: draft.type,
        targetId: draft.targetId.trim(),
        unlockPoints: Number(draft.unlockPoints),
        imageUrl: draft.imageUrl.trim(),
        ...(draft.type === 'avatar_accessory'
          ? { rarity: draft.rarity || chestConfig.tiers[chestConfig.tiers.length - 1]?.id, active: true }
          : {}),
      });
      invalidateCollectionCache('unlockables');
      setDraft(BLANK_DRAFT);
      setStatus('✅ Agregado.');
      await load();
    } catch (error) {
      console.error('Error adding unlockable:', error);
      setStatus('❌ Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePoints = async (item, newPoints) => {
    const value = Number(newPoints);
    if (!value || value === item.unlockPoints) return;
    try {
      await updateDoc(doc(db, 'unlockables', item.id), { unlockPoints: value });
      invalidateCollectionCache('unlockables');
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, unlockPoints: value } : i)));
    } catch (error) {
      console.error('Error updating unlockable:', error);
    }
  };

  // Lets a teacher re-tag an existing accessory into a different chest tier
  // after the fact — rarity used to only be set once, at creation.
  const handleUpdateRarity = async (item, newRarity) => {
    if (!newRarity || newRarity === item.rarity) return;
    try {
      await updateDoc(doc(db, 'unlockables', item.id), { rarity: newRarity });
      invalidateCollectionCache('unlockables');
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, rarity: newRarity } : i)));
    } catch (error) {
      console.error('Error updating unlockable rarity:', error);
    }
  };

  // `active: false` pulls an accessory out of circulation for NEW unlocks
  // (chest drops in MisCofresPage.jsx, the points-threshold list in
  // AvatarBuilderPage.jsx) without touching students who already own it via
  // `ownedAccessoryIds` — built for seasonal items (a Halloween pumpkin that
  // should stop being obtainable once the season's over, then come back
  // next year).
  const handleUpdateActive = async (item, newActive) => {
    try {
      await updateDoc(doc(db, 'unlockables', item.id), { active: newActive });
      invalidateCollectionCache('unlockables');
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active: newActive } : i)));
    } catch (error) {
      console.error('Error updating unlockable active state:', error);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`¿Eliminar "${item.label}"? Esto lo vuelve a bloquear para todos.`)) return;
    try {
      await deleteDoc(doc(db, 'unlockables', item.id));
      invalidateCollectionCache('unlockables');
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (error) {
      console.error('Error deleting unlockable:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest">
        Cargando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-start justify-center p-4 sm:p-8">
      <div className="max-w-3xl w-full space-y-6">
      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-5">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>🔓</span> Desbloqueables
          </h2>
          <Link
            to="/admin-daily-plan-hub"
            className="text-slate-400 hover:text-white text-xs font-bold border border-slate-700 px-3 py-1.5 rounded-lg"
          >
            ← Hub
          </Link>
        </div>

        <p className="text-slate-400 text-xs">
          Recompensas que un estudiante desbloquea con puntos totales (ej. el tema "Calma"). Agrega una fila nueva para
          cada recompensa futura — no requiere código nuevo.
        </p>

        <div className="space-y-2">
          {items.length === 0 && <p className="text-slate-500 text-sm italic">Todavía no hay desbloqueables.</p>}
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-700 rounded-lg p-3"
            >
              {item.imageUrl && (
                <img src={item.imageUrl} alt="" className="w-10 h-10 object-contain rounded-md bg-slate-950 shrink-0" />
              )}
              <div className="flex-1 min-w-[140px]">
                <p className="text-white font-bold text-sm">{item.label}</p>
                <p className="text-slate-500 text-[10px] font-mono uppercase">{item.type} · {item.targetId}</p>
              </div>
              {item.type === 'avatar_accessory' && (
                <select
                  value={item.rarity || chestConfig.tiers[chestConfig.tiers.length - 1]?.id || ''}
                  onChange={(e) => handleUpdateRarity(item, e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                >
                  {chestConfig.tiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.label}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  defaultValue={item.unlockPoints}
                  onBlur={(e) => handleUpdatePoints(item, e.target.value)}
                  className="w-28 bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1.5 text-sm text-right font-bold focus:outline-none focus:border-indigo-500"
                />
                <span className="text-slate-500 text-[10px] font-bold uppercase">pts</span>
              </div>
              {item.type === 'avatar_accessory' && (
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={item.active !== false}
                    onChange={(e) => handleUpdateActive(item, e.target.checked)}
                    className="accent-indigo-500"
                  />
                  Activo
                </label>
              )}
              <button
                onClick={() => handleDelete(item)}
                className="text-rose-400 hover:text-rose-300 text-xs font-bold px-2"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-700 pt-4 space-y-3">
          <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">+ Nuevo Desbloqueable</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder="Etiqueta (ej. Tema Calma)"
              className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
            <select
              value={draft.type}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
              className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={draft.targetId}
              onChange={(e) => setDraft((d) => ({ ...d, targetId: e.target.value }))}
              placeholder="ID del objetivo (ej. calma)"
              className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
            />
            <input
              type="number"
              value={draft.unlockPoints}
              onChange={(e) => setDraft((d) => ({ ...d, unlockPoints: e.target.value }))}
              placeholder="Puntos para desbloquear"
              className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
            {draft.type === 'avatar_accessory' && (
              <>
                <div className="sm:col-span-2">
                  <ImageUploadField
                    value={draft.imageUrl}
                    onChange={(url) => setDraft((d) => ({ ...d, imageUrl: url }))}
                    folder="avatar_accessories"
                    placeholder="https://... (imagen del accesorio)"
                    inputClassName="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <select
                  value={draft.rarity || chestConfig.tiers[chestConfig.tiers.length - 1]?.id || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, rarity: e.target.value }))}
                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                >
                  {chestConfig.tiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      Rareza (cofres): {tier.label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          {status && (
            <p className={`text-xs font-bold ${status.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>{status}</p>
          )}

          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors shadow-lg"
          >
            {saving ? 'Guardando...' : 'Agregar Desbloqueable'}
          </button>
        </div>
      </div>

      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-5">
        <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
          <span>📦</span> Configuración de Cofres
        </h2>
        <p className="text-slate-400 text-xs">
          Cada 100 puntos que un estudiante gana en un día le dan un cofre. El nivel se sorteia al momento de ganarlo:
          cada nivel (menos el último, el nivel por defecto) tiene su propia probabilidad —{' '}
          <span className="font-mono">mín(tope, racha × tasa)</span> — así que una racha más larga mejora las
          probabilidades de niveles más raros. El orden de la lista importa: de más raro (arriba) a más común
          (abajo) — el último nivel es el que cae cuando ningún otro nivel se sorteó.
        </p>

        <div className="space-y-2">
          {chestConfig.tiers.map((tier, idx) => {
            const isLast = idx === chestConfig.tiers.length - 1;
            return (
              <div key={tier.id} className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    defaultValue={tier.label}
                    onBlur={(e) => updateTierField(idx, 'label', e.target.value)}
                    className="flex-1 min-w-[100px] bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1.5 text-sm font-bold focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveTier(idx, -1)}
                      disabled={idx === 0}
                      title="Subir (más raro)"
                      className="w-7 h-7 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white rounded-md text-xs font-black"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTier(idx, 1)}
                      disabled={isLast}
                      title="Bajar (más común)"
                      className="w-7 h-7 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white rounded-md text-xs font-black"
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTier(idx)}
                    disabled={chestConfig.tiers.length <= 1}
                    className="text-rose-400 hover:text-rose-300 disabled:opacity-30 text-xs font-bold px-2"
                  >
                    Eliminar
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {isLast ? (
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Nivel por defecto — sin probabilidad propia
                    </span>
                  ) : (
                    <>
                      <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
                        Tasa/racha
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={(tier.ratePerStreakDay || 0) * 100}
                          onBlur={(e) => updateTierField(idx, 'ratePerStreakDay', Number(e.target.value) / 100)}
                          className="w-20 bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:border-indigo-500"
                        />
                        <span>% / día</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
                        Tope
                        <input
                          type="number"
                          step="1"
                          defaultValue={(tier.cap || 0) * 100}
                          onBlur={(e) => updateTierField(idx, 'cap', Number(e.target.value) / 100)}
                          className="w-16 bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:border-indigo-500"
                        />
                        <span>%</span>
                      </label>
                    </>
                  )}
                  <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 ml-auto">
                    Puntos al abrir
                    <input
                      type="number"
                      defaultValue={tier.points}
                      onBlur={(e) => updateTierField(idx, 'points', Number(e.target.value))}
                      className="w-20 bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1 text-sm text-right font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addTier}
          className="text-indigo-400 hover:text-indigo-300 text-xs font-bold"
        >
          + Agregar Nivel
        </button>

        <div className="border-t border-slate-700 pt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
            Multiplicador si ya lo tiene
            <input
              type="number"
              step="0.1"
              defaultValue={chestConfig.dupeMultiplier}
              onBlur={(e) => setChestConfig((prev) => ({ ...prev, dupeMultiplier: Number(e.target.value) }))}
              className="w-20 bg-slate-900 border border-slate-700 text-white rounded-md px-2 py-1.5 text-sm text-right font-bold focus:outline-none focus:border-indigo-500"
            />
            <span>×</span>
          </label>
          {chestStatus && (
            <p className={`text-xs font-bold ${chestStatus.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>
              {chestStatus}
            </p>
          )}
          <button
            onClick={handleSaveChestConfig}
            disabled={chestSaving}
            className="ml-auto bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-2.5 px-6 rounded-lg transition-colors shadow-lg"
          >
            {chestSaving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
