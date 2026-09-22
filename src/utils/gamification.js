// Title ladder + badge logic for the gamification system.
//
// Titles and badges are computed on the fly from data that already exists
// (total_points, and the podIndex progress pointers written by
// StudentLearningPath.jsx) rather than stored on the user doc. That keeps
// them always in sync with real progress and needs no migration or extra
// writes on every completion — the only new persisted fields are
// `featuredBadgeId` (the student's own choice of which badge to display)
// and `pod.badgeAward` on individual pods in a learning_paths document
// (set from the Pod Creator — "award this badge/tier when this pod is done").

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
const TIER_RANK = { bronze: 1, silver: 2, gold: 3 };

// Compares what a student has already been shown a celebration for
// (`seenValue`) against what they currently have (`currentValue`), for one
// badge. Values are either `true` (a non-tiered badge, earned/not-earned)
// or a tier string. Used to decide whether a fresh "you just earned this!"
// popup is owed — a badge that was already silver and is now still silver
// isn't new; silver -> gold is.
export const isBadgeUpgrade = (seenValue, currentValue) => {
  if (!currentValue) return false;
  if (currentValue === true) return seenValue !== true;
  return (TIER_RANK[currentValue] || 0) > (TIER_RANK[seenValue] || 0);
};

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

// Hand-awarded, one-off trophies for anything not tracked by the site (e.g.
// "Most Improved", "Best Effort") — stored directly on the user doc since,
// unlike chapter/skill badges, there's no progress data to derive them from.
export const getSpecialTrophies = (userData) =>
  (userData?.specialTrophies || []).map((trophy) => ({ ...trophy, type: 'special', tier: null }));

// A learning_paths doc is either the new flat shape (pathDoc.pods, one
// progress pointer at progress[pathId]) or the legacy branched shape
// (pathDoc.branches.{vocab,verbs,practical}.pods, one pointer per branch at
// progress[pathId][branch]). Returns one { pods, completedCount } group per
// pod list on the doc, so callers don't need to know which shape it is.
const getPathPodGroups = (pathDoc, pathProgress) => {
  if (Array.isArray(pathDoc?.pods)) {
    return [{ pods: pathDoc.pods, completedCount: pathProgress?.podIndex || 0 }];
  }
  return BRANCHES.map((branch) => ({
    pods: pathDoc?.branches?.[branch]?.pods || [],
    completedCount: pathProgress?.[branch]?.podIndex || 0,
  }));
};

// Scans every pod of every learning_paths doc for a `badgeAward` tag (set in
// the Pod Creator, e.g. "finishing this pod awards Presente: bronze") and
// checks it against the student's progress pointer for that path (or that
// path's branch, for a path saved before the vocab/verb split). A pod counts
// as done once the pointer has advanced past it. Returns a map of
// badgeId -> tier string (highest tier reached) or `true` for a non-tiered
// badge that's been earned via any tagged pod.
export const getPodBadgeAwards = (userData, learningPathsById) => {
  const earned = {};
  Object.values(learningPathsById || {}).forEach((pathDoc) => {
    const pathProgress = userData?.progress?.[pathDoc.id];
    getPathPodGroups(pathDoc, pathProgress).forEach(({ pods, completedCount }) => {
      pods.forEach((pod, idx) => {
        const award = pod?.badgeAward;
        if (!award?.badgeId || idx >= completedCount) return;
        if (award.tier) {
          const currentRank = TIER_RANK[earned[award.badgeId]] || 0;
          if (TIER_RANK[award.tier] > currentRank) earned[award.badgeId] = award.tier;
        } else if (!earned[award.badgeId]) {
          earned[award.badgeId] = true;
        }
      });
    });
  });
  return earned;
};

// Returns every badge the student has currently earned — pod-triggered
// chapter/skill badges (looked up against the admin's badge catalog for
// name/icon) plus hand-awarded special trophies.
export const getAllEarnedBadges = (userData, learningPathsById, gamificationConfig) => {
  const catalog = gamificationConfig?.badges || [];
  const earnedMap = getPodBadgeAwards(userData, learningPathsById);

  const podBadges = Object.entries(earnedMap).map(([badgeId, tierOrTrue]) => {
    const def = catalog.find((b) => b.id === badgeId) || { id: badgeId, name: badgeId, icon: '🏅' };
    return tierOrTrue === true
      ? { ...def, type: 'skill', tier: null }
      : { ...def, type: 'chapter', tier: tierOrTrue };
  });

  return [...podBadges, ...getSpecialTrophies(userData)];
};
