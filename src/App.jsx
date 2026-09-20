import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// 🎓 STUDENT ECOSYSTEM & PAGES
import Login from './student/Login';
import Dashboard from './student/Dashboard';
import MusicaEngine from './student/MusicaEngine';
import AtandoCabosPage from './student/AtandoCabosPage';
import CalentamientoEngine from './student/CalentamientoEngine';
import CulturaSandbox from './student/CulturaSandbox';
import EslabonesFinales from './student/EslabonesFinales';
import RecreoHub from './student/RecreoHub';
import SenordlePage from './student/SenordlePage';
import StudentLearningPath from './student/StudentLearningPath';
import TicoTalk from './student/TicoTalk';
import WorkoutEngine from './student/WorkoutEngine';
import GrammarNoteViewer from './student/GrammarNoteViewer';
import VocabPage from './student/VocabPage';
import LecturaPage from './student/LecturaPage'; // 👈 NEW STUDENT READING ROUTE
import FotosAzarPage from './student/FotosAzarPage';
import ResourceHubManager from './admin/managers/ResourceHubManager';
import ConectoresEngine from './student/ConectoresEngine';
import ImpostorLobbyPage from './student/ImpostorLobbyPage';
import ImpostorRoomPage from './student/ImpostorRoomPage';
import SampleSentencesPage from './student/SampleSentencesPage';
import SilabasPage from './student/SilabasPage';


// ⚙️ GLOBAL UI COMPONENTS
import ActivityPage from './components/ActivityPage';

// 🛠️ ADMIN MANAGERS & HUBS
import MasterDashboard from './admin/MasterDashboard/MasterDashboard';
import TeacherGradebook from './admin/MasterDashboard/TeacherGradebook';
import DailyPlanHub from './admin/MasterDashboard/components/DailyPlanHub';
import VerbVault from './admin/MasterDashboard/components/VerbVault';
import VocabVault from './admin/MasterDashboard/components/VocabVault';
import TareasDashboard from './admin/MasterDashboard/components/TareasDashboard';
import TareasSequencer from './admin/MasterDashboard/components/TareasSequencer';
import FormSenordle from './admin/MasterDashboard/components/FormSenordle';
import FormAtandoCabos from './admin/MasterDashboard/components/FormAtandoCabos';
import FormEslabones from './admin/MasterDashboard/components/FormEslabones';
import LecturaEditorPage from './admin/MasterDashboard/components/LecturaEditorPage'; // 👈 NEW ADMIN EDITOR
import LecturasSequencer from './admin/MasterDashboard/components/LecturasSequencer';     // 👈 NEW ADMIN SEQUENCER
import ConectoresManager from './admin/managers/ConectoresManager';
import ImpostorThemesManager from './admin/managers/ImpostorThemesManager';
import SampleSentencesManager from './admin/managers/SampleSentencesManager';
import CalentamientoAdmin from './admin/managers/CalentamientoAdmin';
import SilabasAdmin from './admin/managers/SilabasAdmin';
import CuriosidadesManager from './admin/managers/CuriosidadesManager';
import DestacadoManager from './admin/managers/DestacadoManager';
import MusicaEditor from './admin/managers/MusicaEditor';
import MusicaManager from './admin/managers/MusicaManager';
import PrintMusica from './admin/managers/PrintMusica';
import VideosManager from './admin/managers/VideosManager';

// 📈 ADMIN SEQUENCERS & LEARNING PATHS
import EvaluacionesSequencer from './admin/sequencers/EvaluacionesSequencer';
import GramaticaSequencer from './admin/sequencers/GramaticaSequencer';
import FormLearningPath from './admin/FormLearningPath/FormLearningPath';
import VocabSequencer from './admin/sequencers/VocabSequencer';
import SentenceManager from './admin/managers/SentenceManager';
// 📦 LEGACY ADMIN UPLOADERS
import CulturaUploader from './admin/uploaders/CulturaUploader';
import CuriosidadesUploader from './admin/uploaders/CuriosidadesUploader';
import DestacadoUploader from './admin/uploaders/DestacadoUploader';
import SenordleUploader from './admin/uploaders/SenordleUploader';
import TieredCulturaUploader from './admin/uploaders/TieredCulturaUploader';
import VerbUploader from './admin/uploaders/VerbUploader';
import VocabUploader from './admin/uploaders/VocabUploader';

