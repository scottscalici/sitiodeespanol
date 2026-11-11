import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCachedCollection, invalidateCollectionCache } from '../../utils/firestoreCache';

// Generic points-gated rewards (currently just the Calma theme toggle in
// Header.jsx, via ThemeUnlockToggle.jsx) — kept as one small collection so a
// future unlockable (another theme, a badge, whatever) is just a new row
// here, with no new admin page or code needed.
const TYPE_OPTIONS = [{ value: 'theme', label: 'Tema (Clásico/Calma toggle)' }];

const BLANK_DRAFT = { label: '', type: 'theme', targetId: '', unlockPoints: 10000 };

export default function UnlockablesManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(BLANK_DRAFT);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

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
  }, []);

  const handleAdd = async () => {
    if (!draft.label.trim() || !draft.targetId.trim() || !draft.unlockPoints) {
      setStatus('❌ Completa etiqueta, id y puntos.');
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
      <div className="max-w-3xl w-full bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-5">
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
              <div className="flex-1 min-w-[140px]">
                <p className="text-white font-bold text-sm">{item.label}</p>
                <p className="text-slate-500 text-[10px] font-mono uppercase">
                  {item.type} · {item.targetId}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  defaultValue={item.unlockPoints}
                  onBlur={(e) => handleUpdatePoints(item, e.target.value)}
                  className="w-28 bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1.5 text-sm text-right font-bold focus:outline-none focus:border-indigo-500"
                />
                <span className="text-slate-500 text-[10px] font-bold uppercase">pts</span>
              </div>
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
    </div>
  );
}
