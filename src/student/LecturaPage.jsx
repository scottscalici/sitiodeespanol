import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import CulturalLecturaExercise from './CulturalLecturaExercise';

// Section types whose answer is a single letter chosen from section.options
// — exactly gradable, no phrasing-variability problem.
const CHOICE_TYPES = ['multiple_choice', 'matching'];
const MULTI_SELECT_TYPE = 'multiple_select';
const TRUE_FALSE_TYPE = 'true_false_justification';

// true_false_justification answers are stored as "F, conviven en perfecta
// armonía..." — split on the first comma into the gradable V/F part and the
// free-text justification, which only gets a reveal button.
function parseTrueFalse(answer) {
  const str = (answer || '').trim();
  const idx = str.indexOf(',');
  if (idx === -1) return { truth: str.toUpperCase(), justification: '' };
  return { truth: str.slice(0, idx).trim().toUpperCase(), justification: str.slice(idx + 1).trim() };
}

function parseLetterSet(answer) {
  return new Set(
    (answer || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );
}

export default function LecturaPage() {
  const { lecturaId } = useParams();
  const [lectura, setLectura] = useState(null);
  const [loading, setLoading] = useState(true);

  // Keyed "sIdx_qIdx" -> a letter (choice/true-false) or an array of letters
  // (multiple_select). Free-text types (short_answer, reference, etc.) have
  // no variability-prone exact-match grading at all anymore — see `revealed`.
  const [studentAnswers, setStudentAnswers] = useState({});
  const [revealed, setRevealed] = useState({});
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
        console.error('Error fetching lectura:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLectura();
  }, [lecturaId]);

  const setSingleAnswer = (key, letter) => {
    setStudentAnswers((prev) => ({ ...prev, [key]: letter }));
  };

  const toggleMultiAnswer = (key, letter) => {
    setStudentAnswers((prev) => {
      const current = new Set(prev[key] || []);
      if (current.has(letter)) current.delete(letter);
      else current.add(letter);
      return { ...prev, [key]: [...current] };
    });
  };

  const toggleReveal = (key) => {
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
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

  if (lectura.type === 'cultural') {
    return <CulturalLecturaExercise lectura={lectura} lecturaId={lecturaId} />;
  }

  let totalGraded = 0;
  let correctGraded = 0;
  (lectura.question_sections || []).forEach((section, sIdx) => {
    const hasOptions = section.options && Object.keys(section.options).length > 0;
    (section.questions || []).forEach((q, qIdx) => {
      const key = `${sIdx}_${qIdx}`;
      if (CHOICE_TYPES.includes(section.type) && hasOptions) {
        totalGraded++;
        if ((studentAnswers[key] || '') === (q.answer || '').trim().toUpperCase()) correctGraded++;
      } else if (section.type === MULTI_SELECT_TYPE && hasOptions) {
        totalGraded++;
        const expected = parseLetterSet(q.answer);
        const given = new Set(studentAnswers[key] || []);
        if (expected.size === given.size && [...expected].every((l) => given.has(l))) correctGraded++;
      } else if (section.type === TRUE_FALSE_TYPE) {
        totalGraded++;
        const { truth } = parseTrueFalse(q.answer);
        if ((studentAnswers[key] || '') === truth) correctGraded++;
      }
    });
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-8 font-sans pb-24">
      <div className="max-w-5xl mx-auto space-y-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
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

          <div className="lg:col-span-7 space-y-6">
            {(lectura.question_sections || []).map((section, sIdx) => {
              const hasOptions = section.options && Object.keys(section.options).length > 0;
              return (
                <div key={sIdx} className="bg-slate-800 border border-slate-700 p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
                  <div className="border-b border-slate-700 pb-3 flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                      Sección {sIdx + 1}
                    </span>
                    <span className="text-[10px] font-mono bg-slate-900 px-2 py-1 rounded text-slate-400 uppercase">
                      Tipo: {section.type || 'Standard'}
                    </span>
                  </div>

                  {section.instructions && (
                    <p className="text-sm font-bold text-slate-200 bg-slate-900/60 p-4 rounded-xl border border-slate-700/60 leading-relaxed">
                      {section.instructions}
                    </p>
                  )}

                  {hasOptions && (
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

                  <div className="space-y-4">
                    {(section.questions || []).map((q, qIdx) => {
                      const key = `${sIdx}_${qIdx}`;
                      const qNum = q.number || qIdx + 1;

                      // --- Single-letter choice: multiple_choice / matching ---
                      if (CHOICE_TYPES.includes(section.type) && hasOptions) {
                        const selected = studentAnswers[key] || '';
                        const correctLetter = (q.answer || '').trim().toUpperCase();
                        const isCorrect = submitted && selected === correctLetter;
                        return (
                          <div key={qIdx} className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3">
                            <div className="flex items-start gap-3">
                              <span className="font-black text-rose-400 font-mono text-sm">{qNum}.</span>
                              <p className="text-sm font-bold text-white flex-1">{q.prompt}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 pl-6">
                              {Object.entries(section.options).map(([letter, text]) => {
                                const isSelected = selected === letter;
                                const isTheCorrectOne = submitted && letter === correctLetter;
                                return (
                                  <button
                                    key={letter}
                                    type="button"
                                    disabled={submitted}
                                    onClick={() => setSingleAnswer(key, letter)}
                                    className={`text-xs text-left rounded-lg px-3 py-2 border transition-colors ${
                                      submitted
                                        ? isTheCorrectOne
                                          ? 'border-emerald-500 bg-emerald-950/30 text-emerald-200'
                                          : isSelected
                                          ? 'border-rose-500 bg-rose-950/30 text-rose-200'
                                          : 'border-slate-700 text-slate-500'
                                        : isSelected
                                        ? 'border-cyan-400 bg-cyan-950/40 text-white'
                                        : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-cyan-500'
                                    }`}
                                  >
                                    <strong>{letter}:</strong> {text}
                                  </button>
                                );
                              })}
                            </div>
                            {submitted && (
                              <p className={`text-xs font-mono pl-6 ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isCorrect ? '✔ ¡Correcto!' : `✖ Respuesta correcta: ${correctLetter}`}
                              </p>
                            )}
                          </div>
                        );
                      }

                      // --- Multi-letter choice: multiple_select ---
                      if (section.type === MULTI_SELECT_TYPE && hasOptions) {
                        const given = new Set(studentAnswers[key] || []);
                        const expected = parseLetterSet(q.answer);
                        const isCorrect =
                          submitted && given.size === expected.size && [...expected].every((l) => given.has(l));
                        return (
                          <div key={qIdx} className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3">
                            <div className="flex items-start gap-3">
                              <span className="font-black text-rose-400 font-mono text-sm">{qNum}.</span>
                              <p className="text-sm font-bold text-white flex-1">{q.prompt}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 pl-6">
                              {Object.entries(section.options).map(([letter, text]) => {
                                const isChecked = given.has(letter);
                                const shouldBeChecked = expected.has(letter);
                                const cls = submitted
                                  ? shouldBeChecked
                                    ? 'border-emerald-500 bg-emerald-950/30 text-emerald-200'
                                    : isChecked
                                    ? 'border-rose-500 bg-rose-950/30 text-rose-200'
                                    : 'border-slate-700 text-slate-500'
                                  : isChecked
                                  ? 'border-cyan-400 bg-cyan-950/40 text-white'
                                  : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-cyan-500';
                                return (
                                  <button
                                    key={letter}
                                    type="button"
                                    disabled={submitted}
                                    onClick={() => toggleMultiAnswer(key, letter)}
                                    className={`text-xs text-left rounded-lg px-3 py-2 border transition-colors ${cls}`}
                                  >
                                    <strong>{letter}:</strong> {text}
                                    {isChecked && !submitted ? ' ✓' : ''}
                                  </button>
                                );
                              })}
                            </div>
                            {submitted && (
                              <p className={`text-xs font-mono pl-6 ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isCorrect ? '✔ ¡Correcto!' : `✖ Respuesta correcta: ${[...expected].join(', ')}`}
                              </p>
                            )}
                          </div>
                        );
                      }

                      // --- True/False + justification ---
                      if (section.type === TRUE_FALSE_TYPE) {
                        const { truth, justification } = parseTrueFalse(q.answer);
                        const selected = studentAnswers[key] || '';
                        const isCorrect = submitted && selected === truth;
                        const isRevealed = !!revealed[key];
                        return (
                          <div key={qIdx} className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3">
                            <div className="flex items-start gap-3">
                              <span className="font-black text-rose-400 font-mono text-sm">{qNum}.</span>
                              <p className="text-sm font-bold text-white flex-1">{q.prompt}</p>
                            </div>
                            <div className="flex gap-2 pl-6">
                              {['V', 'F'].map((letter) => (
                                <button
                                  key={letter}
                                  type="button"
                                  disabled={submitted}
                                  onClick={() => setSingleAnswer(key, letter)}
                                  className={`text-xs font-black px-4 py-2 rounded-lg border transition-colors ${
                                    submitted
                                      ? letter === truth
                                        ? 'border-emerald-500 bg-emerald-950/30 text-emerald-200'
                                        : selected === letter
                                        ? 'border-rose-500 bg-rose-950/30 text-rose-200'
                                        : 'border-slate-700 text-slate-500'
                                      : selected === letter
                                      ? 'border-cyan-400 bg-cyan-950/40 text-white'
                                      : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-cyan-500'
                                  }`}
                                >
                                  {letter === 'V' ? 'Verdadero' : 'Falso'}
                                </button>
                              ))}
                            </div>
                            {submitted && (
                              <p className={`text-xs font-mono pl-6 ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isCorrect ? '✔ ¡Correcto!' : `✖ Respuesta correcta: ${truth === 'V' ? 'Verdadero' : 'Falso'}`}
                              </p>
                            )}
                            {submitted && justification && (
                              <div className="pl-6">
                                <button
                                  type="button"
                                  onClick={() => toggleReveal(key)}
                                  className="text-[10px] text-cyan-400 font-bold uppercase hover:underline"
                                >
                                  {isRevealed ? 'Ocultar justificación' : 'Mostrar justificación oficial'}
                                </button>
                                {isRevealed && <p className="text-xs text-slate-300 mt-1 italic">"{justification}"</p>}
                              </div>
                            )}
                          </div>
                        );
                      }

                      // --- Self-check only: short_answer, reference, synonym_search,
                      // fill_in_the_blank, and anything else. The exact phrasing of
                      // these answers varies too much to auto-grade honestly, so no
                      // input, no exact-match coloring — just a reveal button.
                      const isRevealed = !!revealed[key];
                      return (
                        <div key={qIdx} className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3">
                          <div className="flex items-start gap-3">
                            <span className="font-black text-rose-400 font-mono text-sm">{qNum}.</span>
                            <p className="text-sm font-bold text-white flex-1">{q.prompt}</p>
                          </div>
                          {submitted ? (
                            <div className="pl-6">
                              <button
                                type="button"
                                onClick={() => toggleReveal(key)}
                                className="text-[10px] text-cyan-400 font-bold uppercase hover:underline"
                              >
                                {isRevealed ? 'Ocultar respuesta' : 'Mostrar respuesta oficial'}
                              </button>
                              {isRevealed && <p className="text-xs text-slate-300 mt-1 italic">"{q.answer}"</p>}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic pl-6">
                              Autoevaluación — entrega el examen para ver la respuesta oficial.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {!submitted ? (
              <button
                onClick={() => setSubmitted(true)}
                className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg transition-all active:scale-95"
              >
                Comprobar Respuestas
              </button>
            ) : (
              <div className="text-center p-6 bg-slate-800 rounded-2xl border border-slate-700 space-y-2">
                <p className="text-lg font-black text-emerald-400">
                  {totalGraded > 0 ? `${correctGraded} / ${totalGraded} correctas` : '¡Evaluación completada!'}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                  Las preguntas de respuesta corta / justificación se autoevalúan con "Mostrar respuesta"
                </p>
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
