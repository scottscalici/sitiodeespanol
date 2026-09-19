// Parses a line like "Ella [[tiene]] veinte años." into the sentence with
// the blank shown as an underline, plus the correct answer.
export const parseBlankSentence = (line) => {
    const match = line.match(/\[\[(.+?)\]\]/);
    if (!match) return { display: line, answer: null };
    const answer = match[1].trim();
    const display = line.replace(match[0], '_____');
    return { display, answer };
  };