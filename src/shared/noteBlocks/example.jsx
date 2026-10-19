import React from 'react';

// One or more example sentences, each with an optional translation —
// raw === stored, no finalize step.
export const TYPE_KEY = 'example';
export const TYPE_LABEL = 'Ejemplo';

export const emptyBlock = () => ({ type: 'example', items: [{ es: '', en: '' }] });

export const Renderer = ({ block, showEnglish }) => (
  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Ejemplos</p>
    <ul className="space-y-1.5 list-disc ml-5">
      {(block.items || []).map((item, i) => (
        <li key={i} className="text-slate-700">
          <em>{item.es}</em>
          {showEnglish && item.en && <span className="text-slate-500"> — {item.en}</span>}
        </li>
      ))}
    </ul>
  </div>
);

export const Editor = ({ block, onChange }) => {
  const items = block.items || [];
  const update = (i, patch) => onChange({ items: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const add = () => onChange({ items: [...items, { es: '', en: '' }] });
  const remove = (i) => onChange({ items: items.filter((_, j) => j !== i) });
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={item.es || ''}
            onChange={(e) => update(i, { es: e.target.value })}
            placeholder="Ejemplo en español"
            className="flex-1 border border-slate-300 rounded-md p-1.5 text-sm"
          />
          <input
            type="text"
            value={item.en || ''}
            onChange={(e) => update(i, { en: e.target.value })}
            placeholder="Traducción (opcional)"
            className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs text-slate-500"
          />
          <button onClick={() => remove(i)} className="shrink-0 text-slate-400 hover:text-rose-600 text-xs px-1">
            ✕
          </button>
        </div>
      ))}
      <button onClick={add} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
        + Agregar ejemplo
      </button>
    </div>
  );
};
