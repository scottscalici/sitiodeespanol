import React from 'react';

// Every card key the live Dashboard actually reads a theme color for.
// Deliberately excludes Destacado and Anuncios (they already pick their own
// color from real information — region, or warning/trip type — so a flat
// theme color would erase that signal) and any legacy key from the old
// vanilla-JS site (pruebas, senordle, extras, sidebarEvalList, cultura) that
// nothing in this React app consumes yet.
const CARD_KEYS = [
  { key: 'calentamiento', label: 'Calentamiento', texture: true },
  { key: 'evaluacion', label: 'Evaluación', texture: true },
  { key: 'lectura', label: 'Lectura', texture: true },
  { key: 'conversacion', label: 'Conversación', texture: true },
  { key: 'video', label: 'Video', texture: true },
  { key: 'musica', label: 'Música', texture: true },
  { key: 'vocabulario', label: 'Vocabulario', texture: true },
  { key: 'tareas', label: 'Tareas (barra lateral)', texture: true },
  { key: 'countdown', label: 'Cuenta Regresiva', texture: true },
  { key: 'recursos', label: 'Panel de Recursos', texture: true },
  { key: 'curiosidad', label: 'Curiosidad' },
  { key: 'estructura', label: 'Estructura' },
  { key: 'practica', label: 'Practice Hub' },
  { key: 'learningPath', label: 'Ruta de Aprendizaje' },
  { key: 'recreo', label: 'El Recreo' },
  { key: 'leaderboard', label: 'Tabla de Líderes' },
];

const MASCOT_KEYS = [
  { key: 'sloth', label: 'Perezoso' },
  { key: 'tutor', label: 'Señor+ Tutor' },
  { key: 'ib', label: 'IB' },
  { key: 'misd', label: 'MISD' },
  { key: 'vocabTree', label: 'Árbol de Vocab' },
];

export default function FormTemas({ actividad, setActividad }) {
  if (!actividad) return null;

  const styles = actividad?.styles || {};
  const overrides = styles?.cardOverrides || {};
  const textures = styles?.textures || {};
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
          <div className="flex flex-col">
            <label className="font-bold mb-1">Theme Name</label>
            <input
              type="text"
              name="name"
              value={themeName}
              onChange={(e) => setActividad({ ...actividad, name: e.target.value, titulo: e.target.value })}
              className="p-2 border rounded"
            />
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
              <label className="text-xs font-semibold">Image URL</label>
              <input
                type="text"
                value={hero.img || ''}
                onChange={(e) => handleHeroChange('img', e.target.value)}
                className="p-1 border rounded text-sm w-full"
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
                  <input
                    type="text"
                    value={mascots[key] || ''}
                    onChange={(e) => handleMascotChange(key, e.target.value)}
                    className="p-1 border rounded text-xs flex-1"
                    placeholder="https://..."
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
                    <input
                      type="text"
                      value={textures[key] || ''}
                      onChange={(e) => handleTextureChange(key, e.target.value)}
                      disabled={!enabled}
                      placeholder="Textura (URL opcional)"
                      className="p-1 border rounded text-xs w-40 disabled:opacity-30"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* LIVE PREVIEW COLUMN */}
        <div className="w-full xl:w-1/2 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden flex flex-col bg-white">

          {/* Header & Hero Image Display */}
          <div className={`w-full p-8 text-center text-white flex flex-col items-center justify-center min-h-[160px] ${styles?.header || 'bg-gray-800'}`}>
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
