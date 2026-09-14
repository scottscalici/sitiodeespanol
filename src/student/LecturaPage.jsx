import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function LecturaPage() {
  const { lecturaId } = useParams();
  const [lectura, setLectura] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Student Answers State: { sectionIndex: { questionIndex: userResponse } }
  const [studentAnswers, setStudentAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchLectura = async () => {
      if (!lecturaId) return;
      try {
        const docRef = doc(db, 'lecturas', lecturaId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setLectura(docSnap.data());
        }
      } catch (err) {
        console.error("Error fetching lectura:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLectura();
  }, [lecturaId]);

  const handleInputChange = (sIdx, qIdx, value) => {
    setStudentAnswers(prev => ({
      ...prev,
      [sIdx]: {
        ...(prev[sIdx] || {}),
        [qIdx]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-cyan-400 font-black animate-pulse uppercase tracking-widest">
          Cargando Lectura de Examen...
        </div>
      </div>
    );
  }

  if (!lectura) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-center text-white">
        <h2 className="text-2xl font-black text-slate-500 uppercase mb-4">Lectura No Encontrada</h2>
        <Link to="/" className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 font-bold rounded-xl shadow-lg transition-all">
          Volver al Inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-8 font-sans pb-24">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* HEADER / METADATA BAR */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-cyan-950 text-cyan-400 border border-cyan-800 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                Examen IB • Texto {lectura.text_id || 'A'}
              </span>
              <span className="text-xs font-mono text-slate-400">{lectura.test_id}</span>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white">
              {lectura.subtitulo || 'Comprensión de Lectura'}
            </h1>
          </div>
          <Link to="/" className="text-slate-400 hover:text-white font-bold text-xs bg-slate-700 px-4 py-2 rounded-xl border border-slate-600 transition-colors">
            ← Volver al Dashboard
          </Link>
        </header>

        {/* SPLIT LAYOUT: READING PASSAGE & QUESTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: THE READING PASSAGE (Sticky on desktop) */}
          <div className="lg:col-span-5 bg-slate-800 border border-slate-700 p-6 sm:p-8 rounded-2xl shadow-xl h-fit lg:sticky lg:top-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400 border-b border-slate-700 pb-3">
              Texto de Lectura
            </h3>
            <div className="space-y-4 font-serif text-slate-300 leading-relaxed text-base">
              {(lectura.paragraphs || []).map((p, idx) => (
                <p key={idx} className="indent-6">
                  {p}
                </p>
              ))}
            </div>
          </div>

          {/* RIGHT: QUESTION SECTIONS */}
          <div className="lg:col-span-7 space-y-6">
            {(lectura.question_sections || []).map((section, sIdx) => (
              <div key={sIdx} className="bg-slate-800 border border-slate-700 p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
                
                {/* Section Header */}
                <div className="border-b border-slate-700 pb-3 flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                    Sección {sIdx + 1}
                  </span>
                  <span className="text-[10px] font-mono bg-slate-900 px-2 py-1 rounded text-slate-400 uppercase">
                    Tipo: {section.type || 'Standard'}
                  </span>
                </div>

                {/* Instructions */}
                {section.instructions && (
                  <p className="text-sm font-bold text-slate-200 bg-slate-900/60 p-4 rounded-xl border border-slate-700/60 leading-relaxed">
                    {section.instructions}
                  </p>
                )}

                {/* Options Box (If Matching / Multiple Choice options exist) */}
                {section.options && Object.keys(section.options).length > 0 && (
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Opciones de Referencia:</p>
                    {Object.entries(section.options).map(([key, val]) => (
                      <div key={key} className="flex gap-3 text-sm">
                        <span className="font-black text-cyan-400 w-5">{key}:</span>
                        <span className="text-slate-300">{val}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Questions List */}
                <div className="space-y-4">
                  {(section.questions || []).map((q, qIdx) => {
                    const userAnswer = studentAnswers[sIdx]?.[qIdx] || "";
                    const isCorrect = submitted && userAnswer.trim().toLowerCase() === (q.answer || "").trim().toLowerCase();

                    return (
                      <div key={qIdx} className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="font-black text-rose-400 font-mono text-sm">{q.number || (qIdx + 1)}.</span>
                          <p className="text-sm font-bold text-white flex-1">{q.prompt}</p>
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                            {q.points || 1} pts
                          </span>
                        </div>

                        {/* Student Response Input */}
                        <div className="flex gap-2 items-center pt-2">
                          <input 
                            type="text"
                            placeholder="Escribe tu respuesta..."
                            value={userAnswer}
                            disabled={submitted}
                            onChange={(e) => handleInputChange(sIdx, qIdx, e.target.value)}
                            className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm text-white font-medium outline-none transition-colors ${
                              submitted 
                                ? (isCorrect ? 'border-emerald-500 bg-emerald-950/20' : 'border-rose-500 bg-rose-950/20')
                                : 'border-slate-700 focus:border-cyan-400'
                            }`}
                          />
                        </div>

                        {/* Reveal Answer on Submit */}
                        {submitted && (
                          <div className="text-xs font-mono pt-1">
                            {isCorrect ? (
                              <span className="text-emerald-400 font-bold">✔ ¡Correcto!</span>
                            ) : (
                              <span className="text-rose-400">
                                ✖ Respuesta oficial: <strong className="text-white">{q.answer}</strong>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            ))}

            {/* SUBMIT BUTTON */}
            {!submitted ? (
              <button 
                onClick={() => setSubmitted(true)}
                className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg transition-all active:scale-95"
              >
                Comprobar Respuestas
              </button>
            ) : (
              <div className="text-center p-6 bg-slate-800 rounded-2xl border border-slate-700">
                <p className="text-lg font-black text-emerald-400 mb-2">¡Evaluación Completada!</p>
                <button 
                  onClick={() => setSubmitted(false)}
                  className="text-xs text-slate-400 underline hover:text-white font-bold uppercase tracking-widest"
                >
                  Intentar de nuevo / Modificar respuestas
                </button>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}