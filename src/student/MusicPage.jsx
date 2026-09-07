import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase'; //
import { doc, getDoc } from 'firebase/firestore';

const MusicPage = () => {
  const { id } = useParams();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userAnswers, setUserAnswers] = useState({}); // Track student typing

  useEffect(() => {
    const fetchSong = async () => {
      try {
        const docRef = doc(db, "musica", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSong(docSnap.data());
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSong();
  }, [id]);

  // 🟢 The "Cloze Engine" function
  const renderLyrics = () => {
    if (!song.letras?.texto) return null;

    // Split the text by our [[n]] placeholders
    const parts = song.letras.texto.split(/(\[\[\d+\]\])/g);

    return parts.map((part, index) => {
      const match = part.match(/\[\[(\d+)\]\]/);
      
      if (match) {
        const inputIndex = parseInt(match[1]) - 1; // e.g., [[1]] becomes index 0
        return (
          <input
            key={index}
            type="text"
            className="border-b-2 border-slate-300 bg-emerald-50 px-2 mx-1 w-24 outline-none focus:border-emerald-500 font-bold text-emerald-800 transition-all"
            onChange={(e) => {
              setUserAnswers({ ...userAnswers, [inputIndex]: e.target.value });
            }}
          />
        );
      }
      // Return regular text line-by-line
      return <span key={index}>{part}</span>;
    });
  };

  if (loading) return <div className="p-20 text-center">Cargando...</div>;
  if (!song) return <div className="p-20 text-center">No se encontró la canción.</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-10">
      <header className="text-center space-y-2">
        <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-800">{song.titulo}</h1>
        <p className="text-xl italic text-slate-500">{song.artista}</p>
      </header>

      {/* 🎬 Video Section */}
      <div className="aspect-video shadow-2xl rounded-2xl overflow-hidden">
        <iframe 
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${song.video.id}`}
          title="YouTube video"
          allowFullScreen
        ></iframe>
      </div>

      {/* 📝 Interactive Lyrics Section */}
      {song.letras && (
        <section className="bg-white rounded-2xl shadow-lg p-8 border-l-8 border-emerald-500">
          <h2 className="text-2xl font-bold mb-6 text-emerald-700 flex items-center gap-2">
            <span>📝</span> Completa la letra
          </h2>
          <div className="whitespace-pre-wrap leading-loose text-lg text-slate-700">
            {renderLyrics()}
          </div>
        </section>
      )}

      {/* 🤔 Questions Section (Placeholder for your MC/Open logic) */}
      {song.preguntas && (
        <section className="bg-white rounded-2xl shadow-lg p-8 border-l-8 border-sky-500">
          <h2 className="text-2xl font-bold mb-6 text-sky-700">🤔 Comprensión</h2>
          <div className="space-y-6">
            {song.preguntas.map((q, idx) => (
              <div key={idx} className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-800">{idx + 1}. {q.q}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default MusicPage;