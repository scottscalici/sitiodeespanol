import React, { useState } from 'react';
import { BLOCK_TYPES, BLOCK_LABELS } from '../../shared/noteBlocks';
import { reconstructQuestion, finalizeQuestion } from '../../shared/questionTypes';

// Reopening an already-saved note's `question` blocks only has each nested
// question's final, persisted shape — reconstructQuestion rebuilds the raw
// editable text once on load (same reason CuriosidadQuestionsModal does
// this for its own questions), so editing an existing matching/cloze
// question starts from something readable rather than a blank textarea.
const reconstructEditableBlocks = (blocks) =>
  (blocks || []).map((b) => (b.type === 'question' && b.question ? { ...b, question: reconstructQuestion(b.question) } : b));

const GrammarNoteBlocksModal = ({ note, onClose, onSave }) => {
  const [blocks, setBlocks] = useState(() => reconstructEditableBlocks(note.blocks));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateBlock = (idx, patch) => {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const moveBlock = (idx, direction) => {
    setBlocks((prev) => {
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const removeBlock = (idx) => setBlocks((prev) => prev.filter((_, i) => i !== idx));

  // Each block type converts its own raw, freely-typed editing fields into
  // the final persisted shape here — for every block type EXCEPT `question`
  // this is a no-op (raw === stored across the whole block registry); a
  // `question` block's NESTED question object still goes through the
  // existing registry's own finalizeQuestion for the 3 types that need it
  // (matching, word_bank_cloze, line_bank_cloze).
  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const finalizedBlocks = blocks.map((b) => (b.type === 'question' && b.question ? { ...b, question: finalizeQuestion(b.question) } : b));
      await onSave(finalizedBlocks);
      onClose();
    } catch (err) {
      setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo — tus cambios aquí no se perdieron.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={saving ? undefined : onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg font-black text-slate-800">Bloques: {note.title || note.id}</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
              {blocks.length} bloque{blocks.length === 1 ? '' : 's'}
            </p>
          </div>
          <button onClick={onClose} disabled={saving} className="text-slate-400 hover:text-slate-700 text-xl px-2 disabled:opacity-30">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-6">
          {blocks.length === 0 && <p className="text-sm text-slate-400 italic text-center py-6">Todavía no hay bloques. Agrega uno abajo.</p>}

          {blocks.map((b, idx) => {
            const TypeEditor = BLOCK_TYPES[b.type]?.Editor;
            return (
              <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex justify-between items-start mb-3 gap-3">
                  <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-100 rounded-full px-2 py-1">
                    {BLOCK_LABELS[b.type] || b.type}
                  </span>
                  <div className="shrink-0 flex items-center gap-1">
                    <button onClick={() => moveBlock(idx, -1)} disabled={idx === 0} title="Mover arriba" className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-sm px-1">
                      ▲
                    </button>
                    <button
                      onClick={() => moveBlock(idx, 1)}
                      disabled={idx === blocks.length - 1}
                      title="Mover abajo"
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-sm px-1"
                    >
                      ▼
                    </button>
                    <button onClick={() => removeBlock(idx)} className="text-rose-500 hover:text-rose-700 text-xs font-black uppercase">
                      🗑️ Quitar
                    </button>
                  </div>
                </div>
                {TypeEditor && <TypeEditor block={b} onChange={(patch) => updateBlock(idx, patch)} instanceId={idx} />}
              </div>
            );
          })}

          <div className="flex flex-wrap gap-3">
            {Object.values(BLOCK_TYPES).map((mod) => (
              <button
                key={mod.TYPE_KEY}
                onClick={() => setBlocks((prev) => [...prev, mod.emptyBlock()])}
                className="flex-1 min-w-[140px] py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50"
              >
                + {mod.TYPE_LABEL}
              </button>
            ))}
          </div>
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
            {saving ? 'Guardando...' : 'Guardar Bloques'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GrammarNoteBlocksModal;
