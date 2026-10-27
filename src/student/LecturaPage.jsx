import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import CulturalLecturaExercise from './CulturalLecturaExercise';
import { RichText, IbPassage } from './ibText';
import { SECTION_LABELS } from './ibLabels';

// Section types whose answer is a letter chosen from a list of options —
// exactly gradable, no phrasing-variability problem. Multiple-choice questions
// carry their own options (q.options); the other types share section.options.
const CHOICE_TYPES = ['multiple_choice', 'matching', 'gap_summary', 'fill_in_the_blank'];
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

// The options a choice question offers, or null if it isn't a letter question
// (old fill_in_the_blank sections can hold written answers instead of letters).
function choiceOptions(section, q) {
  if (!CHOICE_TYPES.includes(section.type)) return null;
  const opts = q.options && Object.keys(q.options).length ? q.options : section.options;
  if (!opts || !Object.keys(opts).length) return null;
  return /^[A-Z](\s*\/\s*[A-Z])*$/.test(String(q.answer || '').trim().toUpperCase()) ? opts : null;
}

// Options in letter order. Firestore doesn't keep the order of map keys, so
// { A, B, C… } can come back shuffled — always sort before showing them.
function sortedOptions(obj) {
  return Object.entries(obj || {}).sort(([a], [b]) => a.localeCompare(b));
}

// "J/D" -> both letters are accepted.
function acceptedLetters(answer) {
  return String(answer || '').toUpperCase().split('/').map((s) => s.trim()).filter(Boolean);
}

// Mark-scheme notes shown under the official answer.
function MarkNotes({ q }) {
  if (!q.accept && !q.reject) return null;
  return (
    <div className="mt-1 space-y-0.5 text-[11px] text-slate-400">
      {q.accept && <p>Se acepta: <RichText text={q.accept} /></p>}
      {q.reject && <p>No se acepta: <RichText text={q.reject} /></p>}
    </div>
  );
}

