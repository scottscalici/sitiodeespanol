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
import AITutor from '../components/AITutor';
import GamesSidebar from '../components/GamesSidebar';
import ActivityGrid from '../components/ActivityGrid';
import Estructura from '../components/Estructura';
import UtilityCard from '../components/UtilityCard';
import Anuncios from '../components/Anuncios';
import Destacado from '../components/Destacado';
import Curiosidad from '../components/Curiosidad';
import LecturaCard from '../components/LecturaCard'; 
import ResourceHub from '../components/ResourceHub';

const Dashboard = () => {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const [activeCourse, setActiveCourse] = useState(isAdmin ? 's4' : (userData?.course || 's2'));
  const { data, loading, liveDia, setLiveDia, course } = useGymData(activeCourse);

  const [dailySong, setDailySong] = useState(null);
  const [activeVocabBundles, setActiveVocabBundles] = useState([]);
  const [activeLecturas, setActiveLecturas] = useState([]);

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
            
            {/* 🎯 DAILY MUSIC MISSION CARD */}
            {dailySong && (
              <Link to={`/musica/${dailySong.id}`} className="group relative block overflow-hidden rounded-2xl bg-slate-900 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1">
                <div className="absolute inset-0 opacity-40">
                  <img src={dailySong.imagen} alt={dailySong.titulo} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent"></div>
                </div>
                <div className="relative p-8 flex flex-col items-start justify-end min-h-[240px]">
                  <span className="mb-2 rounded-full bg-indigo-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">Misión de Música: Día {liveDia}</span>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{dailySong.titulo}</h2>
                  <p className="text-lg italic text-slate-300">{dailySong.artista}</p>
                  <div className="mt-4 flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-indigo-400">
                    <span>🎯 {dailySong.totalPoints} Puntos de Comprensión</span>
                    <span className="bg-white/10 px-4 py-2 rounded-lg text-white group-hover:bg-indigo-500 transition-colors">Empezar →</span>
                  </div>
                </div>
              </Link>
            )}

            <Evaluacion evals={data?.evals?.[course] || []} liveDia={liveDia} course={course} cal={data?.cal} />

            {/* ⏱️ CALENTAMIENTO CARD */}
            <Link to={`/calentamiento/${course}/${liveDia}`} className="group relative block overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
              <div className="flex flex-col sm:flex-row items-stretch">
                
                {/* Left Banner / Icon Area */}
                <div className="sm:w-56 h-32 sm:h-auto bg-gradient-to-br from-orange-500 to-amber-500 relative flex items-center justify-center shrink-0">
                  <span className="text-5xl drop-shadow-md">🔥</span>
                  <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm text-amber-300 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md shadow">
                    Práctica Diaria
                  </span>
                </div>

                {/* Right Content & Action */}
                <div className="p-5 flex flex-col justify-between flex-1 gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">Rutina del Día</span>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mt-0.5">Calentamiento</h3>
                    <p className="text-slate-500 text-xs font-medium mt-1">Accede a la práctica para practicar los verbos programados y repasar el vocabulario para el Día {liveDia}.</p>
                  </div>

                  <div className="flex justify-end">
                    <span className="bg-slate-900 group-hover:bg-orange-600 text-white font-black text-xs px-6 py-2.5 rounded-lg text-center uppercase tracking-wider transition-colors shadow-sm inline-block">
                      Iniciar Misión →
                    </span>
                  </div>
                </div>

              </div>
            </Link>
 {/* 💡 CURIOSIDAD */}
 <Curiosidad curiosidades={activeCuriosidades} />
            {/* 📖 VOCABULARY CARDS */}
            {activeVocabBundles.map(bundleId => (
              <Link key={bundleId} to={`/vocabulario/${bundleId}`} className="group relative block overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
                <div className="flex flex-col sm:flex-row items-stretch">
                  
                  {/* Left Banner / Icon Area */}
                  <div className="sm:w-56 h-32 sm:h-auto bg-gradient-to-br from-indigo-500 to-purple-600 relative flex items-center justify-center shrink-0">
                    <span className="text-5xl drop-shadow-md">🧠</span>
                    <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm text-indigo-300 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md shadow">
                      Vocabulario Activo
                    </span>
                  </div>

                  {/* Right Content & Action */}
                  <div className="p-5 flex flex-col justify-between flex-1 gap-4">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Conjunto Asignado</span>
                      <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mt-0.5 font-mono">{bundleId.replace(/_/g, ' ')}</h3>
                      <p className="text-slate-500 text-xs font-medium mt-1">Domina los términos y estructuras clave de esta unidad.</p>
                    </div>

                    <div className="flex justify-end">
                      <span className="bg-slate-900 group-hover:bg-indigo-600 text-white font-black text-xs px-6 py-2.5 rounded-lg text-center uppercase tracking-wider transition-colors shadow-sm inline-block">
                        Estudiar →
                      </span>
                    </div>
                  </div>

                </div>
              </Link>
            ))}
            {/* 📄 LECTURAS (DYNAMIC READING CARDS) */}
            {activeLecturas.map(lecturaId => (
              <LecturaCard 
                key={lecturaId} 
                lecturaId={lecturaId} 
                title="Comprensión de Lectura" 
                testId="IB Paper 1" 
                textId="A" 
              />
            ))}

            <ActivityGrid activities={data?.activities} liveDia={liveDia} course={course} />
            <Estructura estructura={data?.estructura?.[course] || []} liveDia={liveDia} />
            
           
            
           
 {/* 🔥 DESTACADO */}
 <Destacado destacado={activeDestacados} />
          </div>

          {/* RIGHT: SIDEBAR */}
          <div className="space-y-6">
            <GamesSidebar />
            <div className="pt-6 border-t border-slate-200 space-y-6">
              {/* 🟢 FIXED RESOURCE HUB PROP */}
              <ResourceHub course={course} />
              
              <Countdown course={course} />

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="font-bold text-[11px] mb-2 flex items-center gap-2 text-slate-400 uppercase tracking-widest">
                  <span>✍️</span> Oraciones de Práctica
                </h3>
                <p className="text-xs text-slate-400 mb-3">Completa oraciones con las palabras que faltan.</p>
                <Link to={`/practica/oraciones/${course}/${liveDia}`} className="block text-center bg-slate-900 hover:bg-teal-600 text-white font-black text-[11px] px-4 py-2.5 rounded-lg uppercase tracking-wider transition-colors">
                  Practicar →
                </Link>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="font-bold text-[11px] mb-4 flex items-center gap-2 text-slate-400 uppercase tracking-widest">
                  <span>📝</span> Tareas de Referencia
                </h3>
                <div className="space-y-3 opacity-75">
                  {courseTasks.length === 0 ? (
                    <p className="text-xs text-slate-300 italic text-center">No hay tareas.</p>
                  ) : (
                    courseTasks.map((t, idx) => (
                      <div key={idx} className="bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                        <h4 className="font-bold text-slate-600 text-xs leading-tight">{t.titulo}</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Vence: Día {t.day_due}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <AITutor temas={data?.temas} />
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