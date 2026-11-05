import React, { useState } from 'react';

// Same ordered, hand-curated pick-and-reorder pattern as
// GrammarLandingSubtopicsModal, just scoped to a whole course's default
// teaching order (config/grammar_sequences.{course}) instead of one landing
// note's own subtopics. Also lets an id reference a note that doesn't exist
// yet — GrammarIndexPage shows it as "próximamente", same as a subtopic.
const GrammarSequenceModal = ({ course, items, allNotes, onClose, onSave }) => {
  const [rows, setRows] = useState(() => items || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (idx, patch) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const add = () => setRows((prev) => [...prev, { id: '', label: '' }]);
  const remove = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));
  const move = (idx, dir) => {
    setRows((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(rows.filter((r) => r.id && r.id.trim()));
      onClose();
    } catch (err) {
      setError('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={saving ? undefined : onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex justify-between items-center">
          <h2 className="text-lg font-black text-slate-800">Secuencia — {course.toUpperCase()}</h2>
          <button onClick={onClose} disabled={saving} className="text-slate-400 hover:text-slate-700 text-xl px-2 disabled:opacity-30">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-500">
            Este orden es lo que {course.toUpperCase()} ve por defecto en el índice en vez de la vista alfabética. Un ID que
            todavía no existe se muestra como "próximamente". Deja vacía la secuencia de un curso para que siga usando el
            índice alfabético como antes.
          </p>
          {rows.map((r, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
              <div className="flex flex-col shrink-0">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs leading-none px-1">
                  ▲
                </button>
                <button onClick={() => move(idx, 1)} disabled={idx === rows.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs leading-none px-1">
                  ▼
                </button>
              </div>
              <span className="w-6 text-center text-xs font-black text-slate-400 shrink-0">{idx + 1}.</span>
              <input
                type="text"
                list="grammar-sequence-note-ids"
                value={r.id || ''}
                onChange={(e) => update(idx, { id: e.target.value })}
                placeholder="ID de la nota (p. ej. imperfecto:usos)"
                className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs font-mono"
              />
              <input
                type="text"
                value={r.label || ''}
                onChange={(e) => update(idx, { label: e.target.value })}
                placeholder="Etiqueta opcional"
                className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs"
              />
              <button onClick={() => remove(idx)} className="shrink-0 text-slate-400 hover:text-rose-600 text-xs px-1">
                ✕
              </button>
            </div>
          ))}
          <datalist id="grammar-sequence-note-ids">
            {allNotes.map((n) => (
              <option key={n.id} value={n.id}>{n.title || n.id}</option>
            ))}
          </datalist>
          <button onClick={add} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
            + Agregar nota a la secuencia
          </button>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex items-center justify-end gap-3">
          {error && <p className="text-xs text-rose-600 font-bold mr-auto">{error}</p>}
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 text-slate-500 font-bold text-xs uppercase disabled:opacity-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Secuencia'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GrammarSequenceModal;
