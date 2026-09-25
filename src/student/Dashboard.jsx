import React, { useEffect, useState, useMemo } from 'react';
import { useGymData } from '../hooks/useGymData';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCachedCollection } from '../utils/firestoreCache';
import { useActiveTheme, ThemeContext, ThemeStyleSync } from '../context/ThemeContext';
import { getThemedCardStyle } from '../utils/getThemedCardStyle';
import { getAssignedWarmups, buildWarmupBreakdown, averageFromBreakdown } from '../utils/warmupBreakdown';
import { getVocabUnitWord } from '../utils/vocabUnitLabel';

// Components
import Header from '../components/Header';
import ThemeParticles from '../components/ThemeParticles';
import ThemeHeroBanner from '../components/ThemeHeroBanner';
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
  const { theme: todayTheme, loaded: themeLoaded, resolveThemeForDate } = useActiveTheme() || {};
  const isAdmin = userData?.role === 'admin';
  const [activeCourse, setActiveCourse] = useState(isAdmin ? 's4' : (userData?.course || 's2'));
  const { data, loading, liveDia, setLiveDia, course } = useGymData(activeCourse);

  // The day being viewed keeps ITS OWN calendar date's theme permanently —
  // browsing an old lesson day shows that day's era-correct theme instead of
  // whatever's seasonally active today.
  const fechaByDia = useMemo(() => {
    const map = {};
    (data?.cal || []).forEach((c) => {
      if (c.dia != null && c.fecha) map[Number(c.dia)] = c.fecha;
    });
    return map;
  }, [data?.cal]);
  const liveDiaFecha = liveDia ? fechaByDia[Number(liveDia)] : null;
  const theme = useMemo(() => {
    if (!liveDiaFecha || !resolveThemeForDate) return todayTheme;
    return resolveThemeForDate(liveDiaFecha) ?? todayTheme;
  }, [liveDiaFecha, resolveThemeForDate, todayTheme]);

  const [dailySong, setDailySong] = useState(null);
  const [activeVocabBundles, setActiveVocabBundles] = useState([]);
  const [vocabBundleDetails, setVocabBundleDetails] = useState({});
  const [activeLecturas, setActiveLecturas] = useState([]);
  const [hasSentences, setHasSentences] = useState(false);
  const [warmupBreakdown, setWarmupBreakdown] = useState([]);
  const [showWarmupModal, setShowWarmupModal] = useState(false);
  const warmupAverage = averageFromBreakdown(warmupBreakdown);

  // Calentamiento promedio: a calentamiento counts once its day's date has
  // arrived; a missed one counts as a 0 instead of being skipped, so this
  // matches the teacher gradebook's average.
  useEffect(() => {
    const computeWarmupBreakdown = async () => {
      if (!course || !data?.cal?.length) return;
      try {
        const calentamientos = await getCachedCollection('calentamientos');
        const todayStr = new Date().toLocaleDateString('en-CA');
        const fechaByDia = {};
        data.cal.forEach((c) => {
          if (c.dia != null && c.fecha) fechaByDia[Number(c.dia)] = c.fecha;
        });

        const assigned = getAssignedWarmups(calentamientos, fechaByDia, course, todayStr, null);
        setWarmupBreakdown(buildWarmupBreakdown(assigned, userData?.progress?.warmups || {}));
      } catch (error) {
        console.error('Error computing warmup breakdown:', error);
      }
    };
    computeWarmupBreakdown();
  }, [course, data?.cal, userData?.progress?.warmups]);

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

  // Fetch each vocab bundle's real title (textbook + chapter) so the
  // Dashboard card can show "Descubre 2 — Lección 8" / "Reporteros 4 —
  // Unidad 1" instead of a slugified doc ID.
  useEffect(() => {
    if (activeVocabBundles.length === 0) return;
    let cancelled = false;
    const fetchBundleDetails = async () => {
      try {
        const entries = await Promise.all(
          activeVocabBundles.map(async (bundleId) => {
            const snap = await getDoc(doc(db, 'vocab_bundles', bundleId));
            return [bundleId, snap.exists() ? snap.data() : null];
          })
        );
        if (!cancelled) setVocabBundleDetails(Object.fromEntries(entries));
      } catch (error) {
        console.error('Error fetching vocab bundle details:', error);
      }
    };
    fetchBundleDetails();
    return () => { cancelled = true; };
  }, [activeVocabBundles]);

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

  const themeAccent = theme?.styles?.accent;
  const themeCardOverrides = theme?.styles?.cardOverrides || {};
  const themeTextures = theme?.styles?.textures || {};
  const themeGradientStyle = (key) => getThemedCardStyle(themeCardOverrides[key], themeAccent, themeTextures[key]);

  return (
    // A nested provider so every card below (Header, Countdown, Curiosidad,
    // Estructura, Evaluacion, LecturaCard, GamesSidebar, ResourceHub,
    // LeaderboardCard, LearningPathTile, PracticeHubTile — all read
    // useActiveTheme() themselves) picks up the VIEWED DAY's theme instead
    // of today's, with no prop drilling needed.
    <ThemeContext.Provider value={{ theme, loaded: themeLoaded, resolveThemeForDate }}>
      <ThemeStyleSync theme={theme} />
      <div className="min-h-screen bg-slate-50/50">
        <ThemeParticles config={theme?.effectConfig} />
        <div className="w-full max-w-6xl mx-auto space-y-8 pb-24 pt-6 px-4 sm:px-6">
  
          {/* HEADER */}
          <div className="space-y-4">
            <Header liveDia={liveDia} setLiveDia={setLiveDia} maxAllowedDay={maxAllowedDay} course={course} cal={data?.cal} isAdmin={isAdmin} onToggleCourse={() => setActiveCourse((prev) => (prev === 's2' ? 's4' : 's2'))} />
          </div>
  
          {/* 📢 ANUNCIOS */}
          <Anuncios anuncios={data?.anuncios} cal={data?.cal} liveDia={liveDia} course={course} />
  
          {/* 🎨 SEASONAL THEME HERO BANNER */}
          <ThemeHeroBanner hero={theme?.hero} accent={theme?.styles?.accent} />
  
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT: LESSON CONTENT */}
            <div className="lg:col-span-2 space-y-8">
  
              {/* 🎯 EVALUACIÓN */}
              <Evaluacion evals={data?.evals?.[course] || []} liveDia={liveDia} course={course} cal={data?.cal} />
  
              {/* ⏱️ CALENTAMIENTO CARD — WORKOUT-APP STYLE */}
              <div className="relative group">
                <Link
                  to={`/calentamiento/${course}/${liveDia}`}
                  className="block overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-rose-600 p-6 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1"
                  style={themeGradientStyle('calentamiento')}
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
  
                {warmupAverage !== null && (
                  <button
                    type="button"
                    onClick={() => setShowWarmupModal(true)}
                    className="absolute top-4 right-4 bg-white/15 hover:bg-white/30 backdrop-blur-sm rounded-lg px-3 py-1.5 text-right transition-colors cursor-pointer"
                    title="Ver desglose de calentamientos"
                  >
                    <span className="block text-[9px] font-black uppercase tracking-widest text-orange-100">Promedio</span>
                    <span className="block text-lg font-black text-white leading-none">{warmupAverage}%</span>
                  </button>
                )}
              </div>
  
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
                  style={themeGradientStyle('conversacion')}
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
                  style={themeGradientStyle('video')}
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
                  style={themeGradientStyle('musica')}
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
              {activeVocabBundles.map(bundleId => {
                const bundleDetails = vocabBundleDetails[bundleId];
                const bundleTitle = bundleDetails
                  ? `${bundleDetails.textbook} — ${getVocabUnitWord(bundleDetails.textbook)} ${bundleDetails.chapter}`
                  : bundleId.replace(/_/g, ' ');
  
                return (
                <Link
                  key={bundleId}
                  to={`/vocabulario/${bundleId}`}
                  className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-6 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1"
                  style={themeGradientStyle('vocabulario')}
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
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter font-mono truncate">{bundleTitle}</h3>
                      <p className="text-emerald-100/80 text-sm font-medium mt-1 line-clamp-2">Aquí puedes ver una lista de palabras y usar tarjetas de estudio.</p>
                    </div>
                  </div>
  
                  <div className="mt-5 flex justify-end">
                    <span className="bg-white/15 group-hover:bg-white text-white group-hover:text-emerald-700 font-black text-sm px-6 py-2.5 rounded-lg text-center uppercase tracking-wider transition-colors shadow-sm inline-flex items-center gap-2">
                      Estudiar <span>→</span>
                    </span>
                  </div>
                </Link>
                );
              })}
  
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
              <PracticeHubTile course={course} />
              <LeaderboardCard course={course} />
              <div className="pt-6 border-t border-slate-200 space-y-6">
                {/* 🟢 FIXED RESOURCE HUB PROP */}
                <ResourceHub course={course} />
  
                <Countdown course={course} />
  
                <div
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-800 to-slate-900 p-6 shadow-xl"
                  style={themeGradientStyle('tareas')}
                >
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
  
        {/* 🔥 CALENTAMIENTO PROMEDIO BREAKDOWN MODAL */}
        {showWarmupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
              <div className="bg-slate-900 p-5 flex justify-between items-center sticky top-0">
                <div>
                  <h2 className="text-white font-black uppercase tracking-widest text-lg">Mis Calentamientos</h2>
                  <p className="text-orange-400 font-bold text-xs uppercase tracking-widest mt-1">Promedio: {warmupAverage}%</p>
                </div>
                <button
                  onClick={() => setShowWarmupModal(false)}
                  className="text-slate-400 hover:text-white text-3xl font-bold leading-none p-2 -mr-2"
                >
                  ×
                </button>
              </div>
  
              <div className="p-6 space-y-3 bg-slate-50">
                {warmupBreakdown.length === 0 ? (
                  <p className="text-center text-slate-500 italic font-bold py-8">
                    Todavía no hay calentamientos asignados.
                  </p>
                ) : (
                  warmupBreakdown.map((item) => {
                    const gradeClasses = !item.completed
                      ? 'bg-slate-100 text-slate-400 border-slate-200'
                      : item.grade < 50
                      ? 'bg-rose-50 text-rose-600 border-rose-200'
                      : item.grade < 70
                      ? 'bg-amber-50 text-amber-600 border-amber-200'
                      : 'bg-emerald-50 text-emerald-600 border-emerald-200';
  
                    return (
                      <Link
                        key={item.id}
                        to={`/calentamiento/${item.course}/${item.dia}`}
                        onClick={() => setShowWarmupModal(false)}
                        className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-orange-300 hover:shadow-md transition-all"
                      >
                        <div className="flex justify-between items-center gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">Día {item.dia}: {item.title}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{item.fecha}</p>
                          </div>
                          <div className={`shrink-0 border rounded-lg px-3 py-1.5 text-center min-w-[70px] font-black text-xs ${gradeClasses}`}>
                            {item.completed ? `${item.grade}%` : 'Sin hacer'}
                          </div>
                        </div>
  
                        {item.errors.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-rose-500">
                              Fallaste ({item.errors.length}):
                            </p>
                            {item.errors.map((err, i) => (
                              <p key={i} className="text-[11px] text-slate-500">
                                <span className="font-bold text-slate-700">{err.verb}</span> ({err.subject}, {err.tense}) —
                                era <span className="text-emerald-600 font-mono">{err.expected}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeContext.Provider>
  );
};

export default Dashboard;
