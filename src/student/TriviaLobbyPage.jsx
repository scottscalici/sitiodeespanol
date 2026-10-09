import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { listPoolQuestions, getCategoryImages, resolvePoolQuestionImage } from '../utils/questionPool';
import { generateRoomCode, buildQuestionSet } from '../utils/triviaGame';
import QuestionPoolPickerModal from '../admin/shared/QuestionPoolPickerModal';

const DEFAULT_TIME_LIMIT = 20;

// Teacher-hosted only, unlike Impostor — a student can join a room but never
// create one, so "Crear Sala" is gated on role the same way the rest of the
// admin surfaces are, rather than being open to anyone the way Impostor's
// peer-to-peer game deliberately is.
const TriviaLobbyPage = () => {
  const { currentUser, userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const navigate = useNavigate();
  const [mode, setMode] = useState('menu'); // menu | create | join
  const [course, setCourse] = useState(userData?.course || 's2');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [poolEntries, setPoolEntries] = useState([]);
  const [categoryImages, setCategoryImages] = useState({});
  const [categoryRows, setCategoryRows] = useState([{ category: '', count: 5 }]);
  const [handPicked, setHandPicked] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(DEFAULT_TIME_LIMIT);

  useEffect(() => {
    if (mode !== 'create' || !isAdmin) return;
    Promise.all([listPoolQuestions(), getCategoryImages()])
      .then(([entries, images]) => {
        setPoolEntries(entries);
        setCategoryImages(images);
      })
      .catch((err) => console.error('Error loading question pool for trivia setup:', err));
  }, [mode, isAdmin]);

  const categories = useMemo(
    () => [...new Set(poolEntries.map((e) => e.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [poolEntries]
  );

  // Approximate running total shown while building the set — the exact
  // count can come in lower once random draws and hand-picks are deduped,
  // so this is "up to", not a guarantee.
  const approxTotal =
    categoryRows.reduce((sum, row) => sum + (Number(row.count) || 0), 0) + handPicked.length;

  const playerName = userData?.firstName
    ? `${userData.firstName} ${userData.lastName}`
    : (currentUser?.email?.split('@')[0] || 'Jugador');

  const addCategoryRow = () => setCategoryRows((prev) => [...prev, { category: '', count: 5 }]);
  const updateCategoryRow = (idx, patch) =>
    setCategoryRows((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const removeCategoryRow = (idx) => setCategoryRows((prev) => prev.filter((_, i) => i !== idx));

  const handleCreateRoom = async () => {
    if (!currentUser || !isAdmin) return;
    setBusy(true);
    setError('');
    try {
      const questions = buildQuestionSet({
        allEntries: poolEntries,
        categoryRows: categoryRows.filter((r) => r.category),
        handPicked,
        categoryImages,
        resolveImage: resolvePoolQuestionImage,
      });

      if (questions.length === 0) {
        setError('❌ Agrega al menos una categoría con preguntas, o elige preguntas específicas.');
        setBusy(false);
        return;
      }

      let code = generateRoomCode();
      let attempts = 0;
      let roomRef = doc(db, 'trivia_rooms', code);
      let roomSnap = await getDoc(roomRef);
      while (roomSnap.exists() && roomSnap.data().gameState !== 'gameover' && attempts < 10) {
        code = generateRoomCode();
        roomRef = doc(db, 'trivia_rooms', code);
        roomSnap = await getDoc(roomRef);
        attempts += 1;
      }
      if (roomSnap.exists() && roomSnap.data().gameState !== 'gameover') {
        setError('❌ Todas las salas están ocupadas ahora mismo. Intenta de nuevo en un momento.');
        setBusy(false);
        return;
      }

      await setDoc(roomRef, {
        hostId: currentUser.uid,
        hostName: playerName,
        course,
        gameState: 'lobby',
        questions,
        currentQuestionIndex: 0,
        questionStartedAt: null,
        timeLimitSeconds: Number(timeLimitSeconds) || DEFAULT_TIME_LIMIT,
        createdAt: new Date().toISOString(),
      });

      await setDoc(doc(db, 'trivia_rooms', code, 'players', currentUser.uid), {
        name: playerName,
        score: 0,
        lastScoredQuestionIndex: -1,
        pointsAwarded: false,
        joinedAt: Date.now(),
      });

      navigate(`/juegos/trivia/${code}`);
    } catch (err) {
      console.error('Error creating trivia room:', err);
      setError(`❌ No se pudo crear la sala. (${err.code || err.message})`);
    } finally {
      setBusy(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!currentUser || !joinCode.trim()) return;
    setBusy(true);
    setError('');
    try {
      const code = joinCode.trim().toUpperCase();
      const roomRef = doc(db, 'trivia_rooms', code);
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
        setError('❌ No existe una sala con ese código.');
        setBusy(false);
        return;
      }
      if (roomSnap.data().gameState !== 'lobby') {
        setError('❌ Esa sala ya empezó a jugar.');
        setBusy(false);
        return;
      }

      await setDoc(doc(db, 'trivia_rooms', code, 'players', currentUser.uid), {
        name: playerName,
        score: 0,
        lastScoredQuestionIndex: -1,
        pointsAwarded: false,
        joinedAt: Date.now(),
      }, { merge: true });

      navigate(`/juegos/trivia/${code}`);
    } catch (err) {
      console.error('Error joining trivia room:', err);
      setError(`❌ No se pudo unir a la sala. (${err.code || err.message})`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans">
      <div className="max-w-lg w-full">
        <Link to="/recreo" className="text-slate-400 hover:text-white text-sm font-bold flex items-center gap-2 mb-6">
          ← Arcade
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500">
            Trivia en Vivo
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Compite en tiempo real con toda la clase</p>
        </div>

        {mode === 'menu' && (
          <div className="space-y-4">
            {isAdmin && (
              <button
                onClick={() => setMode('create')}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-lg transition-colors"
              >
                Crear Sala
              </button>
            )}
            <button
              onClick={() => setMode('join')}
              className="w-full bg-slate-800 border-2 border-slate-700 hover:border-indigo-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-colors"
            >
              Unirse a Sala
            </button>
          </div>
        )}

        {mode === 'create' && isAdmin && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Curso</label>
              <div className="flex gap-3">
                <button onClick={() => setCourse('s2')} className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest ${course === 's2' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>S2</button>
                <button onClick={() => setCourse('s4')} className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest ${course === 's4' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>S4</button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Preguntas por Categoría</label>
              <div className="space-y-2">
                {categoryRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={row.category}
                      onChange={(e) => updateCategoryRow(idx, { category: e.target.value })}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-white"
                    >
                      <option value="">Elige categoría...</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={row.count}
                      onChange={(e) => updateCategoryRow(idx, { count: e.target.value })}
                      className="w-16 bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-black text-center text-white"
                    />
                    <button onClick={() => removeCategoryRow(idx)} className="text-slate-500 hover:text-rose-400 text-sm px-1">✕</button>
                  </div>
                ))}
              </div>
              <button onClick={addCategoryRow} className="mt-2 text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest">
                + Agregar Categoría
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Preguntas Específicas</label>
                <button onClick={() => setPickerOpen(true)} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest">
                  🔍 Elegir
                </button>
              </div>
              {handPicked.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Ninguna elegida a mano todavía.</p>
              ) : (
                <div className="space-y-1">
                  {handPicked.map((q) => (
                    <div key={q.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-1.5">
                      <span className="text-xs font-bold truncate">{q.clue}</span>
                      <button onClick={() => setHandPicked((prev) => prev.filter((p) => p.id !== q.id))} className="text-slate-500 hover:text-rose-400 text-xs px-1 shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tiempo por Pregunta (seg)</label>
              <input
                type="number"
                min="5"
                value={timeLimitSeconds}
                onChange={(e) => setTimeLimitSeconds(e.target.value)}
                className="w-16 bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-black text-center text-white"
              />
            </div>

            <p className="text-center text-xs font-bold text-slate-400">~{approxTotal} pregunta{approxTotal === 1 ? '' : 's'} en total</p>

            {error && <p className="text-rose-400 text-xs font-bold text-center">{error}</p>}

            <button
              onClick={handleCreateRoom}
              disabled={busy}
              className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors"
            >
              {busy ? 'Creando...' : 'Crear Sala'}
            </button>
            <button onClick={() => setMode('menu')} className="w-full text-slate-500 text-xs font-bold uppercase tracking-widest">Atrás</button>
          </div>
        )}

        {mode === 'join' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Código de Sala</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="GATO"
                className="w-full bg-slate-800 border border-slate-700 text-white text-center text-2xl font-black tracking-[0.3em] rounded-lg p-3 focus:outline-none focus:border-indigo-500 uppercase"
              />
            </div>

            {error && <p className="text-rose-400 text-xs font-bold text-center">{error}</p>}

            <button
              onClick={handleJoinRoom}
              disabled={busy || !joinCode.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors"
            >
              {busy ? 'Uniendo...' : 'Unirse'}
            </button>
            <button onClick={() => setMode('menu')} className="w-full text-slate-500 text-xs font-bold uppercase tracking-widest">Atrás</button>
          </div>
        )}
      </div>

      {pickerOpen && (
        <QuestionPoolPickerModal
          onClose={() => setPickerOpen(false)}
          onSelect={(picked) => {
            setHandPicked((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              return [...prev, ...picked.filter((p) => !existingIds.has(p.id))];
            });
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default TriviaLobbyPage;
