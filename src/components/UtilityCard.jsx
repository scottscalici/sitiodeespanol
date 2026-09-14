import React from 'react';

export default function UtilityCard({ type, data }) {
  // Gracefully hide the card if there is no data for this day
  if (!data || (Array.isArray(data) && data.length === 0)) return null;

  // Normalize data into an array so we can map it consistently
  const items = Array.isArray(data) ? data : [data];

  // 🎨 The Theme Dictionary: Drives the UI automatically based on the 'type'
  const config = {
    curiosidad: {
      icon: '💡',
      title: 'Curiosidades',
      border: 'border-yellow-500/50',
      bg: 'bg-yellow-950/20',
      iconBg: 'bg-yellow-900/50',
      textColor: 'text-yellow-400',
      badge: 'bg-yellow-500 text-black',
    },
    anuncio: {
      icon: '📢',
      title: 'Anuncios',
      border: 'border-rose-500/50',
      bg: 'bg-rose-950/20',
      iconBg: 'bg-rose-900/50',
      textColor: 'text-rose-400',
      badge: 'bg-rose-500 text-white',
    },
    recurso: {
      icon: '🔗',
      title: 'Recursos',
      border: 'border-cyan-500/50',
      bg: 'bg-cyan-950/20',
      iconBg: 'bg-cyan-900/50',
      textColor: 'text-cyan-400',
      badge: 'bg-cyan-500 text-black',
    },
    destacado: {
      icon: '🔥',
      title: 'Destacado Diario',
      border: 'border-emerald-500/50',
      bg: 'bg-emerald-950/20',
      iconBg: 'bg-emerald-900/50',
      textColor: 'text-emerald-400',
      badge: 'bg-emerald-500 text-black',
    },
    default: {
      icon: '📌',
      title: 'Nota',
      border: 'border-slate-500/50',
      bg: 'bg-slate-900/60',
      iconBg: 'bg-slate-800',
      textColor: 'text-slate-400',
      badge: 'bg-slate-500 text-white',
    }
  };

  const theme = config[type] || config.default;

  return (
    <div className={`rounded-2xl p-5 shadow-sm border ${theme.border} ${theme.bg} group`}>
      <div className="border-b border-white/10 pb-3 mb-4 flex justify-between items-center">
        <h2 className={`font-black text-lg flex items-center gap-2 ${theme.textColor}`}>
          <span>{theme.icon}</span> {theme.title}
        </h2>
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${theme.badge}`}>
          {items.length} {items.length === 1 ? 'Ítem' : 'Ítems'}
        </span>
      </div>
      
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={item.id || idx} className="bg-slate-950 p-4 rounded-xl border border-white/5 flex gap-4 transition-colors hover:bg-black/60">
            
            {/* Visual Thumbnail or Fallback Icon */}
            {item.img || item.imagen ? (
              <div className="w-16 h-16 bg-neutral-900 rounded-lg overflow-hidden shrink-0 shadow-md">
                <img src={item.img || item.imagen} alt="thumbnail" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 text-2xl shadow-inner ${theme.iconBg}`}>
                {theme.icon}
              </div>
            )}
            
            {/* Content Body */}
            <div className="flex flex-col justify-center w-full">
              {/* Handles Destacado sub-headers or custom tags */}
              {(item.header || item.tipo) && (
                <span className={`text-[10px] font-black uppercase tracking-wider mb-1 ${theme.textColor}`}>
                  {item.header || item.tipo}
                </span>
              )}
              
              {/* Handles multiple title naming conventions from Firebase */}
              <p className="text-sm font-bold text-white leading-tight">
                {item.title || item.titulo || item.mensaje || 'Información'}
              </p>
              
              {/* Handles various text body conventions (like Teacher Notes for trivia) */}
              {(item.body || item.location || item.teacher_notes || item.descripcion) && (
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  {item.body || item.location || item.teacher_notes || item.descripcion}
                </p>
              )}
              
              {/* External Links */}
              {(item.enlace || item.url) && (
                <a 
                  href={item.enlace || item.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className={`mt-2 text-[10px] font-black uppercase tracking-widest ${theme.textColor} hover:opacity-70 w-fit`}
                >
                  Abrir Enlace ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}