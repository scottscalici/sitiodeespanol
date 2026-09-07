import React, { useEffect, useState } from 'react';
import { useGymData } from './hooks/useGymData';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';

// Components
import Header from './components/Header';
import Anuncios from './components/Anuncios';
import Evaluacion from './components/Evaluacion';
import Curiosidad from './components/Curiosidad';
import Destacado from './components/Destacado';
import Countdown from './components/Countdown';
import AITutor from './components/AITutor';
import Recursos from './components/Recursos';
import GamesSidebar from './components/GamesSidebar';
import ActivityGrid from './components/ActivityGrid';

const Dashboard = () => {
  const { userData } = useAuth();
  
  // 1. Re-define isAdmin using the new userData from context
  const isAdmin = userData?.role === 'admin';

  // 2. Set the course based on their profile, defaulting to s4 for admins
  const [activeCourse, setActiveCourse] = useState(
    isAdmin ? 's4' : (userData?.course || 's2')
  );

  // 3. Feed the state variable into your hook
  const { data, loading, liveDia, setLiveDia, course } = useGymData(activeCourse);

  // 4. State for the Daily Music Mission
  const [dailySong, setDailySong] = useState(null);

  // Fetch the specific song for Today
  useEffect(() => {
    const fetchDailyMusic = async () => {
      if (!course || !liveDia) return;

      try {
        const q = query(
          collection(db, 'musica'),
          where('course', 'array-contains', course)
        );

        const querySnapshot = await getDocs(q);
        const allCourseSongs = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const matchedSong = allCourseSongs.find(
          (song) => song.dias && song.dias.includes(liveDia)
        );

        setDailySong(matchedSong || null);
      } catch (error) {
        console.error('Error fetching daily music:', error);
      }
    };

    fetchDailyMusic();
  }, [liveDia, course]);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center font-bold text-slate-400 animate-pulse uppercase tracking-widest">
          Descargando Plan de Clase...
        </div>
      </div>
    );
  }

  const safeTareas = data.tareas?.tareas || [];
  const courseTasks = safeTareas.filter(
    (t) =>
      t.day_assigned <= liveDia &&
      t.day_due >= liveDia &&
      (!t.course ||
        t.course === course ||
        (Array.isArray(t.course) && t.course.includes(course)))
  );

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="w-full max-w-6xl mx-auto space-y-8 pb-24 pt-6 px-4 sm:px-6">
        {/* HEADER & CONTROLS */}
        <div className="space-y-4">
          <div className="flex justify-end">
            <div className="flex items-center gap-3 bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-xl">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Ir al Día:
              </label>
              <input
                type="number"
                value={liveDia}
                onChange={(e) => setLiveDia(parseInt(e.target.value) || 1)}
                className="w-16 bg-slate-100 border-none rounded-lg px-2 py-1 font-bold text-slate-700 text-center outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>
          <Header
            liveDia={liveDia}
            course={course}
            cal={data?.cal}
            isAdmin={isAdmin}
            onToggleCourse={() =>
              setActiveCourse((prev) => (prev === 's2' ? 's4' : 's2'))
            }
          />
        </div>

        <Anuncios
          anuncios={data?.anuncios}
          cal={data?.cal}
          liveDia={liveDia}
          course={course}
        />

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: LESSON CONTENT */}
          <div className="lg:col-span-2 space-y-8">
            {/* 🎯 DAILY MUSIC MISSION CARD */}
            {dailySong && (
              <Link
                to={`/musica/${dailySong.id}`}
                className="group relative block overflow-hidden rounded-2xl bg-slate-900 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1"
              >
                <div className="absolute inset-0 opacity-40">
                  <img
                    src={dailySong.imagen}
                    alt={dailySong.titulo}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent"></div>
                </div>

                <div className="relative p-8 flex flex-col items-start justify-end min-h-[240px]">
                  <span className="mb-2 rounded-full bg-indigo-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
                    Misión de Música: Día {liveDia}
                  </span>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                    {dailySong.titulo}
                  </h2>
                  <p className="text-lg italic text-slate-300">
                    {dailySong.artista}
                  </p>
                  <div className="mt-4 flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-indigo-400">
                    <span>
                      🎯 {dailySong.totalPoints} Puntos de Comprensión
                    </span>
                    <span className="bg-white/10 px-4 py-2 rounded-lg text-white group-hover:bg-indigo-500 transition-colors">
                      Empezar →
                    </span>
                  </div>
                </div>
              </Link>
            )}

            <Evaluacion evals={data?.evals} liveDia={liveDia} course={course} />
            <ActivityGrid
              activities={data?.activities}
              liveDia={liveDia}
              course={course}
            />
            <Curiosidad
              curiosidades={data?.curios}
              liveDia={liveDia}
              course={course}
            />
            <Destacado
              destacado={data?.destacado}
              liveDia={liveDia}
              course={course}
            />
          </div>

          {/* RIGHT: SIDEBAR */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Progreso de Hoy
                </span>
                <span className="text-[10px] font-black text-indigo-600">
                  0%
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full w-[5%] transition-all duration-500"></div>
              </div>
            </div>

            <GamesSidebar />

            <div className="pt-6 border-t border-slate-200 space-y-6">
              <Countdown course={course} />
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="font-bold text-[11px] mb-4 flex items-center gap-2 text-slate-400 uppercase tracking-widest">
                  <span>📝</span> Tareas de Referencia
                </h3>
                <div className="space-y-3 opacity-75">
                  {courseTasks.length === 0 ? (
                    <p className="text-xs text-slate-300 italic text-center">
                      No hay tareas.
                    </p>
                  ) : (
                    courseTasks.map((t, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50/50 rounded-lg p-3 border border-slate-100"
                      >
                        <h4 className="font-bold text-slate-600 text-xs leading-tight">
                          {t.titulo}
                        </h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                          Vence: Día {t.day_due}
                        </p>
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
          <Recursos data={data} liveDia={liveDia} course={course} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;