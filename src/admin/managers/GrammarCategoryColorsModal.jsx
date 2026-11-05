import React, { useState } from 'react';
import { resolveCategoryColor } from '../../utils/grammarCategoryColors';

// One color per category name, shared everywhere that category shows up
// (the alphabetical index tiles, a colored tag on a sequence entry) — lets
// a teacher group unrelated categories (e.g. "Pretérito", "Adverbios") under
// the same color on purpose, instead of color being an arbitrary side effect
// of alphabetical position like it was before this existed.
const GrammarCategoryColorsModal = ({ categories, initialColors, onClose, onSave }) => {
  const [colors, setColors] = useState(() => ({ ...initialColors }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setColor = (name, value) => setColors((prev) => ({ ...prev, [name]: value }));
  const resetColor = (name) => setColors((prev) => {
    const next = { ...prev };
    delete next[name];
    return next;
  });

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(colors);
      onClose();
    } catch (err) {
      setError('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={saving ? undefined : onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex justify-between items-center">
          <h2 className="text-lg font-black text-slate-800">Colores de Categoría</h2>
          <button onClick={onClose} disabled={saving} className="text-slate-400 hover:text-slate-700 text-xl px-2 disabled:opacity-30">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-2">
          <p className="text-xs text-slate-500 mb-3">
            Categorías sin color elegido muestran un color automático estable (no cambia solo porque agregues otra categoría).
            Puedes poner el mismo color en varias categorías para agruparlas visualmente.
          </p>
          {categories.map((name) => {
            const hasCustom = name in colors;
            const current = resolveCategoryColor(name, colors);
            return (
              <div key={name} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <input
                  type="color"
                  value={current}
                  onChange={(e) => setColor(name, e.target.value)}
                  className="w-9 h-9 cursor-pointer rounded border-0 p-0 bg-transparent shrink-0"
                />
                <span className="flex-1 text-sm font-bold text-slate-700 truncate">{name}</span>
                {hasCustom && (
                  <button onClick={() => resetColor(name)} className="shrink-0 text-[10px] font-black text-slate-400 hover:text-slate-700 uppercase tracking-widest">
                    Quitar
                  </button>
                )}
              </div>
            );
          })}
          {categories.length === 0 && <p className="text-sm text-slate-400 italic">No hay categorías todavía.</p>}
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
            {saving ? 'Guardando...' : 'Guardar Colores'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GrammarCategoryColorsModal;
