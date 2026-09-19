import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { parseBlankSentence } from '../utils/sentenceBlanks';

const normalize = (str) =>
  (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

const SampleSentencesPage = () => {
  const { courseId, targetDia } = useParams();
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';

  const [sentences, setSentences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState({});
  const [results, setResults] = useState({});
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const fetchSentences = async () => {
      try {
        const snap = await getDocs(collection(db, 'sentence_sets'));
        const targetDiaNum = Number(targetDia);
        const matchingLines = [];

        snap.forEach((docSnap) => {
          const set = docSnap.data();
          const matches = (set.assignments || []).some(
            (a) => a.course === courseId && Number(a.dia) === targetDiaNum
          );
          if (matches) matchingLines.push(...(set.lines || []));
        });

        setSentences(matchingLines.map(parseBlankSentence));
      } catch (error) {
        console.error('Error loading sample sentences:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSentences();
  }, [courseId, targetDia]);

  const handleCheck = (index) => {
    const sentence = sentences[index];
    const isCorrect = normalize(inputs[index]) === normalize(sentence.answer);
    setResults((prev) => ({ ...prev, [index]: isCorrect ? 'correct' : 'incorrect' }));
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Link to="/" className="text-slate-400 hover:text-white text-sm font-bold flex items-center gap-2">← Volver</Link>
          {isAdmin && (
            <button
              onClick={() => setShowKey((prev) => !prev)}
              className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors ${showKey ? 'bg-amber-500 text-black border-amber-400' : 'bg-slate-800 text-amber-400 border-slate-700'}`}
            >
              👁️ {showKey ? 'Ocultar Respuestas' : 'Ver Respuestas'}
            </button>
          )}
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-black uppercase tracking-tight">Oraciones de Práctica</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">
            {courseId?.toUpperCase()} · Día {targetDia}
          </p>
        </div>

        {sentences.length === 0 ? (
          <p className="text-center text-slate-500 font-bold">No hay oraciones disponibles para hoy.</p>
        ) : (
          <div className="space-y-4">
            {sentences.map((sentence, index) => {
              if (!sentence.answer) {
                return (
                  <div key={index} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
                    <p className="text-slate-300 leading-relaxed italic">{sentence.display}</p>
                  </div>
                );
              }

              const [before, after] = sentence.display.split('_____');
              const result = results[index];

              return (
                <div key={index} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                  <p className="text-slate-200 leading-relaxed">
                    {before}
                    <input
                      type="text"
                      value={inputs[index] || ''}
                      onChange={(e) => setInputs((prev) => ({ ...prev, [index]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleCheck(index)}
                      className={`mx-1 w-32 sm:w-40 bg-slate-950 border-b-2 text-center font-bold text-white px-2 py-1 outline-none transition-colors ${
                        result === 'correct' ? 'border-emerald-500' : result === 'incorrect' ? 'border-rose-500' : 'border-slate-600 focus:border-teal-400'
                      }`}
                    />
                    {after}
                  </p>

                  {showKey && (
                    <p className="text-amber-400 text-xs font-bold mt-2">Respuesta: {sentence.answer}</p>
                  )}

                  <div className="flex justify-between items-center mt-3">
                    <button
                      onClick={() => handleCheck(index)}
                      className="bg-teal-600 hover:bg-teal-500 text-white font-black text-[11px] px-4 py-2 rounded-lg uppercase tracking-wider transition-colors"
                    >
                      Revisar
                    </button>
                    {result === 'correct' && <span className="text-emerald-400 font-black text-sm">✓ Correcto</span>}
                    {result === 'incorrect' && <span className="text-rose-400 font-black text-sm">✗ Intenta de nuevo</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SampleSentencesPage;