import React from 'react';
import { toYoutubeEmbedUrl } from '../../utils/youtube';
import { toOfficeEmbedUrl } from '../../utils/officeEmbed';

// Video reuses the site's existing YouTube-embed convention. Slides reuse
// the already-working pattern from the old static site: the raw file (e.g.
// a .ppt on raw.githubusercontent.com) wrapped in Microsoft's public Office
// Online viewer — no new file hosting needed, the file stays wherever it
// already lives. `url` always stores the plain source link; the embed
// wrapper is computed at render time (same as toYoutubeEmbedUrl), so a
// change to the embedding approach later doesn't require touching stored
// data.
export const TYPE_KEY = 'media';
export const TYPE_LABEL = 'Media (video / diapositivas)';

export const emptyBlock = () => ({ type: 'media', kind: 'video', url: '', caption: '' });

export const Renderer = ({ block }) => {
  const embedUrl = block.kind === 'video' ? toYoutubeEmbedUrl(block.url) : toOfficeEmbedUrl(block.url);
  return (
    <div>
      <div className="relative w-full rounded-xl overflow-hidden border border-slate-200" style={{ paddingTop: '56.25%' }}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={embedUrl}
          title={block.caption || 'Media'}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
      {block.caption && <p className="text-xs text-slate-500 mt-1 text-center">{block.caption}</p>}
      {block.kind === 'slides' && block.url && (
        <p className="text-xs text-center mt-1">
          <a href={block.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 underline">
            Abrir / descargar la presentación
          </a>
        </p>
      )}
    </div>
  );
};

export const Editor = ({ block, onChange }) => (
  <div className="space-y-2">
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange({ kind: 'video' })}
        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase ${block.kind === 'video' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
      >
        🎥 Video
      </button>
      <button
        type="button"
        onClick={() => onChange({ kind: 'slides' })}
        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase ${block.kind === 'slides' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
      >
        📊 Diapositivas
      </button>
    </div>
    <input
      type="text"
      value={block.url || ''}
      onChange={(e) => onChange({ url: e.target.value })}
      placeholder={block.kind === 'video' ? 'Enlace de YouTube' : 'Enlace directo al archivo (p. ej. raw.githubusercontent.com/.../archivo.ppt)'}
      className="w-full border border-slate-300 rounded-md p-2 text-xs font-mono"
    />
    <input
      type="text"
      value={block.caption || ''}
      onChange={(e) => onChange({ caption: e.target.value })}
      placeholder="Descripción opcional"
      className="w-full border border-slate-300 rounded-md p-2 text-sm"
    />
  </div>
);
