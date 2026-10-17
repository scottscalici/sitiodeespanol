import React from 'react';

// The teacher's spoken-explanation voice — always English, visually
// distinct from the Spanish note body. Optional `items` for a short bullet
// list (e.g. "verbs that change meaning"), alongside the free-text `text`.
export const TYPE_KEY = 'aside';
export const TYPE_LABEL = 'Aparte (inglés)';

export const emptyBlock = () => ({ type: 'aside', text: '', items: [] });

export const Renderer = ({ block }) => (
  <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-xl p-4">
    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">💬 Nota del profe</p>
    {block.text && <p className="text-slate-700 text-sm leading-relaxed">{block.text}</p>}
    {(block.items || []).length > 0 && (
      <ul className="list-disc ml-5 mt-2 space-y-1 text-sm text-slate-700">
        {block.items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    )}
  </div>
);

export const Editor = ({ block, onChange }) => {
  const items = block.items || [];
  const updateItem = (i, v) => onChange({ items: items.map((it, j) => (j === i ? v : it)) });
  const addItem = () => onChange({ items: [...items, ''] });
  const removeItem = (i) => onChange({ items: items.filter((_, j) => j !== i) });
  return (
    <div className="space-y-2">
      <textarea
        value={block.text || ''}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={3}
        placeholder="Tu explicación en inglés..."
        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
      />
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lista opcional (p. ej. verbos que cambian de significado)</p>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="text" value={it} onChange={(e) => updateItem(i, e.target.value)} className="flex-1 border border-slate-300 rounded-md p-1.5 text-sm" />
          <button onClick={() => removeItem(i)} className="shrink-0 text-slate-400 hover:text-rose-600 text-xs px-1">
            ✕
          </button>
        </div>
      ))}
      <button onClick={addItem} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
        + Agregar línea
      </button>
    </div>
  );
};
