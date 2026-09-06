import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'; // 👈 Added Navigate
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; // 👈 Added Firestore imports
import { auth, db } from './firebase'; // 👈 Make sure db is imported!

import Login from './Login';
import Dashboard from './Dashboard';
import ActivityPage from './components/ActivityPage';
import SenordlePage from './pages/SenordlePage';
import RecreoHub from './pages/RecreoHub';
import TicoTalk from './pages/TicoTalk';
import AtandoCabosPage from './pages/AtandoCabosPage';
import EslabonesFinales from './pages/EslabonesFinales';
import CulturaSandbox from './pages/CulturaSandbox';
import MusicUploader from './admin/MusicUploader';
import MusicPage from './pages/MusicPage';
import VocabUploader from './admin/VocabUploader';
import VerbUploader from './admin/VerbUploader';
import CulturaUploader from './admin/CulturaUploader';
import TieredCulturaUploader from './admin/TieredCulturaUploader';
import DestacadoUploader from './admin/DestacadoUploader';
import MasterDashboard from './admin/MasterDashboard/MasterDashboard';
import SenordleUploader from './admin/SenordleUploader';
import AtandoCabosUploader from './admin/AtandoCabosUploader';
import EslabonesUploader from './admin/EslabonesUploader';
import VerbVault from './admin/MasterDashboard/components/VerbVault';
import VocabVault from './admin/MasterDashboard/components/VocabVault';
import TareasDashboard from './admin/MasterDashboard/components/TareasDashboard';
import FormLearningPath from './admin/FormLearningPath/FormLearningPath';
import StudentLearningPath from './pages/StudentLearningPath';
import WorkoutEngine from './pages/WorkoutEngine';
import TeacherGradebook from './admin/MasterDashboard/TeacherGradebook';
import CalentamientoAdmin from './admin/MasterDashboard/CalentamientoAdmin';
import CalentamientoEngine from './pages/CalentamientoEngine';
import EvaluacionesSequencer from './admin/EvaluacionesSequencer';
import CuriosidadesUploader from './admin/CuriosidadesUploader';
import GramaticaSequencer from './admin/GramaticaSequencer';
import CuriosidadesManager from './admin/CuriosidadesManager';
import TareasSequencer from './admin/MasterDashboard/components/TareasSequencer';
import DailyPlanHub from './admin/MasterDashboard/components/DailyPlanHub';

