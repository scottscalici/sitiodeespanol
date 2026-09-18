import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { awardPoints } from '../utils/pointsHelper';

const normalize = (str) =>
  (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

const getBlankAnswers = (letras) => {
  if (!letras || typeof letras !== 'string') return [];
  const matches = letras.match(/\[(.*?)\]/g) || [];
  return matches.map((m) => m.slice(1, -1));
};

const MusicaEngine = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Store student answers
  const [clozeAnswers, setClozeAnswers] = useState({});
  const [compAnswers, setCompAnswers] = useState({});
  const pointsAwardedRef = useRef(false);

  useEffect(() => {
    const fetchSong = async () => {
      try {
        const docRef = doc(db, 'musica', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setSong({ id: docSnap.id, ...docSnap.data() });
        } else {
          setErrorMsg(`El documento con ID "${id}" no existe en la base de datos.`);
        }
      } catch (error) {
        console.error("Error fetching song:", error);
        setErrorMsg(`Error de Firebase: ${error.message}`); 
      } finally {
        setLoading(false);
      }
    };

    fetchSong();
  }, [id]);

  const handleClozeChange = (index, value) => {
    setClozeAnswers(prev => ({ ...prev, [index]: value }));
  };

  const handleCompChange = (index, value) => {
    setCompAnswers(prev => ({ ...prev, [index]: value }));
  };

  const handleSubmit = async () => {
    const blankAnswers = getBlankAnswers(song?.letras);
    const correctCount = blankAnswers.filter(
      (ans, i) => normalize(clozeAnswers[i]) === normalize(ans)
    ).length;

    if (currentUser && !pointsAwardedRef.current) {
      pointsAwardedRef.current = true;
      try {
        await awardPoints(currentUser.uid, song?.totalPoints || 0);
      } catch (error) {
        console.error('Error awarding music points:', error);
      }
    }

    const scoreMsg = blankAnswers.length > 0
      ? `Completaste ${correctCount}/${blankAnswers.length} espacios correctamente. `
      : '';
    alert(`${scoreMsg}¡Respuestas enviadas! (+${song?.totalPoints || 0} puntos)`);
    navigate('/');
  };

  // --- THE DIGITAL CLOZE ENGINE ---
  const renderInteractiveLyrics = (letras) => {
    if (!letras || typeof letras !== 'string') return null;

    const parts = letras.split(/(\[.*?\])/g);
    let blankCounter = 0;

    return (
      <div className="whitespace-pre-wrap text-lg leading-loose font-medium text-slate-200">
        {parts.map((part, index) => {
          if (part.startsWith('[') && part.endsWith(']')) {
            const currentIndex = blankCounter++;
            return (
              <span key={index} className="inline-block relative my-1">
                <span className="absolute -top-3 left-1 text-[9px] font-black text-emerald-400 font-mono">[{currentIndex + 1}]</span>
                <input
                  type="text"
                  value={clozeAnswers[currentIndex] || ''}
                  onChange={(e) => handleClozeChange(currentIndex, e.target.value)}
                  className="mx-1.5 border-b-2 border-emerald-500 bg-emerald-950/40 outline-none px-3 py-0.5 text-center font-bold text-emerald-300 w-32 focus:bg-emerald-900/60 focus:border-emerald-400 rounded transition-all text-base"
                  autoComplete="off"
                />
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </div>
    );
  };
  
  const getYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    return match ? match[1] : null;
  };

  const getSpotifyId = (url) => {
    if (!url) return null;
    const match = url.match(/track\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center font-bold text-emerald-400 uppercase tracking-widest animate-pulse">Cargando Misión de Música...</div>;
  }

  if (!song) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 p-6 text-center text-white">
        <div className="font-bold text-rose-500 uppercase tracking-widest">Misión Fallida</div>
        <div className="text-slate-400 bg-neutral-900 p-4 rounded-xl border border-neutral-800 font-mono text-sm max-w-lg">
          {errorMsg || "Error desconocido."}
        </div>
        <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold mt-4 hover:bg-emerald-500 transition-colors uppercase text-xs tracking-widest">
          Volver al Dashboard
        </button>
      </div>
    );
  }

  const ytId = getYouTubeId(song.youtube_url);
  const spotId = getSpotifyId(song.spotify_url);
  const albumImage = song.imagen || song.img;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-24">
      
      {/* SPOTIFY-STYLE TOP NAV BAR */}
      <div className="bg-slate-950/80 backdrop-blur-md border-b border-neutral-800 p-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <button 
            onClick={() => navigate('/')}
            className="text-neutral-400 hover:text-white font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2"
          >
            <span>←</span> Volver al Dashboard
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">
              Spotify Audio Experience
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-8 mt-4 space-y-8">
        
        {/* SPOTIFY HERO HEADER */}
        <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 rounded-3xl p-6 sm:p-10 border border-neutral-800 shadow-2xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
          
          {/* Subtle Ambient Glow Behind Album Art */}
          {albumImage && (
            <div className="absolute -left-20 -top-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          )}

          {/* Album Cover Art */}
          {albumImage ? (
            <div className="w-48 h-48 sm:w-60 sm:h-60 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-neutral-700 bg-neutral-900">
              <img src={albumImage} alt={song.titulo} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-48 h-48 sm:w-60 sm:h-60 shrink-0 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-5xl shadow-2xl">
              🎵
            </div>
          )}

          {/* Track Metadata */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-3 flex-1">
            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Misión de Música
              </span>
              {song.course && song.course.map((c, i) => (
                <span key={i} className="bg-neutral-800 text-neutral-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {c.toUpperCase()}
                </span>
              ))}
            </div>
            
            <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-white">
              {song.titulo}
            </h1>
            <p className="text-xl sm:text-2xl font-bold text-neutral-400 italic">
              {song.artista}
            </p>
          </div>
        </div>

        {/* MEDIA ROW: VIDEO + SPOTIFY */}
        {(ytId || spotId) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ytId && (
              <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 bg-black">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${ytId}`}
                  title="YouTube"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            )}

            {spotId && (
              <div className="w-full rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 flex items-center bg-neutral-900">
                <iframe
                  src={`https://open.spotify.com/embed/track/${spotId}`}
                  width="100%"
                  height="152"
                  frameBorder="0"
                  allowtransparency="true"
                  allow="encrypted-media"
                ></iframe>
              </div>
            )}
          </div>
        )}

        {/* INTERACTIVE CLOZE LYRICS — FULL WIDTH */}
        <div className="bg-neutral-900/80 border border-neutral-800 p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
          <h3 className="font-black text-emerald-400 uppercase tracking-widest text-xs border-b border-neutral-800 pb-3 flex items-center justify-between">
            <span className="flex items-center gap-2"><span>📝</span> Completa las Letras</span>
            <span className="text-[10px] text-neutral-500 font-mono">Modo Interactivo</span>
          </h3>
          <div className="bg-neutral-950/60 p-6 sm:p-8 rounded-2xl border border-neutral-800/80">
            {renderInteractiveLyrics(song.letras)}
          </div>
        </div>

        {/* COMPREHENSION QUESTIONS — FULL WIDTH */}
        {song.preguntas && song.preguntas.length > 0 && (
          <div className="bg-neutral-900/80 border border-neutral-800 p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
            <h3 className="font-black text-amber-400 uppercase tracking-widest text-xs flex items-center gap-2 border-b border-neutral-800 pb-3">
              <span>🤔</span> Preguntas de Comprensión
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {song.preguntas.map((p, idx) => (
                <div key={idx} className="space-y-2">
                  <p className="font-bold text-sm text-slate-200">{idx + 1}. {p.q}</p>
                  <textarea
                    value={compAnswers[idx] || ''}
                    onChange={(e) => handleCompChange(idx, e.target.value)}
                    placeholder="Escribe tu respuesta aquí..."
                    className="w-full p-3 rounded-xl border border-neutral-800 bg-neutral-950 text-white outline-none focus:border-amber-500 resize-none h-24 text-xs font-medium transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBMIT BUTTON */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            Enviar Respuestas →
          </button>
        </div>

      </div>
    </div>
  );
};

export default MusicaEngine;