import React, { useState, useEffect, useMemo } from 'react';
import { listPoolQuestions } from '../../utils/questionPool';

// Browses the shared trivia-fact pool so an admin can reuse an existing clue
// in a new Jeopardy-style board instead of retyping it. Multi-select, same
// "pick several, then confirm" pattern as image_select's own multi-select.
const QuestionPoolPickerModal = ({ onSelect, onClose }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    listPoolQuestions()
      .then((list) => {
        if (!cancelled) setEntries(list);
      })
      .catch((err) => {
        console.error('Error listing question pool:', err);
        if (!cancelled) setError('No se pudo cargar la reserva de preguntas. Intenta de nuevo.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter(
      (e) =>
        e.clue?.toLowerCase().includes(term) ||
        e.answer?.toLowerCase().includes(term) ||
        e.category?.toLowerCase().includes(term)
    );
  }, [entries, search]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleConfirm = () => {
    const picked = entries.filter((e) => selectedIds.includes(e.id));
    onSelect(picked);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
      >
        <div className="p-5 border-b border-slate-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
              Elegir de la Reserva de Preguntas
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl px-2">
              ✕
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por categoría, pregunta o respuesta..."
            className="w-full border border-slate-300 rounded-lg p-2 text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-sm text-slate-400 italic text-center py-10">Cargando reserva...</p>
          ) : error ? (
            <p className="text-sm text-rose-600 text-center py-10">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-10">
              {entries.length === 0
                ? 'Todavía no hay preguntas en la reserva. Se agregan automáticamente al guardar preguntas de Opción Múltiple.'
                : 'Ninguna pregunta coincide con tu búsqueda.'}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((entry) => {
                const isSelected = selectedIds.includes(entry.id);
                return (
                  <label
                    key={entry.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(entry.id)}
                      className="mt-1 shrink-0"
                    />
                    <div className="min-w-0">
                      {entry.category && (
                        <span className="inline-block text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-100 rounded-full px-2 py-0.5 mb-1">
                          {entry.category}
                        </span>
                      )}
                      <p className="text-sm font-bold text-slate-800">{entry.clue}</p>
                      <p className="text-xs text-slate-500">
                        ✓ {entry.answer}
                        {entry.distractors?.length > 0 && (
                          <span className="text-slate-400"> · {entry.distractors.join(', ')}</span>
                        )}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500">
            {selectedIds.length} seleccionada{selectedIds.length === 1 ? '' : 's'}
          </p>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black rounded-lg text-xs uppercase tracking-widest"
          >
            Agregar {selectedIds.length || ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionPoolPickerModal;
