import React from 'react';
import { Link as RouterLink } from 'react-router-dom';

// Either an internal cross-note reference (`targetId`, checked for existence
// at render time — shown as "próximamente" rather than a dead link if the
// target hasn't been built yet, since notes are deliberately built a couple
// of topics ahead of each other) or a plain external URL. Exactly one of
// the two is set at a time; setting one in the Editor clears the other.
export const TYPE_KEY = 'link';
export const TYPE_LABEL = 'Enlace';

export const emptyBlock = () => ({ type: 'link', label: '', targetId: '', url: '' });

// `existingIds` (a Set of every grammar_pages doc id, passed down from the
// page that loads all of them anyway for the index) lets this render
// "próximamente" for a forward reference instead of a broken link. Omit it
// (e.g. in an isolated preview) and every targetId is treated as existing.
export const Renderer = ({ block, existingIds }) => {
  if (block.url) {
    return (
      <a href={block.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 underline font-bold">
        🔗 {block.label || block.url}
      </a>
    );
  }
  const exists = !existingIds || existingIds.has(block.targetId);
  if (!exists) {
    return (
      <span className="inline-flex items-center gap-1 text-slate-400 font-bold cursor-not-allowed" title="Esta nota todavía no existe">
        🔗 {block.label || block.targetId} <span className="text-[10px] uppercase">(próximamente)</span>
      </span>
    );
  }
  return (
    <RouterLink to={`/gramatica/${encodeURIComponent(block.targetId)}`} className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 underline font-bold">
      🔗 {block.label || block.targetId}
    </RouterLink>
  );
};

export const Editor = ({ block, onChange }) => (
  <div className="space-y-2">
    <input
      type="text"
      value={block.label || ''}
      onChange={(e) => onChange({ label: e.target.value })}
      placeholder="Texto del enlace"
      className="w-full border border-slate-300 rounded-md p-2 text-sm"
    />
    <input
      type="text"
      value={block.targetId || ''}
      onChange={(e) => onChange({ targetId: e.target.value, url: '' })}
      placeholder="ID de otra nota (p. ej. imperfecto:notas_generales)"
      className="w-full border border-slate-300 rounded-md p-2 text-xs font-mono"
    />
    <p className="text-[10px] text-slate-400 text-center">— o —</p>
    <input
      type="text"
      value={block.url || ''}
      onChange={(e) => onChange({ url: e.target.value, targetId: '' })}
      placeholder="URL externa (https://...)"
      className="w-full border border-slate-300 rounded-md p-2 text-xs font-mono"
    />
  </div>
);
