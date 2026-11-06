import React from 'react';

// A collapsed-by-default "go further" section — the core rule stays the
// main thing a student reads; this is extra depth for whoever wants it,
// not more required reading. Deliberately as simple as `rule` minus the
// image field (plain title + text only, per Scott's "keep it simple").
// Uses a native <details>/<summary> rather than any custom open/close
// state — no JS needed for the expand/collapse interaction at all.
export const TYPE_KEY = 'digdeeper';
export const TYPE_LABEL = 'Profundiza Más';

export const emptyBlock = () => ({ type: 'digdeeper', title: '', text: '' });

export const Renderer = ({ block }) => (
  <details className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 group">
    <summary className="cursor-pointer text-sm font-black text-indigo-700 uppercase tracking-widest marker:content-none flex items-center gap-2">
      <span className="transition-transform group-open:rotate-90">▶</span>
      🔍 {block.title || 'Profundiza Más'}
    </summary>
    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line mt-3">{block.text}</p>
  </details>
);

export const Editor = ({ block, onChange }) => (
  <div className="space-y-2">
    <input
      type="text"
      value={block.title || ''}
      onChange={(e) => onChange({ title: e.target.value })}
      placeholder="Título (opcional — p. ej. 'Por qué cambia la raíz')"
      className="w-full border border-slate-300 rounded-md p-2 text-sm font-bold"
    />
    <textarea
      value={block.text || ''}
      onChange={(e) => onChange({ text: e.target.value })}
      rows={5}
      placeholder="Contenido adicional para quien quiera profundizar..."
      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
    />
  </div>
);
