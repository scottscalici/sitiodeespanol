// Starter content for the K-Practice pool (see KPracticePage.jsx / the
// "K-Practice (Personal)" vault source toggle) — dictated by the teacher
// (present-tense stem-changers, ser/estar/tener/ir, chore vocab, and the
// six "verb + infinitive" grammar patterns). Pre-fills the import tool in
// VaultSidebar.jsx so the first import needs no typing; the textarea there
// can be edited/replaced for anything added later.

const cell = (target, english) => ({ target, english });

const presente = (subjEnglishVerb, forms) => ({
  presente: {
    yo: cell(forms[0], `I ${subjEnglishVerb}`),
    tú: cell(forms[1], `you ${subjEnglishVerb}`),
    él_ella_ud: cell(forms[2], `he/she ${subjEnglishVerb}s`),
    nosotros: cell(forms[3], `we ${subjEnglishVerb}`),
    vosotros: cell(forms[4], `you all ${subjEnglishVerb}`),
    ellos_ellas_uds: cell(forms[5], `they ${subjEnglishVerb}`),
  },
});

const verb = (id, infinitiveEnglish, verbGerundLike, forms, tags) => ({
  id,
  palabra: id,
  translations: { infinitivo: cell(id, infinitiveEnglish) },
  tenses: presente(verbGerundLike, forms),
  tags,
  lastUpdated: new Date().toISOString(),
});

export const KPRACTICE_SEED_CONTENT = {
  vocab_bundle: {
    id: 'kpractice_quehaceres',
    textbook: 'K-Practice',
    chapter: '1',
    words: [
      { id: 'sacar_basura', palabra: 'sacar la basura', traduccion: 'to take out the trash', metadata: { secciones: ['1.1'] } },
      { id: 'cortar_cesped', palabra: 'cortar el césped', traduccion: 'to cut/mow the lawn', metadata: { secciones: ['1.1'] } },
      { id: 'barrer_suelo', palabra: 'barrer el suelo', traduccion: 'to sweep the floor', metadata: { secciones: ['1.1'] } },
      { id: 'apagar_luz', palabra: 'apagar la luz', traduccion: 'to turn off the light', metadata: { secciones: ['1.1'] } },
      { id: 'escribir_preguntas', palabra: 'escribir las preguntas', traduccion: 'to write the questions', metadata: { secciones: ['1.1'] } },
      { id: 'cuidar_perro', palabra: 'cuidar al perro', traduccion: 'to take care of the dog', metadata: { secciones: ['1.1'] } },
      { id: 'usar_computadora', palabra: 'usar la computadora', traduccion: 'to use the computer', metadata: { secciones: ['1.1'] } },
      { id: 'prender_luces', palabra: 'prender las luces', traduccion: 'to turn on the lights', metadata: { secciones: ['1.1'] } },
      { id: 'leer_libros', palabra: 'leer los libros', traduccion: 'to read the books', metadata: { secciones: ['1.1'] } },
    ],
  },

  verbs: [
    verb('pensar', 'to think', 'think', ['pienso', 'piensas', 'piensa', 'pensamos', 'pensáis', 'piensan'], ['ar', 'stem_e_ie', 'presente']),
    verb('cerrar', 'to close', 'close', ['cierro', 'cierras', 'cierra', 'cerramos', 'cerráis', 'cierran'], ['ar', 'stem_e_ie', 'presente']),
    verb('empezar', 'to start/begin', 'start', ['empiezo', 'empiezas', 'empieza', 'empezamos', 'empezáis', 'empiezan'], ['ar', 'stem_e_ie', 'presente']),
    verb('entender', 'to understand', 'understand', ['entiendo', 'entiendes', 'entiende', 'entendemos', 'entendéis', 'entienden'], ['er', 'stem_e_ie', 'presente']),
    verb('querer', 'to want', 'want', ['quiero', 'quieres', 'quiere', 'queremos', 'queréis', 'quieren'], ['er', 'stem_e_ie', 'presente']),
    verb('preferir', 'to prefer', 'prefer', ['prefiero', 'prefieres', 'prefiere', 'preferimos', 'preferís', 'prefieren'], ['ir', 'stem_e_ie', 'presente']),
    verb('contar', 'to count/tell', 'count', ['cuento', 'cuentas', 'cuenta', 'contamos', 'contáis', 'cuentan'], ['ar', 'stem_o_ue', 'presente']),
    verb('volar', 'to fly', 'fly', ['vuelo', 'vuelas', 'vuela', 'volamos', 'voláis', 'vuelan'], ['ar', 'stem_o_ue', 'presente']),
    verb('costar', 'to cost', 'cost', ['cuesto', 'cuestas', 'cuesta', 'costamos', 'costáis', 'cuestan'], ['ar', 'stem_o_ue', 'presente']),
    verb('volver', 'to return', 'return', ['vuelvo', 'vuelves', 'vuelve', 'volvemos', 'volvéis', 'vuelven'], ['er', 'stem_o_ue', 'presente']),
    verb('devolver', 'to give back', 'give back', ['devuelvo', 'devuelves', 'devuelve', 'devolvemos', 'devolvéis', 'devuelven'], ['er', 'stem_o_ue', 'presente']),
    verb('poder', 'to be able to/can', 'can', ['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden'], ['er', 'stem_o_ue', 'presente']),
    verb('recordar', 'to remember', 'remember', ['recuerdo', 'recuerdas', 'recuerda', 'recordamos', 'recordáis', 'recuerdan'], ['ar', 'stem_o_ue', 'presente']),
    verb('ser', 'to be (characteristics, origin)', 'be', ['soy', 'eres', 'es', 'somos', 'sois', 'son'], ['irregular', 'presente', 'ser_estar']),
    verb('estar', 'to be (feelings, location)', 'be', ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'], ['irregular', 'presente', 'ser_estar']),
    verb('tener', 'to have', 'have', ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'], ['irregular', 'presente']),
    verb('ir', 'to go', 'go', ['voy', 'vas', 'va', 'vamos', 'vais', 'van'], ['irregular', 'presente']),
  ],

  // "pensar/tener que/tener ganas de/hay que/querer/preferir + infinitivo" —
  // examples 1-5 are the teacher's own dictated sentences; 6-8 fill in the
  // one pattern (pensar) he didn't give an example for, plus two more tying
  // the structures back to the chore vocab above.
  sentences: [
    { id: 'kp_s1', spanish: 'Prefiero escuchar la música.', grammarTags: ['preferir_infinitivo'], chapterId: '1' },
    { id: 'kp_s2', spanish: 'Tiene que estudiar.', grammarTags: ['tener_que_infinitivo'], chapterId: '1' },
    { id: 'kp_s3', spanish: 'Hay que escuchar.', grammarTags: ['hay_que_infinitivo'], chapterId: '1' },
    { id: 'kp_s4', spanish: 'Paco tiene ganas de usar la computadora.', grammarTags: ['tener_ganas_de_infinitivo'], chapterId: '1' },
    { id: 'kp_s5', spanish: 'Tú quieres leer.', grammarTags: ['querer_infinitivo'], chapterId: '1' },
    { id: 'kp_s6', spanish: 'Pienso estudiar esta noche.', grammarTags: ['pensar_infinitivo'], chapterId: '1' },
    { id: 'kp_s7', spanish: 'Tenemos que sacar la basura.', grammarTags: ['tener_que_infinitivo'], chapterId: '1' },
    { id: 'kp_s8', spanish: 'Tengo ganas de leer un libro.', grammarTags: ['tener_ganas_de_infinitivo'], chapterId: '1' },
  ],
};
