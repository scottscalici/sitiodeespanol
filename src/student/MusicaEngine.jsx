import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const MusicaEngine = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Store student answers
  const [clozeAnswers, setClozeAnswers] = useState({});
  const [compAnswers, setCompAnswers] = useState({});

  useEffect(() => {
    const fetchSong = async () => {
      try {
        console.log("Intentando buscar la canción con ID:", id);
        
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

  const handleSubmit = () => {
    // In Phase 4, this will push to a 'student_submissions' Firestore collection
    console.log("Cloze Answers:", clozeAnswers);
    console.log("Comprehension Answers:", compAnswers);
    alert("¡Respuestas enviadas al Señor Scalici!");
    navigate('/dashboard'); 
  };

  // --- THE DIGITAL CLOZE ENGINE ---
  const renderInteractiveLyrics = (letras) => {
    if (!letras) return null;
    
    // Split the string by anything in brackets
    const parts = letras.split(/(\[.*?\])/g);
    let blankCounter = 0;

    return (
      <div className="whitespace-pre-wrap text-lg leading-loose font-medium text-slate-700">
        {parts.map((part, index) => {
          if (part.startsWith('[') && part.endsWith(']')) {
            const currentIndex = blankCounter++;
            return (
              <span key={index} className="inline-block relative">
                <span className="absolute -top-3 -left-2 text-[9px] font-black text-sky-400">{currentIndex + 1}</span>
                <input
                  type="text"
                  value={clozeAnswers[currentIndex] || ''}
                  onChange={(e) => handleClozeChange(currentIndex, e.target.value)}
                  className="mx-1 border-b-2 border-sky-300 bg-sky-50/50 outline-none px-2 text-center font-bold text-sky-800 w-32 focus:bg-sky-100 focus:border-sky-500 transition-colors"
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

  if (loading) {
    return <div className="min-h-screen bg-slate-100 flex items-center justify-center font-bold text-slate-400 uppercase tracking-widest">Cargando Misión...</div>;
  }

  if (!song) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center space-y-4 p-6 text-center">
        <div className="font-bold text-rose-500 uppercase tracking-widest">Misión Fallida</div>
        <div className="text-slate-600 bg-white p-4 rounded-lg border border-slate-200 shadow-sm font-mono text-sm max-w-lg">
          {errorMsg || "Error desconocido."}
        </div>
        <button onClick={() => navigate('/dashboard')} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold mt-4 hover:bg-slate-700">
          Volver al Dashboard
        </button>
      </div>
    );
  }

  const ytId = getYouTubeId(song.youtube_url);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      
      {/* HEADER */}
      <div className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-slate-400 hover:text-white font-bold text-xs uppercase tracking-widest transition-colors"
          >
            ← Volver al Dashboard
          </button>
          <span className="bg-sky-500/20 text-sky-400 border border-sky-500/50 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
            Misión de Música
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-6 mt-6">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          
          <div className="p-6 md:p-8 border-b border-slate-100">
            <h1 className="text-3xl md:text-4xl font-black text-slate-800">{song.titulo}</h1>
            <p className="text-slate-400 mt-1 text-lg font-bold">{song.artista}</p>
          </div>

          <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
            
            {/* LEFT COLUMN: Media & Comprehension */}
            <div className="space-y-8">
              {ytId && (
                <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-md bg-black">
                  <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${ytId}`} title="YouTube" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                </div>
              )}

              {song.preguntas && song.preguntas.length > 0 && (
                <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200">
                  <h3 className="font-black text-amber-600 uppercase tracking-widest text-sm mb-4">Preguntas de Comprensión</h3>
                  <div className="space-y-6">
                    {song.preguntas.map((p, idx) => (
                      <div key={idx}>
                        <p className="font-bold text-slate-800 mb-2">{idx + 1}. {p.q}</p>
                        <textarea
                          value={compAnswers[idx] || ''}
                          onChange={(e) => handleCompChange(idx, e.target.value)}
                          placeholder="Escribe tu respuesta aquí..."
                          className="w-full p-3 rounded-xl border border-amber-300 bg-white outline-none focus:ring-2 focus:ring-amber-400 resize-none h-20 text-sm font-medium text-slate-700"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Interactive Cloze */}
            <div>
              <h3 className="font-black text-sky-600 uppercase tracking-widest text-sm mb-4 border-b border-sky-100 pb-2">Completa las letras</h3>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 h-full">
                {renderInteractiveLyrics(song.letras)}
              </div>
            </div>

          </div>

          {/* SUBMIT BUTTON */}
          <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end">
            <button 
              onClick={handleSubmit}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm shadow-md transition-transform hover:scale-105"
            >
              Enviar Respuestas
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default MusicaEngine;