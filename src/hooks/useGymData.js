import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const CONFIG = {
  ANUNCIOS: 'https://raw.githubusercontent.com/scottscalici/imagenes/main/planes/anuncios.json',
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

export const useGymData = (userCourse = 's2') => {
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
            const calRef = doc(db, 'config', 'academic_year_2026_2027');
            const calSnap = await getDoc(calRef);
            return calSnap.exists() ? calSnap.data() : { map: [] };
          } catch (err) {
            return { map: [] };
          }
        };

        const fetchFirestoreCategory = async (collectionName) => {
          try {
            const snap = await getDocs(collection(db, collectionName));
            const items = {};
            snap.forEach((doc) => {
              items[doc.id] = doc.data();
            });
            return { items };
          } catch (err) {
            return { items: {} };
          }
        };

        const fetchFirestoreArray = async (collectionName, rootKey) => {
          try {
            const snap = await getDocs(collection(db, collectionName));
            const itemsArray = snap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            return rootKey ? { [rootKey]: itemsArray } : itemsArray;
          } catch (err) {
            return rootKey ? { [rootKey]: [] } : [];
          }
        };

        const fetchEvalsMaster = async () => {
          try {
            const evalsRef = doc(db, 'curriculum_tracks', 'evaluaciones_master');
            const evalsSnap = await getDoc(evalsRef);
            return evalsSnap.exists() ? evalsSnap.data() : { s2: [], s4: [] };
          } catch (err) {
            return { s2: [], s4: [] };
          }
        };

        // NEW: Fetch Estructura/Gramatica Master Document
        const fetchGramaticaMaster = async () => {
          try {
            const gramRef = doc(db, 'curriculum_tracks', 'gramatica_master');
            const gramSnap = await getDoc(gramRef);
            return gramSnap.exists() ? gramSnap.data() : { s2: [], s4: [] };
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
          vocab,
          destacado,
          temas,
          atando,
          words,
          evalsMaster,
          curios,
          gramaticaMaster // <--- New Fetcher Executed
        ] = await Promise.all([
          fetchCalendar(),
          safeFetchText(CONFIG.DICTIONARY),

          safeFetchJSON(CONFIG.ANUNCIOS),
          safeFetchJSON(CONFIG.APUNTES),
          safeFetchJSON(CONFIG.EXTRAS),
          safeFetchJSON(CONFIG.PRACTICAS),

          fetchFirestoreCategory('musica'),
          fetchFirestoreCategory('lectura'),
          fetchFirestoreCategory('conversaciones'),
          fetchFirestoreCategory('culture'),
          fetchFirestoreArray('videos', 'daily_tags'),

          fetchFirestoreArray('tareas_bundles', 'tareas'),
          fetchFirestoreArray('vocab_bundles', 'bundles'),
          fetchFirestoreArray('destacado_diario'),
          fetchFirestoreCategory('temas'),
          fetchFirestoreArray('juego_atandocabos', 'eslabones'),
          fetchFirestoreArray('juego_senordle', 'words'),
          fetchEvalsMaster(),
          fetchFirestoreArray('curiosidades'),
          fetchGramaticaMaster() // <--- Added here
        ]);

        const validDictionary = dictText
          .split('\n')
          .map((word) => word.trim().toUpperCase())
          .filter((word) => word.length === 5);
        const calendarArray = cal.map || (Array.isArray(cal) ? cal : []);

        const todayStr = new Date().toLocaleDateString('en-CA');
        const pastEntries = calendarArray.filter(
          (c) => c.fecha && c.fecha <= todayStr && c.dia != null
        );
        const currentDay =
          pastEntries.length > 0
            ? parseInt(
                pastEntries.sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
                  .dia
              )
            : 1;

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

        setLiveDia(currentDay);
        setData({
          tareas,
          cal: calendarArray,
          vocab,
          anuncios,
          words,
          dictionary: validDictionary,
          evals: evalsMaster,
          curios,
          estructura: gramaticaMaster, // <--- Passing the structure data to dashboard
          destacado,
          apuntes,
          temas,
          atando,
          activities: allActivities,
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

  return { data, loading, liveDia, setLiveDia, course: userCourse };
};