import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const PrintMusica = () => {
  const { id } = useParams();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isStudentMode, setIsStudentMode] = useState(true);

  useEffect(() => {
    const fetchSong = async () => {
      try {
        const docRef = doc(db, 'musica', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSong(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching song for print:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSong();
  }, [id]);

  if (loading) {
    return <div className="p-10 font-bold text-left">Cargando documento para imprimir...</div>;
  }

  if (!song) {
    return <div className="p-10 font-bold text-red-600 text-left">Error: Canción no encontrada.</div>;
  }

  // --- PRINT PARSER ---
  const renderLyrics = () => {
    if (!song.letras) return null;
    let counter = 1;
    const processedText = song.letras.replace(/\[(.*?)\]/g, (match, word) => {
      const currentCount = counter++;
      if (isStudentMode) {
        return `<strong>(${currentCount})</strong> ______________________`;
      } else {
        return `<strong>(${currentCount}) <u>${word}</u></strong>`;
      }
    });
    return <div dangerouslySetInnerHTML={{ __html: processedText.replace(/\n/g, '<br/>') }} />;
  };

  return (
    <div 
      // Added print:p-0 and print:max-w-full to expand to the edges of the paper
      className="min-h-screen bg-white text-black p-8 print:p-0 print:max-w-full mx-auto text-left" 
      style={{ 
        fontFamily: '"Baskerville Old Face", "Libre Baskerville", Georgia, serif',
        maxWidth: '850px' 
      }}
    >
      {/* Floating Action Bar (Hidden when printing) */}
      <div className="print:hidden fixed top-6 right-6 flex gap-3 bg-slate-100 p-3 rounded-xl shadow-lg border border-slate-300 font-sans z-50">
        <div className="flex bg-white rounded-lg overflow-hidden border border-slate-300">
          <button 
            onClick={() => setIsStudentMode(true)}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${isStudentMode ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Estudiante
          </button>
          <button 
            onClick={() => setIsStudentMode(false)}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${!isStudentMode ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Maestro (Clave)
          </button>
        </div>
        <button 
          onClick={() => window.print()}
          className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-colors"
        >
          🖨️ Imprimir
        </button>
      </div>

      {/* WORKSHEET HEADER */}
      {/* Added print:mt-0 to pull the header to the very top of the page */}
      <div className="border-b-2 border-black pb-4 mb-8 print:mt-0 mt-8">
        <div className="flex justify-between items-end mb-4">
          <h1 
            className="text-4xl font-bold" 
            style={{ fontFamily: '"Baskerville Old Face", "Libre Baskerville", Georgia, serif' }}
          >
            {song.titulo}
          </h1>
          <h2 className="text-xl italic text-gray-700">{song.artista}</h2>
        </div>
        <div className="flex justify-between items-center text-lg">
          <p>Nombre: ________________________________</p>
          <p>Fecha: _________________</p>
        </div>
      </div>

      {/* WORKSHEET BODY */}
      <div className="space-y-12">
        
        {/* Lyrics Section */}
        <div className="text-lg leading-loose text-left">
          {renderLyrics()}
        </div>

        {/* Comprehension Section */}
        {song.preguntas && song.preguntas.length > 0 && (
          <div className="text-left mt-8">
            <h3 
              className="text-xl font-bold uppercase tracking-widest border-b border-gray-300 pb-2 mb-4"
              style={{ fontFamily: '"Baskerville Old Face", "Libre Baskerville", Georgia, serif' }}
            >
              Preguntas de Comprensión
            </h3>
            <div className="space-y-8 mt-6">
              {song.preguntas.map((p, idx) => (
                <div key={idx} className="break-inside-avoid">
                  <p className="font-bold text-lg">{idx + 1}. {p.q}</p>
                  {isStudentMode ? (
                    <div className="mt-8 border-b border-gray-400 w-full h-4"></div>
                  ) : (
                    <p className="mt-3 text-lg italic font-bold text-gray-700 bg-gray-100 p-3 rounded">Resp: {p.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default PrintMusica;