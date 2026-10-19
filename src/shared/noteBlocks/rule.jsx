import React from 'react';
import ImageUploadField from '../../admin/shared/ImageUploadField';

// The core explanation of a grammar note — the main thing a student reads.
// Raw shape === stored shape (no finalize step), same as multiple_choice in
// the question-type registry, so a standalone importer can write this
// directly.
export const TYPE_KEY = 'rule';
export const TYPE_LABEL = 'Regla';

export const emptyBlock = () => ({ type: 'rule', title: '', image: '', text: '', textEn: '' });

// `showEnglish` is the page-level "Ver en inglés" toggle — falls back to the
// Spanish text whenever a block has no textEn, so translating is optional
// per-block rather than all-or-nothing.
export const Renderer = ({ block, showEnglish }) => (
  <div className="space-y-2">
    {block.title && <h3 className="text-lg font-black text-slate-800">{block.title}</h3>}
    {block.image && <img src={block.image} alt="" className="w-full max-h-72 object-contain bg-slate-50 rounded-xl" />}
    <p className="text-slate-700 leading-relaxed whitespace-pre-line">{showEnglish && block.textEn ? block.textEn : block.text}</p>
  </div>
);

export const Editor = ({ block, onChange }) => (
  <div className="space-y-2">
    <input
      type="text"
      value={block.title || ''}
      onChange={(e) => onChange({ title: e.target.value })}
      placeholder="Título (opcional)"
      className="w-full border border-slate-300 rounded-md p-2 text-sm font-bold"
    />
    <div className="flex items-center gap-2">
      {block.image && <img src={block.image} alt="" className="w-12 h-12 object-cover rounded-md border border-slate-200 shrink-0" />}
      <ImageUploadField
        value={block.image || ''}
        onChange={(url) => onChange({ image: url })}
        folder="grammar_pages"
        placeholder="Imagen opcional"
        inputClassName="w-full border border-slate-300 rounded-md p-1.5 text-[10px] font-mono"
      />
    </div>
    <textarea
      value={block.text || ''}
      onChange={(e) => onChange({ text: e.target.value })}
      rows={4}
      placeholder="Texto de la regla (español)"
      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
    />
    <textarea
      value={block.textEn || ''}
      onChange={(e) => onChange({ textEn: e.target.value })}
      rows={3}
      placeholder="Versión en inglés (opcional — para el botón 'Ver en inglés')"
      className="w-full border border-slate-300 rounded-lg p-2 text-sm text-slate-500"
    />
  </div>
);
