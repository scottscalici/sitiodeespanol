import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { parseBlankSentence } from '../utils/sentenceBlanks';

const SampleSentencesPage = () => {
  const { courseId, targetDia } = useParams();
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';

  const [sentences, setSentences] = useState([]);
  const [title, setTitle] = useState('Oraciones');
  const [loading, setLoading] = useState(true);
  // Students write these out on paper — there's no input/grading here by
  // design (too many valid phrasings to ever reduce to one exact-match
  // answer, e.g. "quiero estudiar" vs "quiero que tú estudies"). Only the
  // teacher can reveal an example answer, one sentence at a time, while
  // going over it with the class.
  const [revealed, setRevealed] = useState({});

  useEffect(() => {
    const fetchSentences = async () => {
      try {
        const snap = await getDocs(collection(db, 'sentence_sets'));
        const targetDiaNum = Number(targetDia);
        const matchingLines = [];
        let firstTitle = null;

        snap.forEach((docSnap) => {
          const set = docSnap.data();
          const matches = (set.assignments || []).some(
            (a) => a.course === courseId && Number(a.dia) === targetDiaNum
          );
          if (matches) {
            matchingLines.push(...(set.lines || []));
            if (firstTitle == null) firstTitle = set.title || '';
          }
        });

        if (firstTitle) setTitle(firstTitle);
        setSentences(matchingLines.map(parseBlankSentence));
      } catch (error) {
        console.error('Error loading sample sentences:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSentences();
  }, [courseId, targetDia]);

  const toggleReveal = (index) => setRevealed((prev) => ({ ...prev, [index]: !prev[index] }));

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Link to="/" className="text-slate-400 hover:text-white text-sm font-bold flex items-center gap-2">← Volver</Link>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-black uppercase tracking-tight">{title}</h1>
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
              const isRevealed = revealed[index];

              return (
                <div key={index} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                  <p className="text-slate-200 leading-relaxed">
                    {before}
                    <span className="mx-1 inline-block w-32 sm:w-40 border-b-2 border-slate-600 align-bottom">&nbsp;</span>
                    {after}
                  </p>

                  {isAdmin && (
                    <div className="mt-3 pt-3 border-t border-slate-700/60">
                      <button
                        onClick={() => toggleReveal(index)}
                        className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-[10px] font-black uppercase tracking-widest"
                      >
                        <span className={`transition-transform ${isRevealed ? 'rotate-90' : ''}`}>▶</span>
                        {isRevealed ? 'Ocultar respuesta' : 'Ver respuesta'}
                      </button>
                      {isRevealed && (
                        <p className="text-amber-400 text-xs font-bold mt-2">Respuesta: {sentence.answer}</p>
                      )}
                    </div>
                  )}
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
