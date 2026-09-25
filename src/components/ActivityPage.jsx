import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGymData } from '../hooks/useGymData';
import { useAuth } from '../context/AuthContext';
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
        {type === 'practica' && <PracticaLayout activity={activityData} />}

        {/* Fallback for anything else we haven't built yet */}
        {type !== 'conversacion' && type !== 'eslabones' && type !== 'video' && type !== 'musica' && type !== 'lectura' && type !== 'cultura' && type !== 'practica' && (
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
              Música
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
const formatConvTime = (s) => {
  const sign = s < 0 ? '-' : '';
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  return `${sign}${m}:${sec.toString().padStart(2, '0')}`;
};

const pickRandomQuestion = (pool) => pool[Math.floor(Math.random() * pool.length)];

const TeacherOnlyBadge = () => (
  <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full ml-2">
    🔒 Solo profesor
  </span>
);

const ConversacionLayout = ({ activity }) => {
  const { raw } = activity;
  const { userData } = useAuth();
  const isS4 = userData?.course === 's4';
  const isAdmin = userData?.role === 'admin';
  const canSee = (field) => isAdmin || !!raw.visibilidad?.[field];

  const baseSegments = (raw.presentation_segments || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
  const basePrep = raw.prep_seconds ?? 0;
  const isOpenFormat = basePrep === 0 && baseSegments.length === 0;

  const [simMode, setSimMode] = useState(false);
  const prepSeconds = simMode ? 900 : basePrep;
  const segments = simMode ? [240] : baseSegments;

  const [phase, setPhase] = useState(isOpenFormat ? 'end' : 'idle'); // idle -> prep -> waitToSpeak -> speak -> end
  const [seconds, setSeconds] = useState(prepSeconds);
  const [segIndex, setSegIndex] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const clearTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const startPrep = () => {
    clearTimer();
    setPhase('prep');
    setSeconds(prepSeconds);
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearTimer();
          setPhase('waitToSpeak');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startSpeak = () => {
    clearTimer();
    setSegIndex(0);
    setPhase('speak');
    setSeconds(segments[0] ?? 0);
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => prev - 1);
    }, 1000);
  };

  const nextSegment = () => {
    const next = segIndex + 1;
    if (next < segments.length) {
      setSegIndex(next);
      setSeconds(segments[next]);
    } else {
      clearTimer();
      setPhase('end');
    }
  };

  const resetAll = () => {
    clearTimer();
    setSimMode(false);
    setPhase(isOpenFormat ? 'end' : 'idle');
    setSeconds(basePrep);
    setSegIndex(0);
  };

  const startSimulacion = () => {
    setSimMode(true);
    clearTimer();
    setPhase('prep');
    setSeconds(900);
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearTimer();
          setPhase('waitToSpeak');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const spoken = phase === 'speak' ? (segments[segIndex] ?? 0) - seconds : 0;
  const isOvertime = phase === 'speak' && seconds < 0;
  const isOnTarget = phase === 'speak' && spoken >= 180 && seconds >= 0;

  // Notes (ephemeral — never persisted to Firestore, matching the original design)
  const notasConfig = raw.notas || { type: 'block', bullets: 10, pregunta: false };
  const [bulletNotes, setBulletNotes] = useState(
    Array(notasConfig.bullets || 10).fill('')
  );
  const [blockNotes, setBlockNotes] = useState('');
  const [tuPregunta, setTuPregunta] = useState('');

  const updateBullet = (i, value) => {
    setBulletNotes((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  };

  // Question zone
  const [activeLevel, setActiveLevel] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState('');

  const askQuestion = (level) => {
    const pool = raw.preguntas?.[level] || [];
    if (pool.length === 0) return;
    const q = pickRandomQuestion(pool);
    setActiveLevel(level);
    setCurrentQuestion(q);
  };

  const hasPromptBox = raw.escenario || (raw.instrucciones || []).some((i) => i) || (raw.modelo && canSee('modelo'));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
      <div className="md:flex border-b border-slate-100 bg-slate-50/50">
        {activity.img && (
          <div className="md:w-1/3 shrink-0">
            <img src={activity.img} alt={activity.title} className="w-full h-48 md:h-full object-cover" />
          </div>
        )}
        <div className="p-6 md:p-8 flex flex-col justify-center">
          {activity.subtitle && (
            <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2">{activity.subtitle}</h4>
          )}
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 leading-tight">{activity.title}</h1>
          {(raw.etiquetas || []).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {raw.etiquetas.map((tag, i) => (
                <span key={i} className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 md:p-8 flex flex-col gap-6">
        {/* Literary excerpt, when present */}
        {raw.extracto && (
          <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-6">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-3">Extracto</h4>
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-serif">{raw.extracto}</p>
          </div>
        )}

        {/* Escenario / Instrucciones / Modelo */}
        {hasPromptBox && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 flex flex-col gap-4">
            {raw.escenario && (
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2">Escenario</h4>
                <p className="text-slate-700 font-medium leading-relaxed">{raw.escenario}</p>
              </div>
            )}
            {(raw.instrucciones || []).filter(Boolean).length > 0 && (
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2">Instrucciones</h4>
                <ul className="list-disc list-inside space-y-1">
                  {raw.instrucciones.filter(Boolean).map((instr, i) => (
                    <li key={i} className="text-slate-700 font-medium">{instr}</li>
                  ))}
                </ul>
              </div>
            )}
            {raw.modelo && canSee('modelo') && (
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2 flex items-center">
                  Modelo de Respuesta
                  {isAdmin && !raw.visibilidad?.modelo && <TeacherOnlyBadge />}
                </h4>
                <p className="text-slate-700 italic leading-relaxed">{raw.modelo}</p>
              </div>
            )}
          </div>
        )}

        {/* Contenido extendido del profesor (cada sección se puede mostrar al estudiante desde el editor) */}
        {(() => {
          const teacherSections = [
            { field: 'descripcion', label: 'Descripción', kind: 'text' },
            { field: 'relacion_tema', label: 'Relación con el Tema', kind: 'text' },
            { field: 'conexion_cultural', label: 'Conexión Cultural', kind: 'list' },
            { field: 'preguntas_interpretativas', label: 'Preguntas Interpretativas', kind: 'list' },
            { field: 'preguntas_personales', label: 'Preguntas Personales / Globales', kind: 'list' },
            { field: 'conexion_personal', label: 'Conexión Personal', kind: 'list' },
            { field: 'expansion_tema', label: 'Expansión del Tema', kind: 'list' },
          ].filter(({ field, kind }) => canSee(field) && (kind === 'text' ? raw[field] : (raw[field] || []).length > 0));

          const showExpresiones = canSee('expresiones_idiomaticas') && (raw.expresiones_idiomaticas || []).length > 0;
          const interaccionLevels = [
            { key: 'descriptivo', label: 'Descriptivo' },
            { key: 'interpretativo', label: 'Interpretativo' },
            { key: 'personal_global', label: 'Personal-Global' },
          ].filter(({ key }) => (raw.interacciones?.[key] || []).length > 0);
          const showInteracciones = canSee('interacciones') && interaccionLevels.length > 0;

          if (teacherSections.length === 0 && !showExpresiones && !showInteracciones) return null;

          return (
            <div className="bg-fuchsia-50 border border-fuchsia-100 rounded-xl p-6 flex flex-col gap-5">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600">Contenido Extendido</h4>

              {teacherSections.map(({ field, label, kind }) => (
                <div key={field}>
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-fuchsia-500 mb-2 flex items-center">
                    {label}
                    {isAdmin && !raw.visibilidad?.[field] && <TeacherOnlyBadge />}
                  </h5>
                  {kind === 'text' ? (
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{raw[field]}</p>
                  ) : (
                    <ul className="list-disc list-inside space-y-1">
                      {raw[field].map((item, i) => (
                        <li key={i} className="text-slate-700 leading-relaxed">{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}

              {showExpresiones && (
                <div>
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-fuchsia-500 mb-2 flex items-center">
                    Expresiones Idiomáticas
                    {isAdmin && !raw.visibilidad?.expresiones_idiomaticas && <TeacherOnlyBadge />}
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {raw.expresiones_idiomaticas.map((exp, i) => (
                      <div key={i} className="bg-white border border-fuchsia-100 rounded-lg p-3">
                        <p className="font-black text-slate-800 text-sm">{exp.expresion}</p>
                        <p className="text-slate-600 text-xs mt-1">{exp.significado}</p>
                        {exp.ejemplo && <p className="text-slate-500 text-xs italic mt-1">"{exp.ejemplo}"</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showInteracciones && (
                <div>
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-fuchsia-500 mb-2 flex items-center">
                    Interacción: Niveles
                    {isAdmin && !raw.visibilidad?.interacciones && <TeacherOnlyBadge />}
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {interaccionLevels.map(({ key, label }) => (
                      <div key={key} className="bg-white border border-fuchsia-100 rounded-lg p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-fuchsia-400 mb-1">{label}</p>
                        <ul className="space-y-1">
                          {(raw.interacciones[key] || []).map((line, i) => (
                            <li key={i} className="text-slate-700 text-xs leading-relaxed">{line}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Andamio del estudiante — siempre visible cuando existe */}
        {((raw.pasos_estudiante || []).length > 0 || (raw.banco_palabras || []).length > 0 || (raw.autoevaluacion || []).length > 0) && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 flex flex-col gap-5">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600">🧑‍🎓 Tu Guía</h4>

            {(raw.pasos_estudiante || []).length > 0 && (
              <div className="flex flex-col gap-3">
                {raw.pasos_estudiante.map((paso, i) => (
                  <div key={i} className="bg-white border border-emerald-100 rounded-lg p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">{paso.titulo || `Paso ${i + 1}`}</p>
                    <p className="text-slate-700 text-sm leading-relaxed">{paso.prompt}</p>
                  </div>
                ))}
              </div>
            )}

            {(raw.banco_palabras || []).length > 0 && (
              <div>
                <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">Banco de Palabras</h5>
                <div className="flex flex-wrap gap-2">
                  {raw.banco_palabras.map((word, i) => (
                    <span key={i} className="text-xs font-bold text-emerald-700 bg-white border border-emerald-200 px-3 py-1 rounded-full">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(raw.autoevaluacion || []).length > 0 && (
              <div>
                <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">Autoevaluación</h5>
                <ul className="space-y-1">
                  {raw.autoevaluacion.map((item, i) => (
                    <li key={i} className="text-slate-700 text-sm flex items-start gap-2">
                      <span className="mt-0.5">☐</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Enlaces de apoyo */}
        {(raw.enlaces || []).filter((e) => e.url).length > 0 && (
          <div className="flex flex-wrap gap-3">
            {raw.enlaces.filter((e) => e.url).map((enlace, i) => (
              <a
                key={i}
                href={enlace.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-full shadow-sm transition-colors"
              >
                {enlace.texto || 'Enlace'} ↗
              </a>
            ))}
          </div>
        )}

        {/* Timer engine */}
        {!isOpenFormat && (
          <div className="bg-slate-900 rounded-xl p-8 text-center flex flex-col items-center gap-4">
            {isS4 && phase === 'idle' && !simMode && (
              <button
                onClick={startSimulacion}
                className="self-end text-[10px] font-black uppercase tracking-widest text-rose-300 bg-rose-900/40 border border-rose-500/40 px-3 py-1 rounded-full hover:bg-rose-900/70 transition-colors"
              >
                Simulación (Condiciones de Examen)
              </button>
            )}

            {phase === 'idle' && (
              <>
                <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Preparación: {formatConvTime(prepSeconds)}</p>
                <button
                  onClick={startPrep}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-sm px-8 py-4 rounded-xl transition-colors"
                >
                  Comenzar Preparación
                </button>
              </>
            )}

            {phase === 'prep' && (
              <>
                <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Preparando...</p>
                <p className="text-white text-6xl font-black tabular-nums">{formatConvTime(seconds)}</p>
              </>
            )}

            {phase === 'waitToSpeak' && (
              <>
                <p className="text-emerald-400 text-lg font-black uppercase tracking-widest animate-pulse">¡Listo Para Hablar!</p>
                <button
                  onClick={startSpeak}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-sm px-8 py-4 rounded-xl transition-colors"
                >
                  Comenzar a Hablar
                </button>
              </>
            )}

            {phase === 'speak' && (
              <>
                <p className="text-slate-400 text-xs font-black uppercase tracking-widest">
                  Segmento {segIndex + 1} de {segments.length}
                </p>
                <p
                  className={`text-6xl font-black tabular-nums ${
                    isOvertime ? 'text-rose-500' : isOnTarget ? 'text-emerald-400' : 'text-white'
                  }`}
                >
                  {formatConvTime(seconds)}
                </p>
                {isOvertime && <p className="text-rose-400 text-xs font-black uppercase tracking-widest">Tiempo Extra</p>}
                <button
                  onClick={nextSegment}
                  className="bg-white hover:bg-slate-200 text-slate-900 font-black uppercase tracking-widest text-sm px-8 py-4 rounded-xl transition-colors"
                >
                  {segIndex + 1 < segments.length ? 'Siguiente Segmento' : 'Terminar'}
                </button>
              </>
            )}

            {phase === 'end' && (
              <p className="text-emerald-400 text-lg font-black uppercase tracking-widest">Presentación Terminada</p>
            )}

            {phase !== 'idle' && (
              <button
                onClick={resetAll}
                className="text-slate-500 hover:text-slate-300 text-[10px] font-bold uppercase tracking-widest transition-colors"
              >
                Reiniciar
              </button>
            )}
          </div>
        )}

        {/* Notes area */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Tus Notas</h4>
          {notasConfig.type === 'bullets' ? (
            <div className="flex flex-col gap-2">
              {bulletNotes.map((val, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-5 text-right">{i + 1}.</span>
                  <input
                    value={val}
                    onChange={(e) => updateBullet(i, e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
              ))}
            </div>
          ) : (
            <textarea
              value={blockNotes}
              onChange={(e) => setBlockNotes(e.target.value)}
              className="w-full min-h-[160px] px-3 py-2 rounded-lg border border-slate-200 text-sm"
              placeholder="Escribe tus notas aquí..."
            />
          )}
          {notasConfig.pregunta && (
            <div className="mt-4">
              <label className="text-xs font-bold text-slate-500 block mb-1">Tu Pregunta</label>
              <input
                value={tuPregunta}
                onChange={(e) => setTuPregunta(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              />
            </div>
          )}
        </div>

        {/* Question zone */}
        {phase === 'end' && raw.preguntas && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {['1', '2', '3'].map(
                (lvl) =>
                  (raw.preguntas[lvl] || []).length > 0 && (
                    <button
                      key={lvl}
                      onClick={() => askQuestion(lvl)}
                      className={`rounded-xl p-4 border text-center font-black uppercase text-xs tracking-widest transition-colors ${
                        activeLevel === lvl
                          ? lvl === '1'
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : lvl === '2'
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'bg-rose-500 border-rose-500 text-white'
                          : lvl === '1'
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100'
                          : lvl === '2'
                          ? 'bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100'
                          : 'bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      Nivel {lvl}
                    </button>
                  )
              )}
            </div>
            {currentQuestion && (
              <div className="bg-slate-800 rounded-xl p-6 text-center">
                <p className="text-white text-lg font-bold leading-relaxed">{currentQuestion}</p>
                <button
                  onClick={() => askQuestion(activeLevel)}
                  className="mt-4 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  🔄 Otra Pregunta
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- LAYOUT: DEFAULT (Fallback) ⚠️ ---
// IB exam-style practice: one or more levels (HL/NM/etc), each with a set of
// texts that link out to their (externally-hosted) reading pages.
const PracticaLayout = ({ activity }) => {
  const levels = activity.raw?.levels || [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
      <div className="p-8 md:p-10">
        <div className="mb-8 border-b border-slate-100 pb-8">
          <span className="text-[10px] font-black uppercase tracking-widest text-white bg-indigo-600 px-3 py-1 rounded-full mb-3 inline-block">
            Práctica IB
          </span>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            {activity.icon && <span>{activity.icon}</span>}
            {activity.title}
          </h1>
        </div>

        {levels.length === 0 ? (
          <p className="text-slate-500 font-medium">Esta práctica todavía no tiene textos asignados.</p>
        ) : (
          <div className="space-y-8">
            {levels.map((level, lIdx) => (
              <div key={lIdx}>
                <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-3">
                  {level.level_name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(level.texts || []).map((text, tIdx) => (
                    <a
                      key={tIdx}
                      href={text.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl p-5 transition-all"
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{text.label}</span>
                      <p className="text-slate-800 font-bold mt-1 group-hover:text-indigo-700">{text.title}</p>
                      <span className="text-xs font-bold text-slate-400 mt-2 inline-flex items-center gap-1">
                        Abrir texto ↗
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

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