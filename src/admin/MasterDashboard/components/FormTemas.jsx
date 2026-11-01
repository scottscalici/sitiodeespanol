import React, { useState } from 'react';
import ImageUploadField from '../../shared/ImageUploadField';
import { parseHeaderGradientStyle } from '../../../utils/parseHeaderGradient';

// Fields an imported styles JSON blob is allowed to touch — deliberately
// excludes every image-URL field (imageOverrides, textures, hero.img, mascot
// URLs): a screenshot-analysis tool can describe colors/fonts/layout, but it
// can't invent a real, hosted image, so letting it write those fields would
// either silently no-op or (worse) save a broken URL.
const IMPORTABLE_STYLE_KEYS = [
  'header', 'accent', 'fontHeading', 'fontMono', 'archedCards', 'bgTexture', 'cardOverrides',
  'pageBackground', 'accentShades', 'fonts', 'fontList', 'textEffects',
];

// Every card key the live Dashboard actually reads a theme color for.
// Destacado normally picks its own color from real information (the
// featured item's region) — checking its box here opts that one card out
// of the region signal in favor of matching the page theme instead, which
// is left off by default so the region color keeps meaning something
// unless a teacher deliberately overrides it. Excludes any legacy key from
// the old vanilla-JS site (pruebas, senordle, extras, sidebarEvalList,
// cultura) that nothing in this React app consumes yet. Anuncios is
// included, but only ever applies to a routine/default announcement — a
// 'warning' or 'trip' one keeps its own fixed semantic color (red/emerald)
// regardless of this setting.
const CARD_KEYS = [
  { key: 'calentamiento', label: 'Calentamiento', texture: true },
  { key: 'evaluacion', label: 'Evaluación', texture: true },
  { key: 'anuncios', label: 'Anuncios (solo tipo rutinario)', texture: true },
  { key: 'lectura', label: 'Lectura', texture: true },
  { key: 'conversacion', label: 'Conversación', texture: true },
  { key: 'video', label: 'Video', texture: true },
  { key: 'musica', label: 'Música', texture: true },
  { key: 'vocabulario', label: 'Vocabulario', texture: true },
  { key: 'tareas', label: 'Tareas (barra lateral)', texture: true },
  { key: 'countdown', label: 'Cuenta Regresiva', texture: true },
  { key: 'recursos', label: 'Panel de Recursos', texture: true },
  { key: 'practicaCard', label: 'Práctica (Gustar, etc.)', texture: true },
  { key: 'destacado', label: 'Destacado Diario (anula el color por región)' },
  { key: 'curiosidad', label: 'Curiosidad' },
  { key: 'estructura', label: 'Estructura' },
  { key: 'notaGramatica', label: 'Nota de Gramática' },
  { key: 'practica', label: 'Practice Hub' },
  { key: 'learningPath', label: 'Ruta de Aprendizaje' },
  { key: 'recreo', label: 'El Recreo' },
  { key: 'leaderboard', label: 'Tabla de Líderes' },
];

// Card keys whose Dashboard component actually checks for an image
// override today (the rest can still be set here — saved for when more
// cards get wired up — but won't visibly change anything yet).
const IMAGE_WIRED_KEYS = new Set([
  'calentamiento', 'conversacion', 'vocabulario', 'tareas', 'evaluacion',
  'video', 'musica', 'anuncios', 'lectura', 'recursos', 'practicaCard', 'estructura',
]);

const MASCOT_KEYS = [
  { key: 'sloth', label: 'Perezoso' },
  { key: 'tutor', label: 'Señor+ Tutor' },
  { key: 'ib', label: 'IB' },
  { key: 'misd', label: 'MISD' },
  { key: 'vocabTree', label: 'Árbol de Vocab' },
];

