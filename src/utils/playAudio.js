// Shared Spanish text-to-speech helper — extracted from WorkoutEngine.jsx so
// PracticeCardEngine.jsx's 'listen' question type sounds the same as every
// other listening prompt in the app instead of reimplementing this itself.
export const playAudio = (text) => {
  if (!text || !('speechSynthesis' in window)) return;
  const cleanText = text.replace(/\[\[|\]\]/g, '').replace(/_+/g, '').replace(/[()]/g, '').replace(/\/[a-z]{1,2}\b/gi, '');
  if (!cleanText.trim()) return;

  const speakNow = () => {
    // Chrome's speech queue can silently stop responding after ~15s idle;
    // canceling any stuck/queued utterance before speaking clears that.
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-US'; utterance.rate = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((v) => v.lang === 'es-US' || v.lang === 'es-MX');
    if (preferredVoice) utterance.voice = preferredVoice;
    window.speechSynthesis.speak(utterance);
  };

  // Voices load asynchronously — right after page load, getVoices() can
  // still return [] the first time. Wait for them once instead of speaking
  // silently with no voice available.
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      speakNow();
    };
  } else {
    speakNow();
  }
};
