import React, { useState } from 'react';
import { checkAnswerLeniently } from '../../utils/checkAnswer';

// A compact multi-row fill-in-the-blank table — e.g. a verb conjugation
// drill (Infinitivo | Pronombre | Imperfecto) — graded together with one
// shared Verificar/Revelar/Reiniciar action, instead of the `question`
// block's one-at-a-time card. Purpose-built for this exact "several short
// blanks sharing a pattern" case rather than routed through the full
// question-type registry, which has no concept of a shared row table.
export const TYPE_KEY = 'drill';
export const TYPE_LABEL = 'Tabla de práctica';

export const emptyBlock = () => ({
  type: 'drill',
  title: '',
  contextColumns: ['Infinitivo', 'Pronombre'],
  answerLabel: 'Respuesta',
  requireAccents: false,
  rows: [{ context: ['', ''], answer: '' }],
});

const inputClass = (result, revealed) => {
  if (revealed) return 'border-sky-300 bg-sky-50 text-sky-800';
  if (!result) return 'border-slate-300 bg-white text-slate-900';
  if (result.missedAccent) return 'border-amber-400 bg-amber-50 text-amber-800';
  return result.correct ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-rose-400 bg-rose-50 text-rose-800';
};

export const Renderer = ({ block }) => {
  const rows = block.rows || [];
  const [values, setValues] = useState(() => rows.map(() => ''));
  const [results, setResults] = useState(() => rows.map(() => null));
  const [revealed, setRevealed] = useState(false);

  const setValue = (i, v) => {
    if (revealed) return;
    setValues((prev) => prev.map((val, j) => (j === i ? v : val)));
    if (results[i]) setResults((prev) => prev.map((r, j) => (j === i ? null : r)));
  };

  const handleVerificar = () => {
    setResults(rows.map((row, i) => checkAnswerLeniently(values[i] || '', row.answer, !!block.requireAccents)));
  };

  const handleRevelar = () => {
    setRevealed(true);
    setValues(rows.map((row) => row.answer));
  };

  const handleReiniciar = () => {
    setValues(rows.map(() => ''));
    setResults(rows.map(() => null));
    setRevealed(false);
  };

  if (rows.length === 0) return null;

  return (
    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">🧠 {block.title || 'Practica rápida'}</p>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {(block.contextColumns || []).map((col, i) => (
              <th key={i} className="text-left font-black text-slate-500 text-xs uppercase tracking-wide pb-1 pr-3">{col}</th>
            ))}
            <th className="text-left font-black text-slate-500 text-xs uppercase tracking-wide pb-1">{block.answerLabel || 'Respuesta'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-emerald-100/70">
              {(row.context || []).map((cell, ci) => (
                <td key={ci} className="py-1.5 pr-3 italic text-slate-700 whitespace-nowrap">{cell}</td>
              ))}
              <td className="py-1.5 w-full">
                <input
                  type="text"
                  value={revealed ? row.answer : values[i] || ''}
                  disabled={revealed}
                  onChange={(e) => setValue(i, e.target.value)}
                  className={`w-full border rounded-md px-2 py-1 text-sm ${inputClass(results[i], revealed)}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 mt-3">
        <button onClick={handleVerificar} disabled={revealed} className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-bold disabled:opacity-40">
          Verificar
        </button>
        <button onClick={handleRevelar} className="px-3 py-1.5 rounded-md bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300">
          Revelar
        </button>
        <button onClick={handleReiniciar} className="px-3 py-1.5 rounded-md bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100">
          Reiniciar
        </button>
      </div>
    </div>
  );
};

export const Editor = ({ block, onChange }) => {
  const contextColumns = block.contextColumns || [];
  const rows = block.rows || [];

  const resizeRowContexts = (newColCount, currentRows) =>
    currentRows.map((row) => {
      const ctx = row.context || [];
      const next = ctx.slice(0, newColCount);
      while (next.length < newColCount) next.push('');
      return { ...row, context: next };
    });

  const addColumn = () => {
    const next = [...contextColumns, ''];
    onChange({ contextColumns: next, rows: resizeRowContexts(next.length, rows) });
  };
  const removeColumn = (i) => {
    const next = contextColumns.filter((_, j) => j !== i);
    onChange({ contextColumns: next, rows: resizeRowContexts(next.length, rows) });
  };
  const updateColumn = (i, label) => onChange({ contextColumns: contextColumns.map((c, j) => (j === i ? label : c)) });

  const updateRow = (i, patch) => onChange({ rows: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const updateRowContext = (i, ci, value) => updateRow(i, { context: (rows[i].context || []).map((c, j) => (j === ci ? value : c)) });
  const addRow = () => onChange({ rows: [...rows, { context: contextColumns.map(() => ''), answer: '' }] });
  const removeRow = (i) => onChange({ rows: rows.filter((_, j) => j !== i) });

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={block.title || ''}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Título (opcional, por defecto 'Practica rápida')"
        className="w-full border border-slate-300 rounded-md p-2 text-sm"
      />

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 shrink-0">
          <input type="checkbox" checked={!!block.requireAccents} onChange={(e) => onChange({ requireAccents: e.target.checked })} />
          Requerir acentos correctos
        </label>
      </div>

      <div className="border border-slate-200 rounded-lg p-2 space-y-1.5 bg-white">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Columnas de contexto</p>
        {contextColumns.map((col, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="text"
              value={col}
              onChange={(e) => updateColumn(i, e.target.value)}
              placeholder={`Columna ${i + 1} (ej: Infinitivo)`}
              className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs"
            />
            <button onClick={() => removeColumn(i)} className="text-slate-400 hover:text-rose-600 text-xs px-1">✕</button>
          </div>
        ))}
        <button onClick={addColumn} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">+ Columna de contexto</button>
      </div>

      <input
        type="text"
        value={block.answerLabel || ''}
        onChange={(e) => onChange({ answerLabel: e.target.value })}
        placeholder="Nombre de la columna de respuesta (ej: Imperfecto)"
        className="w-full border border-slate-300 rounded-md p-2 text-sm"
      />

      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1 border border-slate-200 rounded-md p-1.5">
            {contextColumns.map((col, ci) => (
              <input
                key={ci}
                type="text"
                value={row.context?.[ci] || ''}
                onChange={(e) => updateRowContext(i, ci, e.target.value)}
                placeholder={col || `Col. ${ci + 1}`}
                className="flex-1 min-w-0 border border-slate-300 rounded-md p-1 text-xs"
              />
            ))}
            <input
              type="text"
              value={row.answer || ''}
              onChange={(e) => updateRow(i, { answer: e.target.value })}
              placeholder="Respuesta correcta"
              className="flex-1 min-w-0 border border-indigo-200 bg-indigo-50/40 rounded-md p-1 text-xs font-bold"
            />
            <button onClick={() => removeRow(i)} className="text-slate-400 hover:text-rose-600 text-xs px-1 shrink-0">✕</button>
          </div>
        ))}
        <button onClick={addRow} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
          + Agregar fila
        </button>
      </div>
    </div>
  );
};
