import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  doc, collection, onSnapshot, updateDoc, getDoc, addDoc,
  increment, runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PointsIndicator from '../components/PointsIndicator';
import { awardPoints } from '../utils/pointsHelper';

const POINTS_PER_ROUND = 5;

const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);

const pickTheme = (allThemes, usedThemes) => {
  const fresh = allThemes.filter((t) => !usedThemes.includes(t));
  const pool = fresh.length > 0 ? fresh : allThemes;
  return pool[Math.floor(Math.random() * pool.length)];
};

const ImpostorRoomPage = () => {
  const { roomCode } = useParams();
  const { currentUser } = useAuth();

  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [clueText, setClueText] = useState('');
  const [error, setError] = useState('');
  const [pointsFlash, setPointsFlash] = useState(null);
  const scoredRoundRef = useRef(0);

  const roomRef = doc(db, 'impostor_rooms', roomCode);

  useEffect(() => {
    const unsubRoom = onSnapshot(roomRef, (snap) => {
      if (snap.exists()) {
        setRoom({ id: snap.id, ...snap.data() });
      } else {
        setRoom(null);
      }
      setLoading(false);
    });

    const unsubPlayers = onSnapshot(collection(db, 'impostor_rooms', roomCode, 'players'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
      setPlayers(list);
    });

    const unsubMessages = onSnapshot(collection(db, 'impostor_rooms', roomCode, 'messages'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setMessages(list);
    });

    return () => {
      unsubRoom();
      unsubPlayers();
      unsubMessages();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const me = players.find((p) => p.id === currentUser?.uid);
  const isHost = room?.hostId === currentUser?.uid;
  const activePlayerId = room?.turnOrder?.[room?.turnIndex];
  const isMyTurn = room?.gameState === 'playing' && room?.subPhase === 'clues' && activePlayerId === currentUser?.uid;
  const currentRoundMessages = messages.filter((m) => m.round === room?.round);

  const startGame = async () => {
    if (!isHost || players.length < 3) return;
    setError('');
    try {
      const themesSnap = await getDoc(doc(db, 'config', 'impostor_themes'));
      const themesData = themesSnap.exists() ? themesSnap.data() : {};
      const themeList = themesData[room.course] || [];
      if (themeList.length === 0) {
        setError('❌ No hay temas configurados para este curso todavía.');
        return;
      }

      const theme = pickTheme(themeList, []);
      const shuffledIds = shuffle(players.map((p) => p.id));
      const impostorCount = players.length >= 7 ? 2 : 1;
      const impostorIds = shuffledIds.slice(0, impostorCount);
      const turnOrder = shuffle(players.map((p) => p.id));

      await updateDoc(roomRef, {
        gameState: 'playing',
        subPhase: 'clues',
        theme,
        round: 1,
        turnOrder,
        turnIndex: 0,
        impostorIds,
        remainingImpostorIds: impostorIds,
        usedThemes: [theme],
        lastResult: null,
      });

      await Promise.all(players.map((p) => updateDoc(doc(db, 'impostor_rooms', roomCode, 'players', p.id), {
        role: impostorIds.includes(p.id) ? 'impostor' : 'player',
        isReady: false,
        votedFor: null,
      })));
    } catch (err) {
      console.error('Error starting Impostor game:', err);
      setError('❌ No se pudo iniciar el juego.');
    }
  };

  const advanceTurn = useCallback(async () => {
    const nextIndex = room.turnIndex + 1;
    if (nextIndex >= room.turnOrder.length) {
      await updateDoc(roomRef, { subPhase: 'discussion', turnIndex: nextIndex });
    } else {
      await updateDoc(roomRef, { turnIndex: nextIndex });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, roomCode]);

  const submitClue = async () => {
    if (!clueText.trim()) return;
    await addDoc(collection(db, 'impostor_rooms', roomCode, 'messages'), {
      playerId: currentUser.uid,
      playerName: me?.name || 'Jugador',
      clueText: clueText.trim(),
      round: room.round,
      timestamp: Date.now(),
    });
    setClueText('');
    await advanceTurn();
  };

  const toggleReady = async () => {
    await updateDoc(doc(db, 'impostor_rooms', roomCode, 'players', currentUser.uid), {
      isReady: !me?.isReady,
    });
  };

  const castVote = async (targetId) => {
    await updateDoc(doc(db, 'impostor_rooms', roomCode, 'players', currentUser.uid), {
      votedFor: targetId,
    });
  };

  // Auto-advance: discussion -> voting once everyone is ready
  useEffect(() => {
    if (!room || room.gameState !== 'playing' || room.subPhase !== 'discussion') return;
    if (players.length === 0) return;
    if (players.every((p) => p.isReady)) {
      updateDoc(roomRef, { gameState: 'voting' }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, room?.gameState, room?.subPhase]);

  // Auto-resolve: once everyone has voted, tally results (guarded transaction, runs once)
  useEffect(() => {
    if (!room || room.gameState !== 'voting') return;
    if (players.length === 0) return;
    if (!players.every((p) => p.votedFor)) return;

    const resolve = async () => {
      try {
        await runTransaction(db, async (tx) => {
          const roomSnap = await tx.get(roomRef);
          if (!roomSnap.exists()) return;
          const roomData = roomSnap.data();
          if (roomData.gameState !== 'voting') return;

          const playerSnaps = await Promise.all(
            players.map((p) => tx.get(doc(db, 'impostor_rooms', roomCode, 'players', p.id)))
          );

          const votes = {};
          playerSnaps.forEach((snap) => {
            const v = snap.data()?.votedFor;
            if (v) votes[v] = (votes[v] || 0) + 1;
          });

          let accusedId = null;
          let maxVotes = -1;
          let tie = false;
          Object.entries(votes).forEach(([id, count]) => {
            if (count > maxVotes) {
              maxVotes = count;
              accusedId = id;
              tie = false;
            } else if (count === maxVotes) {
              tie = true;
            }
          });

          const wasImpostor = !tie && roomData.impostorIds.includes(accusedId);
          let remainingImpostorIds = roomData.remainingImpostorIds || roomData.impostorIds;
          if (wasImpostor) {
            remainingImpostorIds = remainingImpostorIds.filter((id) => id !== accusedId);
          }
          const gameWon = wasImpostor && remainingImpostorIds.length === 0;

          const accusedPlayer = players.find((p) => p.id === accusedId);
          tx.update(roomRef, {
            gameState: gameWon ? 'gameover' : 'reveal',
            remainingImpostorIds,
            lastResult: {
              accusedId,
              accusedName: accusedPlayer?.name || '???',
              wasImpostor,
              tie,
              gameWon,
            },
          });
        });
      } catch (err) {
        console.error('Error resolving Impostor vote:', err);
      }
    };

    resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, room?.gameState]);

  // Each player awards their own points once a round resolves (avoids writing
  // to other users' docs). The reveal/gameover screen sits there until the
  // host advances — sometimes a while — and a plain refresh used to re-fire
  // this for the exact same round every time (scoredRoundRef lives in the
  // component, not the database, so it resets to 0 on every reload). Checking
  // the player's own persisted lastScoredRound instead closes that off.
  useEffect(() => {
    if (!currentUser || !room || !me) return;
    if (room.gameState !== 'reveal' && room.gameState !== 'gameover') return;
    if (room.round <= (me.lastScoredRound || 0)) return;
    if (room.round <= scoredRoundRef.current) return;
    scoredRoundRef.current = room.round;

    awardPoints(currentUser.uid, POINTS_PER_ROUND)
      .then(() => {
        setPointsFlash({ amount: POINTS_PER_ROUND });
        return updateDoc(doc(db, 'impostor_rooms', roomCode, 'players', currentUser.uid), {
          lastScoredRound: room.round,
        });
      })
      .catch((err) => console.error('Error awarding Impostor points:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, room?.gameState, room?.round, me?.lastScoredRound]);

  const nextRound = async () => {
    if (!isHost) return;
    try {
      const themesSnap = await getDoc(doc(db, 'config', 'impostor_themes'));
      const themesData = themesSnap.exists() ? themesSnap.data() : {};
      const themeList = themesData[room.course] || [];
      const theme = pickTheme(themeList, room.usedThemes || []);
      const turnOrder = shuffle(players.map((p) => p.id));

      await updateDoc(roomRef, {
        gameState: 'playing',
        subPhase: 'clues',
        theme,
        round: increment(1),
        turnOrder,
        turnIndex: 0,
        usedThemes: [...(room.usedThemes || []), theme],
        lastResult: null,
      });

      await Promise.all(players.map((p) => updateDoc(doc(db, 'impostor_rooms', roomCode, 'players', p.id), {
        isReady: false,
        votedFor: null,
      })));
    } catch (err) {
      console.error('Error starting next Impostor round:', err);
    }
  };

  const playAgain = async () => {
    if (!isHost) return;
    try {
      await updateDoc(roomRef, {
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
      });
      scoredRoundRef.current = 0;
      await Promise.all(players.map((p) => updateDoc(doc(db, 'impostor_rooms', roomCode, 'players', p.id), {
        role: null,
        isReady: false,
        votedFor: null,
      })));
    } catch (err) {
      console.error('Error resetting Impostor room:', err);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando sala...</div>;
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
        <p className="text-rose-400 font-black uppercase tracking-widest">Esta sala ya no existe.</p>
        <Link to="/juegos/impostor" className="text-indigo-400 font-bold underline">Volver</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 font-sans">
      <PointsIndicator flash={pointsFlash} />
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Link to="/recreo" className="text-slate-400 hover:text-white text-sm font-bold flex items-center gap-2">← Arcade</Link>
          <div className="bg-slate-900 border border-slate-700 rounded-full px-4 py-1.5 text-xs font-black tracking-[0.2em] text-fuchsia-400">
            SALA: {roomCode}
          </div>
        </div>

        {/* LOBBY */}
        {room.gameState === 'lobby' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-2xl font-black uppercase tracking-tight">Sala de Espera</h2>
            <p className="text-slate-400 text-sm">
              Curso: <span className="font-bold text-white uppercase">{room.course}</span> · Modo: <span className="font-bold text-white">{room.gameMode === 'text' ? 'Escrito' : 'Hablado'}</span>
            </p>

            <div className="space-y-2">
              {players.map((p) => (
                <div key={p.id} className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 flex justify-between items-center">
                  <span className="font-bold">{p.name}</span>
                  {p.id === room.hostId && <span className="text-[10px] font-black uppercase text-fuchsia-400">Host</span>}
                </div>
              ))}
            </div>

            {error && <p className="text-rose-400 text-xs font-bold text-center">{error}</p>}

            {isHost ? (
              <button
                onClick={startGame}
                disabled={players.length < 3}
                className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white font-black uppercase tracking-widest py-3 rounded-lg"
              >
                {players.length < 3 ? 'Se necesitan 3+ jugadores' : 'Iniciar Juego'}
              </button>
            ) : (
              <p className="text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Esperando a que el host inicie el juego...</p>
            )}
          </div>
        )}

        {/* PLAYING */}
        {room.gameState === 'playing' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ronda {room.round}</p>
            </div>

            <div
              onMouseDown={() => setRevealed(true)}
              onMouseUp={() => setRevealed(false)}
              onMouseLeave={() => setRevealed(false)}
              onTouchStart={() => setRevealed(true)}
              onTouchEnd={() => setRevealed(false)}
              className="select-none bg-slate-900 active:bg-indigo-950 border-2 border-slate-800 rounded-2xl p-10 text-center cursor-pointer transition-colors"
            >
              {revealed ? (
                me?.role === 'impostor' ? (
                  <p className="text-3xl sm:text-4xl font-black text-rose-500 tracking-widest uppercase">¡Eres el Impostor!</p>
                ) : (
                  <p className="text-3xl sm:text-4xl font-black text-white tracking-widest uppercase">{room.theme}</p>
                )
              ) : (
                <p className="text-slate-600 font-black uppercase tracking-widest">Mantén presionado para ver</p>
              )}
            </div>

            {room.subPhase === 'clues' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
                <p className="text-lg font-bold">
                  {isMyTurn ? '¡Te toca!' : <>Le toca a <span className="text-fuchsia-400">{players.find((p) => p.id === activePlayerId)?.name}</span></>}
                </p>

                {isMyTurn && room.gameMode === 'text' && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={clueText}
                      onChange={(e) => setClueText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submitClue()}
                      placeholder="Escribe tu pista..."
                      className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-fuchsia-500"
                    />
                    <button onClick={submitClue} className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold px-4 py-2 rounded-lg">Enviar</button>
                  </div>
                )}

                {isMyTurn && room.gameMode === 'speaking' && (
                  <button onClick={advanceTurn} className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black uppercase tracking-widest px-6 py-3 rounded-lg">
                    Ya di mi pista → Siguiente
                  </button>
                )}

                {room.gameMode === 'text' && currentRoundMessages.length > 0 && (
                  <div className="text-left bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                    {currentRoundMessages.map((m) => (
                      <p key={m.id} className="text-sm"><span className="font-bold text-fuchsia-400">{m.playerName}:</span> {m.clueText}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {room.subPhase === 'discussion' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <p className="text-center font-bold uppercase tracking-widest text-slate-400 text-sm">Discusión</p>

                {room.gameMode === 'text' && (
                  <div className="text-left bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                    {currentRoundMessages.map((m) => (
                      <p key={m.id} className="text-sm"><span className="font-bold text-fuchsia-400">{m.playerName}:</span> {m.clueText}</p>
                    ))}
                  </div>
                )}

                <button
                  onClick={toggleReady}
                  className={`w-full font-black uppercase tracking-widest py-3 rounded-lg transition-colors ${me?.isReady ? 'bg-emerald-600 text-white' : 'bg-slate-800 border-2 border-slate-700 text-slate-300'}`}
                >
                  {me?.isReady ? '✓ Estoy Listo' : 'Estoy Listo'}
                </button>
                <p className="text-center text-xs text-slate-500 font-bold">
                  {players.filter((p) => p.isReady).length}/{players.length} listos
                </p>
              </div>
            )}
          </div>
        )}

        {/* VOTING */}
        {room.gameState === 'voting' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-black uppercase tracking-widest text-center">¿Quién es el Impostor?</h2>
            <div className="grid grid-cols-2 gap-3">
              {players.filter((p) => p.id !== currentUser.uid).map((p) => (
                <button
                  key={p.id}
                  onClick={() => castVote(p.id)}
                  className={`p-4 rounded-xl border-2 font-bold transition-colors ${me?.votedFor === p.id ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-800 border-slate-700 hover:border-rose-500'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-slate-500 font-bold">
              {players.filter((p) => p.votedFor).length}/{players.length} han votado
            </p>
          </div>
        )}

        {/* REVEAL */}
        {room.gameState === 'reveal' && room.lastResult && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-center">
            <h2 className="text-2xl font-black uppercase tracking-tight">
              {room.lastResult.tie ? 'Empate en la votación' : `${room.lastResult.accusedName} ${room.lastResult.wasImpostor ? 'era el Impostor' : 'era Inocente'}`}
            </h2>
            <p className="text-slate-400 text-sm">
              {room.lastResult.wasImpostor ? 'El tema era: ' : 'Sigan buscando. El tema era: '}
              <span className="text-white font-bold">{room.theme}</span>
            </p>
            {isHost ? (
              <button onClick={nextRound} className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black uppercase tracking-widest py-3 rounded-lg">
                Siguiente Ronda
              </button>
            ) : (
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Esperando al host...</p>
            )}
          </div>
        )}

        {/* GAME OVER */}
        {room.gameState === 'gameover' && room.lastResult && (
          <div className="bg-emerald-950/30 border-2 border-emerald-700 rounded-2xl p-8 space-y-4 text-center">
            <h2 className="text-3xl font-black uppercase tracking-tight text-emerald-400">¡Atrapado!</h2>
            <p className="text-white">
              <span className="font-bold">{room.lastResult.accusedName}</span> era el impostor. ¡Ganó el grupo!
            </p>
            {isHost ? (
              <button onClick={playAgain} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest py-3 rounded-lg">
                Jugar de Nuevo
              </button>
            ) : (
              <p className="text-xs text-emerald-500/70 font-bold uppercase tracking-widest">Esperando al host...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImpostorRoomPage;
