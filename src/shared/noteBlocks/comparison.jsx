import React from 'react';

// Side-by-side labeled columns — e.g. "Imperfecto vs. Pretérito" marker-word
// lists. Supports 2 or more columns.
export const TYPE_KEY = 'comparison';
export const TYPE_LABEL = 'Comparación';

export const emptyBlock = () => ({
  type: 'comparison',
  title: '',
  columns: [
    { label: '', items: [''] },
    { label: '', items: [''] },
  ],
});

export const Renderer = ({ block }) => (
  <div>
    {block.title && <h3 className="text-lg font-black text-slate-800 mb-2">{block.title}</h3>}
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${(block.columns || []).length}, minmax(0, 1fr))` }}>
      {(block.columns || []).map((col, i) => (
        <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          {col.label && <p className="font-black text-indigo-700 text-sm mb-2">{col.label}</p>}
          <ul className="list-disc ml-4 space-y-1 text-sm text-slate-700">
            {(col.items || []).map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </div>
);

export const Editor = ({ block, onChange }) => {
  const columns = block.columns || [];
  const updateCol = (i, patch) => onChange({ columns: columns.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const updateItem = (ci, ii, v) => {
    const items = (columns[ci].items || []).map((it, j) => (j === ii ? v : it));
    updateCol(ci, { items });
  };
  const addItem = (ci) => updateCol(ci, { items: [...(columns[ci].items || []), ''] });
  const removeItem = (ci, ii) => updateCol(ci, { items: columns[ci].items.filter((_, j) => j !== ii) });
  const addCol = () => onChange({ columns: [...columns, { label: '', items: [''] }] });
  const removeCol = (i) => onChange({ columns: columns.filter((_, j) => j !== i) });

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={block.title || ''}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Título (opcional)"
        className="w-full border border-slate-300 rounded-md p-2 text-sm font-bold"
      />
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((col, ci) => (
          <div key={ci} className="border border-slate-200 rounded-lg p-2 space-y-1">
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={col.label || ''}
                onChange={(e) => updateCol(ci, { label: e.target.value })}
                placeholder="Columna"
                className="flex-1 border border-slate-300 rounded-md p-1 text-xs font-bold"
              />
              {columns.length > 2 && (
                <button onClick={() => removeCol(ci)} className="text-slate-400 hover:text-rose-600 text-xs px-1">
                  ✕
                </button>
              )}
            </div>
            {(col.items || []).map((it, ii) => (
              <div key={ii} className="flex items-center gap-1">
                <input type="text" value={it} onChange={(e) => updateItem(ci, ii, e.target.value)} className="flex-1 border border-slate-300 rounded-md p-1 text-xs" />
                <button onClick={() => removeItem(ci, ii)} className="text-slate-400 hover:text-rose-600 text-xs px-1">
                  ✕
                </button>
              </div>
            ))}
            <button onClick={() => addItem(ci)} className="text-[9px] font-black text-indigo-600 uppercase">
              + línea
            </button>
          </div>
        ))}
      </div>
      <button onClick={addCol} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
        + Agregar columna
      </button>
    </div>
  );
};
