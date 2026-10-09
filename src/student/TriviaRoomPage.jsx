import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  doc, collection, onSnapshot, updateDoc, setDoc, getDoc,
  serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { awardPoints } from '../utils/pointsHelper';
import { computeTriviaPoints } from '../utils/triviaGame';

const OPTION_COLORS = ['bg-rose-600 hover:bg-rose-500', 'bg-sky-600 hover:bg-sky-500', 'bg-amber-600 hover:bg-amber-500', 'bg-emerald-600 hover:bg-emerald-500'];
const OPTION_SHAPES = ['▲', '◆', '●', '■'];

const TriviaRoomPage = () => {
  const { roomCode } = useParams();
  const { currentUser, userData } = useAuth();

  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mySelectedIndex, setMySelectedIndex] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const scoredQuestionRef = useRef(-1);
  const pointsAwardedRef = useRef(false);

  const roomRef = doc(db, 'trivia_rooms', roomCode);

  useEffect(() => {
    const unsubRoom = onSnapshot(roomRef, (snap) => {
      setRoom(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    });
    const unsubPlayers = onSnapshot(collection(db, 'trivia_rooms', roomCode, 'players'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
      setPlayers(list);
    });
    const unsubAnswers = onSnapshot(collection(db, 'trivia_rooms', roomCode, 'answers'), (snap) => {
      setAnswers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubRoom();
      unsubPlayers();
      unsubAnswers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const me = players.find((p) => p.id === currentUser?.uid);
  const isHost = room?.hostId === currentUser?.uid;
  const currentQuestion = room?.questions?.[room?.currentQuestionIndex];
  const currentAnswers = answers.filter((a) => a.questionIndex === room?.currentQuestionIndex);
  const myAnswerForCurrent = currentAnswers.find((a) => a.uid === currentUser?.uid);
  const isLastQuestion = room && room.currentQuestionIndex >= (room.questions?.length || 0) - 1;

  // Reset local per-question UI state (selection, scoring guards) whenever
  // the question actually changes — keyed on the index, not just "did room
  // change", so an unrelated field update on the room doc doesn't wrongly
  // reset an in-progress selection.
  useEffect(() => {
    setMySelectedIndex(null);
  }, [room?.currentQuestionIndex]);

  const startGame = async () => {
    if (!isHost || !room?.questions?.length) return;
    await updateDoc(roomRef, {
      gameState: 'question',
      currentQuestionIndex: 0,
      questionStartedAt: serverTimestamp(),
    });
  };

  const submitAnswer = async (optionIndex) => {
    if (!currentUser || mySelectedIndex !== null || room?.gameState !== 'question') return;
    setMySelectedIndex(optionIndex);
    try {
      await setDoc(doc(db, 'trivia_rooms', roomCode, 'answers', `${room.currentQuestionIndex}_${currentUser.uid}`), {
        uid: currentUser.uid,
        questionIndex: room.currentQuestionIndex,
        selectedIndex: optionIndex,
        answeredAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error submitting trivia answer:', err);
      setMySelectedIndex(null);
    }
  };

  // Host-only: watches the countdown and advances question -> reveal once
  // the time limit elapses. Derived from the room's own serverTimestamp
  // (questionStartedAt), not a client clock, so it stays correct even if
  // this effect re-mounts after a reload partway through the countdown.
  useEffect(() => {
    if (!isHost || room?.gameState !== 'question' || !room?.questionStartedAt) return;
    const timeLimitMs = (room.timeLimitSeconds || 20) * 1000;
    const startedMs = room.questionStartedAt.toMillis();

    const tick = () => {
      const remainingMs = startedMs + timeLimitMs - Date.now();
      setTimeLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
      if (remainingMs <= 0) {
        updateDoc(roomRef, { gameState: 'reveal' }).catch((err) => console.error('Error advancing to reveal:', err));
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, room?.gameState, room?.currentQuestionIndex, room?.questionStartedAt]);

  // Non-host countdown display only (no authority to advance the game) —
  // same derivation, just for the student's own "time's running out" UI.
  useEffect(() => {
    if (isHost || room?.gameState !== 'question' || !room?.questionStartedAt) return;
    const timeLimitMs = (room.timeLimitSeconds || 20) * 1000;
    const startedMs = room.questionStartedAt.toMillis();
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((startedMs + timeLimitMs - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [isHost, room?.gameState, room?.currentQuestionIndex, room?.questionStartedAt]);

  // Each player scores THEMSELVES once reveal starts for a question — never
  // the host writing into another student's doc, same self-service pattern
  // Impostor uses for points. Reads back the server-resolved answeredAt
  // (a serverTimestamp() write doesn't resolve to a real value locally
  // until synced, and by reveal time it reliably has) to time the answer
  // off the server's clock, not this device's.
  useEffect(() => {
    if (!currentUser || !room || !me || !currentQuestion) return;
    if (room.gameState !== 'reveal') return;
    if (room.currentQuestionIndex <= (me.lastScoredQuestionIndex ?? -1)) return;
    if (room.currentQuestionIndex <= scoredQuestionRef.current) return;
    scoredQuestionRef.current = room.currentQuestionIndex;

    const score = async () => {
      try {
        const answerSnap = await getDoc(doc(db, 'trivia_rooms', roomCode, 'answers', `${room.currentQuestionIndex}_${currentUser.uid}`));
        const answerData = answerSnap.exists() ? answerSnap.data() : null;
        const isCorrect = answerData?.selectedIndex === currentQuestion.correctIndex;
        let points = 0;
        if (isCorrect && answerData?.answeredAt && room.questionStartedAt) {
          const elapsedMs = answerData.answeredAt.toMillis() - room.questionStartedAt.toMillis();
          points = computeTriviaPoints(true, elapsedMs, (room.timeLimitSeconds || 20) * 1000);
        }
        await updateDoc(doc(db, 'trivia_rooms', roomCode, 'players', currentUser.uid), {
          score: increment(points),
          correctCount: increment(isCorrect ? 1 : 0),
          lastScoredQuestionIndex: room.currentQuestionIndex,
        });
      } catch (err) {
        console.error('Error self-scoring trivia question:', err);
      }
    };
    score();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, room?.gameState, room?.currentQuestionIndex, me?.lastScoredQuestionIndex]);

  // Each player awards their own global XP once the game ends — scaled down
  // from their big 0-1000-per-question in-room score (not a flat
  // per-correct rate, so a 20+ question game doesn't dwarf a whole
  // semester of other activities' points) plus a flat top-5 rank bonus,
  // mirroring the leaderboard shown between questions.
  useEffect(() => {
    if (!currentUser || !me || userData?.role === 'admin') return;
    if (room?.gameState !== 'gameover') return;
    if (me.pointsAwarded || pointsAwardedRef.current) return;
    pointsAwardedRef.current = true;

    const ranked = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
    const rank = ranked.findIndex((p) => p.id === currentUser.uid);
    const rankBonus = [15, 10, 7, 5, 3][rank] || 0;
    const basePoints = Math.round((me.score || 0) / 500);
    const totalPoints = basePoints + rankBonus;

    const finish = async () => {
      try {
        if (totalPoints > 0) await awardPoints(currentUser.uid, totalPoints);
        await updateDoc(doc(db, 'trivia_rooms', roomCode, 'players', currentUser.uid), { pointsAwarded: true });
      } catch (err) {
        console.error('Error awarding trivia XP:', err);
      }
    };
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, room?.gameState, me?.pointsAwarded]);

  const goToLeaderboard = async () => {
    if (!isHost) return;
    await updateDoc(roomRef, { gameState: 'leaderboard' });
  };

  const nextQuestion = async () => {
    if (!isHost) return;
    if (isLastQuestion) {
      await updateDoc(roomRef, { gameState: 'gameover' });
    } else {
      await updateDoc(roomRef, {
        gameState: 'question',
        currentQuestionIndex: room.currentQuestionIndex + 1,
        questionStartedAt: serverTimestamp(),
      });
    }
  };

  const topRanked = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando sala...</div>;
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
        <p className="text-rose-400 font-black uppercase tracking-widest">Esta sala ya no existe.</p>
        <Link to="/juegos/trivia" className="text-indigo-400 font-bold underline">Volver</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Link to="/recreo" className="text-slate-400 hover:text-white text-sm font-bold flex items-center gap-2">← Arcade</Link>
          <div className="bg-slate-900 border border-slate-700 rounded-full px-4 py-1.5 text-xs font-black tracking-[0.2em] text-orange-400">
            SALA: {roomCode}
          </div>
        </div>

        {/* LOBBY */}
        {room.gameState === 'lobby' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-2xl font-black uppercase tracking-tight">Sala de Espera</h2>
            <p className="text-slate-400 text-sm">
              {room.questions.length} pregunta{room.questions.length === 1 ? '' : 's'} · {room.timeLimitSeconds}s cada una
            </p>
            <div className="space-y-2">
              {players.map((p) => (
                <div key={p.id} className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 flex justify-between items-center">
                  <span className="font-bold">{p.name}</span>
                  {p.id === room.hostId && <span className="text-[10px] font-black uppercase text-orange-400">Host</span>}
                </div>
              ))}
            </div>
            {error && <p className="text-rose-400 text-xs font-bold text-center">{error}</p>}
            {isHost ? (
              <button onClick={startGame} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-widest py-3 rounded-lg">
                Iniciar Juego
              </button>
            ) : (
              <p className="text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Esperando a que el host inicie el juego...</p>
            )}
          </div>
        )}

        {/* QUESTION */}
        {room.gameState === 'question' && currentQuestion && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Pregunta {room.currentQuestionIndex + 1}/{room.questions.length}
              </p>
              <p className="text-2xl font-black text-orange-400 tabular-nums">{timeLeft ?? room.timeLimitSeconds}</p>
            </div>

            {isHost && (
              <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-8 text-center space-y-4">
                {currentQuestion.image && (
                  <img src={currentQuestion.image} alt="" className="max-h-56 mx-auto rounded-xl object-contain" />
                )}
                <h2 className="text-2xl sm:text-3xl font-black">{currentQuestion.clue}</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {currentAnswers.length} de {players.length} han respondido
                </p>
              </div>
            )}

            {!isHost && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQuestion.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => submitAnswer(idx)}
                    disabled={mySelectedIndex !== null}
                    className={`${OPTION_COLORS[idx]} disabled:opacity-40 text-white font-black text-lg rounded-2xl p-6 flex items-center gap-3 transition-all ${mySelectedIndex === idx ? 'ring-4 ring-white' : ''}`}
                  >
                    <span className="text-2xl">{OPTION_SHAPES[idx]}</span>
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            )}
            {!isHost && mySelectedIndex !== null && (
              <p className="text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Esperando a los demás...</p>
            )}
          </div>
        )}

        {/* REVEAL */}
        {room.gameState === 'reveal' && currentQuestion && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-center">
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-400">Respuesta Correcta</h2>
            {isHost ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentQuestion.options.map((opt, idx) => {
                    const count = currentAnswers.filter((a) => a.selectedIndex === idx).length;
                    const isCorrect = idx === currentQuestion.correctIndex;
                    return (
                      <div
                        key={idx}
                        className={`rounded-2xl p-4 flex items-center justify-between font-black text-white ${isCorrect ? 'bg-emerald-700 ring-4 ring-emerald-400' : 'bg-slate-800'}`}
                      >
                        <span className="flex items-center gap-2"><span>{OPTION_SHAPES[idx]}</span> {opt}</span>
                        <span>{count}</span>
                      </div>
                    );
                  })}
                </div>
                <button onClick={goToLeaderboard} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-widest py-3 rounded-lg">
                  Ver Tabla
                </button>
              </>
            ) : (
              <>
                {mySelectedIndex === currentQuestion.correctIndex || myAnswerForCurrent?.selectedIndex === currentQuestion.correctIndex ? (
                  <p className="text-2xl font-black text-emerald-400">¡Correcto! 🎉</p>
                ) : (
                  <p className="text-2xl font-black text-rose-400">
                    Incorrecto — era "{currentQuestion.options[currentQuestion.correctIndex]}"
                  </p>
                )}
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Esperando al host...</p>
              </>
            )}
          </div>
        )}

        {/* LEADERBOARD */}
        {room.gameState === 'leaderboard' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-center">
            <h2 className="text-2xl font-black uppercase tracking-tight">🏆 Tabla de Líderes</h2>
            <div className="space-y-2">
              {topRanked.slice(0, 5).map((p, idx) => (
                <div key={p.id} className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${p.id === currentUser?.uid ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-slate-800'}`}>
                  <span className="font-bold flex items-center gap-2">
                    <span className="text-slate-500">#{idx + 1}</span> {p.name}
                  </span>
                  <span className="font-black text-orange-400">{p.score || 0}</span>
                </div>
              ))}
            </div>
            {isHost ? (
              <button onClick={nextQuestion} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-widest py-3 rounded-lg">
                {isLastQuestion ? 'Terminar Juego' : 'Siguiente Pregunta'}
              </button>
            ) : (
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Esperando al host...</p>
            )}
          </div>
        )}

        {/* GAME OVER */}
        {room.gameState === 'gameover' && (
          <div className="bg-emerald-950/30 border-2 border-emerald-700 rounded-2xl p-8 space-y-4 text-center">
            <h2 className="text-3xl font-black uppercase tracking-tight text-emerald-400">¡Juego Terminado!</h2>
            <div className="space-y-2">
              {topRanked.map((p, idx) => (
                <div key={p.id} className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${p.id === currentUser?.uid ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-slate-900'}`}>
                  <span className="font-bold flex items-center gap-2">
                    <span className="text-slate-500">#{idx + 1}</span> {idx === 0 && '👑'} {p.name}
                  </span>
                  <span className="font-black text-emerald-400">{p.score || 0}</span>
                </div>
              ))}
            </div>
            <Link to="/recreo" className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest py-3 rounded-lg">
              Volver al Arcade
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default TriviaRoomPage;
