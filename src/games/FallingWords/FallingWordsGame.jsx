import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FALLING_WORDS_LIST, FALLING_WORDS_CONFIG } from '../gameSettings/fallingWordsSettings';

const {
  lives: STARTING_LIVES,
  columns: COLUMN_COUNT,
  spawnIntervalMs: SPAWN_INTERVAL_MS,
  baseFallSpeed: BASE_FALL_SPEED,
  maxFallSpeed: MAX_FALL_SPEED,
  speedIncreasePerStreak: SPEED_INCREASE,
  streakForSpeedUp: STREAK_FOR_SPEEDUP,
  speedEaseBackOnMistake: SPEED_EASE_BACK,
  decoyChance: DECOY_CHANCE,
} = FALLING_WORDS_CONFIG;

const BASKET_WIDTH_PCT = 18; // basket width as % of play-area width
const CATCH_ZONE_Y_PCT = 86; // y% where the basket's catch line sits
const PLAY_AREA_HEIGHT_PX = 480;

const columnCenters = Array.from({ length: COLUMN_COUNT }, (_, i) => ((i + 0.5) / COLUMN_COUNT) * 100);

const pickTarget = (excludeEs) => {
  const pool = FALLING_WORDS_LIST.filter((w) => w.es !== excludeEs);
  const list = pool.length > 0 ? pool : FALLING_WORDS_LIST;
  return list[Math.floor(Math.random() * list.length)];
};

const pickDecoy = (targetEs) => {
  const pool = FALLING_WORDS_LIST.filter((w) => w.es !== targetEs);
  return pool[Math.floor(Math.random() * pool.length)];
};

