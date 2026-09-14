import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useNavigate } from 'react-router-dom';

export default function LecturaEditorPage() {
  const navigate = useNavigate();
  const [lecturasList, setLecturasList] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  
  // The active document state matching your form blueprint
  const [actividad, setActividad] = useState({
    subtitulo: '',
    test_id: '',
    text_id: 'A',
    dia: '',
    paragraphs: [],
    question_sections: []
  });
  
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch all existing lecturas on load
  useEffect(() => {
    const fetchLecturas = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'lecturas'));
        const docs = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setLecturasList(docs);
      } catch (error) {
        console.error("Error fetching lecturas list:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLecturas();
  }, []);

  // Handle dropdown selection change
  const handleSelectLectura = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    setStatus('');

    if (id === 'new') {
      setActividad({
        subtitulo: '',
        test_id: '',
        text_id: 'A',
        dia: '',
        paragraphs: [],
        question_sections: []
      });
    } else {
      const found = lecturasList.find(l => l.id === id);
      if (found) {
        setActividad(found);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setActividad(prev => ({ ...prev, [name]: value }));
  };

  // Helper para párrafos
  const handleParagraphsChange = (text) => {
    setActividad(prev => ({ 
      ...prev, 
      paragraphs: text.split('\n').filter(p => p.trim() !== "") 
    }));
  };

  // Add a new question section
  const addSection = () => {
    setActividad(prev => ({
      ...prev,
      question_sections: [
        ...(prev.question_sections || []),
        { type: 'MCQ', instructions: '', options: {}, questions: [{ number: 1, prompt: '', answer: '', points: 1 }] }
      ]
    }));
  };

  // Helper para cambiar campos dentro de una sección
  const updateSection = (sIdx, field, value) => {
    const newSections = [...(actividad.question_sections || [])];
    newSections[sIdx][field] = value;
    setActividad(prev => ({ ...prev, question_sections: newSections }));
  };

  // Helper para las opciones (ej: A: "Respuesta...")
  const updateOption = (sIdx, key, value) => {
    const newSections = [...(actividad.question_sections || [])];
    if (!newSections[sIdx].options) newSections[sIdx].options = {};
    newSections[sIdx].options[key] = value;
    setActividad(prev => ({ ...prev, question_sections: newSections }));
  };

  // Add a question to a section
  const addQuestion = (sIdx) => {
    const newSections = [...(actividad.question_sections || [])];
    const currentQuestions = newSections[sIdx].questions || [];
    newSections[sIdx].questions = [
      ...currentQuestions,
      { number: currentQuestions.length + 1, prompt: '', answer: '', points: 1 }
    ];
    setActividad(prev => ({ ...prev, question_sections: newSections }));
  };

  // Helper para las preguntas individuales
  const updateQuestion = (sIdx, qIdx, field, value) => {
    const newSections = [...(actividad.question_sections || [])];
    newSections[sIdx].questions[qIdx][field] = value;
    setActividad(prev => ({ ...prev, question_sections: newSections }));
  };

  // Save to Firebase
  const handleSave = async (e) => {
    e.preventDefault();
    setStatus('Guardando...');

    try {
      if (!selectedId || selectedId === 'new') {
        // Create new doc
        const docRef = await addDoc(collection(db, 'lecturas'), actividad);
        setSelectedId(docRef.id);
        setLecturasList(prev => [...prev, { id: docRef.id, ...actividad }]);
      } else {
        // Overwrite existing doc
        const docRef = doc(db, 'lecturas', selectedId);
        await setDoc(docRef, actividad, { merge: true });
      }
      setStatus('¡Guardado con éxito en Firebase!');
    } catch (error) {
      console.error("Error saving lectura:", error);
      setStatus('Error al guardar.');
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest bg-black min-h-screen text-white">Cargando Editor...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8 font-sans pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* TOP CONTROLS BAR */}
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              <span>✍️</span> Lectura Editor & Creator
            </h1>
            <p className="text-xs text-neutral-400 font-mono mt-1">Crea o modifica textos de examen IB Paper 1.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select 
              value={selectedId} 
              onChange={handleSelectLectura}
              className="bg-neutral-950 border border-neutral-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl outline-none cursor-pointer flex-1 sm:flex-none"
            >
              <option value="">-- Selecciona una Lectura --</option>
              <option value="new" className="text-cyan-400 font-bold">+ Crear Nueva Lectura</option>
              {lecturasList.map(l => (
                <option key={l.id} value={l.id}>
                  {l.subtitulo || l.id} ({l.test_id} - Text {l.text_id})
                </option>
              ))}
            </select>

            <button onClick={() => navigate('/admin-daily-plan-hub')} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold px-4 py-2.5 rounded-xl border border-neutral-700">
              ← Hub
            </button>
          </div>
        </div>

        {selectedId && (
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* METADATA BLOCK */}
            <div className="bg-neutral-900/60 border border-neutral-800 p-6 rounded-2xl space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-cyan-400 border-b border-neutral-800 pb-3">Lectura Metadata</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-6 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Subtítulo / Tema</label>
                  <input name="subtitulo" value={actividad.subtitulo || ""} onChange={handleChange} className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-cyan-500" />
                </div>
                <div className="sm:col-span-4 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Test ID (ej: 2020 Nov. NS)</label>
                  <input name="test_id" value={actividad.test_id || ""} onChange={handleChange} placeholder="Exam Session" className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-cyan-500" />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Text ID</label>
                  <input name="text_id" value={actividad.text_id || ""} onChange={handleChange} placeholder="A, B, C..." className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-cyan-500" />
                </div>
              </div>
            </div>

            {/* CONTENIDO DEL TEXTO */}
            <div className="bg-neutral-900/60 border border-neutral-800 p-6 rounded-2xl space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-cyan-400 border-b border-neutral-800 pb-3">Contenido del Texto (Párrafos)</h4>
              <textarea 
                value={(actividad.paragraphs || []).join('\n\n')} 
                onChange={(e) => handleParagraphsChange(e.target.value)}
                className="w-full min-h-[200px] bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-sm font-serif text-slate-200 leading-relaxed outline-none focus:border-cyan-500"
                placeholder="Pega aquí cada párrafo separado por un salto de línea..."
              />
            </div>

            {/* SECCIONES DE PREGUNTAS */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black uppercase tracking-tight text-white">Secciones de Preguntas</h3>
                <button type="button" onClick={addSection} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all">
                  + Añadir Sección
                </button>
              </div>

              {(actividad.question_sections || []).map((section, sIdx) => (
                <div key={sIdx} className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                    <span className="font-black text-xs uppercase tracking-widest text-amber-400">
                      Sección {sIdx + 1}
                    </span>
                    <select 
                      value={section.type || 'MCQ'} 
                      onChange={(e) => updateSection(sIdx, 'type', e.target.value)}
                      className="bg-neutral-950 border border-neutral-700 text-xs font-bold text-white px-3 py-1.5 rounded-lg outline-none"
                    >
                      <option value="MCQ">Opción Múltiple (MCQ)</option>
                      <option value="Matching">Pareo / Matching (A, B, C...)</option>
                      <option value="Short Answer">Respuesta Corta</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Instrucciones:</label>
                    <textarea 
                      value={section.instructions || ""} 
                      onChange={(e) => updateSection(sIdx, 'instructions', e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Opciones de la lista (A, B, C...) si aplica */}
                  <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Opciones de Referencia (A, B, C...)</label>
                      <button 
                        type="button" 
                        onClick={() => {
                          const keys = Object.keys(section.options || {});
                          const nextKey = String.fromCharCode(65 + keys.length); // A, B, C...
                          updateOption(sIdx, nextKey, '');
                        }}
                        className="text-[10px] text-cyan-400 font-bold hover:underline"
                      >
                        + Añadir Opción
                      </button>
                    </div>
                    {Object.entries(section.options || {}).map(([key, val]) => (
                      <div key={key} className="flex gap-3 items-center">
                        <span className="font-bold text-cyan-400 w-6">{key}:</span>
                        <input 
                          value={val} 
                          onChange={(e) => updateOption(sIdx, key, e.target.value)}
                          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                          placeholder={`Texto para opción ${key}`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Preguntas de esta sección */}
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preguntas</label>
                      <button type="button" onClick={() => addQuestion(sIdx)} className="text-[10px] text-cyan-400 font-bold hover:underline">
                        + Añadir Pregunta
                      </button>
                    </div>

                    {(section.questions || []).map((q, qIdx) => (
                      <div key={qIdx} className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-rose-400 font-mono text-xs">{q.number || (qIdx + 1)}.</span>
                          <input 
                            value={q.prompt || ""} 
                            onChange={(e) => updateQuestion(sIdx, qIdx, 'prompt', e.target.value)}
                            placeholder="Pregunta o enunciado..."
                            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white outline-none"
                          />
                        </div>

                        <div className="flex gap-4 items-center">
                          <div className="flex-1 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase">Respuesta:</span>
                            <input 
                              value={q.answer || ""} 
                              onChange={(e) => updateQuestion(sIdx, qIdx, 'answer', e.target.value)}
                              placeholder="Respuesta oficial..."
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-emerald-300 font-bold outline-none"
                            />
                          </div>
                          <div className="w-24 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase">Pts:</span>
                            <input 
                              type="number" 
                              value={q.points || 1} 
                              onChange={(e) => updateQuestion(sIdx, qIdx, 'points', parseInt(e.target.value) || 1)}
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-center text-white outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              ))}
            </div>

            {status && (
              <p className={`text-xs font-bold text-center ${status.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
                {status}
              </p>
            )}

            <button type="submit" className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg transition-all active:scale-95">
              Guardar Cambios en Firebase
            </button>
          </form>
        )}

      </div>
    </div>
  );
}