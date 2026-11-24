import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useActiveTheme } from '../context/ThemeContext';
import { parseHeaderGradientStyle } from '../utils/parseHeaderGradient';
import { parseBlankSentence } from '../utils/sentenceBlanks';

const SampleSentencesPage = () => {
  const { courseId, targetDia } = useParams();
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const { theme } = useActiveTheme();
  const pageBgClass = theme?.styles?.pageBackground || 'bg-slate-900';
  const pageBgStyle = parseHeaderGradientStyle(pageBgClass);

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
    <div
      className={`min-h-screen text-white p-4 sm:p-8 font-sans relative overflow-hidden ${pageBgStyle ? '' : pageBgClass}`}
      style={pageBgStyle || undefined}
    >
      {/* Optional full-page photo background, with a dark overlay so text
          stays readable over it — same theme field RecreoHub/Dashboard use. */}
      {theme?.styles?.pageBackgroundImage?.url && (
        <div
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: `url("${theme.styles.pageBackgroundImage.url}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: theme.styles.pageBackgroundImage.overlayColor || '#000000',
              opacity: theme.styles.pageBackgroundImage.overlayOpacity ?? 0.5,
            }}
          />
        </div>
      )}
      {/* Site-wide decorative texture — same theme field as Dashboard.jsx's. */}
      {theme?.styles?.bgTexture && (
        <div
          className="fixed inset-0 pointer-events-none z-[1]"
          style={{ backgroundImage: `url("${theme.styles.bgTexture}")`, backgroundRepeat: 'repeat', opacity: 0.06 }}
        />
      )}

      <div className="max-w-2xl mx-auto space-y-3 relative z-10">
        <div className="flex justify-between items-center">
          <Link to="/" className="text-slate-400 hover:text-white text-sm font-bold flex items-center gap-2">← Volver</Link>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 sm:p-6">
          <span
            className="inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-2"
            style={{ color: 'var(--accent, #fbbf24)', backgroundColor: 'rgba(251,191,36,0.12)' }}
          >
            Actividad
          </span>
          <h1 className="text-xl font-black uppercase tracking-tight">{title}</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1 mb-4">
            {courseId?.toUpperCase()} · Día {targetDia}
          </p>

          {sentences.length === 0 ? (
            <p className="text-slate-500 font-bold text-sm">No hay oraciones disponibles para hoy.</p>
          ) : (
            <div className="space-y-2">
              {sentences.map((sentence, index) => {
                if (!sentence.answer) {
                  return (
                    <p key={index} className="text-slate-300 text-sm italic leading-snug">
                      &ldquo;{sentence.display}&rdquo;
                    </p>
                  );
                }

                const [before, after] = sentence.display.split('_____');
                const isRevealed = revealed[index];

                return (
                  <div key={index} className="flex items-start justify-between gap-3">
                    <p className="text-slate-300 text-sm italic leading-snug flex-1">
                      &ldquo;{before}
                      <span className="mx-1 inline-block w-16 sm:w-24 border-b-2 border-slate-600 align-bottom">&nbsp;</span>
                      {after}&rdquo;
                    </p>
                    {isAdmin && (
                      <button
                        onClick={() => toggleReveal(index)}
                        className="shrink-0 text-xs font-black hover:opacity-80 transition-opacity not-italic"
                        style={{ color: 'var(--accent, #fbbf24)' }}
                      >
                        {isRevealed ? sentence.answer : '👁️'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SampleSentencesPage;