// 🛡️ ADMIN BOUNCER COMPONENT
const AdminRoute = ({ user, role, children }) => {
  if (!user || role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        try {
          const userRef = doc(db, 'users', authUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            setUser({ ...authUser, ...userData });
            setRole(userData.role || null);
          } else {
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
        {user?.isAnonymous && (
          <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md">
            <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
              <span className="font-black text-xs sm:text-sm uppercase tracking-wide">
                👤 Sesión de Invitado — tu progreso no se guardará
              </span>
              <button
                onClick={() => signOut(auth)}
                className="bg-white/20 hover:bg-white text-white hover:text-orange-700 font-black text-[11px] uppercase tracking-wide px-3 py-1 rounded-md transition-colors"
              >
                Crear Cuenta
              </button>
            </div>
          </div>
        )}
        <main className="w-full flex-grow">
          <Routes>
            {/* 🟢 PUBLIC STUDENT ROUTES */}
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/juegos/senordle" element={<SenordlePage />} />
            <Route path="/actividad/:type/:id" element={<ActivityPage />} />
            <Route path="/recreo" element={<RecreoHub />} />
            <Route path="/recreo/ticotalk" element={<TicoTalk />} />
            <Route path="/juegos/atandocabos" element={<AtandoCabosPage />} />
            <Route path="/juegos/eslabones" element={<EslabonesFinales />} />
            <Route path="/juegos/impostor" element={<ImpostorLobbyPage />} />
            <Route path="/juegos/impostor/:roomCode" element={<ImpostorRoomPage />} />
            <Route path="/juegos/silabas" element={<SilabasPage />} />
            <Route path="/practica/oraciones/:courseId/:targetDia" element={<SampleSentencesPage />} />
            <Route path="/musica/:id" element={<MusicaEngine />} />
            <Route path="/student-learning-path" element={<StudentLearningPath />} />
            <Route path="/student-learning-path-questions" element={<WorkoutEngine />} />
            <Route path="/calentamiento/:courseId/:targetDia" element={<CalentamientoEngine />} />
            <Route path="/gramatica/:noteId" element={<GrammarNoteViewer />} />
            <Route path="/vocabulario/:bundleId" element={<VocabPage />} />
            <Route path="/lectura/:lecturaId" element={<LecturaPage />} /> {/* 👈 STUDENT ROUTE */}
            <Route path="/fotos-azar" element={<FotosAzarPage />} />
            <Route path="/practica/conectores" element={<ConectoresEngine />} />


            {/* 🔴 SECURE ADMIN ROUTES */}
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
              path="/admin-vocab-sequencer"
              element={
                <AdminRoute user={user} role={role}>
                  <VocabSequencer />
                </AdminRoute>
              }
            />
            {/* 👈 NEW ADMIN LECTURAS ROUTES */}
            <Route
              path="/admin-lecturas-editor"
              element={
                <AdminRoute user={user} role={role}>
                  <LecturaEditorPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-lecturas-sequencer"
              element={
                <AdminRoute user={user} role={role}>
                  <LecturasSequencer />
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
              path="/admin-daily-plan-musica"
              element={
                <AdminRoute user={user} role={role}>
                  <MusicaManager />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-musica-editor/:id"
              element={
                <AdminRoute user={user} role={role}>
                  <MusicaEditor />
                </AdminRoute>
              }
            />
            <Route
  path="/admin-resource-hub"
  element={
    <AdminRoute user={user} role={role}>
      <ResourceHubManager />
    </AdminRoute>
  }
/>
<Route
  path="/admin-secret-portal-conectores"
  element={
    <AdminRoute user={user} role={role}>
      <ConectoresManager />
    </AdminRoute>
  }
/>

            <Route
              path="/print-musica/:id"
              element={
                <AdminRoute user={user} role={role}>
                  <PrintMusica />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-daily-plan-destacado"
              element={
                <AdminRoute user={user} role={role}>
                  <DestacadoManager />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-daily-plan-videos"
              element={
                <AdminRoute user={user} role={role}>
                  <VideosManager />
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
              path="/admin-daily-plan-atandocabos"
              element={
                <AdminRoute user={user} role={role}>
                  <FormAtandoCabos />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-daily-plan-eslabones"
              element={
                <AdminRoute user={user} role={role}>
                  <FormEslabones />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-impostor-themes"
              element={
                <AdminRoute user={user} role={role}>
                  <ImpostorThemesManager />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-oraciones"
              element={
                <AdminRoute user={user} role={role}>
                  <SampleSentencesManager />
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
  path="/admin-secret-portal-sentences"
  element={
    <AdminRoute user={user} role={role}>
      <SentenceManager />
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
            <Route
              path="/admin-secret-portal-calentamiento"
              element={
                <AdminRoute user={user} role={role}>
                  <CalentamientoAdmin />
                </AdminRoute>
              }
            />
            <Route
              path="/admin-secret-portal-silabas"
              element={
                <AdminRoute user={user} role={role}>
                  <SilabasAdmin />
                </AdminRoute>
              }
            />
            <Route path="/admin-daily-plan-senordle" element={<FormSenordle />} />
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
