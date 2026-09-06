import React from 'react';

const AITutor = ({ temas }) => {
  const tutorImg = temas?.mascots?.tutor || "https://raw.githubusercontent.com/scottscalici/imagenes/main/diasfestivos/senor.png";

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border-t-8 border-indigo-500 flex flex-col group transition-transform hover:-translate-y-1">
      <div className="h-32 overflow-hidden border-b bg-slate-50"> 
        <img src={tutorImg} alt="AI Tutor" className="w-full h-full object-cover mix-blend-multiply" /> 
      </div>
      <div className="p-4 flex flex-col flex-grow bg-white text-center">
        <h3 className="text-slate-900 font-bold text-md mb-3 italic">Señor+ AI Tutor</h3>
        <a 
          href="https://student.schoolai.com/dot/spaces/join?code=AWSM-S4EM" 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-slate-800 text-white py-2.5 rounded-lg font-bold text-xs hover:bg-black transition-colors shadow-md uppercase tracking-widest"
        >
          Practicar ahora ↗
        </a>
      </div>
    </div>
  );
};

export default AITutor;