export default function FormTemas({ actividad, setActividad }) {
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState(null); // { ok: bool, msg: string } | null

  if (!actividad) return null;

  const styles = actividad?.styles || {};
  const overrides = styles?.cardOverrides || {};
  const textures = styles?.textures || {};
  const imageOverrides = styles?.imageOverrides || {};
  const themeName = actividad?.name || actividad?.titulo || '';
  const hero = actividad?.hero || {};
  const mascots = actividad?.mascots || {};
  const effectConfig = actividad?.effectConfig || {};

  const updateStyles = (patch) => {
    setActividad((prev) => ({ ...prev, styles: { ...(prev.styles || {}), ...patch } }));
  };

  const handleColorChange = (key, value) => {
    updateStyles({ cardOverrides: { ...(styles.cardOverrides || {}), [key]: value } });
  };

  const handleTextureChange = (key, value) => {
    const next = { ...(styles.textures || {}) };
    if (value) next[key] = value;
    else delete next[key];
    updateStyles({ textures: next });
  };

  // A card's real content image (replaces its default emoji badge on the
  // Dashboard while this theme is active) — separate from `textures` above,
  // which is only ever a small decorative watermark blended into a card's
  // gradient background, not a full icon/content replacement.
  const handleImageOverrideChange = (key, value) => {
    const next = { ...(styles.imageOverrides || {}) };
    if (value) next[key] = value;
    else delete next[key];
    updateStyles({ imageOverrides: next });
  };

  // A card's color override is either present (checkbox on) or absent
  // entirely — leaving it off means the component keeps its own default
  // look instead of quietly saving a color nobody chose.
  const toggleCardOverride = (key, enabled) => {
    const next = { ...(styles.cardOverrides || {}) };
    if (enabled) next[key] = next[key] || styles.accent || '#6366f1';
    else delete next[key];
    updateStyles({ cardOverrides: next });
  };

  const handleHeaderChange = (e) => updateStyles({ header: e.target.value });
  const handleAccentChange = (value) => updateStyles({ accent: value });
  const handleFontHeadingChange = (value) => updateStyles({ fontHeading: value });
  const handleFontMonoChange = (value) => updateStyles({ fontMono: value });
  const handleArchedCardsChange = (checked) => updateStyles({ archedCards: checked });
  const handleBgTextureChange = (value) => updateStyles({ bgTexture: value });
  const handlePageBackgroundChange = (e) => updateStyles({ pageBackground: e.target.value });
  const handleAccentShadeChange = (key, value) => updateStyles({ accentShades: { ...(styles.accentShades || {}), [key]: value } });
  const handleFontSlotChange = (key, value) => updateStyles({ fonts: { ...(styles.fonts || {}), [key]: value } });
  const handlePageBgImageField = (field, value) =>
    updateStyles({ pageBackgroundImage: { ...(styles.pageBackgroundImage || {}), [field]: value } });

  // Merges a pasted JSON blob (e.g. the output of an AI screenshot-to-theme
  // tool) into this theme's styles, keeping only the fields it's safe for
  // that kind of tool to set — see IMPORTABLE_STYLE_KEYS above. Anything
  // else in the pasted object is silently ignored rather than rejecting the
  // whole paste over one stray/unsupported key.
  const handleImportStyles = () => {
    if (!importText.trim()) return;
    let parsed;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setImportStatus({ ok: false, msg: 'JSON inválido — revisa que esté bien formado.' });
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setImportStatus({ ok: false, msg: 'Se esperaba un objeto JSON con campos de estilo.' });
      return;
    }
    const patch = {};
    IMPORTABLE_STYLE_KEYS.forEach((key) => {
      if (parsed[key] !== undefined) patch[key] = parsed[key];
    });
    if (Object.keys(patch).length === 0) {
      setImportStatus({ ok: false, msg: 'No se encontró ningún campo reconocido en el JSON.' });
      return;
    }
    // Shallow-merge rather than replace for every object-shaped field, so
    // importing a JSON blob that only mentions e.g. `fonts.body` doesn't
    // wipe out `fonts.cardTitle`/`fonts.accent` this theme already had set.
    ['cardOverrides', 'accentShades', 'fonts'].forEach((key) => {
      if (patch[key]) patch[key] = { ...(styles[key] || {}), ...patch[key] };
    });
    if (patch.textEffects) {
      patch.textEffects = {
        presets: { ...(styles.textEffects?.presets || {}), ...(patch.textEffects.presets || {}) },
        assignments: { ...(styles.textEffects?.assignments || {}), ...(patch.textEffects.assignments || {}) },
      };
    }
    updateStyles(patch);
    setImportStatus({ ok: true, msg: `Importado: ${Object.keys(patch).join(', ')}` });
    setImportText('');
  };

  const handleHeroChange = (field, value) => {
    setActividad((prev) => ({ ...prev, hero: { ...(prev.hero || {}), [field]: value } }));
  };

  const handleMascotChange = (key, value) => {
    setActividad((prev) => ({ ...prev, mascots: { ...(prev.mascots || {}), [key]: value } }));
  };

  const handleEffectChange = (field, value) => {
    setActividad((prev) => ({ ...prev, effectConfig: { ...(prev.effectConfig || {}), [field]: value } }));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col xl:flex-row gap-6">

        {/* CONTROLS COLUMN */}
        <div className="w-full xl:w-1/2 flex flex-col gap-4">
          <div className="flex items-end gap-3">
            <div className="flex flex-col flex-1">
              <label className="font-bold mb-1">Theme Name</label>
              <input
                type="text"
                name="name"
                value={themeName}
                onChange={(e) => setActividad({ ...actividad, name: e.target.value, titulo: e.target.value })}
                className="p-2 border rounded"
              />
            </div>
            {actividad?.id && (
              <a
                href={`/?previewThemeId=${encodeURIComponent(actividad.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abre el Dashboard real con este tema forzado, para ver exactamente lo que verían los estudiantes"
                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded"
              >
                👁️ Vista Previa
              </a>
            )}
          </div>

          {/* Paste-box JSON import — the landing spot for an AI theme-importer
              skill's output (paste a screenshot into Claude, paste the JSON
              it hands back here). Only touches IMPORTABLE_STYLE_KEYS. */}
          <div className="bg-indigo-50 p-3 rounded border border-indigo-200">
            <h3 className="font-bold mb-1 text-sm">Importar Estilos (JSON)</h3>
            <p className="text-xs text-gray-500 mb-2">
              Pega aquí el JSON de estilos generado por IA (color, fuentes, encabezado, textura de fondo). No reemplaza
              imágenes. También es la única forma de configurar <code className="bg-white px-1 rounded">fontList</code> (pesos
              de fuente) y <code className="bg-white px-1 rounded">textEffects</code> (animaciones con nombre, como un
              parpadeo de vela) — esos dos campos no tienen controles propios todavía.
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{"accent": "#6366f1", "fontHeading": "Creepster", ...}'
              rows={3}
              className="w-full p-2 border rounded font-mono text-xs bg-white"
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={handleImportStyles}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded"
              >
                Aplicar JSON
              </button>
              {importStatus && (
                <span className={`text-xs ${importStatus.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                  {importStatus.msg}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col w-1/2">
              <label className="text-sm font-semibold mb-1">Start Date (MM-DD)</label>
              <input type="text" value={actividad?.start || ''} onChange={(e) => setActividad({ ...actividad, start: e.target.value })} className="p-2 border rounded" />
            </div>
            <div className="flex flex-col w-1/2">
              <label className="text-sm font-semibold mb-1">End Date (MM-DD)</label>
              <input type="text" value={actividad?.end || ''} onChange={(e) => setActividad({ ...actividad, end: e.target.value })} className="p-2 border rounded" />
            </div>
          </div>

          {/* Hero Banner */}
          <div className="bg-gray-50 p-3 rounded border">
            <h3 className="font-bold mb-2 text-sm">Hero Banner Settings</h3>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold">Imagen</label>
              <ImageUploadField
                value={hero.img || ''}
                onChange={(url) => handleHeroChange('img', url)}
                folder="temas"
                inputClassName="p-1 border rounded text-sm w-full"
              />
              <label className="text-xs font-semibold">Message</label>
              <input
                type="text"
                value={hero.msg || ''}
                onChange={(e) => handleHeroChange('msg', e.target.value)}
                className="p-1 border rounded text-sm w-full"
              />
              <label className="flex items-center gap-2 text-xs font-semibold mt-1">
                <input type="checkbox" checked={!!hero.active} onChange={(e) => handleHeroChange('active', e.target.checked)} />
                Mostrar el banner cuando este tema esté activo
              </label>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="font-bold mb-1">Header Classes (Tailwind)</label>
            <input
              type="text"
              value={styles?.header || ''}
              onChange={handleHeaderChange}
              className="p-2 border rounded font-mono text-sm bg-gray-50"
              placeholder="bg-gradient-to-r from-purple-900 via-orange-600 to-black"
            />
          </div>

          {/* Fondo de Página — same Tailwind-gradient-class format as Header,
              applied to the whole page instead of just the header bar. */}
          <div className="flex flex-col">
            <label className="font-bold mb-1">Fondo de Página (Tailwind)</label>
            <input
              type="text"
              value={styles?.pageBackground || ''}
              onChange={handlePageBackgroundChange}
              className="p-2 border rounded font-mono text-sm bg-gray-50"
              placeholder="bg-gradient-to-br from-[#1a0a05] to-[#0d0503]"
            />
          </div>

          <div className="bg-gray-50 p-3 rounded border">
            <h3 className="font-bold mb-2 text-sm">Imagen de Fondo (toda la página, opcional)</h3>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold">Imagen</label>
              <ImageUploadField
                value={styles?.pageBackgroundImage?.url || ''}
                onChange={(url) => handlePageBgImageField('url', url)}
                folder="temas"
                inputClassName="p-1 border rounded text-sm w-full"
              />
              <div className="flex gap-3 items-end mt-1">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold mb-1">Color del Overlay</label>
                  <input
                    type="color"
                    value={styles?.pageBackgroundImage?.overlayColor || '#000000'}
                    onChange={(e) => handlePageBgImageField('overlayColor', e.target.value)}
                    className="w-10 h-10 cursor-pointer rounded border-0 p-0 bg-transparent"
                  />
                </div>
                <div className="flex flex-col flex-1">
                  <label className="text-xs font-semibold mb-1">Opacidad del Overlay (0–1, para que el texto siga siendo legible)</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={styles?.pageBackgroundImage?.overlayOpacity ?? 0.5}
                    onChange={(e) => handlePageBgImageField('overlayOpacity', parseFloat(e.target.value))}
                    className="p-1.5 border rounded text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Accent + Heading Font */}
          <div className="flex gap-4 items-end">
            <div className="flex flex-col">
              <label className="text-sm font-semibold mb-1">Color de Acento</label>
              <input
                type="color"
                value={styles?.accent || '#6366f1'}
                onChange={(e) => handleAccentChange(e.target.value)}
                className="w-10 h-10 cursor-pointer rounded border-0 p-0 bg-transparent"
              />
            </div>
            <div className="flex flex-col flex-1">
              <label className="text-sm font-semibold mb-1">Fuente del Encabezado (Google Fonts)</label>
              <input
                type="text"
                value={styles?.fontHeading || ''}
                onChange={(e) => handleFontHeadingChange(e.target.value)}
                placeholder="Creepster"
                className="p-2 border rounded text-sm"
              />
            </div>
          </div>

          {/* Fuente Mono + Tarjetas en Arco — a smaller, more surgical pair
              of theme knobs than the ones above: a second font slot for
              small all-caps labels (card badges, stat tags) instead of
              reusing the heading font, and an arched-top tile shape so far
              only wired into El Recreo. */}
          <div className="flex gap-4 items-end">
            <div className="flex flex-col flex-1">
              <label className="text-sm font-semibold mb-1">Fuente Mono / Etiquetas (Google Fonts)</label>
              <input
                type="text"
                value={styles?.fontMono || ''}
                onChange={(e) => handleFontMonoChange(e.target.value)}
                placeholder="JetBrains Mono"
                className="p-2 border rounded text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold pb-2">
              <input
                type="checkbox"
                checked={!!styles?.archedCards}
                onChange={(e) => handleArchedCardsChange(e.target.checked)}
              />
              Tarjetas en Arco (El Recreo)
            </label>
          </div>

          {/* Site-wide background texture — distinct from the per-card
              `textures` field above: this tiles behind the ENTIRE page
              (Dashboard, El Recreo), not just one card's gradient. */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1">Textura de Fondo (todo el sitio)</label>
            <ImageUploadField
              value={styles?.bgTexture || ''}
              onChange={handleBgTextureChange}
              folder="temas"
              placeholder="Textura de fondo (opcional)"
              inputClassName="p-2 border rounded text-sm w-full"
            />
          </div>

          {/* Tonos de Acento — two optional shades alongside the single
              Color de Acento above, for themes that want a lighter/darker
              variant available (e.g. several oranges in a Halloween theme)
              without replacing the one flat accent most things still use. */}
          <div className="flex gap-4 items-end">
            <div className="flex flex-col">
              <label className="text-sm font-semibold mb-1">Acento Claro (opcional)</label>
              <input
                type="color"
                value={styles?.accentShades?.light || styles?.accent || '#6366f1'}
                onChange={(e) => handleAccentShadeChange('light', e.target.value)}
                className="w-10 h-10 cursor-pointer rounded border-0 p-0 bg-transparent"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold mb-1">Acento Oscuro (opcional)</label>
              <input
                type="color"
                value={styles?.accentShades?.dark || styles?.accent || '#6366f1'}
                onChange={(e) => handleAccentShadeChange('dark', e.target.value)}
                className="w-10 h-10 cursor-pointer rounded border-0 p-0 bg-transparent"
              />
            </div>
          </div>

          {/* Fuentes adicionales — tres ranuras más allá del Encabezado y
              Mono de arriba: título de tarjeta, texto normal, y una fuente
              decorativa para efectos. Cada una es opcional; una tarjeta o
              texto que no la use no cambia. */}
          <div className="bg-gray-50 p-3 rounded border">
            <h3 className="font-bold mb-2 text-sm">Fuentes Adicionales (Google Fonts, todas opcionales)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1">Título de Tarjeta</label>
                <input
                  type="text"
                  value={styles?.fonts?.cardTitle || ''}
                  onChange={(e) => handleFontSlotChange('cardTitle', e.target.value)}
                  placeholder="Jolly Lodger"
                  className="p-2 border rounded text-sm"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1">Texto Normal</label>
                <input
                  type="text"
                  value={styles?.fonts?.body || ''}
                  onChange={(e) => handleFontSlotChange('body', e.target.value)}
                  placeholder="Nunito"
                  className="p-2 border rounded text-sm"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1">Acento / Efectos</label>
                <input
                  type="text"
                  value={styles?.fonts?.accent || ''}
                  onChange={(e) => handleFontSlotChange('accent', e.target.value)}
                  placeholder="Butcherman"
                  className="p-2 border rounded text-sm"
                />
              </div>
            </div>
          </div>

          {/* Particle Effect */}
          <div className="bg-gray-50 p-3 rounded border">
            <h3 className="font-bold mb-2 text-sm">Efecto de Partículas</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <label className="text-xs font-semibold">Emoji / Carácter</label>
                <input type="text" value={effectConfig.char || ''} onChange={(e) => handleEffectChange('char', e.target.value)} placeholder="🎃" className="p-1 border rounded text-sm" />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold">Color</label>
                <input type="color" value={effectConfig.color || '#ffffff'} onChange={(e) => handleEffectChange('color', e.target.value)} className="w-8 h-8 cursor-pointer rounded border-0 p-0 bg-transparent" />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold">Dirección</label>
                <select value={effectConfig.direction || 'down'} onChange={(e) => handleEffectChange('direction', e.target.value)} className="p-1 border rounded text-sm">
                  <option value="down">Cayendo</option>
                  <option value="up">Subiendo</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold">Velocidad</label>
                <input type="number" step="0.1" min="0" value={effectConfig.speed ?? 1} onChange={(e) => handleEffectChange('speed', parseFloat(e.target.value) || 0)} className="p-1 border rounded text-sm" />
              </div>
              <div className="flex flex-col col-span-2">
                <label className="text-xs font-semibold">Cantidad (0 = sin efecto)</label>
                <input type="number" min="0" max="200" value={effectConfig.count ?? 0} onChange={(e) => handleEffectChange('count', parseInt(e.target.value, 10) || 0)} className="p-1 border rounded text-sm" />
              </div>
            </div>
          </div>

          {/* Mascots */}
          <div className="bg-gray-50 p-3 rounded border">
            <h3 className="font-bold mb-2 text-sm">Mascotas (URLs)</h3>
            <div className="flex flex-col gap-2">
              {MASCOT_KEYS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-28 shrink-0">{label}</span>
                  <ImageUploadField
                    value={mascots[key] || ''}
                    onChange={(url) => handleMascotChange(key, url)}
                    folder="temas"
                    inputClassName="p-1 border rounded text-xs flex-1"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Card Colors + Textures */}
          <h3 className="font-bold mt-2 border-b pb-1">Colores por Tarjeta</h3>
          <div className="flex flex-col gap-2">
            {CARD_KEYS.map(({ key, label, texture }) => {
              const enabled = key in overrides;
              return (
                <div key={key} className="flex items-center gap-3 bg-gray-50 p-2 rounded border">
                  <label className="flex items-center gap-2 text-sm flex-1">
                    <input type="checkbox" checked={enabled} onChange={(e) => toggleCardOverride(key, e.target.checked)} />
                    {label}
                  </label>
                  <input
                    type="color"
                    value={overrides[key] || styles.accent || '#ffffff'}
                    disabled={!enabled}
                    onChange={(e) => handleColorChange(key, e.target.value)}
                    className="w-8 h-8 cursor-pointer rounded border-0 p-0 bg-transparent disabled:opacity-30"
                  />
                  {texture && (
                    <div className={`w-48 ${!enabled ? 'opacity-30 pointer-events-none' : ''}`}>
                      <ImageUploadField
                        value={textures[key] || ''}
                        onChange={(url) => handleTextureChange(key, url)}
                        folder="temas"
                        placeholder="Textura (opcional)"
                        inputClassName="p-1 border rounded text-xs w-full"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Card Content Images — replaces a card's default emoji badge */}
          <h3 className="font-bold mt-2 border-b pb-1">Imágenes por Tarjeta</h3>
          <p className="text-xs text-gray-500 -mt-2">
            Reemplaza el emoji por defecto de una tarjeta mientras este tema esté activo. Las tarjetas marcadas
            "⏳ aún no conectado" se guardan, pero el Dashboard todavía no las usa.
          </p>
          <div className="flex flex-col gap-2">
            {CARD_KEYS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3 bg-gray-50 p-2 rounded border">
                <span className="text-sm flex-1 flex items-center gap-2">
                  {label}
                  {IMAGE_WIRED_KEYS.has(key) ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">✅ Activo</span>
                  ) : (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">⏳ Aún no conectado</span>
                  )}
                </span>
                <div className="w-56">
                  <ImageUploadField
                    value={imageOverrides[key] || ''}
                    onChange={(url) => handleImageOverrideChange(key, url)}
                    folder="temas"
                    inputClassName="p-1 border rounded text-xs w-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LIVE PREVIEW COLUMN */}
        <div className="w-full xl:w-1/2 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden flex flex-col bg-white">

          {/* Header & Hero Image Display */}
          <div
            className={`w-full p-8 text-center text-white flex flex-col items-center justify-center min-h-[160px] ${
              parseHeaderGradientStyle(styles?.header) ? '' : styles?.header || 'bg-gray-800'
            }`}
            style={parseHeaderGradientStyle(styles?.header) || undefined}
          >
            {hero.img && (
              <img
                src={hero.img}
                alt="Theme Hero"
                className="h-24 object-contain mb-3 drop-shadow-lg"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <h1 className="text-3xl font-bold tracking-wide" style={{ fontFamily: styles?.fontHeading || 'sans-serif' }}>
              {themeName || 'Preview'}
            </h1>
            {hero.msg && (
              <p className="mt-2 text-sm opacity-90 italic">{hero.msg}</p>
            )}
          </div>

          <div className="p-4 grid grid-cols-2 gap-3 flex-grow">
            {CARD_KEYS.filter(({ key }) => overrides[key]).map(({ key, label }) => (
              <div key={key} className="p-3 rounded text-white shadow-sm" style={{ backgroundColor: overrides[key] }}>
                <h4 className="font-bold text-sm">{label}</h4>
              </div>
            ))}
            {Object.keys(overrides).length === 0 && (
              <p className="col-span-2 text-sm text-gray-400 italic">Activa colores de tarjeta a la izquierda para verlos aquí.</p>
            )}
          </div>

          {/* Mascots Display Rack */}
          {Object.values(mascots).some(Boolean) && (
            <div className="bg-gray-100 p-3 border-t flex items-center justify-around flex-wrap gap-2">
              {Object.entries(mascots).filter(([, url]) => url).map(([name, url]) => (
                <div key={name} className="flex flex-col items-center">
                  <img
                    src={url}
                    alt={name}
                    className="w-10 h-10 object-contain drop-shadow"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <span className="text-[10px] text-gray-500 uppercase mt-1">{name}</span>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
