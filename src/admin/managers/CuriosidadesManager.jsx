import React, { useState, useEffect } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebase';

const CuriosidadesManager = () => {
  const [items, setItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCuriosidades = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'curiosidades'));
        let fetchedItems = [];
        
        querySnapshot.forEach((docSnap) => {
          fetchedItems.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Sort items primarily by s2_dia, putting unassigned (null) at the bottom
        fetchedItems.sort((a, b) => {
          const dayA = a.s2_dia || 999;
          const dayB = b.s2_dia || 999;
          return dayA - dayB;
        });

        setItems(fetchedItems);
      } catch (error) {
        console.error("Error fetching curiosidades:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCuriosidades();
  }, []);

  const handleInputChange = (id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        if (field === 's2_dia' || field === 's4_dia') {
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
        const docRef = doc(db, 'curiosidades', item.id);
        const { id, ...dataToSave } = item;
        batch.set(docRef, dataToSave, { merge: true });
      });

      await batch.commit();
      alert("¡Curiosidades guardadas exitosamente!");
    } catch (error) {
      console.error("Error saving batch:", error);
      alert("Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando Curiosidades...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-[1400px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center z-10 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Curiosidades Manager</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Gestor de base de datos</p>
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>

        {/* Updated Grid Headers for 12 columns */}
        <div className="grid grid-cols-12 gap-4 p-4 bg-slate-100 border-b border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-500 items-center">
          <div className="col-span-1 text-center">Día S2</div>
          <div className="col-span-1 text-center">Día S4</div>
          <div className="col-span-1 text-indigo-600">ID</div>
          <div className="col-span-2">Título</div>
          <div className="col-span-4">Imagen (Vista Previa & URL)</div>
          <div className="col-span-3">Notas del Maestro</div>
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-4 p-2 hover:bg-slate-50 transition-colors items-center">
              
              <div className="col-span-1">
                <input 
                  type="number" 
                  value={item.s2_dia || ''}
                  onChange={(e) => handleInputChange(item.id, 's2_dia', e.target.value)}
                  className="w-full bg-slate-100 border-none focus:ring-2 focus:ring-indigo-500 rounded-md p-2 text-center text-sm font-black text-slate-600 outline-none transition-all"
                  placeholder="-"
                />
              </div>

              <div className="col-span-1">
                <input 
                  type="number" 
                  value={item.s4_dia || ''}
                  onChange={(e) => handleInputChange(item.id, 's4_dia', e.target.value)}
                  className="w-full bg-slate-100 border-none focus:ring-2 focus:ring-emerald-500 rounded-md p-2 text-center text-sm font-black text-slate-600 outline-none transition-all"
                  placeholder="-"
                />
              </div>

              <div className="col-span-1 font-mono text-[10px] text-slate-400 font-bold truncate">
                {item.id}
              </div>

              <div className="col-span-2">
                <input 
                  type="text" 
                  value={item.title || ''}
                  onChange={(e) => handleInputChange(item.id, 'title', e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-2 focus:ring-indigo-500 rounded-md p-2 text-xs font-medium outline-none transition-all text-slate-800"
                />
              </div>

              {/* NEW: Image Preview + URL Editor */}
              <div className="col-span-4 flex items-center gap-3">
                <div className="shrink-0 w-12 h-12 bg-slate-200 rounded-md overflow-hidden border border-slate-300 flex items-center justify-center shadow-sm">
                  {item.img ? (
                    <img 
                      src={item.img} 
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
                  value={item.img || ''}
                  onChange={(e) => handleInputChange(item.id, 'img', e.target.value)}
                  className="w-full bg-transparent border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-md p-2 text-[10px] font-mono outline-none transition-all text-slate-500"
                  placeholder="https://..."
                />
              </div>

              <div className="col-span-3">
                <input 
                  type="text" 
                  value={item.teacher_notes || ''}
                  onChange={(e) => handleInputChange(item.id, 'teacher_notes', e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-2 focus:ring-indigo-500 rounded-md p-2 text-xs font-medium outline-none transition-all text-slate-500 placeholder-slate-300"
                  placeholder="Notas internas..."
                />
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default CuriosidadesManager;