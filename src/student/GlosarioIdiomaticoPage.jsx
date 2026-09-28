import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// Static reference content — no Firestore read needed, so this page costs
// nothing per visit and never goes stale from a caching TTL. Update this
// array directly to add/edit expressions.
const CATEGORIES = [
  {
    id: 'motivacion',
    emoji: '🔋',
    label: 'Motivación / Ánimo',
    color: 'pink',
    expresiones: [
      { expresion: 'Ponerse las pilas', ejemplo: 'Tienes que ponerte las pilas si quieres aprobar el examen.', ingles: 'Get your act together / Get moving' },
      { expresion: 'Echarle ganas', ejemplo: 'Aunque estés cansado, échale ganas y termina el trabajo.', ingles: 'Give it your best effort' },
      { expresion: 'Dar el 100%', ejemplo: 'En el partido de hoy, todos dieron el 100%.', ingles: 'Give it your all' },
      { expresion: 'No tirar la toalla', ejemplo: 'Aunque la situación sea difícil, no tires la toalla.', ingles: "Don't give up" },
    ],
  },
  {
    id: 'frustracion',
    emoji: '🤯',
    label: 'Frustración / Errores',
    color: 'red',
    expresiones: [
      { expresion: 'Meter la pata', ejemplo: 'Metí la pata al decirle eso; no era mi intención.', ingles: 'Mess up / Put your foot in your mouth' },
      { expresion: 'Estar hasta la coronilla', ejemplo: 'Estoy hasta la coronilla de tanto trabajo.', ingles: 'Be fed up' },
      { expresion: 'Perder los estribos', ejemplo: 'Perdió los estribos cuando se enteró de la noticia.', ingles: 'Lose your temper' },
      { expresion: 'Estar en apuros', ejemplo: 'Juan está en apuros y necesita ayuda urgente.', ingles: 'Be in a bind / trouble' },
    ],
  },
  {
    id: 'verguenza',
    emoji: '😳',
    label: 'Vergüenza / Momentos Incómodos',
    color: 'amber',
    expresiones: [
      { expresion: 'Tierra, trágame', ejemplo: 'Cuando me caí en medio de la presentación, pensé: tierra, trágame.', ingles: 'I wish the ground would swallow me up' },
      { expresion: 'Quedarse en blanco', ejemplo: 'Durante el examen oral, me quedé en blanco.', ingles: 'Go blank' },
      { expresion: 'No saber dónde meterse', ejemplo: 'Cuando lo descubrieron mintiendo, no sabía dónde meterse.', ingles: 'Not know where to hide (from embarrassment)' },
    ],
  },
  {
    id: 'exageracion',
    emoji: '😂',
    label: 'Exageración / Drama',
    color: 'purple',
    expresiones: [
      { expresion: 'Ahogarse en un vaso de agua', ejemplo: 'No exageres, te estás ahogando en un vaso de agua.', ingles: 'Make a mountain out of a molehill' },
      { expresion: 'Poner el grito en el cielo', ejemplo: 'Mi madre puso el grito en el cielo cuando vio mi cuarto.', ingles: 'Make a big fuss' },
      { expresion: 'Ser un drama queen', ejemplo: 'Siempre hace un escándalo, es una drama queen.', ingles: 'Be overly dramatic' },
    ],
  },
  {
    id: 'distraccion',
    emoji: '🧠',
    label: 'Distracción / Torpeza',
    color: 'teal',
    expresiones: [
      { expresion: 'Estar en las nubes', ejemplo: 'Pedro estaba en las nubes durante toda la clase.', ingles: 'Daydreaming / Not paying attention' },
      { expresion: 'No dar pie con bola', ejemplo: 'Hoy no doy pie con bola, todo me sale mal.', ingles: "Can't get anything right" },
    ],
  },
  {
    id: 'relaciones',
    emoji: '🤝',
    label: 'Relaciones / Colaboración',
    color: 'green',
    expresiones: [
      { expresion: 'Echar una mano', ejemplo: '¿Puedes echarme una mano con este proyecto?', ingles: 'Lend a hand' },
      { expresion: 'Llevarse bien', ejemplo: 'Me llevo muy bien con mis compañeros de clase.', ingles: 'Get along well' },
    ],
  },
  {
    id: 'responsabilidad',
    emoji: '🧼',
    label: 'Responsabilidad / Problemas',
    color: 'blue',
    expresiones: [
      { expresion: 'Hacer la vista gorda', ejemplo: 'El profesor hizo la vista gorda cuando vio los apuntes en la mesa.', ingles: 'Turn a blind eye' },
      { expresion: 'Pagar el pato', ejemplo: 'Siempre pago el pato aunque no haya sido yo.', ingles: 'Take the blame' },
    ],
  },
  {
    id: 'locura',
    emoji: '🤪',
    label: 'Locura / Sin sentido',
    color: 'orange',
    expresiones: [
      { expresion: 'Estar como una cabra', ejemplo: '¡Ese chico está como una cabra!', ingles: 'Be a little crazy' },
      { expresion: 'No tener ni pies ni cabeza', ejemplo: 'Esa historia no tiene ni pies ni cabeza.', ingles: 'Makes no sense' },
    ],
  },
  {
    id: 'energia',
    emoji: '💤',
    label: 'Energía / Cansancio',
    color: 'slate',
    expresiones: [
      { expresion: 'Estar hecho polvo', ejemplo: 'Después del examen, estaba hecho polvo.', ingles: 'Be exhausted' },
    ],
  },
];

