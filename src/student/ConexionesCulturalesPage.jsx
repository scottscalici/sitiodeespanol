import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Static reference content for IB oral presentations — one go-to bank of
// authentic Spanish-speaking-world examples per IB theme, organized into the
// same subtopics the IB syllabus uses. No Firestore read needed.
export const THEMES = [
  {
    id: 'identidades',
    emoji: '🟢',
    label: 'Identidades',
    color: 'green',
    description: 'Explorar la naturaleza del ser y lo que significa ser humano.',
    subsections: [
      {
        id: 'salud-bienestar',
        emoji: '🩺',
        label: 'Salud y bienestar',
        items: [
          '🌿 En México y Perú se usan plantas medicinales para tratar enfermedades comunes.',
          '🍅 En España se sigue la dieta mediterránea, que incluye frutas, verduras y aceite de oliva.',
          '💃 En Argentina y Uruguay, compartir mate es una costumbre diaria.',
          '⛰️ En Chile y Costa Rica, muchas personas practican senderismo y otras actividades al aire libre.',
          '🌸 En Argentina, México y España, el yoga y la meditación son populares.',
          '🥗 En España se da importancia a comer productos frescos; en Ecuador, frutas y granos.',
          '💪 En muchos países hispanos, el fútbol, el tenis y el ciclismo son parte esencial del estilo de vida.',
          '💃 En Argentina se baila el tango; en Chile, la cueca; en México, el jarabe tapatío.',
          '🌸 En República Dominicana, se celebra la Semana del Bienestar para promover la salud integral.',
        ],
      },
      {
        id: 'creencias-valores',
        emoji: '🧭',
        label: 'Creencias y valores',
        items: [
          '💀 En México, el Día de los Muertos celebra la vida de los seres queridos fallecidos.',
          '🌞 En Costa Rica, la expresión "Pura vida" representa optimismo y gratitud.',
          '🕊️ En España, la Semana Santa se celebra con procesiones religiosas y arte popular.',
          '🕊️ En los países hispanos, la familia es el centro de la vida social y emocional.',
          '⛪ En América Latina, el catolicismo influye en celebraciones como la Virgen de Guadalupe.',
          '🌿 En Perú, Ecuador y Bolivia, se cree en la Pachamama (Madre Tierra) como fuente de vida.',
          '🎭 En fiestas patrias, las personas muestran con orgullo sus trajes y música tradicional.',
          '❤️ En muchos países, ayudar a los demás es una tradición importante.',
          '🕊️ En México y Colombia, los abuelos tienen un papel fundamental en la educación y valores.',
        ],
      },
      {
        id: 'estilos-vida',
        emoji: '💃',
        label: 'Estilos de vida',
        items: [
          '🥘 En España y Argentina, la sobremesa es el momento para conversar después de comer.',
          '🎶 En Cuba y República Dominicana, la música y el baile forman parte de la vida cotidiana.',
          '🛍️ En Ecuador y Bolivia, los mercados locales son puntos de encuentro social.',
          '💻 En España, México y Colombia, las redes sociales forman parte del día a día.',
          '🏙️ En Madrid y Ciudad de México, las personas viven un ritmo de vida acelerado.',
          '🥗 En Barcelona y Santiago, crece el interés por productos orgánicos y dietas sostenibles.',
          '🌍 En Costa Rica y España, muchas personas reciclan o usan bicicleta para moverse.',
          '🎶 Los jóvenes disfrutan de conciertos y festivales en ciudades como Buenos Aires y Madrid.',
          '🚴 En muchas ciudades, se promueven deportes urbanos como el ciclismo y el patinaje.',
          '☕ En España, Argentina y México, todavía se valora pasar tiempo conversando después de comer.',
        ],
      },
      {
        id: 'subculturas-diversidad',
        emoji: '🎭',
        label: 'Subculturas y diversidad',
        items: [
          '🎨 En México y España, los jóvenes expresan su identidad mediante grafitis y arte urbano.',
          '🎧 En Puerto Rico y República Dominicana, el reguetón es una forma de expresión cultural juvenil.',
          '💃 En Argentina, el tango expresa melancolía, pasión e historia de inmigración.',
        ],
      },
      {
        id: 'lengua-identidad',
        emoji: '🗣️',
        label: 'Lengua e identidad',
        items: [
          '🗺️ En Paraguay, el guaraní y el español conviven como lenguas oficiales.',
          '🗣️ En España, lenguas como el catalán y el euskera forman parte de la identidad regional.',
          '📱 En Argentina y Uruguay, el uso del "vos" es característico del español rioplatense.',
          '💬 En Paraguay y Perú, se valoran las lenguas indígenas como parte del patrimonio cultural.',
        ],
      },
    ],
  },
  {
    id: 'experiencias',
    emoji: '🟣',
    label: 'Experiencias',
    color: 'purple',
    description: 'Explorar y contar la historia de los acontecimientos, experiencias y viajes que determinan nuestra vida.',
    subsections: [
      {
        id: 'actividades-recreativas',
        emoji: '🎭',
        label: 'Actividades recreativas',
        items: [
          '⚽ En México y Argentina, el fútbol es más que un deporte: es una pasión nacional.',
          '🎨 En Colombia, los festivales de música como el Vallenato o Rock al Parque reúnen a miles de personas.',
          '🧩 En España, los juegos de mesa tradicionales como el dominó o la brisca siguen siendo populares.',
          '⚽ En muchos países, el fútbol, el béisbol, el tenis y el ciclismo son deportes populares.',
          '🎨 En los países hispanos, el teatro y la ópera forman parte de las actividades culturales.',
          '💃 El flamenco, el tango y la salsa siguen siendo formas de recreación tradicionales.',
          '🎉 Los festivales son parte esencial de la vida en el mundo hispano, uniendo comunidades.',
          '🎲 Juegos como el dominó o el ajedrez se disfrutan con familia y amigos.',
          '👨‍👩‍👧‍👦 Pasar tiempo con la familia y los amigos es una forma común de recreación.',
        ],
      },
      {
        id: 'vacaciones-viajes',
        emoji: '✈️',
        label: 'Vacaciones y viajes',
        items: [
          '🏝️ En España, las vacaciones de verano son sagradas: muchas familias viajan a la costa o al pueblo natal.',
          '🌋 En Costa Rica y Ecuador, el ecoturismo promueve el respeto por la naturaleza.',
          '🏙️ En México DF y Buenos Aires, el turismo urbano combina historia, gastronomía y arte.',
          '🏖️ En muchos países hispanos, el turismo está conectado con eventos culturales y fiestas tradicionales.',
          '🍽️ En España, la gastronomía —tapas, jamón serrano y paella— es parte esencial del turismo.',
          '🌿 En Costa Rica, Ecuador y Perú, los parques nacionales atraen viajeros interesados en la biodiversidad.',
          '🎭 En ciudades como Barcelona y Quito, el arte y la arquitectura histórica atraen millones de turistas.',
          '🎶 La música local, como la salsa o el flamenco, forma parte de la experiencia cultural de los viajes.',
          '🌎 Muchos jóvenes viajan por América Latina para aprender español o hacer voluntariado.',
        ],
      },
      {
        id: 'ritos-paso',
        emoji: '👶',
        label: 'Historias de la vida / ritos de paso',
        items: [
          '🎓 En México y Chile, las graduaciones escolares se celebran con fiestas familiares.',
          '💍 En España y Colombia, las bodas mezclan rituales religiosos y tradiciones regionales.',
          '🎂 En México, los quince años marcan el paso de la niñez a la adolescencia.',
        ],
      },
      {
        id: 'costumbres-tradiciones',
        emoji: '🎉',
        label: 'Costumbres y tradiciones',
        items: [
          '🔥 En España, Las Fallas de Valencia combinan arte, sátira y fuego.',
          '💃 En Argentina, el Carnaval de Gualeguaychú mezcla música, danza y disfraces coloridos.',
          '🕯️ En Guatemala y Honduras, las alfombras de Semana Santa decoran las calles con colores vibrantes.',
          '💀 En México, el Xantolo celebra la vida de los seres queridos fallecidos en comunidades del centro del país.',
        ],
      },
    ],
  },
  {
    id: 'ingenio',
    emoji: '🔵',
    label: 'Ingenio humano',
    color: 'blue',
    description: 'Explorar cómo afectan a nuestro mundo la creatividad humana y la innovación.',
    subsections: [
      {
        id: 'comunicacion-medios',
        emoji: '🗞️',
        label: 'Comunicación y medios',
        items: [
          '📺 En México, programas como Once Noticias promueven la educación y la información pública.',
          '📱 En Colombia, las redes sociales se usan para campañas sociales como #NiUnaMenos.',
          '📰 En Cuba, medios independientes en línea ofrecen nuevas perspectivas informativas.',
          '💻 En muchos países, los blogs y plataformas digitales permiten expresarse libremente.',
          '📞 En España, empresas como Telefónica adaptan su publicidad a la cultura de cada región.',
          '🗣️ En países hispanos, la publicidad se adapta a los modismos y referencias culturales locales.',
          '📱 En América Latina, las redes sociales han transformado la forma de informarse y participar.',
          '📰 En Cuba, periodistas independientes usan medios digitales para compartir información libre.',
        ],
      },
      {
        id: 'entretenimiento',
        emoji: '🎬',
        label: 'Entretenimiento',
        items: [
          '🎥 En España, el cine de Pedro Almodóvar explora temas de identidad y diversidad.',
          '🎶 En Puerto Rico, el reguetón ha evolucionado desde los barrios hasta los escenarios globales.',
          '🎭 En Argentina, el teatro callejero lleva arte a las plazas y barrios populares.',
        ],
      },
      {
        id: 'tecnologia-innovacion',
        emoji: '🤖',
        label: 'Tecnología e innovación',
        items: [
          '🔋 En España, se desarrollan proyectos de energía eólica y solar para reducir la huella de carbono.',
          '🚗 En Colombia, Bogotá implementó autobuses eléctricos y carriles exclusivos para transporte sostenible.',
          '💻 En Chile y México, la telemedicina permite consultas médicas a distancia.',
          '📱 En países hispanos, los teléfonos inteligentes y las apps forman parte de la vida diaria.',
          '🏙️ En ciudades como Bogotá o Barcelona, la tecnología ayuda a resolver problemas de tráfico.',
          '💻 La educación en línea y la telemedicina amplían el acceso a servicios esenciales.',
          '🛒 En México, Colombia y España, el comercio electrónico ha crecido rápidamente.',
          '🌞 En Colombia y España, se usan molinos de viento y paneles solares para generar energía.',
          '🤖 En América Latina y Europa se desarrollan proyectos de robótica e inteligencia artificial.',
          '🌾 En España, Chile y México se usan drones y sensores para mejorar la agricultura.',
        ],
      },
      {
        id: 'educacion-investigacion',
        emoji: '🎓',
        label: 'Educación e investigación',
        items: [
          '🧠 En Costa Rica, programas como Educación Abierta promueven el aprendizaje a distancia.',
          '🔬 En México, universidades como la UNAM lideran investigaciones científicas.',
          '📚 En Argentina y Chile, las universidades públicas ofrecen educación gratuita.',
          '💻 La educación en línea facilita estudiar desde casa en zonas rurales.',
        ],
      },
      {
        id: 'innovacion-cientifica',
        emoji: '🧬',
        label: 'Innovación científica',
        items: [
          '🔬 En países hispanos, la tecnología se usa para promover el progreso científico.',
          '🌾 En España, Chile y Colombia, la investigación agrícola busca métodos sostenibles.',
          '🌍 Los países hispanos participan en proyectos globales de investigación científica.',
          '⚙️ En distintas regiones, la biotecnología mejora los tratamientos de salud y el acceso al agua.',
        ],
      },
      {
        id: 'artesania-tradicional',
        emoji: '🧵',
        label: 'Artesanía y técnicas tradicionales',
        items: [
          '🧶 En Perú, Bolivia y Guatemala, las técnicas de tejido indígena se transmiten de generación en generación como una forma de ingenio y expresión artística.',
          '🎨 Los patrones, colores y tintes naturales de los textiles andinos y mayas reflejan siglos de innovación artesanal, no solo decoración.',
          '🪢 Nota para el estudiante: si tu foto muestra la técnica o el patrón del tejido, esto encaja mejor aquí (creatividad e innovación humana). Si tu foto muestra tintes naturales, materiales sostenibles o la tradición frente a la producción en masa, también podría conectarse con "Cómo compartimos el planeta" — anota ambas posibilidades si no estás seguro.',
        ],
      },
    ],
  },
  {
    id: 'organizacion',
    emoji: '🟠',
    label: 'Organización social',
    color: 'orange',
    description: 'Explorar cómo se autoorganizan o son organizados los grupos de personas mediante sistemas o intereses comunes.',
    subsections: [
      {
        id: 'relaciones-sociales',
        emoji: '🤝',
        label: 'Relaciones sociales',
        items: [
          '👨‍👩‍👧 En las comunidades hispanas, la familia es un pilar central de la vida social.',
          '👫 En muchos países, los lazos entre amigos y vecinos son fuertes y duraderos.',
          '🎉 Las celebraciones familiares refuerzan la conexión entre generaciones.',
          '💬 Las comunidades locales organizan eventos para fomentar la convivencia.',
        ],
      },
      {
        id: 'educacion',
        emoji: '🏫',
        label: 'Educación',
        items: [
          '🎓 En España y muchos países latinoamericanos, la educación es gratuita y obligatoria.',
          '📚 En México y Perú, se enseñan las culturas indígenas como parte del currículo nacional.',
          '🎨 Las escuelas incluyen arte, música y literatura para promover valores culturales.',
          '🏫 Hay colegios públicos, privados y religiosos en la mayoría de los países.',
          '⚽ Las actividades extracurriculares fomentan el trabajo en equipo y la creatividad.',
        ],
      },
      {
        id: 'mundo-laboral',
        emoji: '💼',
        label: 'El mundo laboral',
        items: [
          '👷 En muchos países hispanos, las profesiones tradicionales conviven con nuevas industrias tecnológicas.',
          '🧑‍🏫 El respeto a la jerarquía y la cooperación son valores comunes en el entorno laboral.',
          '💡 La creatividad y la innovación están ganando importancia en las empresas modernas.',
          '🌎 Muchos trabajadores migran a otros países en busca de mejores oportunidades.',
        ],
      },
      {
        id: 'ley-orden',
        emoji: '⚖️',
        label: 'Ley y orden',
        items: [
          '👮 En América Latina, la seguridad ciudadana es un tema de debate constante.',
          '🏛️ En España, las leyes promueven la igualdad de género y los derechos sociales.',
          '⚖️ En México y Chile, se busca fortalecer el sistema judicial y la transparencia gubernamental.',
          '🕊️ En muchos países, hay movimientos ciudadanos que promueven la justicia y la paz.',
        ],
      },
      {
        id: 'cultura-arte',
        emoji: '🎭',
        label: 'Cultura y arte',
        items: [
          '📖 En España, Miguel de Cervantes es considerado uno de los autores más influyentes de la lengua española.',
          '🎨 En México, artistas como Frida Kahlo y Diego Rivera reflejan la historia y la identidad nacional.',
          '🖼️ En Colombia, Fernando Botero es famoso por su estilo único y figuras voluminosas.',
          '🎶 En el Caribe, la música salsa y reguetón expresan alegría, identidad y comunidad.',
        ],
      },
    ],
  },
  {
    id: 'planeta',
    emoji: '🟢',
    label: 'Cómo compartimos el planeta',
    color: 'green',
    description: 'Explorar las dificultades y las oportunidades a las que se enfrentan los individuos y las comunidades en el mundo moderno.',
    subsections: [
      {
        id: 'medio-ambiente',
        emoji: '🌿',
        label: 'Medio ambiente',
        items: [
          '🌱 En Costa Rica, la biodiversidad es fundamental para el turismo y la conservación natural.',
          '🏞️ En Ecuador y Perú, los parques nacionales protegen especies únicas del planeta.',
          '☀️ En España y México, la energía solar y eólica ayudan a reducir la contaminación.',
          '💧 En Chile y Argentina, los proyectos de energía hidroeléctrica son fuentes renovables importantes.',
          '🌍 En muchos países hispanos, se promueven programas de sostenibilidad y reciclaje.',
        ],
      },
      {
        id: 'consumo-consciente',
        emoji: '🧵',
        label: 'Consumo consciente y moda sostenible',
        items: [
          '👗 La artista peruana Marina Testino se vistió de un solo color durante dos meses seguidos, reinventando los mismos materiales en vez de comprar ropa nueva cada día — un símbolo visual del consumo consciente.',
          '🧵 Su proyecto no es una costumbre tradicional, sino un ejemplo del movimiento cultural moderno del "consumo consciente" que está creciendo en el mundo hispanohablante como respuesta a la cultura del "fast fashion".',
          '♻️ Nota para el estudiante: una foto de un problema ambiental (como una playa contaminada) también puede conectarse aquí si tu presentación habla de la respuesta cultural — reducir, reutilizar, no comprar de más — en vez de solo describir el problema.',
        ],
      },
      {
        id: 'derechos-humanos',
        emoji: '⚖️',
        label: 'Derechos humanos',
        items: [
          '🤝 En Argentina y México, existen campañas por la igualdad y los derechos de las mujeres.',
          '🏳️‍🌈 En España y Colombia, se celebran marchas del orgullo para promover la diversidad y la inclusión.',
          '👩‍⚖️ En Chile y Perú, se han aprobado reformas para proteger los derechos laborales y sociales.',
        ],
      },
      {
        id: 'paz-conflictos',
        emoji: '🕊️',
        label: 'Paz y conflictos',
        items: [
          '🕊️ En Colombia, el acuerdo de paz de 2016 fue un paso histórico hacia la reconciliación nacional.',
          '🤍 En Guatemala y El Salvador, organizaciones civiles trabajan por la memoria y la justicia social.',
          '💬 En América Latina, los jóvenes promueven el diálogo como alternativa a la violencia.',
        ],
      },
      {
        id: 'igualdad-etica',
        emoji: '⚖️',
        label: 'Igualdad y ética',
        items: [
          '⚖️ En España, la igualdad de género es parte de la educación y las leyes laborales.',
          '💡 En Uruguay y Chile, se promueve la transparencia en el gobierno y la ética pública.',
          '👩‍🏫 En México, campañas educativas fomentan el respeto y la empatía en la comunidad escolar.',
        ],
      },
      {
        id: 'medio-urbano-rural',
        emoji: '🏙️',
        label: 'El medio urbano y rural',
        items: [
          '🏙️ En Bogotá y Madrid, el transporte público busca reducir el tráfico y la contaminación.',
          '🌾 En las zonas rurales de Perú y Bolivia, la agricultura tradicional mantiene vivas las costumbres ancestrales.',
          '🏡 En muchos pueblos pequeños, las comunidades trabajan unidas para preservar su entorno natural.',
        ],
      },
    ],
  },
];

