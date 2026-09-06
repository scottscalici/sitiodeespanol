import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGymData } from '../hooks/useGymData';
import Eslabones from './Eslabones'; 

const ActivityPage = () => {
  const { type, id } = useParams();
  const { data, loading } = useGymData();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse font-bold text-slate-400 uppercase tracking-widest">
          Cargando Actividad...
        </div>
      </div>
    );
  }

  const activityData = data?.activities?.find(act => String(act.id) === String(id));

  if (!activityData) {
    return (
      <div className="min-h-screen p-8 text-center bg-slate-50 flex flex-col items-center justify-center">
        <h2 className="text-2xl font-black text-slate-800 mb-4">Actividad no encontrada</h2>
        <Link to="/" className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-widest">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8">
        
        <Link to="/" className="text-indigo-600 font-bold mb-8 inline-flex items-center gap-2 hover:text-indigo-800 transition-colors group">
          <span className="text-xl leading-none group-hover:-translate-x-1 transition-transform">←</span> 
          Volver al Dashboard
        </Link>

        {/* 🔀 THE TRAFFIC COP */}
        {type === 'conversacion' && <ConversacionLayout activity={activityData} />}
        {type === 'eslabones' && <Eslabones gameData={activityData.raw} />}
        {type === 'video' && <VideoLayout activity={activityData} />}
        {type === 'musica' && <MusicaLayout activity={activityData} />}
        {type === 'lectura' && <LecturaLayout activity={activityData} />}
        {type === 'cultura' && <CulturaLayout activity={activityData} />}

        {/* Fallback for anything else we haven't built yet */}
        {type !== 'conversacion' && type !== 'eslabones' && type !== 'video' && type !== 'musica' && type !== 'lectura' && type !== 'cultura' && (
          <DefaultLayout activity={activityData} />
        )}

      </div>
    </div>
  );
};

