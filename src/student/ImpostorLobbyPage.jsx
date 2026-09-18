import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const CODE_WORDS = [
  'GATO', 'AZUL', 'LUNA', 'PATO', 'MESA', 'LIBRO', 'PLAYA', 'VERDE',
  'RATON', 'FLOR', 'NUBE', 'RIO', 'SOL', 'ARBOL', 'PERRO', 'ROJO',
  'CIELO', 'MONTE', 'TREN', 'PAN',
];

const generateRoomCode = () => CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];

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
        lastScoredRound: 0,
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
      setError('❌ No se pudo crear la sala. Intenta de nuevo.');
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
      setError('❌ No se pudo unir a la sala. Intenta de nuevo.');
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
