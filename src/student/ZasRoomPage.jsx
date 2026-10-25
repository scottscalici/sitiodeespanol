import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  doc, collection, onSnapshot, updateDoc, setDoc, increment, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PointsIndicator from '../components/PointsIndicator';
import { awardPoints } from '../utils/pointsHelper';
import { layoutBoard, tallyRoundClicks } from '../utils/zasGame';

const GROUP_WIN_POINTS = 5;
const CLASS_FASTEST_BONUS = 5;
const MAX_GROUP_SIZE = 4;

const makeGroupCode = () => Math.random().toString(36).slice(2, 5).toUpperCase();

const ZasRoomPage = () => {
  const { roomCode } = useParams();
  const { currentUser } = useAuth();

  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [clicks, setClicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupCodeInput, setGroupCodeInput] = useState('');
  const [groupError, setGroupError] = useState('');
  const [pointsFlash, setPointsFlash] = useState(null);
  const scoredRoundRef = useRef(0);

  const roomRef = doc(db, 'zas_rooms', roomCode);

  useEffect(() => {
    const unsubRoom = onSnapshot(roomRef, (snap) => {
      setRoom(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    });
    const unsubPlayers = onSnapshot(collection(db, 'zas_rooms', roomCode, 'players'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
      setPlayers(list);
    });
    return () => {
      unsubRoom();
      unsubPlayers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // Re-subscribes every time the round number changes — each round's clicks
  // live in their own subcollection, so this naturally clears stale clicks
  // from the previous round instead of needing to filter them out by hand.
  useEffect(() => {
    if (!room?.round) {
      setClicks([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'zas_rooms', roomCode, 'rounds', String(room.round), 'clicks'),
      (snap) => {
        setClicks(snap.docs.map((d) => {
          const data = d.data();
          return { id: d.id, ...data, atMs: data.timestamp?.toMillis ? data.timestamp.toMillis() : null };
        }));
      }
    );
    return () => unsub();
  }, [roomCode, room?.round]);

  const me = players.find((p) => p.id === currentUser?.uid);
  const isHost = room?.hostId === currentUser?.uid;

  const groupedPlayers = useMemo(() => {
    const map = {};
    players.forEach((p) => {
      if (!p.groupId) return;
      if (!map[p.groupId]) map[p.groupId] = [];
      map[p.groupId].push(p);
    });
    return map;
  }, [players]);
  const ungroupedPlayers = players.filter((p) => !p.groupId);

  const correctClicks = clicks.filter((c) => c.correct);
  const myClick = clicks.find((c) => c.id === currentUser?.uid);
  const alreadyAnsweredCorrectly = myClick?.correct === true;

  // --- Lobby: grouping ---
  const createGroup = async () => {
    const code = makeGroupCode();
    setGroupError('');
    await setDoc(doc(db, 'zas_rooms', roomCode, 'players', currentUser.uid), {
      groupId: code, groupLabel: code,
    }, { merge: true });
  };

  const joinGroup = async () => {
    const code = groupCodeInput.trim().toUpperCase();
    if (!code) return;
    const members = groupedPlayers[code] || [];
    if (members.length === 0) { setGroupError('❌ No existe ese grupo.'); return; }
    if (members.length >= MAX_GROUP_SIZE) { setGroupError('❌ Ese grupo ya está completo.'); return; }
    setGroupError('');
    await setDoc(doc(db, 'zas_rooms', roomCode, 'players', currentUser.uid), {
      groupId: code, groupLabel: code,
    }, { merge: true });
    setGroupCodeInput('');
  };

  const leaveGroup = async () => {
    await setDoc(doc(db, 'zas_rooms', roomCode, 'players', currentUser.uid), {
      groupId: null, groupLabel: '',
    }, { merge: true });
  };

  // --- Host controls ---
  const startGame = async () => {
    if (!isHost) return;
    await updateDoc(roomRef, { gameState: 'playing' });
  };

  const pickTarget = async (wordId) => {
    if (!isHost || room.currentTargetId) return;
    await updateDoc(roomRef, { round: increment(1), currentTargetId: wordId });
  };

  const revealRound = async () => {
    if (!isHost || !room.currentTargetId) return;
    const { groupWinners, classWinner } = tallyRoundClicks(clicks);
    const targetWord = room.remainingWords.find((w) => w.id === room.currentTargetId);
    const roundNumber = room.round;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.round !== roundNumber || data.roundResult !== null) return;
        tx.update(roomRef, {
          roundResult: {
            round: roundNumber,
            targetId: room.currentTargetId,
            palabra: targetWord?.palabra || '',
            groupWinners,
            classWinner,
          },
        });
      });
    } catch (err) {
      console.error('Error revealing Zas round:', err);
    }
  };

  const nextWord = async () => {
    if (!isHost || !room.roundResult) return;
    const newRemaining = room.remainingWords.filter((w) => w.id !== room.roundResult.targetId);
    await updateDoc(roomRef, {
      remainingWords: newRemaining,
      board: layoutBoard(newRemaining),
      currentTargetId: null,
      roundResult: null,
    });
  };

  const endGame = async () => {
    if (!isHost) return;
    await updateDoc(roomRef, { gameState: 'gameover' });
  };

  // --- Student: answering ---
  const handleWordClick = async (word) => {
    if (!room?.currentTargetId || alreadyAnsweredCorrectly || !me?.groupId) return;
    const correct = word.id === room.currentTargetId;
    try {
      await setDoc(doc(db, 'zas_rooms', roomCode, 'rounds', String(room.round), 'clicks', currentUser.uid), {
        uid: currentUser.uid,
        name: me?.name || 'Jugador',
        groupId: me.groupId,
        wordId: word.id,
        correct,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error registering Zas click:', err);
    }
  };

  // Each player awards their own points once a round resolves — mirrors
  // Impostor's pattern of never writing to another user's doc. Guarded by
  // both a local ref (closes off a same-tick double-fire) and the player's
  // own persisted `lastScoredRound` (closes it off across reloads/reconnects).
  useEffect(() => {
    if (!currentUser || !room?.roundResult || !me) return;
    const rr = room.roundResult;
    if (rr.round <= (me.lastScoredRound || 0)) return;
    if (rr.round <= scoredRoundRef.current) return;

    const amGroupWinner = me.groupId && rr.groupWinners?.[me.groupId]?.uid === currentUser.uid;
    const amClassWinner = rr.classWinner?.uid === currentUser.uid;
    if (!amGroupWinner && !amClassWinner) return;
    scoredRoundRef.current = rr.round;

    const amount = (amGroupWinner ? GROUP_WIN_POINTS : 0) + (amClassWinner ? CLASS_FASTEST_BONUS : 0);
    awardPoints(currentUser.uid, amount)
      .then(() => {
        setPointsFlash({ amount });
        return updateDoc(doc(db, 'zas_rooms', roomCode, 'players', currentUser.uid), {
          score: increment(amount),
          lastScoredRound: rr.round,
        });
      })
      .catch((err) => console.error('Error awarding Zas points:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, room?.roundResult, me?.lastScoredRound]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando sala...</div>;
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
        <p className="text-rose-400 font-black uppercase tracking-widest">Esta sala ya no existe.</p>
        <Link to="/juegos/zas" className="text-indigo-400 font-bold underline">Volver</Link>
      </div>
    );
  }

  const FONT_CLASS = { 'font-sans': 'font-sans', 'font-serif': 'font-serif', 'font-mono': 'font-mono' };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 font-sans">
      <PointsIndicator flash={pointsFlash} />
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Link to="/recreo" className="text-slate-400 hover:text-white text-sm font-bold flex items-center gap-2">← Arcade</Link>
          <div className="bg-slate-900 border border-slate-700 rounded-full px-4 py-1.5 text-xs font-black tracking-[0.2em] text-amber-400">
            SALA: {roomCode}
          </div>
        </div>

        {/* LOBBY */}
        {room.gameState === 'lobby' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-2xl font-black uppercase tracking-tight">Sala de Espera</h2>
              <p className="text-slate-400 text-sm">
                {room.words?.length || 0} palabras listas · Curso: <span className="font-bold text-white uppercase">{room.course}</span>
              </p>

              {isHost ? (
                <>
                  <div className="space-y-2">
                    {Object.entries(groupedPlayers).map(([gid, members]) => (
                      <div key={gid} className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Grupo {gid}</span>
                        <p className="font-bold text-sm">{members.map((m) => m.name).join(', ')}</p>
                      </div>
                    ))}
                    {ungroupedPlayers.length > 0 && (
                      <p className="text-xs text-slate-500 font-bold">Sin grupo todavía: {ungroupedPlayers.map((p) => p.name).join(', ')}</p>
                    )}
                    {players.length === 0 && <p className="text-xs text-slate-500 italic">Esperando jugadores...</p>}
                  </div>
                  <button
                    onClick={startGame}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest py-3 rounded-lg"
                  >
                    Iniciar Juego
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  {me?.groupId ? (
                    <div className="bg-slate-800 border-2 border-amber-600 rounded-lg p-4 text-center space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tu grupo</p>
                      <p className="text-2xl font-black tracking-[0.3em] text-amber-400">{me.groupId}</p>
                      <p className="text-xs text-slate-400">{(groupedPlayers[me.groupId] || []).map((m) => m.name).join(', ')}</p>
                      <button onClick={leaveGroup} className="text-[10px] font-black text-slate-500 hover:text-rose-400 uppercase tracking-widest">Salir del grupo</button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={createGroup}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest py-3 rounded-lg"
                      >
                        Crear Mi Grupo
                      </button>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={groupCodeInput}
                          onChange={(e) => setGroupCodeInput(e.target.value.toUpperCase())}
                          placeholder="Código de grupo"
                          className="flex-1 bg-slate-800 border border-slate-700 text-white text-center font-black tracking-widest rounded-lg p-2 uppercase"
                        />
                        <button onClick={joinGroup} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 rounded-lg">Unirme</button>
                      </div>
                      {groupError && <p className="text-rose-400 text-xs font-bold text-center">{groupError}</p>}
                    </>
                  )}
                  <p className="text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Esperando a que el profesor inicie el juego...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PLAYING */}
        {room.gameState === 'playing' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ronda {room.round} · {room.remainingWords.length} palabras restantes</p>
            </div>

            {isHost && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                {!room.currentTargetId && !room.roundResult && (
                  <>
                    <p className="text-center font-bold text-sm text-slate-300">Elige la próxima palabra y descríbela en voz alta:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {room.remainingWords.map((w) => (
                        <button
                          key={w.id}
                          onClick={() => pickTarget(w.id)}
                          className="bg-slate-800 hover:bg-amber-600 border border-slate-700 hover:border-amber-500 rounded-lg px-3 py-2 text-sm font-bold transition-colors"
                        >
                          {w.palabra}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {room.currentTargetId && (() => {
                  const targetWord = room.remainingWords.find((w) => w.id === room.currentTargetId);
                  return (
                    <div className="text-center space-y-3">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Palabra actual (solo tú la ves)</p>
                      <p className="text-3xl font-black text-amber-400">{targetWord?.palabra}</p>
                      {(targetWord?.traduccion || targetWord?.hint) && (
                        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-left max-w-md mx-auto space-y-1">
                          {targetWord.traduccion && (
                            <p className="text-xs text-slate-400"><span className="font-bold uppercase tracking-widest text-slate-500">Traducción:</span> {targetWord.traduccion}</p>
                          )}
                          {targetWord.hint && (
                            <p className="text-xs text-slate-400">💡 {targetWord.hint}</p>
                          )}
                        </div>
                      )}
                      <p className="text-sm text-slate-400">{correctClicks.length} respuesta{correctClicks.length === 1 ? '' : 's'} correcta{correctClicks.length === 1 ? '' : 's'} recibida{correctClicks.length === 1 ? '' : 's'}</p>
                      <button onClick={revealRound} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest py-3 rounded-lg">
                        Revelar Ronda
                      </button>
                    </div>
                  );
                })()}

                {room.roundResult && (
                  <div className="text-center space-y-3">
                    <p className="text-sm text-slate-300">La palabra era: <span className="font-black text-amber-400">{room.roundResult.palabra}</span></p>
                    {room.roundResult.classWinner ? (
                      <p className="text-sm">⚡ Más rápido de la clase: <span className="font-bold text-emerald-400">{room.roundResult.classWinner.name}</span></p>
                    ) : (
                      <p className="text-sm text-slate-500">Nadie la encontró esta ronda.</p>
                    )}
                    <button onClick={nextWord} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest py-3 rounded-lg">
                      Siguiente Palabra →
                    </button>
                  </div>
                )}

                <button onClick={endGame} className="w-full text-slate-500 hover:text-rose-400 text-xs font-bold uppercase tracking-widest">Terminar Juego</button>
              </div>
            )}

            {!isHost && (
              <>
                {!me?.groupId && (
                  <div className="bg-rose-950/30 border border-rose-700 rounded-2xl p-6 text-center">
                    <p className="text-rose-400 font-bold text-sm">No te uniste a un grupo antes de empezar. Pide al profesor que reinicie la sala si quieres jugar.</p>
                  </div>
                )}

                {me?.groupId && !room.currentTargetId && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
                    {room.roundResult ? (
                      <>
                        <p className="text-sm text-slate-300">La palabra era: <span className="font-black text-amber-400">{room.roundResult.palabra}</span></p>
                        {room.roundResult.groupWinners?.[me.groupId]?.uid === currentUser.uid ? (
                          <p className="font-black text-emerald-400 uppercase tracking-widest">¡Ganaste esta ronda en tu grupo!</p>
                        ) : room.roundResult.groupWinners?.[me.groupId] ? (
                          <p className="font-bold text-slate-400">{room.roundResult.groupWinners[me.groupId].name} fue más rápido en tu grupo.</p>
                        ) : (
                          <p className="text-slate-500 text-sm">Nadie en tu grupo la encontró.</p>
                        )}
                        {room.roundResult.classWinner?.uid === currentUser.uid && (
                          <p className="font-black text-amber-400 uppercase tracking-widest">⚡ ¡Fuiste el/la más rápido/a de toda la clase!</p>
                        )}
                      </>
                    ) : (
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest animate-pulse">Esperando a que el profesor elija la próxima palabra...</p>
                    )}
                  </div>
                )}

                {me?.groupId && room.currentTargetId && (
                  <div className="relative w-full h-[65vh] bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden">
                    {alreadyAnsweredCorrectly && (
                      <div className="absolute inset-0 bg-slate-950/70 z-10 flex items-center justify-center">
                        <p className="text-emerald-400 font-black uppercase tracking-widest text-lg">¡Respondiste! Esperando a los demás...</p>
                      </div>
                    )}
                    {room.board.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => handleWordClick(w)}
                        disabled={alreadyAnsweredCorrectly}
                        style={{
                          top: `${w.top}%`,
                          left: `${w.left}%`,
                          transform: `translate(-50%, -50%) rotate(${w.rotation}deg) scale(${w.scale})`,
                        }}
                        className={`absolute px-3 py-1.5 bg-slate-800 hover:bg-amber-600 border border-slate-700 hover:border-amber-500 rounded-lg font-bold text-white whitespace-nowrap transition-colors ${FONT_CLASS[w.fontVariant] || ''}`}
                      >
                        {w.palabra}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* GAME OVER */}
        {room.gameState === 'gameover' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-2xl font-black uppercase tracking-tight text-center">¡Juego Terminado!</h2>
            <div className="space-y-2">
              {[...players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.id} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
                  <span className="font-bold">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {p.name}</span>
                  <span className="font-black text-amber-400">{p.score || 0} pts</span>
                </div>
              ))}
            </div>
            <Link to="/recreo" className="block text-center w-full bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest py-3 rounded-lg">
              Volver al Arcade
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZasRoomPage;
