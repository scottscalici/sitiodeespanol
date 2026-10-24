import JSZip from 'jszip';

// Builds a Blackboard 6/7.1-9.0 Question Pool package (assessment/x-bb-pool)
// — not QTI. Hands-on testing against a real Schoology account found that
// importing a QTI v2.1/v2.2 zip only ever creates a single locked
// "assessment," with no way to organize it into folders or mix its
// questions into other quizzes. Importing this Blackboard Pool format
// instead (Resources > Import > Blackboard (ZIP)) creates a real,
// convertible Question Bank that a teacher can later turn into an Item
// Bank and reuse freely across multiple Assessments — the actual goal here.
//
// QUESTION_FILLINBLANK is the one Blackboard question type that natively
// accepts MULTIPLE <ANSWER> elements as equally-correct alternatives (no
// separate "which one is right" marker needed, unlike multiple-choice) —
// a direct match for this app's own alt_answers concept.

const escapeXml = (str) =>
  (str ?? '')
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Matches the real-world example this format was reverse-engineered from —
// Blackboard's own exporter writes CRLF line endings throughout.
const CRLF = '\r\n';

const datesBlock = (indent, timestamp) =>
  `${indent}<DATES>${CRLF}` +
  `${indent}  <CREATED value="${timestamp}" />${CRLF}` +
  `${indent}  <UPDATED value="${timestamp}" />${CRLF}` +
  `${indent}</DATES>${CRLF}`;

const buildQuestionXml = (question, timestamp) => {
  const answersXml = question.answers
    .map(
      (ans, i) =>
        `    <ANSWER id="${question.id}_a${i + 1}" position="${i + 1}">${CRLF}` +
        datesBlock('      ', timestamp) +
        `      <TEXT>${escapeXml(ans)}</TEXT>${CRLF}` +
        `    </ANSWER>${CRLF}`
    )
    .join('');

  return (
    `  <QUESTION_FILLINBLANK id="${question.id}">${CRLF}` +
    datesBlock('    ', timestamp) +
    `    <BODY>${CRLF}` +
    `      <TEXT>${escapeXml(question.prompt)}</TEXT>${CRLF}` +
    `      <FLAGS value="true">${CRLF}` +
    `        <ISHTML value="true" />${CRLF}` +
    `        <ISNEWLINELITERAL />${CRLF}` +
    `      </FLAGS>${CRLF}` +
    `    </BODY>${CRLF}` +
    answersXml +
    `    <GRADABLE>${CRLF}` +
    `      <FEEDBACK_WHEN_CORRECT>¡Correcto!</FEEDBACK_WHEN_CORRECT>${CRLF}` +
    `      <FEEDBACK_WHEN_INCORRECT>Incorrecto, inténtalo de nuevo.</FEEDBACK_WHEN_INCORRECT>${CRLF}` +
    `    </GRADABLE>${CRLF}` +
    `  </QUESTION_FILLINBLANK>${CRLF}`
  );
};

// `questions`: [{ id, prompt, answers: [string, ...] }]. `title` names the
// pool as it'll appear once imported into Schoology. Returns a Blob ready
// to hand to a download link — nothing here touches Firestore or the
// network, so this can run entirely client-side.
export const buildBlackboardPoolZip = async ({ title, questions }) => {
  const timestamp = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');

  const manifest =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    CRLF +
    '<manifest identifier="man00001"><organization default="toc00001">' +
    '<tableofcontents identifier="toc00001"/></organization><resources>' +
    '<resource baseurl="res00001" file="res00001.dat" identifier="res00001" ' +
    'type="assessment/x-bb-pool"/></resources></manifest>';

  const questionlist = questions
    .map((q) => `    <QUESTION id="${q.id}" class="QUESTION_FILLINBLANK" />${CRLF}`)
    .join('');
  const questionsXml = questions.map((q) => buildQuestionXml(q, timestamp)).join('');

  const pool =
    '<?xml version="1.0" encoding="utf-8"?>' +
    CRLF +
    '<POOL>' +
    CRLF +
    '  <COURSEID value="IMPORT" />' +
    CRLF +
    `  <TITLE value="${escapeXml(title)}" />` +
    CRLF +
    '  <DESCRIPTION>' +
    CRLF +
    '    <TEXT>Exported from Sitio de Español Verb Vault</TEXT>' +
    CRLF +
    '  </DESCRIPTION>' +
    CRLF +
    datesBlock('  ', timestamp) +
    '  <QUESTIONLIST>' +
    CRLF +
    questionlist +
    '  </QUESTIONLIST>' +
    CRLF +
    questionsXml +
    '</POOL>';

  const zip = new JSZip();
  zip.file('imsmanifest.xml', manifest);
  zip.file('res00001.dat', pool);
  return zip.generateAsync({ type: 'blob' });
};

export const triggerZipDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
