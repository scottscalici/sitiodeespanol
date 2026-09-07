import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const MusicaEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [song, setSong] = useState({
    titulo: '',
    artista: '',
    youtube_url: '',
    spotify_url: '',
    letras: '',
    preguntas: [] // Array of { q: '', a: '' }
  });

  useEffect(() => {
    const fetchSong = async () => {
      try {
        const docRef = doc(db, 'musica', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSong({
            titulo: data.titulo || '',
            artista: data.artista || '',
            youtube_url: data.youtube_url || '',
            spotify_url: data.spotify_url || '',
            letras: data.letras || '',
            preguntas: data.preguntas || []
          });
        }
      } catch (error) {
        console.error("Error loading song:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSong();
  }, [id]);

  const handleInputChange = (field, value) => {
    setSong(prev => ({ ...prev, [field]: value }));
  };

  // --- COMPREHENSION QUESTIONS BUILDER ---
  const handleAddQuestion = () => {
    setSong(prev => ({
      ...prev,
      preguntas: [...prev.preguntas, { q: '', a: '' }]
    }));
  };

  const handleUpdateQuestion = (index, field, value) => {
    const updated = [...song.preguntas];
    updated[index][field] = value;
    setSong(prev => ({ ...prev, preguntas: updated }));
  };

  const handleRemoveQuestion = (index) => {
    const updated = song.preguntas.filter((_, i) => i !== index);
    setSong(prev => ({ ...prev, preguntas: updated }));
  };

  // --- URL EXTRACTORS ---
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

  const ytId = getYouTubeId(song.youtube_url);
  const spotId = getSpotifyId(song.spotify_url);

  // --- SAVE LOGIC ---
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'musica', id);
      await updateDoc(docRef, song);
      alert('¡Canción guardada exitosamente!');
    } catch (error) {
      console.error("Error saving song:", error);
      alert('Error al guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- LIVE PREVIEW GENERATOR ---
  const renderPreview = () => {
    if (!song.letras) return <span className="text-slate-400 italic">No hay letras todavía...</span>;
    
    let counter = 1;
    // Replace [bracketed] words with numbered bold text
    const processedText = song.letras.replace(/\[(.*?)\]/g, (match, word) => {
      const currentCount = counter++;
      return `<strong class="text-sky-600 bg-sky-50 px-1 rounded border border-sky-200">(${currentCount}) ${word}</strong>`;
    });

    return <div dangerouslySetInnerHTML={{ __html: processedText.replace(/\n/g, '<br/>') }} />;
  };

  if (loading) return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando Editor...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans pb-20">
      <div className="max-w-[1400px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* HEADER */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center z-10 shadow-sm gap-4">
          <div>
            <button onClick={() => navigate('/admin-daily-plan-musica')} className="text-sky-600 font-bold text-xs uppercase tracking-widest hover:text-sky-800 mb-2 block">
              ← Volver al Manager
            </button>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              {song.titulo || 'Nueva Canción'} 
              <span className="bg-slate-100 text-slate-400 text-[10px] uppercase px-2 py-1 rounded-md">{id}</span>
            </h1>
          </div>
          
          <div className="flex gap-3">
            <Link 
              to={`/print-musica/${id}`} 
              target="_blank"
              className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-colors shadow-sm flex items-center gap-2"
            >
              <span>🖨️</span> Imprimir
            </Link>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-colors disabled:opacity-50 shadow-sm"
            >
              {isSaving ? 'Guardando...' : 'Guardar Canción'}
            </button>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT COLUMN: Metadata, Media, & Questions */}
          <div className="space-y-8">
            
            {/* Metadata */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Detalles de la Canción</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Título</label>
                  <input type="text" value={song.titulo} onChange={(e) => handleInputChange('titulo', e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 font-bold text-slate-800" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Artista</label>
                  <input type="text" value={song.artista} onChange={(e) => handleInputChange('artista', e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 font-bold text-slate-800" />
                </div>
              </div>
            </div>

            {/* Media Extractors */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex justify-between">
                <span>Enlaces Multimedia</span>
                <span className="text-sky-500 font-mono text-[9px] lowercase">Auto-extracción activada</span>
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">YouTube URL</label>
                  <input type="text" value={song.youtube_url} onChange={(e) => handleInputChange('youtube_url', e.target.value)} placeholder="https://youtube.com/watch?v=..." className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs text-slate-600 mb-2" />
                  {ytId && (
                    <div className="aspect-video w-full max-w-[300px] rounded-lg overflow-hidden border border-slate-300 shadow-sm bg-black">
                      <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${ytId}`} title="YouTube preview" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 mt-4">Spotify URL</label>
                  <input type="text" value={song.spotify_url} onChange={(e) => handleInputChange('spotify_url', e.target.value)} placeholder="https://open.spotify.com/track/..." className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs text-slate-600 mb-2" />
                  {spotId && (
                    <div className="w-full max-w-[300px] h-[80px] rounded-lg overflow-hidden border border-slate-300 shadow-sm">
                      <iframe src={`https://open.spotify.com/embed/track/${spotId}`} width="100%" height="100%" frameBorder="0" allowtransparency="true" allow="encrypted-media"></iframe>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Comprehension Questions */}
            <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-black text-amber-600 uppercase tracking-widest">Preguntas de Comprensión</h2>
                <button onClick={handleAddQuestion} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm">+ Añadir</button>
              </div>
              
              <div className="space-y-3">
                {song.preguntas.length === 0 && <p className="text-amber-700/50 text-xs italic font-bold">No hay preguntas generadas.</p>}
                
                {song.preguntas.map((p, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-xl border border-amber-200 flex gap-3 relative group">
                    <span className="text-amber-400 font-black mt-2">{idx + 1}.</span>
                    <div className="flex-1 space-y-2">
                      <input type="text" value={p.q} onChange={(e) => handleUpdateQuestion(idx, 'q', e.target.value)} placeholder="Pregunta (Español)" className="w-full p-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-800" />
                      <input type="text" value={p.a} onChange={(e) => handleUpdateQuestion(idx, 'a', e.target.value)} placeholder="Respuesta Esperada" className="w-full p-2 rounded-lg border border-slate-200 text-sm italic text-slate-600 bg-slate-50" />
                    </div>
                    <button onClick={() => handleRemoveQuestion(idx)} className="text-rose-400 hover:text-rose-600 font-bold self-start mt-2 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Lyrics Cloze Editor */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col h-full min-h-[600px]">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Generador Cloze (Letras)</h2>
            <p className="text-[10px] text-slate-500 mb-4 bg-white p-2 rounded border border-slate-200 shadow-sm">
              Envuelve las palabras en corchetes para crear espacios en blanco. <br/>
              Ejemplo: <code className="text-sky-600 font-bold">Quiero respirar tu [cuello] despacito.</code>
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              {/* Raw Input */}
              <div className="flex flex-col h-full">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Editor de Letras</label>
                <textarea 
                  value={song.letras} 
                  onChange={(e) => handleInputChange('letras', e.target.value)}
                  className="w-full flex-1 min-h-[400px] p-4 rounded-xl border border-slate-300 font-mono text-xs leading-relaxed text-slate-700 outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                  placeholder="Pega las letras aquí..."
                />
              </div>

              {/* Live Preview */}
              <div className="flex flex-col h-full">
                <label className="block text-[10px] font-black text-sky-500 uppercase mb-1">Vista Previa (Clave del Maestro)</label>
                <div className="w-full flex-1 min-h-[400px] p-4 rounded-xl border border-sky-200 bg-white font-sans text-sm leading-relaxed text-slate-800 overflow-y-auto shadow-inner">
                  {renderPreview()}
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default MusicaEditor;