export default function FallingWordsGame() {
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [basketXPct, setBasketXPct] = useState(50);
  const [fallingWords, setFallingWords] = useState([]);
  const [target, setTarget] = useState(() => pickTarget(null));

  // Mutable refs mirror the state above so the rAF loop always reads the
  // latest values without re-subscribing the loop every render or closing
  // over stale state.
  const basketXRef = useRef(basketXPct);
  const fallSpeedRef = useRef(BASE_FALL_SPEED);
  const streakRef = useRef(0);
  const targetRef = useRef(target);
  const livesRef = useRef(STARTING_LIVES);
  const gameOverRef = useRef(false);
  const wordsRef = useRef([]);
  const lastTsRef = useRef(null);
  const spawnAccumulatorRef = useRef(0);
  const rafRef = useRef(null);
  const playAreaRef = useRef(null);
  const hasCorrectOnScreenRef = useRef(false);
  const nextIdRef = useRef(1);
  const tickRef = useRef(null);

  useEffect(() => {
    basketXRef.current = basketXPct;
  }, [basketXPct]);

  const spawnWord = useCallback(() => {
    const spawnDecoy = hasCorrectOnScreenRef.current || Math.random() < DECOY_CHANCE;
    const entry = spawnDecoy ? pickDecoy(targetRef.current.es) : targetRef.current;
    const isCorrect = !spawnDecoy;
    if (isCorrect) hasCorrectOnScreenRef.current = true;
    const col = Math.floor(Math.random() * COLUMN_COUNT);
    const word = {
      id: nextIdRef.current++,
      es: entry.es,
      isCorrect,
      xPct: columnCenters[col],
      yPct: 0,
    };
    wordsRef.current = [...wordsRef.current, word];
    setFallingWords(wordsRef.current);
  }, []);

  const handleCatch = useCallback((word) => {
    wordsRef.current = wordsRef.current.filter((w) => w.id !== word.id);
    if (word.isCorrect) {
      hasCorrectOnScreenRef.current = false;
      streakRef.current += 1;
      setScore((s) => s + 10);
      if (streakRef.current % STREAK_FOR_SPEEDUP === 0) {
        fallSpeedRef.current = Math.min(MAX_FALL_SPEED, fallSpeedRef.current + SPEED_INCREASE);
      }
      const nextTarget = pickTarget(word.es);
      targetRef.current = nextTarget;
      setTarget(nextTarget);
    } else {
      streakRef.current = 0;
      fallSpeedRef.current = Math.max(BASE_FALL_SPEED, fallSpeedRef.current - SPEED_EASE_BACK);
      livesRef.current -= 1;
      setLives(livesRef.current);
      if (livesRef.current <= 0) {
        gameOverRef.current = true;
        setGameOver(true);
      }
    }
    setFallingWords(wordsRef.current);
  }, []);

  // --- GAME LOOP ---
  // `tick` is a stable callback (not a plain useEffect closure) so resetGame
  // can kick it off directly every time it's called — including on replay.
  // It used to live inside a useEffect keyed on `started`, which only
  // (re)started the loop the FIRST time `started` flipped false -> true.
  // Once the loop hit `if (gameOverRef.current) return`, it stopped calling
  // requestAnimationFrame(tick) and never resumed: `started` was already
  // true from the first playthrough, so clicking "Jugar de Nuevo" (which
  // sets it to true again, a no-op as far as React's dependency diffing is
  // concerned) never made that effect re-run, and nothing ever called
  // spawnWord() again. Tying the loop's start directly to the resetGame
  // action — not to a boolean's change-detection — fixes it for every
  // replay, not just the first game.
  const tick = useCallback(
    (ts) => {
      if (gameOverRef.current) return;
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dtSec = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      spawnAccumulatorRef.current += dtSec * 1000;
      if (spawnAccumulatorRef.current >= SPAWN_INTERVAL_MS) {
        spawnAccumulatorRef.current = 0;
        spawnWord();
      }

      const fallPctPerSec = (fallSpeedRef.current / PLAY_AREA_HEIGHT_PX) * 100;
      let caught = null;
      const survivors = [];
      for (const w of wordsRef.current) {
        const newY = w.yPct + fallPctPerSec * dtSec;
        if (
          !caught &&
          newY >= CATCH_ZONE_Y_PCT &&
          Math.abs(w.xPct - basketXRef.current) <= BASKET_WIDTH_PCT / 2
        ) {
          caught = w;
          continue;
        }
        if (newY >= 100) {
          // Falls off-screen uncaught — no penalty in v1, it just despawns
          // (keeps the first playable build focused on catch vs. avoid,
          // without punishing a slow reaction on top of that).
          if (w.isCorrect) hasCorrectOnScreenRef.current = false;
          continue;
        }
        survivors.push({ ...w, yPct: newY });
      }
      wordsRef.current = survivors;
      setFallingWords(survivors);
      if (caught) handleCatch(caught);

      rafRef.current = requestAnimationFrame((nextTs) => tickRef.current(nextTs));
    },
    [spawnWord, handleCatch]
  );

  // Keeps tickRef pointed at the latest `tick` closure, so the recursive
  // requestAnimationFrame call above never has to reference `tick` before
  // it's declared (which the linter correctly flags as fragile) while still
  // always running the current version.
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const resetGame = useCallback(() => {
    const firstTarget = pickTarget(null);
    setScore(0);
    setLives(STARTING_LIVES);
    setBasketXPct(50);
    setFallingWords([]);
    setTarget(firstTarget);
    setGameOver(false);
    basketXRef.current = 50;
    fallSpeedRef.current = BASE_FALL_SPEED;
    streakRef.current = 0;
    targetRef.current = firstTarget;
    livesRef.current = STARTING_LIVES;
    gameOverRef.current = false;
    wordsRef.current = [];
    lastTsRef.current = null;
    spawnAccumulatorRef.current = 0;
    hasCorrectOnScreenRef.current = false;
    setStarted(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  // Loop cleanup on unmount only — starting it is resetGame's job now.
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // --- CONTROLS: arrow keys ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!started || gameOverRef.current) return;
      if (e.key === 'ArrowLeft') setBasketXPct((x) => Math.max(BASKET_WIDTH_PCT / 2, x - 8));
      if (e.key === 'ArrowRight') setBasketXPct((x) => Math.min(100 - BASKET_WIDTH_PCT / 2, x + 8));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [started]);

  // --- CONTROLS: drag / tap (mouse + touch) ---
  const movePointerTo = (clientX) => {
    const area = playAreaRef.current;
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(BASKET_WIDTH_PCT / 2, Math.min(100 - BASKET_WIDTH_PCT / 2, pct));
    setBasketXPct(clamped);
  };

  const handlePointerDown = (e) => {
    if (!started || gameOverRef.current) return;
    movePointerTo(e.touches ? e.touches[0].clientX : e.clientX);
  };

  const handlePointerMove = (e) => {
    if (!started || gameOverRef.current) return;
    if (e.touches && e.touches.length > 0) movePointerTo(e.touches[0].clientX);
    else if (e.buttons === 1) movePointerTo(e.clientX);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-xl">
        <Link to="/recreo" className="text-indigo-400 font-bold mb-4 inline-flex items-center gap-2 hover:text-indigo-300 transition-colors">
          ← Volver a El Recreo
        </Link>

        <div className="text-center mt-4 mb-4">
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            Palabras Cayendo
          </h1>
          <p className="text-slate-400 text-sm">
            Atrapa la palabra en español que coincide con el inglés. ¡Evita las incorrectas!
          </p>
        </div>

        {!started && !gameOver && (
          <div className="bg-slate-800 border-2 border-slate-700 rounded-2xl p-8 text-center space-y-4">
            <p className="text-slate-300">Usa las flechas ← → o arrastra con el dedo para mover la canasta.</p>
            <button
              onClick={resetGame}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-lg transition-colors"
            >
              Jugar
            </button>
          </div>
        )}

        {started && (
          <>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-1">
                {Array.from({ length: STARTING_LIVES }, (_, i) => (
                  <span key={i} className={`text-xl ${i < lives ? 'opacity-100' : 'opacity-20'}`}>
                    ❤️
                  </span>
                ))}
              </div>
              <div className="text-lg font-black text-emerald-400">{score} pts</div>
            </div>

            <div className="bg-slate-800 border-2 border-emerald-500/50 rounded-xl py-3 px-4 text-center mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Atrapa:</span>
              <span className="text-2xl font-black text-emerald-300">{target.en}</span>
            </div>

            <div
              ref={playAreaRef}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              className="relative w-full bg-slate-950 border-2 border-slate-700 rounded-2xl overflow-hidden touch-none select-none"
              style={{ height: PLAY_AREA_HEIGHT_PX }}
            >
              {fallingWords.map((w) => (
                <div
                  key={w.id}
                  className="absolute -translate-x-1/2 bg-slate-800 border border-slate-600 text-white font-bold text-sm px-3 py-1.5 rounded-lg whitespace-nowrap"
                  style={{ left: `${w.xPct}%`, top: `${w.yPct}%` }}
                >
                  {w.es}
                </div>
              ))}

              {/* BASKET */}
              <div
                className="absolute -translate-x-1/2 bg-emerald-500 rounded-xl shadow-lg flex items-center justify-center text-2xl"
                style={{
                  left: `${basketXPct}%`,
                  top: `${CATCH_ZONE_Y_PCT}%`,
                  width: `${BASKET_WIDTH_PCT}%`,
                  height: '48px',
                }}
              >
                🧺
              </div>

              {gameOver && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-4 text-center px-6">
                  <h2 className="text-3xl font-black text-rose-400 uppercase">¡Se acabó!</h2>
                  <p className="text-xl text-white font-bold">Puntuación: {score}</p>
                  <button
                    onClick={resetGame}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-lg transition-colors"
                  >
                    Jugar de Nuevo
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