// 🚀 THE NEW BOUNCER COMPONENT
// This wraps around any route you want to protect. If a student tries to enter, it kicks them back to the dashboard.
const AdminRoute = ({ user, role, children }) => {
  if (!user || role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 👈 New state to hold the role
  const [loading, setLoading] = useState(true);

  // Auth Listener (Now fetches the role from Firestore!)
  // Auth Listener (Now fetches the role from Firestore AND stops loading!)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        try {
          // 1. The user logged in. Grab their profile from Firestore.
          const userRef = doc(db, 'users', authUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            // 2. Set both the user object AND the specific role state
            setUser({ ...authUser, ...userData });
            setRole(userData.role || null);
          } else {
            // Fallback if they don't have a Firestore profile yet
            setUser(authUser);
            setRole(null);
          }
        } catch (error) {
          console.error('Error fetching Firestore profile:', error);
          setUser(authUser);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
      }

      // 3. STOP THE LOADING SPINNER!
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <h2 className="text-xl font-bold animate-pulse text-slate-400 uppercase tracking-widest">
          Cargando el Gimnasio...
        </h2>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Global Header */}
        <header className="w-full max-w-6xl mx-auto flex justify-between items-center px-4 sm:px-6 pt-6 pb-2">
          {/* Replaced Title based on your earlier request! */}
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter">
            ESPAÑOL CON SEÑOR
          </h1>
          <div className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            SESIÓN: {user.email} | ROL: {role}
          </div>
        </header>

        <main className="w-full flex-grow">
          <Routes>
            {/* 🟢 PUBLIC STUDENT ROUTES (Anyone logged in can see these) */}
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/juegos/senordle" element={<SenordlePage />} />
            <Route path="/actividad/:type/:id" element={<ActivityPage />} />
            <Route path="/recreo" element={<RecreoHub />} />
            <Route path="/recreo/ticotalk" element={<TicoTalk />} />
            <Route path="/juegos/atandocabos" element={<AtandoCabosPage />} />
            <Route path="/juegos/eslabones" element={<EslabonesFinales />} />

            <Route path="/musica/:id" element={<MusicPage />} />
            <Route
              path="/student-learning-path"
              element={<StudentLearningPath />}
            />
            <Route
              path="/student-learning-path-questions"
              element={<WorkoutEngine />}
            />

            {/* 🔴 SECURE ADMIN ROUTES (Only 'admin' can access these) */}
            <Route
              path="/admin-secret-portal"
              element={
                <AdminRoute user={user} role={role}>
                  <MusicUploader />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-vocab"
              element={
                <AdminRoute user={user} role={role}>
                  <VocabUploader />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-verb"
              element={
                <AdminRoute user={user} role={role}>
                  <VerbUploader />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-cultura"
              element={
                <AdminRoute user={user} role={role}>
                  <CulturaUploader />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-tieredcultura"
              element={
                <AdminRoute user={user} role={role}>
                  <TieredCulturaUploader />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-destacado"
              element={
                <AdminRoute user={user} role={role}>
                  <DestacadoUploader />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-master"
              element={
                <AdminRoute user={user} role={role}>
                  <MasterDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-senordle"
              element={
                <AdminRoute user={user} role={role}>
                  <SenordleUploader />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-atando"
              element={
                <AdminRoute user={user} role={role}>
                  <AtandoCabosUploader />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-eslabon"
              element={
                <AdminRoute user={user} role={role}>
                  <EslabonesUploader />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-verbvault"
              element={
                <AdminRoute user={user} role={role}>
                  <VerbVault />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-vocabvault"
              element={
                <AdminRoute user={user} role={role}>
                  <VocabVault />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-tareas"
              element={
                <AdminRoute user={user} role={role}>
                  <TareasDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-daily-plan-hub"
              element={
                <AdminRoute user={user} role={role}>
                  <DailyPlanHub />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-learning-path"
              element={
                <AdminRoute user={user} role={role}>
                  <FormLearningPath />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-grades"
              element={
                <AdminRoute user={user} role={role}>
                  <TeacherGradebook />
                </AdminRoute>
              }
            />
            <Route
              path="/calentamiento"
              element={<CalentamientoEngine targetDia={1} courseId="s2" />}
            />
<Route
  path="/admin-daily-plan-evals"
  element={
    <AdminRoute user={user} role={role}>
      <EvaluacionesSequencer />
    </AdminRoute>
  }
/>
<Route
  path="/admin-daily-plan-gramatica"
  element={
    <AdminRoute user={user} role={role}>
      <GramaticaSequencer />
    </AdminRoute>
  }
/>
<Route
  path="/admin-daily-plan-curiosidades"
  element={
    <AdminRoute user={user} role={role}>
      <CuriosidadesManager />
    </AdminRoute>
  }
/>
<Route
  path="/admin-daily-plan-tareas"
  element={
    <AdminRoute user={user} role={role}>
      <TareasSequencer />
    </AdminRoute>
  }
/>
<Route
  path="/admin-daily-plan-curiosidadesupload"
  element={
    <AdminRoute user={user} role={role}>
      <CuriosidadesUploader />
    </AdminRoute>
  }
/>

            <Route path="/admin-secret-portal-calentamiento"
              element={
                <AdminRoute user={user} role={role}>
                  <CalentamientoAdmin />
                </AdminRoute>
              }
            />

            <Route path="/admin-secret-portal-calentamiento"
              element={
                <AdminRoute user={user} role={role}>
                  <CalentamientoAdmin />
                </AdminRoute>
              }
            />

            <Route
              path="/test-firebase"
              element={
                <AdminRoute user={user} role={role}>
                  <CulturaSandbox />
                </AdminRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