// --- LAYOUT: MÚSICA 🎵 ---
const MusicaLayout = ({ activity }) => {
  const { raw } = activity;
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
      {/* Media Header */}
      <div className="relative h-72 bg-slate-900 overflow-hidden">
        {activity.img && (
          <img src={activity.img} alt={activity.title} className="absolute inset-0 w-full h-full object-cover opacity-50 blur-sm scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
        
        <div className="absolute bottom-0 left-0 p-8 flex items-end gap-6 w-full">
          {activity.img && (
            <img src={activity.img} alt="Cover" className="w-32 h-32 rounded-xl shadow-2xl border-2 border-white/10 hidden sm:block object-cover" />
          )}
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-white bg-pink-600 px-3 py-1 rounded-full mb-3 inline-block shadow-md">
              Misión de Música
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight mb-1">
              {activity.title}
            </h1>
            {raw.artista && (
              <p className="text-xl text-pink-200 font-bold italic">{raw.artista}</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Content & Player */}
      <div className="p-6 md:p-8">
        {/* If the music file includes a YouTube embed URL */}
        {activity.url && (
          <div className="relative w-full max-w-3xl mx-auto bg-slate-900 rounded-xl overflow-hidden mb-8 shadow-lg" style={{ paddingTop: '45%' }}> 
            <iframe
              className="absolute top-0 left-0 w-full h-full"
              src={activity.url} 
              title={activity.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        )}
        
        {activity.subtitle && (
          <div className="bg-pink-50 p-6 rounded-xl border border-pink-100 mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-pink-500 mb-2">Contexto</h3>
            <p className="text-lg text-slate-700 font-medium leading-relaxed">{activity.subtitle}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- LAYOUT: LECTURA 📖 ---
const LecturaLayout = ({ activity }) => {
  const { raw } = activity;
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in max-w-4xl mx-auto">
      {/* Book-style Header */}
      <div className="p-8 md:p-12 border-b border-slate-100 bg-amber-50/30">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
            Lectura
          </span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Día {raw.dia || "TBD"}
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-800 leading-tight tracking-tight mb-4">
          {activity.title}
        </h1>
        {activity.subtitle && (
          <p className="text-xl text-slate-500 font-medium">{activity.subtitle}</p>
        )}
      </div>
      
      {activity.img && (
        <div className="w-full h-64 md:h-96 bg-slate-100">
          <img src={activity.img} alt={activity.title} className="w-full h-full object-cover" />
        </div>
      )}
      
      {/* Reading Text Container */}
      <div className="p-8 md:p-12">
        <div className="prose prose-lg prose-amber max-w-none">
          {/* Note: Update this safely if your Firestore JSON stores the reading text in a specific field like raw.texto */}
          {raw.texto ? (
            <p className="text-slate-700 leading-relaxed font-medium text-lg whitespace-pre-wrap">{raw.texto}</p>
          ) : (
            <div className="bg-slate-50 p-6 rounded-lg text-center border border-slate-100">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Texto pendiente</p>
              <p className="text-slate-500 text-sm">El texto de esta lectura aún no se ha mapeado a la interfaz.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- LAYOUT: CULTURA 🌍 ---
const CulturaLayout = ({ activity }) => {
  const { raw } = activity;
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
      {/* Magazine-style Hero Image */}
      {activity.img && (
        <div className="relative h-72 md:h-96 w-full bg-slate-900">
          <img src={activity.img} alt={activity.title} className="w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
          <div className="absolute bottom-0 left-0 p-8 w-full">
            <span className="text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 px-3 py-1 rounded-full mb-3 inline-block shadow-md">
              Cultura & Curiosidades
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight tracking-tight max-w-3xl">
              {activity.title}
            </h1>
          </div>
        </div>
      )}
      
      <div className="p-8 md:p-10">
        {/* Fallback header if no image exists */}
        {!activity.img && (
          <div className="mb-8 border-b border-slate-100 pb-8">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full mb-3 inline-block border border-emerald-200">
              Cultura & Curiosidades
            </span>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight">{activity.title}</h1>
          </div>
        )}
        
        <p className="text-xl text-slate-700 font-medium leading-relaxed max-w-4xl">
          {activity.subtitle}
        </p>

        {/* Dynamic content if stored in raw.contenido */}
        {raw.contenido && (
          <div className="mt-8 prose prose-emerald max-w-none">
             <p className="text-slate-600 text-lg leading-relaxed">{raw.contenido}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- LAYOUT: VIDEO 🎬 ---
const VideoLayout = ({ activity }) => {
  const { raw } = activity;
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
      <div className="relative w-full bg-slate-900" style={{ paddingTop: '56.25%' }}> 
        <iframe
          className="absolute top-0 left-0 w-full h-full"
          src={activity.url} 
          title={activity.title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
      
      <div className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-white bg-red-600 px-3 py-1 rounded-full">
            {raw.is_short ? "Cortometraje" : "Video"}
          </span>
          {raw.isNew && (
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
              Nuevo
            </span>
          )}
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Día {raw.dia}
          </span>
        </div>
        
        <h1 className="text-3xl md:text-4xl font-black text-slate-800 leading-tight mb-4">
          {activity.title}
        </h1>
        
        {activity.subtitle && (
          <p className="text-lg text-slate-600 leading-relaxed max-w-3xl">
            {activity.subtitle}
          </p>
        )}

        {raw.internal_notes && (
          <div className="mt-8 p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-lg">
            <p className="text-xs font-black text-indigo-800 uppercase tracking-widest mb-1">Nota Interna:</p>
            <p className="text-sm font-medium text-indigo-900">{raw.internal_notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- LAYOUT: CONVERSACIÓN 🗣️ ---
const ConversacionLayout = ({ activity }) => {
  const { raw } = activity;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
       <div className="md:flex border-b border-slate-100 bg-slate-50/50">
        <div className="md:w-1/3 shrink-0">
          <img src={activity.img} alt={activity.title} className="w-full h-48 md:h-full object-cover" />
        </div>
        <div className="p-6 md:p-8 flex flex-col justify-center">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2">{activity.subtitle}</h4>
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 leading-tight">{activity.title}</h1>
        </div>
      </div>
      <div className="p-6 md:p-8">
        {raw.preguntas && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['1', '2', '3'].map(lvl => raw.preguntas[lvl] && (
              <div key={lvl} className={`rounded-xl p-5 border ${lvl === '1' ? 'bg-emerald-50 border-emerald-100' : lvl === '2' ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100'}`}>
                 <h4 className="font-black uppercase text-[10px] tracking-widest mb-4 border-b border-slate-200 pb-2">Nivel {lvl}</h4>
                 <ul className="space-y-3">
                   {raw.preguntas[lvl].map((q, i) => <li key={i} className="text-sm font-medium leading-snug">{q}</li>)}
                 </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- LAYOUT: DEFAULT (Fallback) ⚠️ ---
const DefaultLayout = ({ activity }) => (
  <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
    <h1 className="text-3xl font-black text-slate-800 mb-2">{activity.title}</h1>
    <p className="text-slate-500 font-medium mb-8 text-lg">{activity.subtitle}</p>
    <div className="bg-slate-100 p-4 rounded-lg font-mono text-xs overflow-auto">
      <p className="font-bold text-slate-400 uppercase mb-2">Diseño en construcción para tipo: {activity.type}</p>
      <pre>{JSON.stringify(activity.raw, null, 2)}</pre>
    </div>
  </div>
);

export default ActivityPage;