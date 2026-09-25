import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { awardPoints } from '../utils/pointsHelper';
import { checkAnswerLeniently } from '../utils/checkAnswer';
import { playAudio } from '../utils/playAudio';

// A small, focused graded practice (e.g. Gustar, prepositional pronouns) —
// unlike Calentamiento (verb-conjugation tables) or WorkoutEngine's
// retry-until-correct Learning Path questions, each question here is
// checked once and the grade reflects first-attempt accuracy, matching how
// a calentamiento's own grade is a first-attempt score. Its grade is folded
// into the SAME "Promedio Calentamientos" average students and teachers
// already see (see src/utils/warmupBreakdown.js), and completing it for the
// first time awards its point value as ordinary XP.
export default function PracticeCardEngine({ onClose }) {
  const { courseId, targetDia } = useParams();
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [errors, setErrors] = useState([]);
  const [finished, setFinished] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [pointsAwarded, setPointsAwarded] = useState(0);

  useEffect(() => {
    if (!targetDia || !courseId) return;
    const fetchCard = async () => {
      try {
        const formattedCourse = String(courseId).toLowerCase();
        const targetDiaNum = Number(targetDia);
        const q = query(
          collection(db, 'practice_cards'),
          where('dia', '==', targetDiaNum),
          where('course', '==', formattedCourse)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setCardData({ id: snap.docs[0].id, ...snap.docs[0].data() });
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error('Error loading practice card:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchCard();
  }, [targetDia, courseId]);

  const questions = cardData?.questions || [];
  const currentQ = questions[currentIndex];

  useEffect(() => {
    if (currentQ?.type === 'listen') playAudio(currentQ.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, cardData]);

  const handleClose = () => {
    if (onClose) onClose();
    else navigate('/');
  };

  const handleCheck = () => {
    if (!currentQ) return;
    let correct;
    let studentInput = '';

    if (currentQ.type === 'mc') {
      studentInput = selectedOption || '';
      correct = selectedOption === currentQ.correctAnswer;
    } else {
      studentInput = userAnswer;
      correct = checkAnswerLeniently(userAnswer, currentQ.correctAnswer, false).correct;
    }

    setIsCorrect(correct);
    setIsChecked(true);
    if (correct) {
      setCorrectCount((prev) => prev + 1);
    } else {
      setErrors((prev) => [...prev, { prompt: currentQ.prompt, expected: currentQ.correctAnswer, studentInput }]);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setUserAnswer('');
      setIsChecked(false);
      setIsCorrect(false);
    } else {
      setFinished(true);
    }
  };

  // Auto-save the instant the final screen is reached, same as
  // Calentamiento — no extra click required to lock in a finished session.
  useEffect(() => {
    if (!finished || !cardData) return;

    const save = async () => {
      setSaveState('saving');
      const grade = Math.round((correctCount / questions.length) * 100);
      const rawScore = `${correctCount}/${questions.length}`;
      // Ranking/XP points are a flat value the admin picks directly on the
      // card (typically 1-5) — independent of question count, and
      // independent of the card's grade-pool weight (gradeWeight, used only
      // by warmupBreakdown.js for the classwork average).
      const points = cardData.points || 1;

      try {
        const alreadyCompleted = !!userData?.progress?.practiceCards?.[cardData.id]?.completed;
        const existingGrade = userData?.progress?.practiceCards?.[cardData.id]?.grade ?? -1;
        const isNewHighScore = grade > existingGrade;

        if (userData?.uid && userData.role !== 'admin') {
          if (isNewHighScore) {
            await setDoc(
              doc(db, 'users', userData.uid),
              {
                progress: {
                  practiceCards: {
                    [cardData.id]: { completed: true, grade, rawScore, errors, timestamp: new Date().toISOString() },
                  },
                },
              },
              { merge: true }
            );
          }
          if (!alreadyCompleted) {
            await awardPoints(userData.uid, points);
            setPointsAwarded(points);
          }
        }
        setSaveState('saved');
      } catch (err) {
        console.error('Error saving practice card result:', err);
        setSaveState('error');
      }
    };
    save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, cardData]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 flex items-center justify-center">
        <div className="text-xl font-bold text-slate-500 animate-pulse">Cargando práctica...</div>
      </div>
    );
  }

  if (notFound || questions.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500 font-bold">Práctica no encontrada.</p>
        <button onClick={handleClose} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">Volver</button>
      </div>
    );
  }

  if (finished) {
    const grade = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="text-5xl">{grade >= 70 ? '🎉' : '💪'}</span>
        <h1 className="text-2xl font-black text-slate-800">{cardData.title}</h1>
        <p className="text-4xl font-black text-emerald-600">{grade}%</p>
        <p className="text-slate-500 font-bold">{correctCount}/{questions.length} correctas</p>
        {pointsAwarded > 0 && (
          <p className="text-amber-600 font-black uppercase tracking-widest text-sm">+{pointsAwarded} puntos</p>
        )}
        {saveState === 'error' && (
          <p className="text-rose-500 text-xs font-bold">Hubo un error al guardar. Intenta de nuevo.</p>
        )}
        <button onClick={handleClose} className="mt-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg uppercase tracking-widest text-xs">
          Volver al Panel
        </button>
      </div>
    );
  }

  const progressPercent = Math.round((currentIndex / questions.length) * 100);
  const isButtonDisabled = !isChecked && !selectedOption && !userAnswer.trim();

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col font-sans">
      <div className="flex-none p-4 flex items-center justify-between gap-4 max-w-3xl mx-auto w-full bg-slate-50 z-10">
        <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2 transition-colors">✕</button>
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
          <div className="bg-emerald-500 h-3 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
        </div>
        <span className="text-slate-500 font-black text-sm">{currentIndex + 1}/{questions.length}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start md:justify-center overflow-y-auto p-4 md:p-6 w-full">
        <div className="w-full max-w-3xl mx-auto text-center pb-8">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-6 block">{cardData.title}</span>

          {currentQ.type === 'mc' ? (
            <>
              <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-8">{currentQ.prompt}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {currentQ.options.map((opt, i) => (
                  <button key={i} disabled={isChecked} onClick={() => setSelectedOption(opt)}
                    className={`p-4 rounded-2xl border-2 font-bold text-lg transition-all ${
                      isChecked && opt === currentQ.correctAnswer ? 'bg-emerald-100 border-emerald-500 text-emerald-800' :
                      isChecked && selectedOption === opt && opt !== currentQ.correctAnswer ? 'bg-red-100 border-red-500 text-red-800' :
                      selectedOption === opt ? 'bg-blue-100 border-blue-500 text-blue-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >{opt}</button>
                ))}
              </div>
            </>
          ) : currentQ.type === 'listen' ? (
            <>
              <button onClick={() => playAudio(currentQ.prompt)} className="w-24 h-24 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-4xl shadow-lg mx-auto mb-8 transition-transform active:scale-95">🔊</button>
              <input type="text" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} readOnly={isChecked} placeholder="Escribe lo que escuchaste..."
                className="w-full text-xl p-4 rounded-2xl border-2 text-center bg-white shadow-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
                onKeyDown={(e) => { if (e.key === 'Enter' && !isButtonDisabled) isChecked ? handleNext() : handleCheck(); }} autoFocus />
            </>
          ) : (
            <>
              <h2 className="text-3xl font-black text-slate-800 mb-8">{currentQ.prompt}</h2>
              <input type="text" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} readOnly={isChecked} placeholder="Escribe en español..."
                className="w-full text-xl p-4 rounded-2xl border-2 text-center bg-white shadow-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
                onKeyDown={(e) => { if (e.key === 'Enter' && !isButtonDisabled) isChecked ? handleNext() : handleCheck(); }} autoFocus />
            </>
          )}
        </div>
      </div>

      <div className={`flex-none border-t-2 p-4 md:p-6 transition-colors z-10 ${isChecked ? isCorrect ? 'bg-emerald-100 border-emerald-200' : 'bg-red-100 border-red-200' : 'bg-white border-slate-200'}`}>
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between">
          <div>
            {isChecked && (
              <div className="flex flex-col animate-fade-in">
                <span className={`font-black text-lg ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                  {isCorrect ? '¡Correcto!' : 'Incorrecto'}
                </span>
                {!isCorrect && (
                  <span className="text-red-600 font-bold text-sm">Respuesta: {currentQ.correctAnswer}</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={isChecked ? handleNext : handleCheck}
            disabled={isButtonDisabled}
            className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isChecked ? (isCorrect ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700') : 'bg-blue-600 hover:bg-blue-700'
            } text-white`}
          >
            {isChecked ? (currentIndex < questions.length - 1 ? 'Siguiente' : 'Terminar') : 'Comprobar'}
          </button>
        </div>
      </div>
    </div>
  );
}
