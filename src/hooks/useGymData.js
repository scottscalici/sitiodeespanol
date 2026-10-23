import { useState, useEffect } from 'react';
import { getCachedCollection, getCachedDoc } from '../utils/firestoreCache';

const CONFIG = {
  DICTIONARY: 'https://raw.githubusercontent.com/bayu01/Wordle-ES/master/palabras_de_cinco_letras.txt',
  APUNTES: 'https://raw.githubusercontent.com/scottscalici/imagenes/main/planes/apuntes.json',
  EXTRAS: 'https://raw.githubusercontent.com/scottscalici/imagenes/main/planes/extras_diarios.json',
  PRACTICAS: 'https://raw.githubusercontent.com/scottscalici/imagenes/main/planes/practicas.json',
};

// 🧹 THE NORMALIZATION ENGINE
const normalizeActivities = (raw) => {
  let activities = [];

  if (raw.extras?.items) {
    raw.extras.items.forEach((item) => {
      activities.push({
        id: item.id,
        type: 'extra',
        title: item.title,
        url: item.url || item.links?.[0]?.url,
        img: item.img,
        tag: item.tag || 'Extra',
        s2_dias: item.s2_dias || [],
        s4_dias: item.s4_dias || [],
        raw: item,
      });
    });
  }

  const processCategory = (source, typeName) => {
    if (!source?.items) return;
    Object.keys(source.items).forEach((key) => {
      const item = source.items[key];
      activities.push({
        id: key,
        type: typeName,
        title: item.titulo,
        subtitle: item.subtitulo,
        url: item.url,
        img: item.imagen,
        tag: item.tag,
        s2_dias: item.courses?.includes('s2') ? item.dias || [] : [],
        s4_dias: item.courses?.includes('s4') ? item.dias || [] : [],
        raw: item,
      });
    });
  };

  processCategory(raw.musica, 'musica');
  processCategory(raw.lectura, 'lectura');
  processCategory(raw.conversa, 'conversacion');
  processCategory(raw.cultura, 'cultura');

  if (raw.videos?.daily_tags) {
    raw.videos.daily_tags.forEach((item) => {
      activities.push({
        id: item.id,
        type: 'video',
        title: item.title,
        subtitle: item.description,
        url: item.page_url || item.video_url,
        img: item.thumbnail_url,
        tag: item.tags?.find((t) => t !== 's2' && t !== 's4') || 'Video',
        s2_dias: item.tags?.includes('s2') ? [item.dia] : [],
        s4_dias: item.tags?.includes('s4') ? [item.dia] : [],
        raw: item,
      });
    });
  }

  if (raw.practicas?.practicas) {
    raw.practicas.practicas.forEach((item, idx) => {
      activities.push({
        id: `practica-${idx}`,
        type: 'practica',
        title: item.title,
        subtitle: 'Práctica IB',
        url: null,
        img: null,
        icon: item.icon,
        tag: 'Práctica',
        s2_dias: item.courses?.includes('s2') ? item.dias || [] : [],
        s4_dias: item.courses?.includes('s4') ? item.dias || [] : [],
        raw: item,
      });
    });
  }

  if (raw.atando?.eslabones) {
    raw.atando.eslabones.forEach((item) => {
      activities.push({
        id: String(item.id),
        type: 'eslabones',
        title: item.theme,
        subtitle: 'El Eslabón Perdido',
        url: null,
        img: null,
        tag: 'Juego',
        s2_dias: item.course?.includes('s2') ? [parseInt(item.dia)] : [],
        s4_dias: item.course?.includes('s4') ? [parseInt(item.dia)] : [],
        raw: item,
      });
    });
  }

  return activities;
};

