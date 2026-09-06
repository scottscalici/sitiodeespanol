import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Replace the string below with your actual API Key from Google AI Studio
const API_KEY = "AIzaSyA7tm_FHpyphuanBSUwTFHYtoe02KmqDdc"; 

export default function AIAssistant({ coleccionActual }) {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const quickPrompts = {
    lectura: "Genera un texto de lectura. Format it into these three specific levels: Level 1 (English/Beginner): Write mostly in English, mixing in a little bit of Spanish only when necessary to introduce key vocabulary or cultural concepts. Level 2 (Structured Spanish/Spanish II): Write entirely in beginner Spanish, structured specifically for students whose proficiency is between the start and end of Spanish II. Limit complex grammar and focus on high-frequency structures. Level 3 (Natural Spanish/Advanced): Write in natural, authentic Spanish using advanced vocabulary, varied tenses, and native phrasing. Output this as raw JSON that fits a culture document structure.",
    vocabulario: "Genera 10 palabras de vocabulario. Incluye la palabra en español, la traducción al inglés, y una oración de ejemplo para nivel Spanish II. Output as raw JSON.",
    verbos: "Conjuga este verbo en el presente, pretérito, e imperfecto para todas las personas (incluyendo boseo y vosotros). Output as raw JSON."
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsLoading(true);
    setResponse("");

    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      
      // Usamos 2.0-flash que es extremadamente rápido y estable para JSON
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const finalPrompt = `${prompt}\n\nIMPORTANTE: Responde ÚNICAMENTE con el código JSON puro. No incluyas explicaciones ni bloques de formato como \`\`\`json.`;
      
      const result = await model.generateContent(finalPrompt);
      const text = result.response.text();
      
      // Limpiamos posibles bloques de markdown por si acaso el modelo los incluye
      const cleanJson = text.replace(/```json|```/g, "").trim();
      
      setResponse(cleanJson);
    } catch (error) {
      console.error("Error detallado:", error);
      // Esto te dirá exactamente qué dice Google ahora
      setResponse("Error de Google: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(response);
    alert("¡JSON copiado!");
  };

  return (
    <div style={{ padding: '20px', border: '2px solid #6c5ce7', borderRadius: '8px', backgroundColor: '#f3f0ff', marginBottom: '20px' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#6c5ce7' }}>✨ Generador de Contenido IA</h3>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <select 
          onChange={(e) => setPrompt(quickPrompts[e.target.value] || "")}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="">Cargar prompt rápido...</option>
          <option value="lectura">Lectura (3 Niveles)</option>
          <option value="vocabulario">Vocabulario</option>
          <option value="verbos">Conjugaciones</option>
        </select>
      </div>

      <textarea 
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Escribe el tema aquí... (ej: La leyenda de la Llorona)"
        style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '10px' }}
      />
      
      <button 
        onClick={handleGenerate} 
        disabled={isLoading || !prompt}
        style={{ padding: '10px 20px', backgroundColor: '#6c5ce7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
      >
        {isLoading ? "Generando..." : "Generar JSON con Gemini"}
      </button>

      {response && (
        <div style={{ marginTop: '20px', position: 'relative' }}>
          <button 
            onClick={handleCopy}
            style={{ position: 'absolute', top: '10px', right: '10px', padding: '5px 10px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Copiar
          </button>
          <pre style={{ backgroundColor: '#2d3436', color: '#a29bfe', padding: '20px', borderRadius: '6px', overflowX: 'auto', whiteSpace: 'pre-wrap', fontSize: '13px' }}>
            {response}
          </pre>
        </div>
      )}
    </div>
  );
}