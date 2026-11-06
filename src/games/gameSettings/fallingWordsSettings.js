// Hard-coded starter word list for Falling Words (Game 1 of El Recreo's
// reward-games plan) — a small set to get the mechanic fun and tunable
// before swapping in real Firestore vocab data (see
// src/utils/firestoreCache.js's getCachedCollection('vocabulary') for that
// follow-up). Every tunable number for this game lives here, not buried in
// the component, so it can be retuned without touching game logic.
export const FALLING_WORDS_LIST = [
  { es: 'el perro', en: 'the dog' },
  { es: 'la casa', en: 'the house' },
  { es: 'el libro', en: 'the book' },
  { es: 'la mesa', en: 'the table' },
  { es: 'el agua', en: 'the water' },
  { es: 'la escuela', en: 'the school' },
  { es: 'el amigo', en: 'the friend' },
  { es: 'la playa', en: 'the beach' },
  { es: 'el coche', en: 'the car' },
  { es: 'la comida', en: 'the food' },
  { es: 'el gato', en: 'the cat' },
  { es: 'la ventana', en: 'the window' },
];

export const FALLING_WORDS_CONFIG = {
  lives: 3,
  columns: 4,
  spawnIntervalMs: 1400, // how often a new falling word appears
  baseFallSpeed: 70, // px/sec at the start
  maxFallSpeed: 220, // speed cap
  speedIncreasePerStreak: 12, // added to fall speed every `streakForSpeedUp` correct catches
  streakForSpeedUp: 3,
  speedEaseBackOnMistake: 25, // subtracted from fall speed after a wrong catch (never below baseFallSpeed)
  decoyChance: 0.55, // chance a spawned word is a wrong decoy instead of the current target
};