// `userCiclo` is the student's own A/B block-schedule cycle (the trailing
// letter of their `section`, e.g. "4B" -> "B") — on an A/B schedule the same
// día number meets on two different real dates, one per cycle, so "what día
// is active today" has to be computed per-cycle. Without it, a student whose
// class doesn't meet today would see whichever cycle's class happens to be
// in session (e.g. a B-day student visiting on an A-day would briefly see
// today's A-day's día number) rather than their own most recent meeting.
export const useGymData = (userCourse = 's2', userCiclo = 'A') => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveDia, setLiveDia] = useState(1);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const safeFetchJSON = (url) =>
          fetch(url)
            .then((r) => (r.ok ? r.json() : {}))
            .catch(() => ({}));
        const safeFetchText = (url) =>
          fetch(url)
            .then((r) => (r.ok ? r.text() : ''))
            .catch(() => '');

        const fetchCalendar = async () => {
          try {
            const calData = await getCachedDoc('config', 'academic_year_2026_2027');
            return calData || { map: [] };
          } catch (err) {
            return { map: [] };
          }
        };

        // Shared cache — several admin tools (VocabSequencer, FormLearningPath)
        // also read vocab_bundles in full, and this hook itself re-runs on
        // every Dashboard mount, so caching cuts both cross-tool duplication
        // and repeat-visit re-fetches within the same browser session.
        const fetchFirestoreCategory = async (collectionName) => {
          try {
            const docs = await getCachedCollection(collectionName);
            const items = {};
            docs.forEach((d) => {
              items[d.id] = d;
            });
            return { items };
          } catch (err) {
            return { items: {} };
          }
        };

        const fetchFirestoreArray = async (collectionName, rootKey) => {
          try {
            const itemsArray = await getCachedCollection(collectionName);
            return rootKey ? { [rootKey]: itemsArray } : itemsArray;
          } catch (err) {
            return rootKey ? { [rootKey]: [] } : [];
          }
        };

        // For a collection that's been consolidated into one document (see
        // DestacadoManager's migration tool) — reads a single doc's `items`
        // map and unwraps it back into the same flat array shape callers
        // already expect, so this collection's cost drops from (one read
        // per historical entry) to (one read, period). Falls back to
        // treating every doc as its own entry if the bundle doc doesn't
        // exist yet, so this works before AND after that migration runs.
        const fetchBundledArray = async (collectionName, bundleDocId = '_bundle') => {
          try {
            const docs = await getCachedCollection(collectionName);
            const bundle = docs.find((d) => d.id === bundleDocId);
            // Object.values alone drops each item's own id (the bundle map's
            // key) — harmless until something needs to address one item
            // specifically, e.g. Curiosidad.jsx's "Jugar" link building
            // /curiosidad-quiz/${item.id}, which silently became
            // /curiosidad-quiz/undefined without this.
            if (bundle) return Object.entries(bundle.items || {}).map(([id, data]) => ({ id, ...data }));
            return docs;
          } catch (err) {
            return [];
          }
        };

        const fetchEvalsMaster = async () => {
          try {
            const evalsData = await getCachedDoc('curriculum_tracks', 'evaluaciones_master');
            return evalsData || { s2: [], s4: [] };
          } catch (err) {
            return { s2: [], s4: [] };
          }
        };
        const fetchTareasMaster = async () => {
          try {
            const tareasData = await getCachedDoc('curriculum_tracks', 'tareas_master');
            return tareasData || { s2: [], s4: [] };
          } catch (err) {
            return { s2: [], s4: [] };
          }
        };
        // NEW: Fetch Estructura/Gramatica Master Document
        const fetchGramaticaMaster = async () => {
          try {
            const gramData = await getCachedDoc('curriculum_tracks', 'gramatica_master');
            return gramData || { s2: [], s4: [] };
          } catch (err) {
            return { s2: [], s4: [] };
          }
        };

        // 📡 FETCH ALL DATA IN PARALLEL
        const [
          cal,
          dictText,
          anuncios,
          apuntes,
          extras,
          practicas,
          musica,
          lectura,
          conversa,
          cultura,
          videos,
          tareas,
          destacado,
          atando,
          evalsMaster,
          curios,
          gramaticaMaster, // <--- New Fetcher Executed
          imageCards,
        ] = await Promise.all([
          fetchCalendar(),
          safeFetchText(CONFIG.DICTIONARY),

          fetchFirestoreArray('anuncios'),
          safeFetchJSON(CONFIG.APUNTES),
          safeFetchJSON(CONFIG.EXTRAS),
          safeFetchJSON(CONFIG.PRACTICAS),

          fetchFirestoreCategory('musica'),
          fetchFirestoreCategory('lectura'),
          fetchFirestoreCategory('conversaciones'),
          fetchFirestoreCategory('culture'),
          fetchFirestoreArray('videos', 'daily_tags'),

          fetchTareasMaster(),
          fetchBundledArray('destacado_diario'),
          fetchFirestoreArray('juego_atandocabos', 'eslabones'),
          fetchEvalsMaster(),
          fetchBundledArray('curiosidades'),
          fetchGramaticaMaster(), // <--- Added here
          fetchBundledArray('image_cards'),
        ]);

        const validDictionary = dictText
          .split('\n')
          .map((word) => word.trim().toUpperCase())
          .filter((word) => word.length === 5);
        const calendarArray = cal.map || (Array.isArray(cal) ? cal : []);

        const allActivities = normalizeActivities({
          extras,
          videos,
          practicas,
          musica,
          lectura,
          conversa,
          cultura,
          atando,
        });

        setData({
          tareas,
          cal: calendarArray,
          anuncios,
          dictionary: validDictionary,
          evals: evalsMaster,
          curios,
          estructura: gramaticaMaster, // <--- Passing the structure data to dashboard
          destacado,
          apuntes,
          atando,
          activities: allActivities,
          imageCards,
        });
      } catch (error) {
        console.error('Error fetching data:', error);
        setData({});
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // Recomputes "today's día" whenever the calendar data loads or the
  // student's own cycle becomes known (e.g. userData loads a tick after
  // this hook first mounts) — kept separate from the fetch effect above so
  // a cycle becoming available doesn't re-trigger a full data refetch, and
  // so it stays in sync with the exact same per-cycle filtering Dashboard.jsx
  // uses for fechaByDia/maxAllowedDay (an entry with no `ciclo` applies to
  // both; one tagged for the other cycle is skipped).
  useEffect(() => {
    const calendarArray = data?.cal;
    if (!calendarArray || calendarArray.length === 0) return;

    const todayStr = new Date().toLocaleDateString('en-CA');
    const pastEntries = calendarArray.filter(
      (c) => c.fecha && c.fecha <= todayStr && c.dia != null && (!c.ciclo || c.ciclo === userCiclo)
    );
    const currentDay =
      pastEntries.length > 0
        ? parseInt(pastEntries.sort((a, b) => b.fecha.localeCompare(a.fecha))[0].dia)
        : 1;

    setLiveDia(currentDay);
  }, [data?.cal, userCiclo]);

  return { data, loading, liveDia, setLiveDia, course: userCourse };
};