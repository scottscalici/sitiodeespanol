import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Link } from 'react-router-dom';
import { getCachedCollection } from '../../utils/firestoreCache';
import { DEFAULT_TITLE_TIERS, getPathPodCount } from '../../utils/gamification';
import BadgeIcon from '../../components/BadgeIcon';

const newChapterBadge = () => ({
  id: `chapter_${Date.now()}`,
  name: '',
  icon: '🏅',
  pathId: '',
  tiers: { bronze: 1, silver: 2, gold: 3 },
});

const newSkillBadge = () => ({
  id: `skill_${Date.now()}`,
  name: '',
  icon: '🥷',
  pathId: '',
});

export default function GamificationManager() {
  const [titleTiers, setTitleTiers] = useState(DEFAULT_TITLE_TIERS);
  const [chapterBadges, setChapterBadges] = useState([]);
  const [skillBadges, setSkillBadges] = useState([]);
  const [learningPaths, setLearningPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [configSnap, paths] = await Promise.all([
          getDoc(doc(db, 'config', 'gamification')),
          getCachedCollection('learning_paths'),
        ]);
        if (configSnap.exists()) {
          const data = configSnap.data();
          if (data.titleTiers?.length) setTitleTiers(data.titleTiers);
          setChapterBadges(data.chapterBadges || []);
          setSkillBadges(data.skillBadges || []);
        }
        setLearningPaths(paths);
      } catch (error) {
        console.error('Error loading gamification config:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const pathLabel = (pathId) => {
    const p = learningPaths.find((lp) => lp.id === pathId);
    return p ? `${p.title || p.id} (${p.id})` : pathId ? `⚠️ ${pathId} (no encontrado)` : '';
  };

  const podCountFor = (pathId) => {
    const p = learningPaths.find((lp) => lp.id === pathId);
    return p ? getPathPodCount(p) : null;
  };

  // --- TITLE TIER HANDLERS ---
  const updateTitleTier = (idx, field, value) => {
    const updated = [...titleTiers];
    updated[idx] = { ...updated[idx], [field]: field === 'minPoints' ? Number(value) || 0 : value };
    setTitleTiers(updated);
  };
  const addTitleTier = () => setTitleTiers([...titleTiers, { minPoints: 0, title: '' }]);
  const removeTitleTier = (idx) => setTitleTiers(titleTiers.filter((_, i) => i !== idx));

  // --- CHAPTER BADGE HANDLERS ---
  const updateChapterBadge = (idx, field, value) => {
    const updated = [...chapterBadges];
    updated[idx] = { ...updated[idx], [field]: value };
    setChapterBadges(updated);
  };
  const updateChapterTier = (idx, tierKey, value) => {
    const updated = [...chapterBadges];
    updated[idx] = { ...updated[idx], tiers: { ...updated[idx].tiers, [tierKey]: Number(value) || 0 } };
    setChapterBadges(updated);
  };
  const addChapterBadge = () => setChapterBadges([...chapterBadges, newChapterBadge()]);
  const removeChapterBadge = (idx) => setChapterBadges(chapterBadges.filter((_, i) => i !== idx));

  // --- SKILL BADGE HANDLERS ---
  const updateSkillBadge = (idx, field, value) => {
    const updated = [...skillBadges];
    updated[idx] = { ...updated[idx], [field]: value };
    setSkillBadges(updated);
  };
  const addSkillBadge = () => setSkillBadges([...skillBadges, newSkillBadge()]);
  const removeSkillBadge = (idx) => setSkillBadges(skillBadges.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      await setDoc(doc(db, 'config', 'gamification'), {
        titleTiers,
        chapterBadges,
        skillBadges,
        lastUpdated: new Date().toISOString(),
      });
      setStatus('✅ Guardado.');
    } catch (error) {
      console.error('Error saving gamification config:', error);
      setStatus('❌ Error al guardar en Firebase.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest">
        Cargando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>🏆</span> Gamification Manager
          </h1>
          <Link
            to="/admin-daily-plan-hub"
            className="text-slate-400 hover:text-white text-xs font-bold border border-slate-700 px-3 py-1.5 rounded-lg"
          >
            ← Hub
          </Link>
        </div>

        {/* TITLE LADDER */}
        <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-black text-emerald-400 uppercase tracking-widest">
            Escalera de Títulos ({titleTiers.length} niveles)
          </h2>
          <p className="text-slate-400 text-xs">
            El total de puntos (`total_points`) determina el título mostrado junto al nombre del estudiante.
          </p>
          <div className="space-y-1.5">
            {titleTiers.map((tier, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="number"
                  value={tier.minPoints}
                  onChange={(e) => updateTitleTier(idx, 'minPoints', e.target.value)}
                  className="w-24 bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-sm font-mono focus:outline-none focus:border-emerald-500"
                />
                <span className="text-slate-500 text-xs">pts →</span>
                <input
                  type="text"
                  value={tier.title}
                  onChange={(e) => updateTitleTier(idx, 'title', e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="Título..."
                />
                <button
                  onClick={() => removeTitleTier(idx)}
                  className="text-rose-400 hover:text-rose-300 text-xs font-bold px-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addTitleTier}
            className="text-emerald-400 hover:text-emerald-300 text-xs font-bold uppercase tracking-widest"
          >
            + Añadir Nivel
          </button>
        </section>

        {/* CHAPTER BADGES */}
        <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-black text-indigo-400 uppercase tracking-widest">
            Insignias de Capítulo ({chapterBadges.length})
          </h2>
          <p className="text-slate-400 text-xs">
            Una insignia por capítulo, con un solo ícono que sube de nivel (bronce → plata → oro) según los pods
            completados en su Learning Path (sumados entre vocab/verbs/practical). Los umbrales son la cantidad
            acumulada de pods, no un incremento.
          </p>
          <div className="space-y-4">
            {chapterBadges.map((badge, idx) => {
              const totalPods = podCountFor(badge.pathId);
              return (
                <div key={badge.id} className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <BadgeIcon icon={badge.icon} tier="gold" size="sm" />
                    <input
                      type="text"
                      value={badge.icon}
                      onChange={(e) => updateChapterBadge(idx, 'icon', e.target.value)}
                      className="w-16 bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-sm text-center focus:outline-none focus:border-indigo-500"
                      placeholder="🏅"
                      title="Emoji o URL de imagen"
                    />
                    <input
                      type="text"
                      value={badge.name}
                      onChange={(e) => updateChapterBadge(idx, 'name', e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500"
                      placeholder="Nombre del capítulo (ej. Presente)"
                    />
                    <button
                      onClick={() => removeChapterBadge(idx)}
                      className="text-rose-400 hover:text-rose-300 text-xs font-bold px-2"
                    >
                      ✕
                    </button>
                  </div>

                  <select
                    value={badge.pathId}
                    onChange={(e) => updateChapterBadge(idx, 'pathId', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Selecciona un Learning Path --</option>
                    {learningPaths.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title || p.id} ({p.id})
                      </option>
                    ))}
                  </select>
                  {badge.pathId && (
                    <p className="text-[10px] text-slate-500">
                      {pathLabel(badge.pathId)} — {totalPods != null ? `${totalPods} pods en total` : 'no encontrado'}
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {['bronze', 'silver', 'gold'].map((tierKey) => (
                      <div key={tierKey}>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                          {tierKey === 'bronze' ? 'Bronce ≥' : tierKey === 'silver' ? 'Plata ≥' : 'Oro ≥'}
                        </label>
                        <input
                          type="number"
                          value={badge.tiers?.[tierKey] ?? ''}
                          onChange={(e) => updateChapterTier(idx, tierKey, e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={addChapterBadge}
            className="text-indigo-400 hover:text-indigo-300 text-xs font-bold uppercase tracking-widest"
          >
            + Añadir Insignia de Capítulo
          </button>
        </section>

        {/* SKILL BADGES */}
        <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-black text-amber-400 uppercase tracking-widest">
            Insignias de Destreza ({skillBadges.length})
          </h2>
          <p className="text-slate-400 text-xs">
            Insignias de un solo nivel — se ganan al completar el 100% de los pods de un Learning Path dedicado a esa
            destreza (ej. subjuntivo).
          </p>
          <div className="space-y-3">
            {skillBadges.map((badge, idx) => (
              <div key={badge.id} className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <BadgeIcon icon={badge.icon} size="sm" />
                  <input
                    type="text"
                    value={badge.icon}
                    onChange={(e) => updateSkillBadge(idx, 'icon', e.target.value)}
                    className="w-16 bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-sm text-center focus:outline-none focus:border-amber-500"
                    placeholder="🥷"
                  />
                  <input
                    type="text"
                    value={badge.name}
                    onChange={(e) => updateSkillBadge(idx, 'name', e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-sm focus:outline-none focus:border-amber-500"
                    placeholder="Nombre (ej. Ninja del Subjuntivo)"
                  />
                  <button
                    onClick={() => removeSkillBadge(idx)}
                    className="text-rose-400 hover:text-rose-300 text-xs font-bold px-2"
                  >
                    ✕
                  </button>
                </div>
                <select
                  value={badge.pathId}
                  onChange={(e) => updateSkillBadge(idx, 'pathId', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Selecciona un Learning Path --</option>
                  {learningPaths.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title || p.id} ({p.id})
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button
            onClick={addSkillBadge}
            className="text-amber-400 hover:text-amber-300 text-xs font-bold uppercase tracking-widest"
          >
            + Añadir Insignia de Destreza
          </button>
        </section>

        {status && (
          <p className={`text-xs font-bold text-center ${status.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>
            {status}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors shadow-lg"
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
