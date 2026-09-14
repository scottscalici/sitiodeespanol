import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigate } from 'react-router-dom';

export default function ResourceHubManager() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const docRef = doc(db, 'config', 'resource_hub');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setItems(docSnap.data().items || []);
        } else {
          setItems([
            { title: "Costa Rica Trip Itinerary & Details", url: "#", image: "", courses: ['s4', 's2'], category: "Viajes y Programas" }
          ]);
        }
      } catch (err) {
        console.error("Error fetching resource hub items:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchResources();
  }, []);

  const handleInputChange = (index, field, value) => {
    setItems(prev => prev.map((item, idx) => idx === index ? { ...item, [field]: value } : item));
  };

  const handleCourseToggle = (index, courseKey) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        const currentCourses = item.courses || [];
        const updatedCourses = currentCourses.includes(courseKey)
          ? currentCourses.filter(c => c !== courseKey)
          : [...currentCourses, courseKey];
        return { ...item, courses: updatedCourses };
      }
      return item;
    }));
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { title: "Nuevo Recurso", url: "", image: "", courses: ['s2', 's4'], category: "General" }
    ]);
  };

  const handleDeleteItem = (index) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      const docRef = doc(db, 'config', 'resource_hub');
      await setDoc(docRef, { items }, { merge: true });
      setStatus('✅ ¡Recursos guardados exitosamente en Firebase!');
    } catch (err) {
      console.error("Error saving resources:", err);
      setStatus('❌ Error al guardar en Firebase.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest bg-slate-950 min-h-screen text-white">Cargando Administrador de Recursos...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-4 sm:p-8 pb-24">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
              <span>🧰</span> Resource Hub Manager
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-1">Administra los enlaces, imágenes y visibilidad por curso (Español II y Español 4 / IB).</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={handleAddItem} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer">
              + Añadir Recurso
            </button>
            <button onClick={() => navigate('/admin-daily-plan-hub')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-700 cursor-pointer">
              ← Hub
            </button>
          </div>
        </div>

        {/* ITEMS LIST */}
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                
                {/* Title */}
                <div className="sm:col-span-4 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Título del Enlace</label>
                  <input 
                    type="text" 
                    value={item.title || ''} 
                    onChange={(e) => handleInputChange(index, 'title', e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white outline-none focus:border-cyan-500 font-bold"
                  />
                </div>

                {/* URL */}
                <div className="sm:col-span-3 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">URL / Ruta</label>
                  <input 
                    type="text" 
                    value={item.url || ''} 
                    onChange={(e) => handleInputChange(index, 'url', e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-cyan-400 font-mono outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Image URL */}
                <div className="sm:col-span-3 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Imagen / Miniatura URL</label>
                  <input 
                    type="text" 
                    value={item.image || ''} 
                    onChange={(e) => handleInputChange(index, 'image', e.target.value)}
                    placeholder="https://..."
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-amber-400 font-mono outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Category */}
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoría</label>
                  <input 
                    type="text" 
                    value={item.category || ''} 
                    onChange={(e) => handleInputChange(index, 'category', e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-cyan-500"
                  />
                </div>

              </div>

              {/* COURSE TOGGLES & DELETE */}
              <div className="flex flex-wrap justify-between items-center pt-2 border-t border-slate-800 gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visible en Cursos:</span>
                  
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    <input 
                      type="checkbox" 
                      checked={item.courses?.includes('s2') || false}
                      onChange={() => handleCourseToggle(index, 's2')}
                      className="accent-cyan-500 w-4 h-4 rounded"
                    />
                    <span className="text-xs font-bold text-slate-300">Español II</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    <input 
                      type="checkbox" 
                      checked={item.courses?.includes('s4') || false}
                      onChange={() => handleCourseToggle(index, 's4')}
                      className="accent-cyan-500 w-4 h-4 rounded"
                    />
                    <span className="text-xs font-bold text-slate-300">Español 4 / IB</span>
                  </label>
                </div>

                <button 
                  onClick={() => handleDeleteItem(index)}
                  className="text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-900/50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  🗑️ Eliminar
                </button>
              </div>

            </div>
          ))}
        </div>

        {/* STATUS & SAVE BUTTON */}
        <div className="space-y-4 pt-4">
          {status && (
            <p className={`text-xs font-bold text-center ${status.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>
              {status}
            </p>
          )}

          <button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            {saving ? 'Guardando...' : 'Guardar Todos los Cambios'}
          </button>
        </div>

      </div>
    </div>
  );
}