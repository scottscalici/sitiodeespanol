import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

// Editable bell-schedule config for reassessment timing windows
// (config/class_schedule, { blocks: [{section, start, end}] }, 24-hour
// "HH:MM" to match a native <input type="time"> and avoid the AM/PM
// ambiguity the old hardcoded TIME_BLOCKS (src/utils/lessonPlanConfig.js)
// had for times like "2:09". `section` must match a student's own
// `section` field exactly (case-insensitive — see classSchedule.js), e.g.
// "1B", "4A" — the trailing letter is that section's A/B day.
const SEED_BLOCKS = [
  { section: '1B', start: '07:15', end: '08:45' },
  { section: '4A', start: '12:38', end: '14:09' },
  { section: '4B', start: '12:38', end: '14:09' },
];

export default function ClassScheduleManager() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'class_schedule'));
        setBlocks(snap.exists() && snap.data().blocks?.length ? snap.data().blocks : SEED_BLOCKS);
      } catch (err) {
        console.error('Error loading class schedule:', err);
        setBlocks(SEED_BLOCKS);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updateRow = (idx, patch) => setBlocks(blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  const removeRow = (idx) => setBlocks(blocks.filter((_, i) => i !== idx));
  const addRow = () => setBlocks([...blocks, { section: '', start: '08:00', end: '09:00' }]);

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      const cleaned = blocks.filter((b) => b.section.trim());
      await setDoc(doc(db, 'config', 'class_schedule'), { blocks: cleaned, updatedAt: new Date().toISOString() });
      setBlocks(cleaned);
      setStatus('✅ Guardado');
    } catch (err) {
      console.error('Error saving class schedule:', err);
      setStatus('❌ Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-white text-center p-10 font-bold animate-pulse uppercase tracking-widest">Cargando...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 text-white font-sans">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-violet-400 flex items-center gap-3">
          <span>🕐</span> Horario de Clases
        </h2>
        <Link to="/admin-reassessment-config" className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700">
          ← Reevaluaciones
        </Link>
      </div>
      <p className="text-xs text-slate-500 mb-5">
        La sección debe coincidir exactamente con la sección del estudiante (ej. "1B", "4A") — su última letra es el día (A/B) en que se reúne esa clase.
      </p>

      <div className="space-y-2 mb-4">
        {blocks.map((b, idx) => (
          <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg p-3">
            <input
              type="text"
              value={b.section}
              onChange={(e) => updateRow(idx, { section: e.target.value })}
              placeholder="Sección (ej. 1B)"
              className="w-28 bg-slate-800 border border-slate-700 rounded-md p-2 text-sm font-bold text-center"
            />
            <input
              type="time"
              value={b.start}
              onChange={(e) => updateRow(idx, { start: e.target.value })}
              className="bg-slate-800 border border-slate-700 rounded-md p-2 text-sm"
            />
            <span className="text-slate-500 text-xs font-bold">a</span>
            <input
              type="time"
              value={b.end}
              onChange={(e) => updateRow(idx, { end: e.target.value })}
              className="bg-slate-800 border border-slate-700 rounded-md p-2 text-sm"
            />
            <button type="button" onClick={() => removeRow(idx)} className="text-rose-400 hover:text-rose-300 text-xs font-black px-2 ml-auto">
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addRow}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-black uppercase tracking-widest rounded-lg"
        >
          + Agregar sección
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
        >
          {saving ? '...' : 'Guardar'}
        </button>
        {status && <span className="text-xs font-bold text-slate-400 self-center">{status}</span>}
      </div>
    </div>
  );
}