function parseLetterSet(answer) {
  return new Set(
    (answer || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );
}

const LAYOUT_STORAGE_KEY = 'ib_lectura_layout';

export default function LecturaPage() {
  const { lecturaId } = useParams();
  const [lectura, setLectura] = useState(null);
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState(() => {
    try {
      return localStorage.getItem(LAYOUT_STORAGE_KEY) || 'lado-a-lado';
    } catch {
      return 'lado-a-lado';
    }
  });

  const toggleLayout = () => {
    setLayout((prev) => {
      const next = prev === 'lado-a-lado' ? 'apilado' : 'lado-a-lado';
      try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, next);
      } catch {
        // localStorage unavailable (private browsing, etc.) — layout just won't persist
      }
      return next;
    });
  };

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
      if (choiceOptions(section, q)) {
        totalGraded++;
        if (acceptedLetters(q.answer).includes(studentAnswers[key] || '')) correctGraded++;
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
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLayout}
              className="text-slate-300 hover:text-white font-bold text-xs bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl border border-slate-600 transition-colors"
              title="Cambiar diseño de la página"
            >
              {layout === 'lado-a-lado' ? '📱 Vista Apilada' : '💻 Vista Lado a Lado'}
            </button>
            <Link to="/" className="text-slate-400 hover:text-white font-bold text-xs bg-slate-700 px-4 py-2 rounded-xl border border-slate-600 transition-colors">
              ← Volver al Dashboard
            </Link>
          </div>
        </header>

        <div className={layout === 'lado-a-lado' ? 'grid grid-cols-1 lg:grid-cols-12 gap-8' : 'space-y-6'}>
          <div
            className={
              layout === 'lado-a-lado'
                ? `${lectura.numbering === 'lines' ? 'lg:col-span-6' : 'lg:col-span-5'} bg-slate-800 border border-slate-700 p-6 sm:p-8 rounded-2xl shadow-xl h-fit lg:sticky lg:top-6 space-y-4 max-h-[80vh] overflow-y-auto`
                : 'bg-slate-800 border border-slate-700 p-6 sm:p-8 rounded-2xl shadow-xl space-y-4'
            }
          >
            <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400 border-b border-slate-700 pb-3">
              Texto de Lectura
            </h3>
            <IbPassage lectura={lectura} />
          </div>

          <div className={layout === 'lado-a-lado' ? `${lectura.numbering === 'lines' ? 'lg:col-span-6' : 'lg:col-span-7'} space-y-6` : 'space-y-6'}>
            {(lectura.question_sections || []).map((section, sIdx) => {
              const hasOptions = section.options && Object.keys(section.options).length > 0;
              return (
                <div key={sIdx} className="bg-slate-800 border border-slate-700 p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
                  <div className="border-b border-slate-700 pb-3 flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                      Sección {sIdx + 1}
                    </span>
                    <span className="text-[10px] font-mono bg-slate-900 px-2 py-1 rounded text-slate-400 uppercase">
                      {SECTION_LABELS[section.type] || section.type || 'Preguntas'}
                    </span>
                  </div>

                  {section.instructions && (
                    <p className="text-sm font-bold text-slate-200 bg-slate-900/60 p-4 rounded-xl border border-slate-700/60 leading-relaxed">
                      <RichText text={section.instructions} />
                    </p>
                  )}

                  {/* Summary with gaps ("Resumen con espacios") */}
                  {section.text && (
                    <p className="text-sm text-slate-200 border-2 border-dashed border-slate-600 p-4 rounded-xl leading-relaxed">
                      <RichText text={section.text} />
                    </p>
                  )}

                  {/* Shared list of options (matching, summaries…). Multiple select
                      shows its statements as the answer buttons instead. */}
                  {hasOptions && section.type !== MULTI_SELECT_TYPE && (
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Opciones de Referencia:</p>
                      {sortedOptions(section.options).map(([key, val]) => (
                        <div key={key} className="flex gap-3 text-sm">
                          <span className="font-black text-cyan-400 w-5">{key}:</span>
                          <span className="text-slate-300"><RichText text={val} /></span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4">
                    {(section.questions || []).map((q, qIdx) => {
                      const key = `${sIdx}_${qIdx}`;
                      const qNum = q.number || qIdx + 1;

                      // --- Single-letter choice: multiple_choice / matching / gap_summary ---
                      const opts = choiceOptions(section, q);
                      if (opts) {
                        const selected = studentAnswers[key] || '';
                        const accepted = acceptedLetters(q.answer);
                        const correctLetter = accepted.join(' / ');
                        const isCorrect = submitted && accepted.includes(selected);
                        return (
                          <div key={qIdx} className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3">
                            <div className="flex items-start gap-3">
                              <span className="font-black text-rose-400 font-mono text-sm">{qNum}.</span>
                              <p className="text-sm font-bold text-white flex-1"><RichText text={q.prompt} /></p>
                            </div>
                            <div className={opts === section.options ? 'flex flex-wrap gap-2 pl-6' : 'flex flex-col items-start gap-2 pl-6'}>
                              {sortedOptions(opts).map(([letter, text]) => {
                                const isSelected = selected === letter;
                                const isTheCorrectOne = submitted && accepted.includes(letter);
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
                                    {/* Shared options are listed above, so just the letter here. */}
                                    {opts === section.options ? (
                                      <strong className="px-1">{letter}</strong>
                                    ) : (
                                      <>
                                        <strong>{letter}:</strong> <RichText text={text} />
                                      </>
                                    )}
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
                        // Studio exams repeat the instruction as the prompt
                        // ("Elige las cuatro frases verdaderas.") — say how many instead.
                        const norm = (x) => String(x || '').toLowerCase().replace(/[^\p{L}\s]/gu, '').trim();
                        const repeatsInstructions = norm(section.instructions).startsWith(norm(q.prompt));
                        const prompt = repeatsInstructions ? `Marca ${expected.size} opciones.` : q.prompt;
                        const isCorrect =
                          submitted && given.size === expected.size && [...expected].every((l) => given.has(l));
                        return (
                          <div key={qIdx} className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3">
                            <div className="flex items-start gap-3">
                              <span className="font-black text-rose-400 font-mono text-sm">{qNum}.</span>
                              <p className="text-sm font-bold text-white flex-1"><RichText text={prompt} /></p>
                            </div>
                            <div className="flex flex-col items-start gap-2 pl-6">
                              {sortedOptions(section.options).map(([letter, text]) => {
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
                                    <strong>{letter}:</strong> <RichText text={text} />
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
                              <p className="text-sm font-bold text-white flex-1"><RichText text={q.prompt} /></p>
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
                                {isRevealed && (
                                  <>
                                    <p className="text-xs text-slate-300 mt-1 italic">"<RichText text={justification} />"</p>
                                    <MarkNotes q={q} />
                                  </>
                                )}
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
                            <p className="text-sm font-bold text-white flex-1"><RichText text={q.prompt} /></p>
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
                              {isRevealed && (
                                <>
                                  <p className="text-xs text-slate-300 mt-1 italic">"<RichText text={q.answer} />"</p>
                                  <MarkNotes q={q} />
                                  {/\(/.test(String(q.answer)) && (
                                    <p className="text-[10px] text-slate-500 mt-1">Las palabras entre paréntesis son opcionales; / separa respuestas alternativas.</p>
                                  )}
                                </>
                              )}
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
