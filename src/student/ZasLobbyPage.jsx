import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { getCachedCollection } from '../utils/firestoreCache';
import { formatVocabSectionLabel } from '../utils/vocabSectionLabel';
import { generateRoomCode, buildZasWordSet, layoutBoard } from '../utils/zasGame';

const DEFAULT_WORD_COUNT = 20;

// Teacher-hosted only, same as Ráfaga (Trivia) — the teacher reads clues out
// loud live, so "Crear Sala" is gated on role; a student can only join.
const ZasLobbyPage = () => {
  const { currentUser, userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const navigate = useNavigate();
  const [mode, setMode] = useState('menu'); // menu | create | join
  const [course, setCourse] = useState(userData?.course || 's2');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [vocabEntries, setVocabEntries] = useState([]);
  const [textbook, setTextbook] = useState('');
  const [section, setSection] = useState('all');
  const [wordCount, setWordCount] = useState(DEFAULT_WORD_COUNT);
  const [wordSet, setWordSet] = useState([]);

  useEffect(() => {
    if (mode !== 'create' || !isAdmin) return;
    getCachedCollection('vocabulary')
      .then((entries) => setVocabEntries(entries))
      .catch((err) => console.error('Error loading vocabulary for Zas setup:', err));
  }, [mode, isAdmin]);

  const textbooks = useMemo(
    () => [...new Set(vocabEntries.map((e) => e.metadata?.textbook).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [vocabEntries]
  );

  const sections = useMemo(() => {
    const all = new Set();
    vocabEntries.forEach((e) => {
      if (textbook && e.metadata?.textbook !== textbook) return;
      const secs = Array.isArray(e.metadata?.secciones) ? e.metadata.secciones : [];
      secs.forEach((s) => all.add(s));
    });
    return [...all].sort((a, b) => a.localeCompare(b, 'es'));
  }, [vocabEntries, textbook]);

  useEffect(() => {
    if (!textbook) {
      setWordSet([]);
      return;
    }
    setWordSet(buildZasWordSet(vocabEntries, { textbook, section, count: Number(wordCount) || DEFAULT_WORD_COUNT }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textbook, section, wordCount, vocabEntries]);

  const reroll = () => {
    if (!textbook) return;
    setWordSet(buildZasWordSet(vocabEntries, { textbook, section, count: Number(wordCount) || DEFAULT_WORD_COUNT }));
  };

  const playerName = userData?.firstName
    ? `${userData.firstName} ${userData.lastName}`
    : (currentUser?.email?.split('@')[0] || 'Jugador');

  const handleCreateRoom = async () => {
    if (!currentUser || !isAdmin) return;
    if (wordSet.length < 2) {
      setError('❌ Elige un libro/sección con al menos 2 palabras.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      let code = generateRoomCode();
      let attempts = 0;
      let roomRef = doc(db, 'zas_rooms', code);
      let roomSnap = await getDoc(roomRef);
      while (roomSnap.exists() && roomSnap.data().gameState !== 'gameover' && attempts < 10) {
        code = generateRoomCode();
        roomRef = doc(db, 'zas_rooms', code);
        roomSnap = await getDoc(roomRef);
        attempts += 1;
      }
      if (roomSnap.exists() && roomSnap.data().gameState !== 'gameover') {
        setError('❌ Todas las salas están ocupadas ahora mismo. Intenta de nuevo en un momento.');
        setBusy(false);
        return;
      }

      const remainingWords = wordSet;
      await setDoc(roomRef, {
        hostId: currentUser.uid,
        hostName: playerName,
        course,
        gameState: 'lobby',
        words: wordSet,
        remainingWords,
        board: layoutBoard(remainingWords),
        round: 0,
        currentTargetId: null,
        roundResult: null,
        createdAt: new Date().toISOString(),
      });

      navigate(`/juegos/zas/${code}`);
    } catch (err) {
      console.error('Error creating Zas room:', err);
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
      const roomRef = doc(db, 'zas_rooms', code);
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

      await setDoc(doc(db, 'zas_rooms', code, 'players', currentUser.uid), {
        name: playerName,
        groupId: null,
        groupLabel: '',
        score: 0,
        joinedAt: Date.now(),
      }, { merge: true });

      navigate(`/juegos/zas/${code}`);
    } catch (err) {
      console.error('Error joining Zas room:', err);
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
          <h1 className="text-4xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-500 to-red-500">
            ¡Zas!
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Encuentra la palabra antes que tu compañero</p>
        </div>

        {mode === 'menu' && (
          <div className="space-y-4">
            {isAdmin && (
              <button
                onClick={() => setMode('create')}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-lg transition-colors"
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
                <button onClick={() => setCourse('s2')} className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest ${course === 's2' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'}`}>S2</button>
                <button onClick={() => setCourse('s4')} className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest ${course === 's4' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'}`}>S4</button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Libro de Texto</label>
              <select
                value={textbook}
                onChange={(e) => { setTextbook(e.target.value); setSection('all'); }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-white"
              >
                <option value="">Elige un libro...</option>
                {textbooks.map((tb) => (
                  <option key={tb} value={tb}>{tb}</option>
                ))}
              </select>
            </div>

            {textbook && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Sección</label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-white"
                >
                  <option value="all">Todas las secciones</option>
                  {sections.map((s) => (
                    <option key={s} value={s}>{formatVocabSectionLabel(s)}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Cantidad de Palabras</label>
              <input
                type="number"
                min="2"
                max="30"
                value={wordCount}
                onChange={(e) => setWordCount(e.target.value)}
                className="w-20 bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-black text-center text-white"
              />
            </div>

            {wordSet.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Palabras ({wordSet.length})</label>
                  <button onClick={reroll} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest">🔄 Otra Selección</button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {wordSet.map((w) => (
                    <span key={w.id} className="bg-slate-800 border border-slate-700 rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-300">{w.palabra}</span>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-rose-400 text-xs font-bold text-center">{error}</p>}

            <button
              onClick={handleCreateRoom}
              disabled={busy || wordSet.length < 2}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors"
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
    </div>
  );
};

export default ZasLobbyPage;