// Tailwind can't see dynamically-built class strings, so each color needs
// its full set of classes spelled out here rather than interpolated.
const COLOR_STYLES = {
  pink: { text: 'text-pink-600', badge: 'bg-pink-50 border-pink-100 text-pink-700', card: 'border-pink-100' },
  red: { text: 'text-red-600', badge: 'bg-red-50 border-red-100 text-red-700', card: 'border-red-100' },
  amber: { text: 'text-amber-600', badge: 'bg-amber-50 border-amber-100 text-amber-700', card: 'border-amber-100' },
  purple: { text: 'text-purple-600', badge: 'bg-purple-50 border-purple-100 text-purple-700', card: 'border-purple-100' },
  teal: { text: 'text-teal-600', badge: 'bg-teal-50 border-teal-100 text-teal-700', card: 'border-teal-100' },
  green: { text: 'text-green-700', badge: 'bg-green-50 border-green-100 text-green-700', card: 'border-green-100' },
  blue: { text: 'text-blue-600', badge: 'bg-blue-50 border-blue-100 text-blue-700', card: 'border-blue-100' },
  orange: { text: 'text-orange-600', badge: 'bg-orange-50 border-orange-100 text-orange-700', card: 'border-orange-100' },
  slate: { text: 'text-slate-700', badge: 'bg-slate-100 border-slate-200 text-slate-700', card: 'border-slate-200' },
};

export default function GlosarioIdiomaticoPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.map((cat) => ({
      ...cat,
      expresiones: cat.expresiones.filter(
        (exp) =>
          exp.expresion.toLowerCase().includes(q) ||
          exp.ingles.toLowerCase().includes(q) ||
          exp.ejemplo.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.expresiones.length > 0);
  }, [search]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-10">
        <button
          onClick={() => navigate(-1)}
          className="text-indigo-600 font-bold mb-6 inline-flex items-center gap-2 hover:text-indigo-800 transition-colors group"
        >
          <span className="text-xl leading-none group-hover:-translate-x-1 transition-transform">←</span>
          Volver
        </button>

        <h1 className="text-3xl font-bold text-indigo-700 mb-2">📚 Glosario de Expresiones Idiomáticas</h1>
        <p className="mb-6 text-lg text-gray-600">
          Expresiones comunes del español organizadas por tema, cada una con un ejemplo natural y su significado en inglés.
        </p>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar una expresión..."
          className="w-full mb-6 px-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-base"
        />

        {/* Quick nav — jumps straight to a category, hidden while filtering by search */}
        {!search && (
          <div className="flex flex-wrap gap-2 mb-8">
            {CATEGORIES.map((cat) => (
              <a
                key={cat.id}
                href={`#${cat.id}`}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${COLOR_STYLES[cat.color].badge}`}
              >
                {cat.emoji} {cat.label}
              </a>
            ))}
          </div>
        )}

        {filteredCategories.length === 0 && (
          <p className="text-gray-400 italic text-center py-10">Sin resultados para "{search}".</p>
        )}

        {filteredCategories.map((cat) => (
          <section key={cat.id} id={cat.id} className="mb-10 scroll-mt-6">
            <h2 className={`text-2xl font-semibold mb-4 ${COLOR_STYLES[cat.color].text}`}>
              {cat.emoji} {cat.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {cat.expresiones.map((exp) => (
                <div key={exp.expresion} className={`bg-white border rounded-xl p-4 shadow-sm ${COLOR_STYLES[cat.color].card}`}>
                  <h3 className="text-lg font-bold text-gray-800">{exp.expresion}</h3>
                  <p className="italic text-gray-600 mt-1">{exp.ejemplo}</p>
                  <p className="text-sm text-gray-500 mt-2">🌐 {exp.ingles}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="border-t pt-6 text-sm text-gray-400">
          <p>Creado por Sr. Scalici · Página de referencia para práctica oral y vocabulario idiomático.</p>
        </section>
      </div>
    </div>
  );
}
