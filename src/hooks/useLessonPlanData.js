import { useState, useEffect } from 'react';
import { getCachedCollection, getCachedDoc, getCachedBucketedCollection } from '../utils/firestoreCache';

// Everything a Lesson Plan view (daily working page or the formal printout)
// needs for one course+day, fetched once per mount and re-filtered on every
// course/day change — same "fetch once, filter client-side" shape the
// original LessonPlanPage.jsx used, just shared so the formal view doesn't
// duplicate ~80 lines of fetch/filter logic. Uses the shared Firestore
// cache (getCachedCollection/getCachedDoc) so mounting both views in the
// same session only pays the read cost once.
export const useLessonPlanData = (course, selectedDay) => {
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      try {
        const configDoc = await getCachedDoc('config', 'academic_year_2026_2027');
        const calendarMap = {};
        const rawDatesMap = {};
        (configDoc?.map || []).forEach((item) => {
          if (item.dia === null || item.dia === undefined) return;
          const dayNum = Number(item.dia);
          if (!calendarMap[dayNum]) calendarMap[dayNum] = [];
          if (!rawDatesMap[dayNum]) rawDatesMap[dayNum] = [];
          let formatted = item.fecha;
          if (item.fecha && item.fecha.includes('-')) {
            const parts = item.fecha.split('-');
            if (parts.length === 3) formatted = `${parts[1]}/${parts[2]}`;
          }
          calendarMap[dayNum].push(`${formatted}${item.ciclo ? ` (${item.ciclo})` : ''}`);
          if (item.fecha) rawDatesMap[dayNum].push(item.fecha);
        });

        const [
          calentamientos, vocabWarmups, practiceCards, sentenceSets,
          curiosidades, tareasDoc, evaluacionesDoc, gramaticaDoc, anuncios,
          destacados, videos, conversaciones, musica, cultura,
          lecturasMasterDoc, lecturas,
        ] = await Promise.all([
          getCachedCollection('calentamientos'),
          getCachedCollection('dailyVocabWarmups'),
          getCachedCollection('practice_cards'),
          getCachedCollection('sentence_sets'),
          getCachedBucketedCollection('curiosidades'),
          getCachedDoc('curriculum_tracks', 'tareas_master'),
          getCachedDoc('curriculum_tracks', 'evaluaciones_master'),
          getCachedDoc('curriculum_tracks', 'gramatica_master'),
          getCachedCollection('anuncios'),
          getCachedBucketedCollection('destacado_diario'),
          getCachedCollection('videos'),
          getCachedCollection('conversaciones'),
          getCachedCollection('musica'),
          getCachedCollection('culture'),
          getCachedDoc('curriculum_tracks', 'lecturas_master'),
          getCachedCollection('lecturas'),
        ]);

        if (cancelled) return;
        const lecturasById = Object.fromEntries(lecturas.map((l) => [l.id, l]));

        setRaw({
          calendarMap, rawDatesMap,
          calentamientos, vocabWarmups, practiceCards, sentenceSets, curiosidades,
          tareas: { s2: tareasDoc?.s2 || [], s4: tareasDoc?.s4 || [] },
          evaluaciones: { s2: evaluacionesDoc?.s2 || [], s4: evaluacionesDoc?.s4 || [] },
          gramatica: { s2: gramaticaDoc?.s2 || [], s4: gramaticaDoc?.s4 || [] },
          anuncios, destacados, videos, conversaciones, musica, cultura,
          lecturasMaster: lecturasMasterDoc || {}, lecturasById,
        });
      } catch (err) {
        console.error('Error loading lesson plan data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAll();
    return () => { cancelled = true; };
  }, []);

  if (loading || !raw) {
    return { loading: true };
  }

  const dateStrings = raw.calendarMap[selectedDay] || [];
  const activeDatesDisplay = dateStrings.length > 0 ? dateStrings.join(' & ') : 'Fecha por confirmar';
  const rawDates = raw.rawDatesMap[selectedDay] || [];

  const activeCalentamientoVerbs = raw.calentamientos.filter((c) => c.course === course && Number(c.dia) === selectedDay);
  const activeCalentamientoVocab = raw.vocabWarmups.filter((v) => v.course === course && Number(v.dia) === selectedDay);
  const verbList = activeCalentamientoVerbs.flatMap((c) => c.bakedQuestions || []).map((q) => `${q.sujeto} ${q.palabra}`).join(', ');
  const vocabList = activeCalentamientoVocab.flatMap((v) => v.sequence || []).map((w) => w.palabra).join(', ');

  const activePracticeCards = raw.practiceCards.filter((p) => p.course === course && Number(p.dia) === selectedDay);
  const activeSentenceSets = raw.sentenceSets.filter((s) => (s.assignments || []).some((a) => a.course === course && Number(a.dia) === selectedDay));
  const activeCuriosidades = raw.curiosidades.filter((c) => (course === 's2' ? c.s2_dia === selectedDay : c.s4_dia === selectedDay));
  const activeGramatica = (raw.gramatica[course] || []).filter((g) => Number(g.dia) === selectedDay);
  const activeEvaluaciones = (raw.evaluaciones[course] || []).filter((e) => Number(e.dia) === selectedDay && e.label && e.label !== 'Nada');

  // Materials aren't a per-course constant — they're read off whatever
  // tarea got assigned that day (logged in Tareas even when it's actually
  // done in class, in case a student doesn't finish) that names a resource.
  const tareasForCourse = raw.tareas[course] || [];
  const tareasDueToday = tareasForCourse.filter((t) => Number(t.day_due) === selectedDay);
  const tareasAssignedTodayDueLater = tareasForCourse.filter((t) => Number(t.day_assigned) === selectedDay && Number(t.day_due) > selectedDay);
  const tareasAssignedToday = tareasForCourse.filter((t) => Number(t.day_assigned) === selectedDay);
  const materialesHoy = tareasAssignedToday.filter((t) => /KWL|VHL/i.test(t.titulo || ''));

  // Anuncios are matched by actual calendar date (not día number) — a día
  // can resolve to two real dates (one per A/B ciclo), so an announcement
  // active on either one counts as active today.
  const activeAnuncios = raw.anuncios.filter(
    (a) => (a.courses || []).includes(course) && rawDates.some((d) => d >= a.start_date && d <= a.end_date)
  );

  const activeDestacados = raw.destacados.filter((d) => {
    if (Number(d.dia) !== selectedDay) return false;
    if (!d.course) return true;
    return Array.isArray(d.course) ? d.course.includes(course) : d.course === course;
  });

  const byCourseDay = (item) => (item.courses || []).includes(course) && (item.dias || []).map(Number).includes(selectedDay);
  const activeConversaciones = raw.conversaciones.filter(byCourseDay);
  const activeMusica = raw.musica.filter(byCourseDay);
  const activeCultura = raw.cultura.filter(byCourseDay);
  const activeVideos = raw.videos.filter((v) => (v.tags || []).includes(course) && Number(v.dia) === selectedDay);

  const lecturaIdsToday = raw.lecturasMaster?.[course]?.[String(selectedDay)] || [];
  const activeLecturas = lecturaIdsToday.map((id) => ({ id, ...(raw.lecturasById[id] || {}) }));

  return {
    loading: false,
    activeDatesDisplay,
    calentamiento: { verbs: activeCalentamientoVerbs, vocab: activeCalentamientoVocab, verbList, vocabList },
    oraciones: activeSentenceSets,
    curiosidad: activeCuriosidades,
    gramatica: activeGramatica,
    evaluacion: activeEvaluaciones,
    practica: activePracticeCards,
    tarea: { dueToday: tareasDueToday, assignedTodayDueLater: tareasAssignedTodayDueLater, materialesHoy },
    anuncios: activeAnuncios,
    destacado: activeDestacados,
    actividades: { videos: activeVideos, conversaciones: activeConversaciones, musica: activeMusica, cultura: activeCultura, lecturas: activeLecturas },
  };
};
