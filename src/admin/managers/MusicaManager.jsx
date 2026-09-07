import React, { useState, useEffect } from 'react';
import { collection, getDocs, writeBatch, doc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';

const MusicaManager = () => {
  const [items, setItems] = useState([]);
  const [calendarMap, setCalendarMap] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Calendar Dates
        const configRef = doc(db, 'config', 'academic_year_2026_2027');
        const configSnap = await getDoc(configRef);
        const mapping = {};

        if (configSnap.exists()) {
          const configData = configSnap.data();
          if (configData.map && Array.isArray(configData.map)) {
            configData.map.forEach((item) => {
              if (item.dia !== null && item.dia !== undefined && item.status === 'school') {
                const dayNum = Number(item.dia);
                if (!mapping[dayNum]) mapping[dayNum] = [];
                
                let formattedDate = item.fecha;
                if (item.fecha && item.fecha.includes('-')) {
                  const parts = item.fecha.split('-');
                  if (parts.length === 3) formattedDate = `${parts[1]}/${parts[2]}`;
                }
                mapping[dayNum].push(`${formattedDate}${item.ciclo ? ` (${item.ciclo})` : ''}`);
              }
            });
          }
          setCalendarMap(mapping);
        }

        // 2. Fetch Musica
        const querySnapshot = await getDocs(collection(db, 'musica'));
        let fetchedItems = [];
        
        querySnapshot.forEach((docSnap) => {
          fetchedItems.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Sort primarily by the first day in the dias array
        fetchedItems.sort((a, b) => {
          const dayA = (a.dias && a.dias.length > 0) ? Math.min(...a.dias) : 999;
          const dayB = (b.dias && b.dias.length > 0) ? Math.min(...b.dias) : 999;
          return dayA - dayB;
        });

        setItems(fetchedItems);
      } catch (error) {
        console.error("Error fetching musica:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        if (field === 'dias') {
          // Parse comma-separated string into an array of numbers
          const arr = value.split(',')
                           .map(d => parseInt(d.trim()))
                           .filter(d => !isNaN(d));
          return { ...item, [field]: arr };
        }
        if (field === 'tags') {
          const arr = value.split(',').map(t => t.trim()).filter(t => t !== '');
          return { ...item, [field]: arr };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      
      items.forEach(item => {
        const docRef = doc(db, 'musica', item.id);
        const { id, ...dataToSave } = item;
        batch.set(docRef, dataToSave, { merge: true });
      });

      await batch.commit();
      alert("¡Música guardada exitosamente!");
    } catch (error) {
      console.error("Error saving batch:", error);
      alert("Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = async () => {
    try {
      const newDoc = await addDoc(collection(db, 'musica'), {
        titulo: 'Nueva Canción',
        artista: '',
        dias: [],
        tags: [],
        createdAt: new Date().toISOString()
      });
      navigate(`/admin-musica-editor/${newDoc.id}`);
    } catch (error) {
      console.error("Error creating new song:", error);
      alert("Error al crear la canción.");
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando Música...</div>;
  }

  const displayedItems = items.filter(item => {
    if (activeFilter === 'all') return true;
    return item.tags && item.tags.includes(activeFilter);
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans pb-20">
      <div className="max-w-[1400px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* HEADER */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center z-10 shadow-sm gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Música Manager</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Gestor de canciones y fechas</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* Course Filter Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setActiveFilter('all')}
                className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${activeFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Todas ({items.length})
              </button>
              <button 
                onClick={() => setActiveFilter('s2')}
                className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${activeFilter === 's2' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Español II
              </button>
              <button 
                onClick={() => setActiveFilter('s4')}
                className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${activeFilter === 's4' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Español 4
              </button>
            </div>

            <button 
              onClick={handleCreateNew}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-colors shadow-sm"
            >
              ➕ Nueva Canción
            </button>

            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-colors disabled:opacity-50 shadow-sm"
            >
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {/* Grid Headers */}
        <div className="grid grid-cols-12 gap-4 p-4 bg-slate-100 border-b border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-500 items-center">
          <div className="col-span-2 text-center">Días / Fechas</div>
          <div className="col-span-3">Título de la Canción</div>
          <div className="col-span-3">Artista</div>
          <div className="col-span-2">Tags (s2, s4, cultura)</div>
          <div className="col-span-2 text-center">Acciones</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {displayedItems.map((item) => {
            // Aggregate all dates for all days assigned to this song
            const activeDates = [];
            if (item.dias && Array.isArray(item.dias)) {
              item.dias.forEach(d => {
                if (calendarMap[d]) {
                  calendarMap[d].forEach(dateStr => activeDates.push(`Día ${d}: ${dateStr}`));
                }
              });
            }

            return (
              <div key={item.id} className="grid grid-cols-12 gap-4 p-3 hover:bg-slate-50 transition-colors items-center">
                
                {/* Multi-Day Stack */}
                <div className="col-span-2 text-center flex flex-col items-center justify-center">
                  <input 
                    type="text" 
                    value={item.dias?.join(', ') || ''}
                    onChange={(e) => handleInputChange(item.id, 'dias', e.target.value)}
                    className="w-full max-w-[100px] bg-slate-100 border-none focus:ring-2 focus:ring-sky-500 rounded-md p-2 text-center text-sm font-black text-slate-600 outline-none transition-all mb-1.5"
                    placeholder="Ej: 12, 13"
                  />
                  <div className="flex flex-col gap-1 w-full items-center">
                    {activeDates.length > 0 ? (
                      activeDates.map((dateStr, idx) => (
                        <span key={idx} className="block text-[8px] font-mono font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-100 whitespace-nowrap w-fit">
                          {dateStr}
                        </span>
                      ))
                    ) : (
                      <span className="block text-[9px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap w-fit">
                        Sin fechas
                      </span>
                    )}
                  </div>
                </div>

                <div className="col-span-3">
                  <input 
                    type="text" 
                    value={item.titulo || ''}
                    onChange={(e) => handleInputChange(item.id, 'titulo', e.target.value)}
                    className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-md p-2 text-sm font-bold outline-none transition-all text-slate-800"
                    placeholder="Título"
                  />
                </div>

                <div className="col-span-3">
                  <input 
                    type="text" 
                    value={item.artista || ''}
                    onChange={(e) => handleInputChange(item.id, 'artista', e.target.value)}
                    className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-md p-2 text-sm font-medium outline-none transition-all text-slate-600"
                    placeholder="Artista"
                  />
                </div>

                <div className="col-span-2">
                  <input 
                    type="text" 
                    value={item.tags?.join(', ') || ''}
                    onChange={(e) => handleInputChange(item.id, 'tags', e.target.value)}
                    className="w-full bg-transparent border border-slate-200 hover:border-slate-300 focus:ring-1 focus:ring-sky-500 rounded-md p-2 text-[10px] font-mono outline-none transition-all text-slate-600"
                    placeholder="s2, s4"
                  />
                </div>

                {/* Open Deep-Dive Editor */}
                <div className="col-span-2 flex justify-center">
                  <Link 
                    to={`/admin-musica-editor/${item.id}`}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all shadow-sm"
                  >
                    <span>✏️</span> Editar
                  </Link>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default MusicaManager;