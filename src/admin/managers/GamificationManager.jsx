import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Link } from 'react-router-dom';
import { DEFAULT_TITLE_TIERS } from '../../utils/gamification';
import BadgeIcon from '../../components/BadgeIcon';

const newBadge = () => ({ id: `badge_${Date.now()}`, name: '', icon: '🏅', tiered: false });

export default function GamificationManager() {
  const [titleTiers, setTitleTiers] = useState(DEFAULT_TITLE_TIERS);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'gamification'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.titleTiers?.length) setTitleTiers(data.titleTiers);
          setBadges(data.badges || []);
        }
      } catch (error) {
        console.error('Error loading gamification config:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // --- TITLE TIER HANDLERS ---
  const updateTitleTier = (idx, field, value) => {
    const updated = [...titleTiers];
    updated[idx] = { ...updated[idx], [field]: field === 'minPoints' ? Number(value) || 0 : value };
    setTitleTiers(updated);
  };
  const addTitleTier = () => setTitleTiers([...titleTiers, { minPoints: 0, title: '' }]);
  const removeTitleTier = (idx) => setTitleTiers(titleTiers.filter((_, i) => i !== idx));

  // --- BADGE CATALOG HANDLERS ---
  const updateBadge = (idx, field, value) => {
    const updated = [...badges];
    updated[idx] = { ...updated[idx], [field]: value };
    setBadges(updated);
  };
  const addBadge = () => setBadges([...badges, newBadge()]);
  const removeBadge = (idx) => setBadges(badges.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      await setDoc(doc(db, 'config', 'gamification'), {
        titleTiers,
        badges,
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
      <div className="max-w-3xl mx-auto space-y-6">
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

        {/* BADGE CATALOG */}
        <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-black text-indigo-400 uppercase tracking-widest">
            Catálogo de Insignias ({badges.length})
          </h2>
          <p className="text-slate-400 text-xs">
            Define el nombre e ícono de cada insignia aquí (o créalas al vuelo desde el Pod Creator). Marca "Por
            niveles" para una insignia de capítulo que sube bronce → plata → oro; sin marcar, es una insignia de un
            solo nivel. Dónde y cuándo se otorga cada una se decide por pod en el{' '}
            <Link to="/admin-secret-portal-learning-path" className="text-indigo-400 underline">
              Pod Creator
            </Link>{' '}
            — no aquí.
          </p>
          <div className="space-y-2">
            {badges.map((badge, idx) => (
              <div key={badge.id} className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-xl p-3">
                <BadgeIcon icon={badge.icon} tier={badge.tiered ? 'gold' : null} size="sm" />
                <input
                  type="text"
                  value={badge.icon}
                  onChange={(e) => updateBadge(idx, 'icon', e.target.value)}
                  className="w-16 bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-sm text-center focus:outline-none focus:border-indigo-500"
                  placeholder="🏅"
                  title="Emoji o URL de imagen"
                />
                <input
                  type="text"
                  value={badge.name}
                  onChange={(e) => updateBadge(idx, 'name', e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Nombre de la insignia"
                />
                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 whitespace-nowrap px-2">
                  <input
                    type="checkbox"
                    checked={!!badge.tiered}
                    onChange={(e) => updateBadge(idx, 'tiered', e.target.checked)}
                    className="w-4 h-4"
                  />
                  Por niveles
                </label>
                <button
                  onClick={() => removeBadge(idx)}
                  className="text-rose-400 hover:text-rose-300 text-xs font-bold px-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addBadge}
            className="text-indigo-400 hover:text-indigo-300 text-xs font-bold uppercase tracking-widest"
          >
            + Añadir Insignia
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
