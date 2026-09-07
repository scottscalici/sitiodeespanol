import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase'; 
import { useCalendarMap } from '../../hooks/useCalendarMap'; // 📅 Import the calendar hook

const GramaticaSequencer = () => {
  const [scheduleS2, setScheduleS2] = useState([]);
  const [scheduleS4, setScheduleS4] = useState([]);
  const [activeCourse, setActiveCourse] = useState('s2');
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDictionary, setShowDictionary] = useState(true);
  
  // Pull live calendar mapping from Firestore config
  const { calendarMap } = useCalendarMap();

  // We will store your apuntes data here for the cheat sheet
  const [apuntesDict, setApuntesDict] = useState({});

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

        // 2. Fetch the apuntes JSON from your GitHub (or local file) for the Cheat Sheet
        const apuntesRes = await fetch('https://raw.githubusercontent.com/scottscalici/imagenes/main/planes/apuntes.json');
        if (apuntesRes.ok) {
          const apuntesData = await apuntesRes.json();
          setApuntesDict(apuntesData);
        }
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

  return (
    <div className="min-h-screen bg-slate-50 p-4 flex gap-4 overflow-hidden">
      
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
              {showDictionary ? 'Ocultar IDs' : 'Ver IDs'}
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
          <div className="col-span-3 text-emerald-600">Recursos (IDs)</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100 pb-20">
          {activeSchedule.map((row) => {
            const calendarDate = calendarMap[row.dia]; // 📅 Lookup date matching this row's day number

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
                <div className="col-span-2">
                  <input 
                    type="text" value={row.enlaces} onChange={(e) => handleInputChange(row.dia, 'enlaces', e.target.value)}
                    className="w-full bg-indigo-50 border border-indigo-100 focus:border-indigo-500 rounded-md p-1.5 text-[10px] font-mono outline-none"
                    placeholder="ej: preterito:regulares"
                  />
                </div>
                <div className="col-span-3">
                  <input 
                    type="text" value={row.recursos} onChange={(e) => handleInputChange(row.dia, 'recursos', e.target.value)}
                    className="w-full bg-emerald-50 border border-emerald-100 focus:border-emerald-500 rounded-md p-1.5 text-[10px] font-mono outline-none"
                    placeholder="ej: preterito, adverbios"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHEAT SHEET DICTIONARY */}
      {showDictionary && (
        <div className="w-80 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-y-auto h-[95vh] p-4">
          <h2 className="font-black text-sm text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4">Banco de IDs</h2>
          
          <div className="space-y-6">
            {Object.keys(apuntesDict).map(mainKey => {
              const category = apuntesDict[mainKey];
              return (
                <div key={mainKey} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="mb-2">
                    <span className="text-xs font-bold text-slate-800">{category.title}</span>
                    <div className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                      Recurso ID: {mainKey}
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 mt-3">
                    {category.links && Object.keys(category.links).map(linkKey => (
                      <div key={linkKey} className="flex flex-col border-t border-slate-200 pt-1.5">
                        <span className="text-[10px] font-medium text-slate-600 leading-tight mb-0.5">
                          {category.links[linkKey].title}
                        </span>
                        <span className="text-[9px] font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded inline-block w-fit">
                          Enlace: {mainKey}:{linkKey}
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
    </div>
  );
};

export default GramaticaSequencer;