import React from 'react';

export default function FormTemas({ actividad, setActividad }) {
  if (!actividad) return null;
  
  const styles = actividad?.styles || {};
  const overrides = styles?.cardOverrides || {};
  const themeName = actividad?.name || actividad?.titulo || "";
  
  // 1. Safely extract the image data from your JSON structure
  const hero = actividad?.hero || {};
  const mascots = actividad?.mascots || {};

  // Color handler
  const handleColorChange = (key, value) => {
    setActividad(prev => ({
      ...prev,
      styles: {
        ...prev.styles,
        cardOverrides: {
          ...(prev.styles?.cardOverrides || {}),
          [key]: value
        }
      }
    }));
  };

  // Header class handler
  const handleHeaderChange = (e) => {
    setActividad(prev => ({
      ...prev,
      styles: { ...(prev.styles || {}), header: e.target.value }
    }));
  };

  // 2. New handler specifically for updating the Hero data
  const handleHeroChange = (field, value) => {
    setActividad(prev => ({
      ...prev,
      hero: {
        ...(prev.hero || {}),
        [field]: value
      }
    }));
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
              onChange={(e) => setActividad({...actividad, name: e.target.value, titulo: e.target.value})}
              className="p-2 border rounded"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col w-1/2">
              <label className="text-sm font-semibold mb-1">Start Date (MM-DD)</label>
              <input type="text" value={actividad?.start || ""} onChange={(e) => setActividad({...actividad, start: e.target.value})} className="p-2 border rounded" />
            </div>
            <div className="flex flex-col w-1/2">
              <label className="text-sm font-semibold mb-1">End Date (MM-DD)</label>
              <input type="text" value={actividad?.end || ""} onChange={(e) => setActividad({...actividad, end: e.target.value})} className="p-2 border rounded" />
            </div>
          </div>

          {/* New Inputs for the Hero Banner */}
          <div className="bg-gray-50 p-3 rounded border">
            <h3 className="font-bold mb-2 text-sm">Hero Banner Settings</h3>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold">Image URL</label>
              <input 
                type="text" 
                value={hero.img || ""} 
                onChange={(e) => handleHeroChange("img", e.target.value)}
                className="p-1 border rounded text-sm w-full"
              />
              <label className="text-xs font-semibold">Message</label>
              <input 
                type="text" 
                value={hero.msg || ""} 
                onChange={(e) => handleHeroChange("msg", e.target.value)}
                className="p-1 border rounded text-sm w-full"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="font-bold mb-1">Header Classes (Tailwind)</label>
            <input 
              type="text" 
              value={styles?.header || ""} 
              onChange={handleHeaderChange}
              className="p-2 border rounded font-mono text-sm bg-gray-50"
            />
          </div>

          <h3 className="font-bold mt-2 border-b pb-1">Card Colors</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.keys(overrides).map((key) => (
              <div key={key} className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                <span className="text-sm capitalize">{key}</span>
                <input 
                  type="color" 
                  value={overrides[key] || "#ffffff"} 
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="w-8 h-8 cursor-pointer rounded border-0 p-0 bg-transparent"
                />
              </div>
            ))}
          </div>
        </div>

        {/* LIVE PREVIEW COLUMN */}
        <div className="w-full xl:w-1/2 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden flex flex-col bg-white">
          
          {/* Header & Hero Image Display */}
          <div className={`w-full p-8 text-center text-white flex flex-col items-center justify-center min-h-[160px] ${styles?.header || "bg-gray-800"}`}>
            {hero.img && (
              <img 
                src={hero.img} 
                alt="Theme Hero" 
                className="h-24 object-contain mb-3 drop-shadow-lg"
                onError={(e) => e.target.style.display = 'none'} // Hides broken image links cleanly
              />
            )}
            <h1 className="text-3xl font-bold tracking-wide" style={{ fontFamily: styles?.fontHeading || "sans-serif" }}>
              {themeName || "Preview"}
            </h1>
            {hero.msg && (
              <p className="mt-2 text-sm opacity-90 italic">{hero.msg}</p>
            )}
          </div>
          
          <div className="p-4 grid grid-cols-2 gap-3 flex-grow">
            <div className="p-3 rounded text-white shadow-sm" style={{ backgroundColor: overrides?.calentamiento || "#333" }}>
              <h4 className="font-bold text-sm">Calentamiento</h4>
            </div>
            <div className="p-3 rounded text-white shadow-sm" style={{ backgroundColor: overrides?.curiosidad || "#333" }}>
              <h4 className="font-bold text-sm">Curiosidad</h4>
            </div>
            <div className="p-3 rounded text-white shadow-sm col-span-2" style={{ backgroundColor: overrides?.destacado || "#333" }}>
              <h4 className="font-bold text-sm">Destacado Diario</h4>
              <p className="text-xs opacity-80 mt-1">Independent Block</p>
            </div>
            <div className="p-3 rounded text-white shadow-sm" style={{ backgroundColor: overrides?.musica || "#333" }}>
              <h4 className="font-bold text-sm">Música</h4>
            </div>
          </div>

          {/* Mascots Display Rack */}
          {Object.keys(mascots).length > 0 && (
            <div className="bg-gray-100 p-3 border-t flex items-center justify-around">
              {Object.entries(mascots).map(([name, url]) => (
                <div key={name} className="flex flex-col items-center">
                  <img 
                    src={url} 
                    alt={name} 
                    className="w-10 h-10 object-contain drop-shadow" 
                    onError={(e) => e.target.style.display = 'none'}
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