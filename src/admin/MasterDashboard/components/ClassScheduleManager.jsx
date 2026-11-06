import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
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

  // Date exceptions (schedule_overrides/{YYYY-MM-DD}) — an unusual bell
  // schedule for one specific day, e.g. an assembly or delayed start.
  // Keyed by date so only that day is ever affected (see
  // classSchedule.js's mergeScheduleBlocks, which PARTIALLY overrides the
  // regular schedule: a date here only needs the sections that actually
  // change that day).
  const [overrideDates, setOverrideDates] = useState([]); // [{date, blocks}]
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideRows, setOverrideRows] = useState([]);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState('');

  const loadOverrides = async () => {
    try {
      const snap = await getDocs(collection(db, 'schedule_overrides'));
      setOverrideDates(snap.docs.map((d) => ({ date: d.id, blocks: d.data().blocks || [] })).sort((a, b) => a.date.localeCompare(b.date)));
    } catch (err) {
      console.error('Error loading schedule overrides:', err);
    }
  };

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
      await loadOverrides();
    };
    load();
  }, []);

  const pickOverrideDate = (dateStr) => {
    setOverrideDate(dateStr);
    setOverrideStatus('');
    const existing = overrideDates.find((o) => o.date === dateStr);
    setOverrideRows(existing ? existing.blocks : []);
  };

  const addOverrideRow = () => setOverrideRows([...overrideRows, { section: '', start: '08:00', end: '09:00' }]);
  const updateOverrideRow = (idx, patch) => setOverrideRows(overrideRows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeOverrideRow = (idx) => setOverrideRows(overrideRows.filter((_, i) => i !== idx));

  const handleSaveOverride = async () => {
    if (!overrideDate) return;
    setOverrideSaving(true);
    setOverrideStatus('');
    try {
      const cleaned = overrideRows.filter((r) => r.section.trim());
      await setDoc(doc(db, 'schedule_overrides', overrideDate), { blocks: cleaned, updatedAt: new Date().toISOString() });
      await loadOverrides();
      setOverrideStatus('✅ Guardado');
    } catch (err) {
      console.error('Error saving schedule override:', err);
      setOverrideStatus('❌ Error al guardar');
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleDeleteOverride = async (dateStr) => {
    try {
      await deleteDoc(doc(db, 'schedule_overrides', dateStr));
      if (overrideDate === dateStr) {
        setOverrideDate('');
        setOverrideRows([]);
      }
      await loadOverrides();
    } catch (err) {
      console.error('Error deleting schedule override:', err);
    }
  };

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

      <div className="mt-10 pt-6 border-t border-slate-800">
        <h3 className="text-lg font-black uppercase tracking-widest text-violet-400 flex items-center gap-2 mb-2">
          <span>📅</span> Excepciones por Fecha
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Para un día con horario especial (asamblea, inicio tardío, etc.) — solo agrega las secciones que cambian ESE día; las demás siguen con su horario normal.
        </p>

        {overrideDates.length > 0 && (
          <div className="space-y-1 mb-4">
            {overrideDates.map((o) => (
              <div key={o.date} className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs">
                <button type="button" onClick={() => pickOverrideDate(o.date)} className="font-bold text-slate-200 hover:text-violet-400">
                  {o.date} — {o.blocks.length} sección(es)
                </button>
                <button type="button" onClick={() => handleDeleteOverride(o.date)} className="text-rose-400 hover:text-rose-300 font-black px-2">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          type="date"
          value={overrideDate}
          onChange={(e) => pickOverrideDate(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white mb-3 outline-none focus:border-violet-500"
        />

        {overrideDate && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-2">
            {overrideRows.map((row, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-3">
                <input
                  type="text"
                  value={row.section}
                  onChange={(e) => updateOverrideRow(idx, { section: e.target.value })}
                  placeholder="Sección (ej. 1B)"
                  className="w-28 bg-slate-800 border border-slate-700 rounded-md p-2 text-sm font-bold text-center"
                />
                <input
                  type="time"
                  value={row.start}
                  onChange={(e) => updateOverrideRow(idx, { start: e.target.value })}
                  className="bg-slate-800 border border-slate-700 rounded-md p-2 text-sm"
                />
                <span className="text-slate-500 text-xs font-bold">a</span>
                <input
                  type="time"
                  value={row.end}
                  onChange={(e) => updateOverrideRow(idx, { end: e.target.value })}
                  className="bg-slate-800 border border-slate-700 rounded-md p-2 text-sm"
                />
                <button type="button" onClick={() => removeOverrideRow(idx)} className="text-rose-400 hover:text-rose-300 text-xs font-black px-2 ml-auto">
                  ✕
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={addOverrideRow}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-black uppercase tracking-widest rounded-lg"
              >
                + Agregar sección
              </button>
              <button
                type="button"
                onClick={handleSaveOverride}
                disabled={overrideSaving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
              >
                {overrideSaving ? '...' : `Guardar excepción (${overrideDate})`}
              </button>
              {overrideStatus && <span className="text-xs font-bold text-slate-400 self-center">{overrideStatus}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
