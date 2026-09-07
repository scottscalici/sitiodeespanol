import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase'; 
import { useCalendarMap } from '../../hooks/useCalendarMap'; 

const GramaticaSequencer = () => {
  const [scheduleS2, setScheduleS2] = useState([]);
  const [scheduleS4, setScheduleS4] = useState([]);
  const [activeCourse, setActiveCourse] = useState('s2');
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDictionary, setShowDictionary] = useState(true);
  
  // Pull live calendar mapping from Firestore config
  const { calendarMap } = useCalendarMap();

  // 📄 Live Grammar Pages fetched directly from Firestore
  const [firestoreGrammarPages, setFirestoreGrammarPages] = useState([]);

  // 🔍 Picker Modal States
  const [pickerModal, setPickerModal] = useState(null); // { dia, type: 'enlaces' | 'recursos' }

  const MAX_DAYS = 85;

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch the sequencer data
        const trackRef = doc(db, 'curriculum_tracks', 'gramatica_master');
        const trackSnap = await getDoc(trackRef);
        
        let dataS2 = trackSnap.exists() ? (trackSnap.data().s2 || []) : [];
        let dataS4 = trackSnap.exists() ? (trackSnap.data().s4 || []) : [];

        const mapData = (sourceArray) => {
          return Array.from({ length: MAX_DAYS }, (_, i) => {
            const dia = i + 1;
            const existing = sourceArray.find(item => item.dia === dia) || {};
            return {
              dia,
              introText: existing.introText || "",
              repasoText: existing.repasoText || "",
              enlaces: existing.enlaces || "",
              recursos: existing.recursos || ""
            };
          });
        };

        setScheduleS2(mapData(dataS2));
        setScheduleS4(mapData(dataS4));

        // 2. Fetch all pages dynamically from 'grammar_pages' collection in Firestore
        const pagesSnap = await getDocs(collection(db, 'grammar_pages'));
        const pagesList = pagesSnap.docs.map(d => ({
          id: d.id, // This is your document ID (e.g., "presente:notas_generales")
          ...d.data()
        }));
        setFirestoreGrammarPages(pagesList);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (dia, field, value) => {
    if (activeCourse === 's2') {
      setScheduleS2(prev => prev.map(row => row.dia === dia ? { ...row, [field]: value } : row));
    } else {
      setScheduleS4(prev => prev.map(row => row.dia === dia ? { ...row, [field]: value } : row));
    }
  };

  // ➕ Smart Append helper for picker selections
  const handleAppendId = (idString) => {
    if (!pickerModal) return;
    const { dia, type } = pickerModal;
    
    const targetSchedule = activeCourse === 's2' ? scheduleS2 : scheduleS4;
    const currentRow = targetSchedule.find(r => r.dia === dia);
    if (!currentRow) return;

    const currentValue = currentRow[type] || "";
    const newValue = currentValue.trim() === "" ? idString : `${currentValue}, ${idString}`;

    handleInputChange(dia, type, newValue);
    setPickerModal(null); 
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleanData = (schedule) => schedule.filter(row => 
        row.introText || row.repasoText || row.enlaces || row.recursos
      );

      const payload = {
        s2: cleanData(scheduleS2),
        s4: cleanData(scheduleS4)
      };

      await setDoc(doc(db, 'curriculum_tracks', 'gramatica_master'), payload);
      alert("¡Guardado exitosamente!");
    } catch (error) {
      console.error("Error saving to Firestore:", error);
      alert("Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando Secuencia...</div>;
  }

  const activeSchedule = activeCourse === 's2' ? scheduleS2 : scheduleS4;

  // Group pages by category dynamically for the modals and sidebar
  const pagesByCategory = firestoreGrammarPages.reduce((acc, page) => {
    const cat = page.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(page);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 p-4 flex gap-4 overflow-hidden relative">
      
      {/* MAIN SPREADSHEET */}
      <div className={`flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-y-auto h-[95vh] transition-all`}>
        
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10 shadow-sm">
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Gramática Sequencer</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setActiveCourse('s2')}
                className={`px-4 py-1.5 rounded-md font-black text-[10px] uppercase tracking-widest transition-colors ${activeCourse === 's2' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Español II
              </button>
              <button 
                onClick={() => setActiveCourse('s4')}
                className={`px-4 py-1.5 rounded-md font-black text-[10px] uppercase tracking-widest transition-colors ${activeCourse === 's4' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                IB Español B
              </button>
            </div>
            
            <button 
              onClick={() => setShowDictionary(!showDictionary)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-1.5 rounded-lg font-black uppercase tracking-widest text-[10px] transition-colors"
            >
              {showDictionary ? 'Ocultar Banco' : 'Ver Banco de Firestore'}
            </button>

            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-1.5 rounded-lg font-black uppercase tracking-widest text-[10px] transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Columns */}
        <div className="grid grid-cols-12 gap-2 p-3 bg-slate-100 border-b border-slate-200 font-black text-[9px] uppercase tracking-widest text-slate-500">
          <div className="col-span-1 text-center">Día / Fecha</div>
          <div className="col-span-3">Introducir</div>
          <div className="col-span-3">Repasar</div>
          <div className="col-span-2 text-indigo-600">Enlaces (IDs)</div>
          <div className="col-span-3 text-emerald-600">Recursos (Categorías/IDs)</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100 pb-20">
          {activeSchedule.map((row) => {
            const calendarDate = calendarMap[row.dia]; 

            return (
              <div key={row.dia} className="grid grid-cols-12 gap-2 p-2 hover:bg-slate-50 items-start">
                
                {/* Day Badge & Date */}
                <div className="col-span-1 text-center pt-1">
                  <span className="text-[9px] font-black text-slate-400 block uppercase">Día</span>
                  <span className="font-black text-slate-700 text-base leading-tight">{row.dia}</span>
                  <span className="block text-[8px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded mt-0.5">
                    {calendarDate || 'Sin fecha'}
                  </span>
                </div>

                <div className="col-span-3">
                  <textarea 
                    value={row.introText} onChange={(e) => handleInputChange(row.dia, 'introText', e.target.value)}
                    className="w-full bg-transparent border border-slate-200 focus:border-indigo-500 rounded-md p-1.5 text-xs outline-none min-h-[50px]"
                  />
                </div>
                <div className="col-span-3">
                  <textarea 
                    value={row.repasoText} onChange={(e) => handleInputChange(row.dia, 'repasoText', e.target.value)}
                    className="w-full bg-transparent border border-slate-200 focus:border-indigo-500 rounded-md p-1.5 text-xs outline-none min-h-[50px]"
                  />
                </div>

                {/* Enlaces Input with Picker Button */}
                <div className="col-span-2 flex flex-col gap-1">
                  <input 
                    type="text" value={row.enlaces} onChange={(e) => handleInputChange(row.dia, 'enlaces', e.target.value)}
                    className="w-full bg-indigo-50 border border-indigo-100 focus:border-indigo-500 rounded-md p-1.5 text-[10px] font-mono outline-none"
                    placeholder="ej: presente:regulares"
                  />
                  <button 
                    onClick={() => setPickerModal({ dia: row.dia, type: 'enlaces' })}
                    className="text-[9px] font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded uppercase tracking-wider transition-colors text-center"
                  >
                    + Elegir Enlace
                  </button>
                </div>

                {/* Recursos Input with Picker Button */}
                <div className="col-span-3 flex flex-col gap-1">
                  <input 
                    type="text" value={row.recursos} onChange={(e) => handleInputChange(row.dia, 'recursos', e.target.value)}
                    className="w-full bg-emerald-50 border border-emerald-100 focus:border-emerald-500 rounded-md p-1.5 text-[10px] font-mono outline-none"
                    placeholder="ej: presente"
                  />
                  <button 
                    onClick={() => setPickerModal({ dia: row.dia, type: 'recursos' })}
                    className="text-[9px] font-black bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-0.5 rounded uppercase tracking-wider transition-colors text-center"
                  >
                    + Elegir Categoría
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* FIRESTORE BANK SIDEBAR */}
      {showDictionary && (
        <div className="w-80 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-y-auto h-[95vh] p-4">
          <h2 className="font-black text-sm text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4">Banco (Firestore)</h2>
          
          <div className="space-y-6">
            {Object.keys(pagesByCategory).map(categoryName => {
              const pages = pagesByCategory[categoryName];
              return (
                <div key={categoryName} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="mb-2">
                    <span className="text-xs font-bold text-slate-800 uppercase">{categoryName}</span>
                  </div>
                  
                  <div className="space-y-1.5 mt-2">
                    {pages.map(page => (
                      <div key={page.id} className="flex flex-col border-t border-slate-200 pt-1.5">
                        <span className="text-[10px] font-medium text-slate-600 leading-tight mb-0.5">
                          {page.title}
                        </span>
                        <span className="text-[9px] font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded inline-block w-fit">
                          ID: {page.id}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 🔍 LIVE FIRESTORE ID SELECTOR MODAL */}
      {pickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white">
              <div>
                <h3 className="font-black uppercase tracking-widest text-sm">
                  Seleccionar {pickerModal.type === 'enlaces' ? 'Enlace (ID de Página)' : 'Recurso (Categoría)'} (Día {pickerModal.dia})
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Cargado directamente de tu colección `grammar_pages`</p>
              </div>
              <button 
                onClick={() => setPickerModal(null)}
                className="text-slate-400 hover:text-white text-2xl font-bold leading-none p-1"
              >
                ×
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50">
              
              {/* IF TYPE IS RECURSOS: Show Categories to select */}
              {pickerModal.type === 'recursos' && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase">Selecciona una Categoría General:</p>
                  {Object.keys(pagesByCategory).map(categoryName => (
                    <div key={categoryName} className="flex justify-between items-center bg-emerald-50 border border-emerald-200 p-3 rounded-xl shadow-sm">
                      <div>
                        <span className="text-sm font-black text-slate-800 block uppercase">{categoryName}</span>
                        <span className="text-[10px] font-mono text-emerald-700">{pagesByCategory[categoryName].length} páginas disponibles</span>
                      </div>
                      <button
                        onClick={() => handleAppendId(categoryName.toLowerCase())}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
                      >
                        Seleccionar Categoría
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* IF TYPE IS ENLACES: Show individual page IDs grouped by category */}
              {pickerModal.type === 'enlaces' && (
                <div className="space-y-4">
                  <p className="text-xs font-bold text-slate-500 uppercase">Selecciona un ID de Página Específica:</p>
                  {Object.keys(pagesByCategory).map(categoryName => (
                    <div key={categoryName} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                      <span className="text-xs font-black text-indigo-600 uppercase tracking-wider block">{categoryName}</span>
                      <div className="space-y-2">
                        {pagesByCategory[categoryName].map(page => (
                          <div key={page.id} className="flex justify-between items-center bg-indigo-50/60 border border-indigo-100 p-2.5 rounded-lg">
                            <div>
                              <span className="text-xs font-bold text-slate-800 block leading-tight">{page.title}</span>
                              <span className="text-[10px] font-mono text-indigo-600">ID: {page.id}</span>
                            </div>
                            <button
                              onClick={() => handleAppendId(page.id)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm shrink-0"
                            >
                              Seleccionar ID
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default GramaticaSequencer;