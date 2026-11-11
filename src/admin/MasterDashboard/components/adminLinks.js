// Every admin page, in one list. The admin hub (DailyPlanHub) is built
// entirely from this file — when you add a new admin page, add a line here
// and it shows up on the hub automatically.
//
// Each section: { id, title, emoji, color, links: [{ to, label, emoji }] }
// `color` must be one of the keys in SECTION_COLORS in DailyPlanHub.jsx.

export const ADMIN_SECTIONS = [
  {
    id: 'plan',
    title: 'Plan del Día',
    emoji: '📅',
    color: 'orange',
    links: [
      { to: '/admin-lesson-plan', label: 'Plan de Lección', emoji: '📋' },
      { to: '/admin-lesson-plan-overview', label: 'Resumen de Planes', emoji: '🗓️' },
      { to: '/admin-daily-plan-destacado', label: 'Destacado Diario', emoji: '🔥' },
      { to: '/admin-image-cards', label: 'Tarjetas de Imagen', emoji: '📸' },
      { to: '/admin-secret-portal-master?tipo=anuncios', label: 'Anuncios', emoji: '📢' },
      { to: '/admin-daily-plan-tareas', label: 'Tareas Asignadas', emoji: '📝' },
      { to: '/admin-daily-plan-evals', label: 'Evaluaciones', emoji: '🎯' },
      { to: '/admin-daily-plan-gramatica', label: 'Gramática (Sequencer)', emoji: '📚' },
      { to: '/admin-vocab-sequencer', label: 'Vocabulario Activo', emoji: '🧠' },
      { to: '/admin-daily-plan-musica', label: 'Música', emoji: '🎵' },
      { to: '/admin-daily-plan-videos', label: 'Videos', emoji: '🎬' },
      { to: '/admin-daily-plan-conversaciones', label: 'Conversación', emoji: '🗣️' },
    ],
  },
  {
    id: 'calentamiento',
    title: 'Calentamiento, Verbos y Vocab',
    emoji: '⏱️',
    color: 'amber',
    links: [
      { to: '/admin-secret-portal-calentamiento', label: 'Calentamiento de Verbos', emoji: '⏱️' },
      { to: '/admin-secret-portal-calentamiento-upload', label: 'Importar Calentamientos', emoji: '📥' },
      { to: '/admin-secret-portal-vocabvault', label: 'Vocab Vault', emoji: '🗂️' },
      { to: '/admin-secret-portal-verb-editor', label: 'Editor de Verbos', emoji: '📖' },
      { to: '/admin-secret-portal-verbvault', label: 'Grupos de Verbos', emoji: '🗃️' },
      { to: '/admin-secret-portal-verb-audit', label: 'Auditoría de Verbos', emoji: '🔍' },
      { to: '/admin-secret-portal-verb-schoology-export', label: 'Exportar a Schoology', emoji: '📤' },
    ],
  },
  {
    id: 'contenido',
    title: 'Contenido',
    emoji: '✏️',
    color: 'violet',
    links: [
      { to: '/admin-grammar-notes', label: 'Notas de Gramática', emoji: '📚' },
      { to: '/admin-grammar-notes-upload', label: 'Importar Notas', emoji: '📥' },
      { to: '/admin-secret-portal-practice-cards', label: 'Tarjetas de Práctica', emoji: '✏️' },
      { to: '/admin-practice-cards-upload', label: 'Importar Práctica', emoji: '📥' },
      { to: '/admin-practice-cards-sequencer', label: 'Práctica (Sequencer)', emoji: '🗓️' },
      { to: '/admin-secret-portal-chapter-import', label: 'Importar Capítulo', emoji: '📦' },
      { to: '/admin-daily-plan-curiosidades', label: 'Curiosidades', emoji: '💡' },
      { to: '/admin-daily-plan-curiosidadesupload', label: 'Importar Curiosidades', emoji: '📥' },
      { to: '/admin-reading-cards-sequencer', label: 'Lecturas', emoji: '📖' },
      { to: '/admin-reading-cards-upload', label: 'Importar Lecturas', emoji: '📥' },
      { to: '/admin-reading-cards-grading', label: 'Calificar Lecturas', emoji: '📝' },
      { to: '/admin-lecturas-editor', label: 'Lecturas IB (Editor)', emoji: '📄' },
      { to: '/admin-lecturas-sequencer', label: 'Lecturas IB (Sequencer)', emoji: '📄' },
      { to: '/admin-secret-portal-oraciones', label: 'Oraciones de Práctica', emoji: '✍️' },
      { to: '/admin-secret-portal-sentences', label: 'Sentence Manager', emoji: '✍️' },
      { to: '/admin-secret-portal-sentence-tag-migration', label: 'Migrar Etiquetas de Oraciones', emoji: '🏷️' },
      { to: '/admin-secret-portal-idioms', label: 'Modismos', emoji: '💬' },
      { to: '/admin-question-pool', label: 'Reserva de Preguntas', emoji: '🧠' },
    ],
  },
  {
    id: 'rutas',
    title: 'Rutas y Práctica',
    emoji: '🧩',
    color: 'indigo',
    links: [
      { to: '/admin-secret-portal-learning-path', label: 'Pod Creator (Learning Path)', emoji: '🧱' },
      { to: '/admin-secret-portal-practice-hub', label: 'Practice Circle Builder', emoji: '🎯' },
      { to: '/admin-secret-portal-gamification', label: 'Insignias', emoji: '🏆' },
      { to: '/admin-secret-portal-unlockables', label: 'Desbloqueables', emoji: '🔓' },
    ],
  },
  {
    id: 'juegos',
    title: 'Juegos',
    emoji: '🎮',
    color: 'emerald',
    links: [
      { to: '/admin-secret-portal-senordle', label: 'Señordle', emoji: '🟩' },
      { to: '/admin-daily-plan-atandocabos', label: 'Atando Cabos', emoji: '🧶' },
      { to: '/admin-daily-plan-eslabones', label: 'Eslabones', emoji: '🔗' },
      { to: '/admin-secret-portal-impostor-themes', label: 'Impostor', emoji: '🎭' },
      { to: '/admin-secret-portal-silabas', label: 'Sílabas', emoji: '🔤' },
      { to: '/admin-arcade-tiles', label: 'Imágenes de El Recreo', emoji: '🕹️' },
    ],
  },
  {
    id: 'clases',
    title: 'Calificaciones y Clases',
    emoji: '📊',
    color: 'cyan',
    links: [
      { to: '/admin-secret-portal-grades', label: 'Gradebook', emoji: '📊' },
      { to: '/admin-monthly-leaders', label: 'Líderes por Clase', emoji: '📈' },
      { to: '/admin-reassessment-config', label: 'Recuperaciones', emoji: '🔁' },
      { to: '/admin-class-schedule', label: 'Horario de Clases', emoji: '🕐' },
      { to: '/admin-secret-portal-seating-chart', label: 'Asientos', emoji: '🪑' },
    ],
  },
  {
    id: 'sitio',
    title: 'Sitio y Ajustes',
    emoji: '⚙️',
    color: 'sky',
    links: [
      { to: '/admin-secret-portal-master', label: 'Master Dashboard', emoji: '🗄️' },
      { to: '/admin-secret-portal-master?tipo=temas', label: 'Temas', emoji: '🎨' },
      { to: '/admin-resource-hub', label: 'Resource Hub Links', emoji: '🧰' },
      { to: '/admin-faq-editor', label: 'Preguntas Frecuentes', emoji: '❓' },
      { to: '/admin-media-migration', label: 'Migración de Imágenes', emoji: '🖼️' },
    ],
  },
  {
    // Older uploaders that nothing links to anymore. Kept so they're still
    // findable; delete a line here once you're sure you don't need the page.
    id: 'antiguos',
    title: 'Herramientas Antiguas',
    emoji: '🗃️',
    color: 'neutral',
    collapsed: true,
    links: [
      { to: '/admin-secret-portal-vocab', label: 'Vocab Uploader', emoji: '📥' },
      { to: '/admin-secret-portal-verb', label: 'Verb Uploader', emoji: '📥' },
      { to: '/admin-secret-portal-cultura', label: 'Cultura Uploader', emoji: '📥' },
      { to: '/admin-secret-portal-tieredcultura', label: 'Tiered Cultura Uploader', emoji: '📥' },
      { to: '/admin-secret-portal-destacado', label: 'Destacado Uploader', emoji: '📥' },
      { to: '/admin-secret-portal-conectores', label: 'Conectores', emoji: '🔌' },
      { to: '/admin-secret-portal-tareas', label: 'Tareas Dashboard', emoji: '📝' },
    ],
  },
];

// Shown in the "Favoritos" row until you star your own.
export const DEFAULT_FAVORITES = [
  '/admin-lesson-plan',
  '/admin-secret-portal-grades',
  '/admin-secret-portal-calentamiento',
  '/admin-secret-portal-vocabvault',
  '/admin-daily-plan-curiosidades',
  '/admin-secret-portal-practice-cards',
  '/admin-grammar-notes',
  '/admin-secret-portal-seating-chart',
];
