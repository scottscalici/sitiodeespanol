import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const CODE_WORDS = [
  'GATO', 'AZUL', 'LUNA', 'PATO', 'MESA', 'LIBRO', 'PLAYA', 'VERDE',
  'RATON', 'FLOR', 'NUBE', 'RIO', 'SOL', 'ARBOL', 'PERRO', 'ROJO',
  'CIELO', 'MONTE', 'TREN', 'PAN',
];

const generateRoomCode = () => CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];

// Only 20 possible codes, shared globally across every class/period using
// the site — a code gets reused constantly. Overwriting the room doc alone
// leaves its 'players' and 'messages' subcollections untouched (Firestore
// subcollections aren't cleared by setDoc on the parent), so without this,
// students from whichever earlier game last used this code — possibly a
// different class entirely — silently reappear in the new game and can even
// get handed a "turn".
const clearStaleRoomData = async (code) => {
  const batch = writeBatch(db);
  const playersSnap = await getDocs(collection(db, 'impostor_rooms', code, 'players'));
  playersSnap.forEach((d) => batch.delete(d.ref));
  const messagesSnap = await getDocs(collection(db, 'impostor_rooms', code, 'messages'));
  messagesSnap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};

const ImpostorLobbyPage = () => {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('menu'); // menu | create | join
  const [gameMode, setGameMode] = useState('speaking');
  const [course, setCourse] = useState(userData?.course || 's2');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const playerName = userData?.firstName
    ? `${userData.firstName} ${userData.lastName}`
    : (currentUser?.email?.split('@')[0] || 'Jugador');

  const handleCreateRoom = async () => {
    if (!currentUser) return;
    setBusy(true);
    setError('');
    try {
      let code = generateRoomCode();
      let attempts = 0;
      let roomRef = doc(db, 'impostor_rooms', code);
      let roomSnap = await getDoc(roomRef);
      while (roomSnap.exists() && roomSnap.data().gameState !== 'gameover' && attempts < 10) {
        code = generateRoomCode();
        roomRef = doc(db, 'impostor_rooms', code);
        roomSnap = await getDoc(roomRef);
        attempts += 1;
      }

      // The loop above only skips codes that are ACTIVELY in use (not yet
      // gameover) — it can still exit with every retry exhausted while that
      // last-checked room is still mid-game. Overwriting it here would boot
      // that class's game and merge two groups of students into one room.
      if (roomSnap.exists() && roomSnap.data().gameState !== 'gameover') {
        setError('❌ Todas las salas están ocupadas ahora mismo. Intenta de nuevo en un momento.');
        setBusy(false);
        return;
      }

      // Reusing a code from a previous, finished game — clear its old
      // players/messages so students from that earlier game (possibly a
      // different class) don't reappear in this one.
      if (roomSnap.exists()) {
        await clearStaleRoomData(code);
      }

      await setDoc(roomRef, {
        hostId: currentUser.uid,
        hostName: playerName,
        course,
        gameMode,
        gameState: 'lobby',
        subPhase: 'clues',
        theme: '',
        round: 0,
        turnOrder: [],
        turnIndex: 0,
        impostorIds: [],
        remainingImpostorIds: [],
        usedThemes: [],
        lastResult: null,
        createdAt: new Date().toISOString(),
      });

      await setDoc(doc(db, 'impostor_rooms', code, 'players', currentUser.uid), {
        name: playerName,
        role: null,
        isReady: false,
        votedFor: null,
        joinedAt: Date.now(),
      });

      navigate(`/juegos/impostor/${code}`);
    } catch (err) {
      console.error('Error creating Impostor room:', err);
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
      const roomRef = doc(db, 'impostor_rooms', code);
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

      await setDoc(doc(db, 'impostor_rooms', code, 'players', currentUser.uid), {
        name: playerName,
        role: null,
        isReady: false,
        votedFor: null,
        joinedAt: Date.now(),
      }, { merge: true });

      navigate(`/juegos/impostor/${code}`);
    } catch (err) {
      console.error('Error joining Impostor room:', err);
      setError(`❌ No se pudo unir a la sala. (${err.code || err.message})`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full">
        <Link to="/recreo" className="text-slate-400 hover:text-white text-sm font-bold flex items-center gap-2 mb-6">
          ← Arcade
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500">
            Impostor
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Encuentra al impostor entre el grupo</p>
        </div>

        {mode === 'menu' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-lg transition-colors"
            >
              Crear Sala
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full bg-slate-800 border-2 border-slate-700 hover:border-indigo-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-colors"
            >
              Unirse a Sala
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Curso</label>
              <div className="flex gap-3">
                <button onClick={() => setCourse('s2')} className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest ${course === 's2' ? 'bg-fuchsia-600 text-white' : 'bg-slate-800 text-slate-400'}`}>S2</button>
                <button onClick={() => setCourse('s4')} className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest ${course === 's4' ? 'bg-fuchsia-600 text-white' : 'bg-slate-800 text-slate-400'}`}>S4</button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Modo de Juego</label>
              <div className="flex gap-3">
                <button onClick={() => setGameMode('speaking')} className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest ${gameMode === 'speaking' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>🗣️ Hablado</button>
                <button onClick={() => setGameMode('text')} className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest ${gameMode === 'text' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>⌨️ Escrito</button>
              </div>
            </div>

            {error && <p className="text-rose-400 text-xs font-bold text-center">{error}</p>}

            <button
              onClick={handleCreateRoom}
              disabled={busy}
              className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors"
            >
              {busy ? 'Creando...' : 'Crear'}
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
    </div>
  );
};

export default ImpostorLobbyPage;
