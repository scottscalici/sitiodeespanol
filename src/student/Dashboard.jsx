import React, { useEffect, useState, useMemo } from 'react';
import { useGymData } from '../hooks/useGymData';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Components
import Header from '../components/Header';
import Evaluacion from '../components/Evaluacion';
import Countdown from '../components/Countdown';
import GamesSidebar from '../components/GamesSidebar';
import LearningPathTile from '../components/LearningPathTile';
import PracticeHubTile from '../components/PracticeHubTile';
import ActivityGrid from '../components/ActivityGrid';
import Estructura from '../components/Estructura';
import UtilityCard from '../components/UtilityCard';
import Destacado from '../components/Destacado';
import Curiosidad from '../components/Curiosidad';
import LecturaCard from '../components/LecturaCard';
import ResourceHub from '../components/ResourceHub';
import Anuncios from '../components/Anuncios';
import LeaderboardCard from '../components/LeaderboardCard';

const PLATFORM_TAREA_INFO = {
  VHL: {
    logo: 'https://raw.githubusercontent.com/scottscalici/imagenes/main/planes/vhl-logo.png',
    label: 'VHL Asignado',
    gradient: 'from-blue-700 via-indigo-900 to-slate-900',
    accent: 'text-blue-200',
  },
  KWL: {
    logo: 'https://raw.githubusercontent.com/scottscalici/imagenes/main/planes/kwl-logo.png',
    label: 'KWL Asignado',
    gradient: 'from-blue-700 via-indigo-900 to-slate-900',
    accent: 'text-blue-200',
  },
};

