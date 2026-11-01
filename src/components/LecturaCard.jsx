import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCachedDoc } from '../utils/firestoreCache';
import { useActiveTheme } from '../context/ThemeContext';
import { resolveCardTheme } from '../utils/resolveCardTheme';
import { CardCornerDecoration, CardOverlay } from './CardDecorations';

export default function LecturaCard({ lecturaId }) {
  const { theme } = useActiveTheme() || {};
  const cardTheme = resolveCardTheme(theme, 'lectura');
  const [lectura, setLectura] = useState(null);

  useEffect(() => {
    if (!lecturaId) return;
    let cancelled = false;
    getCachedDoc('lecturas', lecturaId)
      .then((data) => { if (!cancelled && data) setLectura(data); })
      .catch((err) => console.error('Error loading lectura:', err));
    return () => { cancelled = true; };
  }, [lecturaId]);

  const { subtitulo: title, test_id: testId, text_id: textId } = lectura || {};

  return (
    <Link
      to={`/lectura/${lecturaId}`}
      className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1"
      style={cardTheme.style}
    >
      <CardOverlay overlay={cardTheme.overlay} />
      <CardCornerDecoration decoration={cardTheme.cornerDecoration} />
      <div className="absolute -right-6 -top-6 opacity-20 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110 pointer-events-none">
        <span className="text-[100px]">📄</span>
      </div>
      <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-inner backdrop-blur-sm overflow-hidden">
            {theme?.styles?.imageOverrides?.lectura ? (
              <img src={theme.styles.imageOverrides.lectura} alt="" className="w-full h-full object-cover" />
            ) : (
              '📖'
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-black/30 text-cyan-200 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded">
                Texto {textId || 'A'}
              </span>
              <span className="text-[10px] font-mono text-cyan-100">{testId}</span>
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter" style={{ color: cardTheme.headingColor }}>
              {title || 'Comprensión de Lectura'}
            </h3>
          </div>
        </div>
        <div className="flex w-full sm:w-auto items-center justify-center gap-2 text-white font-black uppercase tracking-widest text-xs bg-black/20 px-6 py-3 rounded-xl group-hover:bg-black/30 transition-colors">
          Leer y Resolver →
        </div>
      </div>
    </Link>
  );
}