const COLOR_STYLES = {
  green: { text: 'text-green-700', nav: 'hover:text-green-700', badge: 'bg-green-50 border-green-100 text-green-700' },
  purple: { text: 'text-purple-700', nav: 'hover:text-purple-700', badge: 'bg-purple-50 border-purple-100 text-purple-700' },
  blue: { text: 'text-blue-700', nav: 'hover:text-blue-700', badge: 'bg-blue-50 border-blue-100 text-blue-700' },
  orange: { text: 'text-orange-600', nav: 'hover:text-orange-600', badge: 'bg-orange-50 border-orange-100 text-orange-700' },
};

export default function ConexionesCulturalesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filteredThemes = q
    ? THEMES.map((theme) => ({
        ...theme,
        subsections: theme.subsections
          .map((sub) => ({ ...sub, items: sub.items.filter((item) => item.toLowerCase().includes(q)) }))
          .filter((sub) => sub.items.length > 0),
      })).filter((theme) => theme.subsections.length > 0)
    : THEMES;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20">
      {/* html-level smooth scroll is a harmless, scoped-enough progressive
          enhancement; scroll-mt-20 on each section (below) handles the
          fixed-nav offset without touching any global scroll-padding. */}
      <style>{'html { scroll-behavior: smooth; }'}</style>
      <div id="top" />

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-10">
        <button
          onClick={() => navigate(-1)}
          className="text-indigo-600 font-bold mb-6 inline-flex items-center gap-2 hover:text-indigo-800 transition-colors group"
        >
          <span className="text-xl leading-none group-hover:-translate-x-1 transition-transform">←</span>
          Volver
        </button>

        <h1 className="text-3xl font-bold text-indigo-700 mb-2">🌎 Conexiones Culturales</h1>
        <p className="mb-6 text-lg text-gray-600">
          Ejemplos del mundo hispanohablante organizados por tema de IB — úsalos para conectar tu foto o presentación con
          la cultura.
        </p>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar un ejemplo, país o palabra clave..."
          className="w-full mb-6 px-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-base"
        />

        {!search && (
          <div className="flex flex-wrap gap-x-3 gap-y-2 mb-8 sticky top-0 bg-gray-50/90 backdrop-blur-sm py-2 z-10 border-b border-gray-200">
            {THEMES.map((theme) => (
              <a
                key={theme.id}
                href={`#${theme.id}`}
                className={`text-sm font-medium text-gray-600 ${COLOR_STYLES[theme.color].nav}`}
              >
                {theme.emoji} {theme.label}
              </a>
            ))}
          </div>
        )}

        {filteredThemes.length === 0 && (
          <p className="text-gray-400 italic text-center py-10">Sin resultados para "{search}".</p>
        )}

        {filteredThemes.map((theme) => (
          <section key={theme.id} id={theme.id} className="mb-10 scroll-mt-20 space-y-4">
            <div>
              <h2 className={`text-2xl font-semibold ${COLOR_STYLES[theme.color].text}`}>
                {theme.emoji} {theme.label}
              </h2>
              {!search && <p className="text-gray-700 mt-1">{theme.description}</p>}
            </div>

            {theme.subsections.map((sub, i) => (
              <details key={sub.id} open={q ? true : i === 0} className="border border-gray-200 bg-white rounded-xl p-4">
                <summary className="font-semibold cursor-pointer">
                  {sub.emoji} {sub.label}
                </summary>
                <ul className="list-disc ml-6 mt-2 space-y-1.5 text-gray-700">
                  {sub.items.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </details>
            ))}

            <div className="text-right">
              <a href="#top" className="text-sm text-gray-500 hover:text-black">
                ⬆️ Volver arriba
              </a>
            </div>
          </section>
        ))}

        <section className="border-t pt-6 text-sm text-gray-400">
          <p>Creado por Sr. Scalici · Banco de ejemplos culturales para presentaciones orales de IB.</p>
        </section>
      </div>
    </div>
  );
}