const Dashboard = () => {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const [activeCourse, setActiveCourse] = useState(isAdmin ? 's4' : (userData?.course || 's2'));
  const { data, loading, liveDia, setLiveDia, course } = useGymData(activeCourse);

  const [dailySong, setDailySong] = useState(null);
  const [activeVocabBundles, setActiveVocabBundles] = useState([]);
  const [activeLecturas, setActiveLecturas] = useState([]);
  const [hasSentences, setHasSentences] = useState(false);

  // Fetch Music
  useEffect(() => {
    const fetchDailyMusic = async () => {
      if (!course || !liveDia) return;
      try {
        const q = query(collection(db, 'musica'), where('course', 'array-contains', course));
        const querySnapshot = await getDocs(q);
        const allCourseSongs = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const matchedSong = allCourseSongs.find((song) => song.dias && song.dias.includes(liveDia));
        setDailySong(matchedSong || null);
      } catch (error) {
        console.error('Error fetching daily music:', error);
      }
    };
    fetchDailyMusic();
  }, [liveDia, course]);

  // Fetch Vocab Sequence
  useEffect(() => {
    const fetchVocabSequence = async () => {
      if (!course || !liveDia) return;
      try {
        const vocabRef = doc(db, 'curriculum_tracks', 'vocab_master');
        const vocabSnap = await getDoc(vocabRef);
        if (vocabSnap.exists()) {
          const masterData = vocabSnap.data();
          const bundlesForToday = masterData[course]?.[liveDia.toString()] || [];
          setActiveVocabBundles(bundlesForToday);
        } else {
          setActiveVocabBundles([]);
        }
      } catch (error) {
        console.error('Error fetching vocab sequence:', error);
      }
    };
    fetchVocabSequence();
  }, [course, liveDia]);

  // Fetch Reading Sequence for Today
  useEffect(() => {
    const fetchLecturasSequence = async () => {
      if (!course || !liveDia) return;
      try {
        const lecturasRef = doc(db, 'curriculum_tracks', 'lecturas_master');
        const snap = await getDoc(lecturasRef);

        if (snap.exists()) {
          const masterData = snap.data();
          const courseData = masterData[course] || {};
          const readingsForToday = courseData[liveDia.toString()] || [];
          setActiveLecturas(readingsForToday);
        } else {
          setActiveLecturas([]);
        }
      } catch (error) {
        console.error('Error fetching lecturas sequence:', error);
      }
    };
    fetchLecturasSequence();
  }, [course, liveDia]);

  // Check for Sentence Sets scheduled for today
  useEffect(() => {
    const checkSentenceSets = async () => {
      if (!course || !liveDia) return;
      try {
        const snap = await getDocs(collection(db, 'sentence_sets'));
        const matches = snap.docs.some((docSnap) =>
          (docSnap.data().assignments || []).some(
            (a) => a.course === course && Number(a.dia) === Number(liveDia)
          )
        );
        setHasSentences(matches);
      } catch (error) {
        console.error('Error checking sentence sets:', error);
      }
    };
    checkSentenceSets();
  }, [course, liveDia]);

  // --- CALCULATE MAX DAY SAFELY ---
  const maxAllowedDay = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const userCiclo = userData?.section ? userData.section.slice(-1).toUpperCase() : 'A';
    let maxDay = liveDia || 1;

    if (data?.cal && data.cal.length > 0) {
      const validPastDays = data.cal.filter(dayObj => {
        if (dayObj.fecha > todayStr) return false;
        if (dayObj.ciclo && dayObj.ciclo !== userCiclo) return false;
        return true;
      });
      if (validPastDays.length > 0) {
        maxDay = Math.max(...validPastDays.map(d => Number(d.dia)));
      }
    }
    return maxDay;
  }, [data?.cal, liveDia, userData?.section]);

  // --- ENFORCE FUTURE DAY BLOCK FOR STUDENTS ---
  useEffect(() => {
    if (!isAdmin && liveDia > maxAllowedDay) {
      setLiveDia(maxAllowedDay); // Snap them back to the present day
    }
  }, [liveDia, maxAllowedDay, isAdmin, setLiveDia]);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center font-bold text-slate-400 animate-pulse uppercase tracking-widest">Descargando Plan de Clase...</div>
      </div>
    );
  }

  // --- TAREAS FILTERING ---
  const safeTareas = data?.tareas?.[course] || [];
  const courseTasks = safeTareas.filter(
    (t) => t.day_assigned <= liveDia && t.day_due >= liveDia
  );

  // --- CONVERSACIÓN FILTERING ---
  const activeConversaciones = (data?.activities || []).filter((act) => {
    if (act.type !== 'conversacion') return false;
    if (course === 's2') return act.s2_dias?.includes(liveDia);
    if (course === 's4') return act.s4_dias?.includes(liveDia);
    return false;
  });

  // --- PLATFORM TAREA FILTERING (VHL/KWL — shown only on the day assigned) ---
  const activePlatformTareas = safeTareas.filter(
    (t) => Number(t.day_assigned) === Number(liveDia) && PLATFORM_TAREA_INFO[t.tipo]
  );

  // --- VIDEO FILTERING ---
  const activeVideos = (data?.activities || []).filter((act) => {
    if (act.type !== 'video') return false;
    if (course === 's2') return act.s2_dias?.includes(liveDia);
    if (course === 's4') return act.s4_dias?.includes(liveDia);
    return false;
  });

  // --- UTILITY FILTERING ---
  const activeDestacados = (data?.destacado || []).filter(d =>
    Number(d.dia) === liveDia && (!d.course || d.course === course || (Array.isArray(d.course) && d.course.includes(course)))
  );

  const activeCuriosidades = (data?.curios || []).filter(c => {
    if (course === 's2') return Number(c.s2_dia) === liveDia;
    if (course === 's4') return Number(c.s4_dia) === liveDia;
    if (course === 'ib') return Number(c.ib_dia) === liveDia;
    return Number(c.dia) === liveDia;
  });

  const activeRecursos = (data?.recursos || []).filter(r => {
    return !r.course || r.course === course || (Array.isArray(r.course) && r.course.includes(course));
  });

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="w-full max-w-6xl mx-auto space-y-8 pb-24 pt-6 px-4 sm:px-6">

        {/* HEADER */}
        <div className="space-y-4">
          <Header liveDia={liveDia} setLiveDia={setLiveDia} maxAllowedDay={maxAllowedDay} course={course} cal={data?.cal} isAdmin={isAdmin} onToggleCourse={() => setActiveCourse((prev) => (prev === 's2' ? 's4' : 's2'))} />
        </div>

        {/* 📢 ANUNCIOS */}
        <Anuncios anuncios={data?.anuncios} cal={data?.cal} liveDia={liveDia} course={course} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: LESSON CONTENT */}
          <div className="lg:col-span-2 space-y-8">

            {/* 🎯 EVALUACIÓN */}
            <Evaluacion evals={data?.evals?.[course] || []} liveDia={liveDia} course={course} cal={data?.cal} />

            {/* ⏱️ CALENTAMIENTO CARD — WORKOUT-APP STYLE */}
            <Link
              to={`/calentamiento/${course}/${liveDia}`}
              className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-rose-600 p-6 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1"
            >
              <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex items-center gap-4">
                {/* Flame Badge */}
                <div className="w-16 h-16 shrink-0 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-inner">
                  <span className="text-3xl drop-shadow">🔥</span>
                </div>

                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-black uppercase tracking-widest text-orange-100 mb-1">Rutina del Día · Día {liveDia}</span>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Calentamiento</h3>
                  <p className="text-orange-50/90 text-sm font-medium mt-1 line-clamp-2">Verbos y vocabulario programado para hoy.</p>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <span className="bg-white/15 group-hover:bg-white text-white group-hover:text-red-600 font-black text-sm px-6 py-2.5 rounded-lg text-center uppercase tracking-wider transition-colors shadow-sm inline-flex items-center gap-2">
                  Iniciar Misión <span>→</span>
                </span>
              </div>
            </Link>

            {/* 💡 CURIOSIDAD */}
            <Curiosidad curiosidades={activeCuriosidades} />

            {/* 🏗️ ESTRUCTURA */}
            <Estructura estructura={data?.estructura?.[course] || []} liveDia={liveDia} />

            {/* ✍️ ORACIONES DE PRÁCTICA/EJEMPLO — WIDGET STYLE */}
            {hasSentences && (
              <Link
                to={`/practica/oraciones/${course}/${liveDia}`}
                className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 via-cyan-700 to-slate-900 p-6 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1"
              >
                <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 shrink-0 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-inner">
                    <span className="text-3xl drop-shadow">✍️</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-black uppercase tracking-widest text-sky-100 mb-1">Día {liveDia}</span>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Oraciones</h3>
                    <p className="text-sky-50/90 text-sm font-medium mt-1 line-clamp-2">Completa oraciones con las palabras que faltan.</p>
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <span className="bg-white/15 group-hover:bg-white text-white group-hover:text-sky-700 font-black text-sm px-6 py-2.5 rounded-lg text-center uppercase tracking-wider transition-colors shadow-sm inline-flex items-center gap-2">
                    Practicar <span>→</span>
                  </span>
                </div>
              </Link>
            )}

            {/* 🗣️ CONVERSACIÓN — WIDGET STYLE */}
            {activeConversaciones.map((conv) => (
              <Link
                key={conv.id}
                to={`/actividad/conversacion/${conv.id}`}
                className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-cyan-700 to-slate-900 p-6 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1"
              >
                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 shrink-0 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-inner overflow-hidden">
                    {conv.img ? (
                      <img src={conv.img} alt={conv.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl drop-shadow">🗣️</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-black uppercase tracking-widest text-teal-100 mb-1">Conversación · Día {liveDia}</span>
                    <h3 className="text-2xl font-black text-white leading-tight tracking-tight truncate">{conv.title}</h3>
                    {conv.subtitle && (
                      <p className="text-teal-50/90 text-sm font-medium mt-1 line-clamp-2">{conv.subtitle}</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <span className="bg-white/15 group-hover:bg-white text-white group-hover:text-teal-700 font-black text-sm px-6 py-2.5 rounded-lg text-center uppercase tracking-wider transition-colors shadow-sm inline-flex items-center gap-2">
                    Practicar <span>→</span>
                  </span>
                </div>
              </Link>
            ))}

            {/* 📺 VIDEO — TV WIDGET STYLE */}
            {activeVideos.map((vid) => (
              <Link
                key={vid.id}
                to={`/actividad/video/${vid.id}`}
                className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-rose-800 to-slate-900 p-6 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1"
              >
                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

                <div className="flex items-center gap-4">
                  {/* TV Outline Badge */}
                  <div className="w-16 h-16 shrink-0 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-inner overflow-hidden">
                    {vid.img ? (
                      <img src={vid.img} alt={vid.title} className="w-full h-full object-cover" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-white drop-shadow">
                        <rect x="3" y="7" width="18" height="13" rx="2" />
                        <path d="M8 7l4-4 4 4" />
                      </svg>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-black uppercase tracking-widest text-red-100 mb-1">Video · Día {liveDia}</span>
                    <h3 className="text-2xl font-black text-white leading-tight tracking-tight truncate">{vid.title}</h3>
                    {vid.subtitle && (
                      <p className="text-red-50/90 text-sm font-medium mt-1 line-clamp-2">{vid.subtitle}</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <span className="bg-white/15 group-hover:bg-white text-white group-hover:text-red-700 font-black text-sm px-6 py-2.5 rounded-lg text-center uppercase tracking-wider transition-colors shadow-sm inline-flex items-center gap-2">
                    Ver Video <span>→</span>
                  </span>
                </div>
              </Link>
            ))}

            {/* 📄 LECTURAS (DYNAMIC READING CARDS) */}
            {activeLecturas.map(lecturaId => (
              <LecturaCard
                key={lecturaId}
                lecturaId={lecturaId}
              />
            ))}

            {/* 🎯 DAILY MUSIC MISSION CARD — SPOTIFY WIDGET STYLE */}
            {dailySong && (
              <Link
                to={`/musica/${dailySong.id}`}
                className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-purple-800 to-slate-900 p-5 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1"
              >
                {/* Spotify-style icon badge, top right */}
                <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-purple-700">
                    <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.3 14.4a.6.6 0 01-.83.2c-2.27-1.39-5.13-1.7-8.5-.93a.6.6 0 11-.27-1.17c3.69-.84 6.86-.48 9.4 1.07a.6.6 0 01.2.83zm1.2-2.72a.75.75 0 01-1.03.25c-2.6-1.6-6.56-2.06-9.63-1.13a.75.75 0 11-.44-1.44c3.51-1.07 7.87-.55 10.85 1.29a.75.75 0 01.25 1.03zm.1-2.83C14.9 9.06 9.9 8.88 6.98 9.77a.9.9 0 11-.53-1.72c3.35-1.02 8.9-.8 12.4 1.28a.9.9 0 11-.92 1.55z"/>
                  </svg>
                </div>

                <div className="flex items-center gap-4">
                  {/* Album Art */}
                  <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden shadow-lg bg-purple-950">
                    {dailySong.imagen && (
                      <img src={dailySong.imagen} alt={dailySong.titulo} className="w-full h-full object-cover" />
                    )}
                  </div>

                  {/* Track Info */}
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-black uppercase tracking-widest text-purple-300 mb-1">Música: Día {liveDia}</span>
                    <h2 className="text-xl font-black text-white truncate">{dailySong.titulo}</h2>
                    <p className="text-base text-purple-200 truncate">{dailySong.artista}</p>
                  </div>
                </div>

                {/* Fake "Now Playing" Progress Bar */}
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
                    <div className="h-full w-1/4 rounded-full bg-white/70 group-hover:bg-white transition-colors"></div>
                  </div>
                  <span className="text-xs font-bold text-purple-300 uppercase tracking-widest">Escuchar</span>
                  <div className="w-9 h-9 shrink-0 rounded-full bg-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-purple-700 ml-0.5">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </Link>
            )}

            {/* 📖 VOCABULARY CARDS — FLASHCARD-DECK STYLE */}
            {activeVocabBundles.map(bundleId => (
              <Link
                key={bundleId}
                to={`/vocabulario/${bundleId}`}
                className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-6 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1"
              >
                <div className="absolute -top-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

                <div className="flex items-center gap-5">
                  {/* Layered Flashcard Deck Visual */}
                  <div className="relative w-16 h-16 shrink-0">
                    <div className="absolute inset-0 rotate-6 rounded-xl bg-white/10"></div>
                    <div className="absolute inset-0 -rotate-3 rounded-xl bg-white/15"></div>
                    <div className="relative inset-0 rounded-xl bg-white/25 backdrop-blur-sm flex items-center justify-center h-full shadow-inner">
                      <span className="text-2xl drop-shadow">🧠</span>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-black uppercase tracking-widest text-emerald-200 mb-1">Vocabulario</span>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter font-mono truncate">{bundleId.replace(/_/g, ' ')}</h3>
                    <p className="text-emerald-100/80 text-sm font-medium mt-1 line-clamp-2">Domina los términos y estructuras clave de esta unidad.</p>
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <span className="bg-white/15 group-hover:bg-white text-white group-hover:text-emerald-700 font-black text-sm px-6 py-2.5 rounded-lg text-center uppercase tracking-wider transition-colors shadow-sm inline-flex items-center gap-2">
                    Estudiar <span>→</span>
                  </span>
                </div>
              </Link>
            ))}

            <ActivityGrid activities={data?.activities} liveDia={liveDia} course={course} />

            {/* 🎓 PLATFORM TAREA (VHL/KWL) — SHOWN ONLY ON DAY ASSIGNED */}
            {activePlatformTareas.map((t) => {
              const info = PLATFORM_TAREA_INFO[t.tipo];
              return (
                <div
                  key={t.id}
                  className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${info.gradient} p-6 shadow-xl`}
                >
                  <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 shrink-0 rounded-2xl bg-white flex items-center justify-center shadow-inner p-2">
                      <img src={info.logo} alt={t.tipo} className="w-full h-full object-contain" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className={`block text-xs font-black uppercase tracking-widest ${info.accent} mb-1`}>
                        {info.label} · Día {liveDia}
                      </span>
                      <h3 className="text-xl font-black text-white leading-tight tracking-tight truncate">{t.titulo}</h3>
                      <p className="text-blue-50/80 text-sm font-medium mt-1">Vence: Día {t.day_due}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 🔥 DESTACADO */}
            <Destacado destacado={activeDestacados} />
          </div>

          {/* RIGHT: SIDEBAR */}
          <div className="space-y-6">
            <GamesSidebar />
            <LearningPathTile liveDia={liveDia} course={course} courseTasks={safeTareas} />
            <PracticeHubTile />
            <LeaderboardCard course={course} />
            <div className="pt-6 border-t border-slate-200 space-y-6">
              {/* 🟢 FIXED RESOURCE HUB PROP */}
              <ResourceHub course={course} />

              <Countdown course={course} />

              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-800 to-slate-900 p-6 shadow-xl">
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

                <div className="relative flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 shrink-0 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-inner">
                    <span className="text-3xl drop-shadow">📝</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-black uppercase tracking-widest text-indigo-200 mb-1">Pendientes</span>
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Tareas de Referencia</h3>
                  </div>
                </div>

                <div className="relative space-y-3">
                  {courseTasks.length === 0 ? (
                    <p className="text-xs text-white/60 italic text-center py-2">No hay tareas.</p>
                  ) : (
                    courseTasks.map((t, idx) => (
                      <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                        <h4 className="font-bold text-white text-xs leading-tight">{t.titulo}</h4>
                        <p className="text-[9px] text-indigo-200 font-bold uppercase mt-1">Vence: Día {t.day_due}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-12 mt-12 w-full border-t border-slate-100">
           {/* 🔗 UTILITY: RECURSOS */}
           <UtilityCard type="recurso" data={activeRecursos} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
