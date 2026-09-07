import React, { useState, useEffect } from 'react';
import { collection, getDocs, writeBatch, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const DestacadoManager = () => {
  const [items, setItems] = useState([]);
  const [calendarMap, setCalendarMap] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Calendar Dates to group both A and B days
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

        // 2. Fetch Destacado Diario
        const querySnapshot = await getDocs(collection(db, 'destacado_diario'));
        let fetchedItems = [];
        
        querySnapshot.forEach((docSnap) => {
          fetchedItems.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Sort items primarily by dia, putting unassigned (null) at the bottom
        fetchedItems.sort((a, b) => {
          const dayA = a.dia || 999;
          const dayB = b.dia || 999;
          return dayA - dayB;
        });

        setItems(fetchedItems);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        if (field === 'dia') {
          const numVal = value === '' ? null : Number(value);
          return { ...item, [field]: numVal };
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
        const docRef = doc(db, 'destacado_diario', item.id);
        const { id, ...dataToSave } = item;
        batch.set(docRef, dataToSave, { merge: true });
      });

      await batch.commit();
      alert("¡Destacados guardados exitosamente!");
    } catch (error) {
      console.error("Error saving batch:", error);
      alert("Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando Destacados...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center z-10 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Destacado Diario Manager</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Gestor de base de datos en cuadrícula</p>
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>

        {/* Grid Headers */}
        <div className="grid grid-cols-12 gap-4 p-4 bg-slate-100 border-b border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-500 items-center">
          <div className="col-span-2 text-center">Día / Fecha</div>
          <div className="col-span-1 text-rose-600">Tipo</div>
          <div className="col-span-2">Ubicación / Persona</div>
          <div className="col-span-3">Titular (Header)</div>
          <div className="col-span-3">Imagen (Vista Previa & URL)</div>
          <div className="col-span-1 text-center">ID</div>
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const activeDates = calendarMap[item.dia] || [];
            
            return (
              <div key={item.id} className="grid grid-cols-12 gap-4 p-2 hover:bg-slate-50 transition-colors items-center">
                
                <div className="col-span-2 text-center flex flex-col items-center justify-center">
                  <input 
                    type="number" 
                    value={item.dia || ''}
                    onChange={(e) => handleInputChange(item.id, 'dia', e.target.value)}
                    className="w-16 bg-slate-100 border-none focus:ring-2 focus:ring-rose-500 rounded-md p-2 text-center text-sm font-black text-slate-600 outline-none transition-all mb-1.5"
                    placeholder="-"
                  />
                  <div className="flex flex-col gap-1">
                    {activeDates.length > 0 ? (
                      activeDates.map((dateStr, idx) => (
                        <span key={idx} className="block text-[9px] font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 whitespace-nowrap">
                          {dateStr}
                        </span>
                      ))
                    ) : (
                      <span className="block text-[9px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                        Sin fecha
                      </span>
                    )}
                  </div>
                </div>

                <div className="col-span-1">
                  <input 
                    type="text" 
                    value={item.type || ''}
                    onChange={(e) => handleInputChange(item.id, 'type', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-2 focus:ring-rose-500 rounded-md p-2 text-xs font-black uppercase text-rose-600 outline-none transition-all"
                    placeholder="Destino"
                  />
                </div>

                <div className="col-span-2">
                  <input 
                    type="text" 
                    value={item.location || ''}
                    onChange={(e) => handleInputChange(item.id, 'location', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-2 focus:ring-rose-500 rounded-md p-2 text-xs font-medium outline-none transition-all text-slate-800"
                  />
                </div>

                <div className="col-span-3">
                  <input 
                    type="text" 
                    value={item.header || ''}
                    onChange={(e) => handleInputChange(item.id, 'header', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-2 focus:ring-rose-500 rounded-md p-2 text-xs font-medium outline-none transition-all text-slate-800"
                  />
                </div>

                <div className="col-span-3 flex items-center gap-3">
  <div className="shrink-0 w-28 h-16 bg-slate-200 rounded-lg overflow-hidden border border-slate-300 flex items-center justify-center shadow-sm">
    {item.image_url ? (
      <img 
        src={item.image_url} 
        alt="preview" 
        className="w-full h-full object-cover"
        onError={(e) => {
          e.target.style.display = 'none';
          e.target.parentElement.classList.add('bg-red-50', 'text-red-400', 'text-[8px]', 'font-bold', 'p-1', 'text-center');
          e.target.parentElement.innerText = 'Roto';
        }}
      />
    ) : (
      <span className="text-[9px] font-black text-slate-400">N/A</span>
    )}
  </div>
  <input 
    type="text" 
    value={item.image_url || ''}
    onChange={(e) => handleInputChange(item.id, 'image_url', e.target.value)}
    className="w-full bg-transparent border border-slate-200 hover:border-slate-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-md p-2 text-[10px] font-mono outline-none transition-all text-slate-500"
    placeholder="https://..."
  />
</div>
                <div className="col-span-1 font-mono text-[9px] text-slate-400 font-bold truncate px-2 text-center" title={item.id}>
                  {item.id}
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default DestacadoManager;