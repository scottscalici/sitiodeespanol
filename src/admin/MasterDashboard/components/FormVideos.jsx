import React from 'react';

export default function FormVideos({ actividad, setActividad }) {
  if (!actividad) return null;

  // Helper to handle the array of tags via a single text input
  const handleTagsChange = (e) => {
    const tagsArray = e.target.value.split(',').map(tag => tag.trim());
    setActividad({ ...actividad, tags: tagsArray });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* CONTROLS COLUMN */}
        <div className="w-full xl:w-1/2 flex flex-col gap-4">
          
          <div className="flex gap-4">
            <div className="flex flex-col w-3/4">
              <label className="font-bold mb-1 text-sm">Title</label>
              <input 
                type="text" 
                value={actividad?.title || ""} 
                onChange={(e) => setActividad({...actividad, title: e.target.value, titulo: e.target.value})}
                className="p-2 border rounded"
              />
            </div>
            <div className="flex flex-col w-1/4">
              <label className="font-bold mb-1 text-sm">Día</label>
              <input 
                type="number" 
                value={actividad?.dia || ""} 
                onChange={(e) => setActividad({...actividad, dia: Number(e.target.value)})}
                className="p-2 border rounded"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="font-bold mb-1 text-sm">Video URL (YouTube Embed format)</label>
            <input 
              type="text" 
              value={actividad?.video_url || ""} 
              onChange={(e) => setActividad({...actividad, video_url: e.target.value})}
              className="p-2 border rounded text-blue-600 font-mono text-sm"
              placeholder="https://www.youtube.com/embed/..."
            />
          </div>

          <div className="flex flex-col">
            <label className="font-bold mb-1 text-sm">Thumbnail URL (Fallback/Override)</label>
            <input 
              type="text" 
              value={actividad?.thumbnail_url || ""} 
              onChange={(e) => setActividad({...actividad, thumbnail_url: e.target.value})}
              className="p-2 border rounded font-mono text-sm"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col w-2/3">
              <label className="font-bold mb-1 text-sm">Tags (comma separated)</label>
              <input 
                type="text" 
                value={actividad?.tags?.join(", ") || ""} 
                onChange={handleTagsChange}
                className="p-2 border rounded text-sm"
                placeholder="s2, s4, cultura"
              />
            </div>
            <div className="flex flex-col w-1/3 justify-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
                <input 
                  type="checkbox" 
                  checked={actividad?.is_short || false} 
                  onChange={(e) => setActividad({...actividad, is_short: e.target.checked})}
                  className="w-4 h-4"
                />
                Is YouTube Short?
              </label>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="font-bold mb-1 text-sm">Description (Public)</label>
            <textarea 
              value={actividad?.description || ""} 
              onChange={(e) => setActividad({...actividad, description: e.target.value})}
              className="p-2 border rounded h-24 text-sm"
            />
          </div>

          <div className="flex flex-col">
            <label className="font-bold mb-1 text-sm text-gray-500">Internal Notes (Private)</label>
            <textarea 
              value={actividad?.internal_notes || ""} 
              onChange={(e) => setActividad({...actividad, internal_notes: e.target.value})}
              className="p-2 border rounded bg-yellow-50 h-16 text-sm"
            />
          </div>

          <div className="flex flex-col">
            <label className="font-bold mb-1 text-sm">Associated Page URL (Optional)</label>
            <input 
              type="text" 
              value={actividad?.page_url || ""} 
              onChange={(e) => setActividad({...actividad, page_url: e.target.value})}
              className="p-2 border rounded text-sm"
            />
          </div>

        </div>

        {/* LIVE PREVIEW COLUMN */}
        <div className="w-full xl:w-1/2 flex flex-col gap-4">
          <h3 className="font-bold text-lg border-b pb-2">Player Preview</h3>
          
          <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg flex items-center justify-center relative">
            {actividad?.video_url ? (
              <iframe 
                width="100%" 
                height="100%" 
                src={actividad.video_url} 
                title={actividad?.title || "Video Player"}
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
                className="absolute inset-0"
              ></iframe>
            ) : actividad?.thumbnail_url ? (
               <img src={actividad.thumbnail_url} alt="Thumbnail Fallback" className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-500 text-sm">No Video URL or Thumbnail provided</span>
            )}
          </div>

          <div className="bg-white p-4 rounded-lg shadow border mt-2">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-bold">{actividad?.title || "Video Title"}</h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">Día {actividad?.dia || "?"}</span>
            </div>
            <p className="text-gray-700 text-sm mb-4">{actividad?.description || "No description provided."}</p>
            
            <div className="flex flex-wrap gap-2">
              {actividad?.tags?.map((tag, idx) => (
                <span key={idx} className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">#{tag}</span>
              ))}
              {actividad?.is_short && (
                <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">▶ Short</span>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}