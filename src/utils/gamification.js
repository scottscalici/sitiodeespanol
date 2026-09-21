// Title ladder + badge logic for the gamification system.
//
// Titles and badges are computed on the fly from data that already exists
// (total_points, and the podIndex/segmentIndex progress pointers written by
// StudentLearningPath.jsx) rather than stored on the user doc. That keeps
// them always in sync with real progress and needs no migration or extra
// writes on every completion — the only new persisted field is
// `featuredBadgeId` (the student's own choice of which badge to display).

export const BRANCHES = ['vocab', 'verbs', 'practical'];

// Front-loaded so early tiers come quickly, then the gap widens. Fully
// editable from the Gamification Manager admin screen — this is just the
// fallback used before an admin ever saves config/gamification.
export const DEFAULT_TITLE_TIERS = [
  { minPoints: 0, title: 'Principiante' },
  { minPoints: 50, title: 'Aprendiz' },
  { minPoints: 125, title: 'Estudiante Dedicado/a' },
  { minPoints: 250, title: 'Practicante' },
  { minPoints: 450, title: 'Conocedor/a' },
  { minPoints: 700, title: 'Hablante en Progreso' },
  { minPoints: 1000, title: 'Intermedio' },
  { minPoints: 1400, title: 'Políglota en Formación' },
  { minPoints: 1900, title: 'Fluido/a' },
  { minPoints: 2500, title: 'Avanzado/a' },
  { minPoints: 3200, title: 'Erudito/a' },
  { minPoints: 4000, title: 'Maestro/a del Idioma' },
  { minPoints: 5000, title: 'Experto/a' },
  { minPoints: 6200, title: 'Virtuoso/a' },
  { minPoints: 7600, title: 'Profesional' },
  { minPoints: 9200, title: 'Leyenda de la Clase' },
];

export const BADGE_TIER_LABELS = { bronze: 'Bronce', silver: 'Plata', gold: 'Oro' };

const sortedTiers = (tiers) => [...(tiers || [])].sort((a, b) => a.minPoints - b.minPoints);

export const getTitleForPoints = (points, tiers = DEFAULT_TITLE_TIERS) => {
  const sorted = sortedTiers(tiers.length ? tiers : DEFAULT_TITLE_TIERS);
  let current = sorted[0]?.title || '';
  for (const tier of sorted) {
    if (points >= tier.minPoints) current = tier.title;
    else break;
  }
  return current;
};

// Returns the next tier the student hasn't reached yet, or null if maxed out.
export const getNextTitleTier = (points, tiers = DEFAULT_TITLE_TIERS) => {
  const sorted = sortedTiers(tiers.length ? tiers : DEFAULT_TITLE_TIERS);
  return sorted.find((tier) => tier.minPoints > points) || null;
};

// Total pods across all three branches of a learning_paths document.
export const getPathPodCount = (pathDoc) =>
  BRANCHES.reduce((sum, b) => sum + (pathDoc?.branches?.[b]?.pods?.length || 0), 0);

// Completed pods for a given path, summed across branches. podIndex is a
// pointer to the pod currently in progress, so everything before it is done.
export const getCompletedPodCount = (userData, pathId) => {
  const unitProgress = userData?.progress?.[pathId];
  return BRANCHES.reduce((sum, b) => sum + (unitProgress?.[b]?.podIndex || 0), 0);
};

// tierThresholds: { bronze, silver, gold } — cumulative pod-count checkpoints,
// not per-tier deltas (e.g. { bronze: 1, silver: 2, gold: 3 }).
export const getChapterBadgeTier = (completedPods, tierThresholds) => {
  if (!tierThresholds) return null;
  if (tierThresholds.gold != null && completedPods >= tierThresholds.gold) return 'gold';
  if (tierThresholds.silver != null && completedPods >= tierThresholds.silver) return 'silver';
  if (tierThresholds.bronze != null && completedPods >= tierThresholds.bronze) return 'bronze';
  return null;
};

// Hand-awarded, one-off trophies for anything not tracked by the site (e.g.
// "Most Improved", "Best Effort") — stored directly on the user doc since,
// unlike chapter/skill badges, there's no progress data to derive them from.
export const getSpecialTrophies = (userData) =>
  (userData?.specialTrophies || []).map((trophy) => ({ ...trophy, type: 'special', tier: null }));

// Returns every badge the student has currently earned (chapter badges with
// their tier, fully-completed skill badges, and hand-awarded special
// trophies), derived live from userData.progress + the learning_paths docs +
// the admin's badge config (plus userData.specialTrophies for hand-awarded ones).
export const getAllEarnedBadges = (userData, learningPathsById, gamificationConfig) => {
  const chapterBadges = (gamificationConfig?.chapterBadges || [])
    .map((badge) => {
      const pathDoc = learningPathsById?.[badge.pathId];
      if (!pathDoc) return null;
      const completedPods = getCompletedPodCount(userData, badge.pathId);
      const tier = getChapterBadgeTier(completedPods, badge.tiers);
      if (!tier) return null;
      return { ...badge, type: 'chapter', tier };
    })
    .filter(Boolean);

  const skillBadges = (gamificationConfig?.skillBadges || [])
    .map((badge) => {
      const pathDoc = learningPathsById?.[badge.pathId];
      if (!pathDoc) return null;
      const totalPods = getPathPodCount(pathDoc);
      const completedPods = getCompletedPodCount(userData, badge.pathId);
      if (totalPods === 0 || completedPods < totalPods) return null;
      return { ...badge, type: 'skill', tier: null };
    })
    .filter(Boolean);

  return [...chapterBadges, ...skillBadges, ...getSpecialTrophies(userData)];
};
