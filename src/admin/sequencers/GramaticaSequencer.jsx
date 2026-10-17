import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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

  // 🔍 Picker Modal State — one unified modal per day, listing every
  // category and note together so the teacher can check off any mix of
  // both without the modal closing after each click.
  const [pickerModal, setPickerModal] = useState(null); // { dia }

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

  // 🔁 Toggle helpers for the unified picker — read/write the day's
  // enlaces/recursos CSV fields as arrays, so checkbox state always reflects
  // what's actually saved (selections persist across reopens for free).
  const parseIds = (str) => (str || '').split(',').map((s) => s.trim()).filter(Boolean);
  const joinIds = (arr) => arr.join(', ');

  const getRow = (dia) => {
    const targetSchedule = activeCourse === 's2' ? scheduleS2 : scheduleS4;
    return targetSchedule.find((r) => r.dia === dia);
  };

  const toggleEnlace = (dia, pageId, categoryName) => {
    const row = getRow(dia);
    if (!row) return;
    const currentEnlaces = parseIds(row.enlaces);
    const currentRecursos = parseIds(row.recursos);
    const catSlug = (categoryName || 'general').toLowerCase();
    const isSelected = currentEnlaces.includes(pageId);

    const newEnlaces = isSelected ? currentEnlaces.filter((id) => id !== pageId) : [...currentEnlaces, pageId];
    handleInputChange(dia, 'enlaces', joinIds(newEnlaces));

    // Selecting a specific note also pulls its whole category into
    // Recursos (the "larger resource" context) — but deselecting the note
    // never auto-removes the category, since other notes may still need it.
    if (!isSelected && !currentRecursos.includes(catSlug)) {
      handleInputChange(dia, 'recursos', joinIds([...currentRecursos, catSlug]));
    }
  };

  const toggleRecurso = (dia, categoryName) => {
    const row = getRow(dia);
    if (!row) return;
    const currentRecursos = parseIds(row.recursos);
    const catSlug = (categoryName || 'general').toLowerCase();
    const newRecursos = currentRecursos.includes(catSlug)
      ? currentRecursos.filter((c) => c !== catSlug)
      : [...currentRecursos, catSlug];
    handleInputChange(dia, 'recursos', joinIds(newRecursos));
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
            <Link
              to="/admin-grammar-notes"
              className="bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg font-black uppercase tracking-widest text-xs transition-colors"
            >
              📝 Notas (Bloques)
            </Link>
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

                {/* Enlaces Input */}
                <div className="col-span-2 flex flex-col gap-1">
                  <input
                    type="text" value={row.enlaces} onChange={(e) => handleInputChange(row.dia, 'enlaces', e.target.value)}
                    className="w-full bg-indigo-50 border border-indigo-100 focus:border-indigo-500 rounded-md p-1.5 text-[10px] font-mono outline-none"
                    placeholder="ej: presente:regulares"
                  />
                </div>

                {/* Recursos Input + unified picker for both columns */}
                <div className="col-span-3 flex flex-col gap-1">
                  <input
                    type="text" value={row.recursos} onChange={(e) => handleInputChange(row.dia, 'recursos', e.target.value)}
                    className="w-full bg-emerald-50 border border-emerald-100 focus:border-emerald-500 rounded-md p-1.5 text-[10px] font-mono outline-none"
                    placeholder="ej: presente"
                  />
                  <button
                    onClick={() => setPickerModal({ dia: row.dia })}
                    className="text-[9px] font-black bg-slate-700 hover:bg-slate-800 text-white px-2 py-0.5 rounded uppercase tracking-wider transition-colors text-center"
                  >
                    + Elegir Notas y Categorías
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

      {/* 🔍 UNIFIED NOTE + CATEGORY PICKER — checkboxes reflect the row's
          current enlaces/recursos live, so reopening shows what's already
          selected, and checking a note auto-checks its category too. */}
      {pickerModal && (() => {
        const row = getRow(pickerModal.dia);
        const selectedEnlaces = parseIds(row?.enlaces);
        const selectedRecursos = parseIds(row?.recursos);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">

              <div className="bg-slate-900 p-5 flex justify-between items-center text-white">
                <div>
                  <h3 className="font-black uppercase tracking-widest text-sm">
                    Notas y Categorías (Día {pickerModal.dia})
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Marca todas las que quieras — se guardan al instante, sin cerrar esta ventana.</p>
                </div>
                <button
                  onClick={() => setPickerModal(null)}
                  className="text-slate-400 hover:text-white text-2xl font-bold leading-none p-1"
                >
                  ×
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50">
                {Object.keys(pagesByCategory).map((categoryName) => {
                  const catSlug = categoryName.toLowerCase();
                  const categoryChecked = selectedRecursos.includes(catSlug);
                  return (
                    <div key={categoryName} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                      <label className="flex items-center justify-between gap-3 cursor-pointer">
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={categoryChecked}
                            onChange={() => toggleRecurso(pickerModal.dia, categoryName)}
                            className="w-4 h-4 accent-emerald-600"
                          />
                          <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">{categoryName}</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">Categoría (Recursos)</span>
                      </label>

                      <div className="space-y-1.5 pl-6 border-l-2 border-slate-100">
                        {pagesByCategory[categoryName].map((page) => {
                          const noteChecked = selectedEnlaces.includes(page.id);
                          return (
                            <label key={page.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                              <input
                                type="checkbox"
                                checked={noteChecked}
                                onChange={() => toggleEnlace(pickerModal.dia, page.id, categoryName)}
                                className="w-4 h-4 accent-indigo-600 shrink-0"
                              />
                              <span className="text-xs font-bold text-slate-800 leading-tight">{page.title}</span>
                              <span className="text-[9px] font-mono text-indigo-500 shrink-0">({page.id})</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default GramaticaSequencer;