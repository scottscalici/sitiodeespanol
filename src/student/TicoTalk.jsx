import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const TicoTalk = () => {
  const [videoDatabase, setVideoDatabase] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Heart Animation State
  const [showBigHeart, setShowBigHeart] = useState(false);
  const [likedVideos, setLikedVideos] = useState({});

  const lastTapRef = useRef(0); // For tracking double-taps on mobile

  // Your Apps Script URL
  const jsonUrl = "https://script.google.com/macros/s/AKfycbyL_siaRKlrOAtyrbE5v-53PH0gRJDhS9LFEAdUH3zB3czS10DzGc6tlwo7YovNBoGi/exec";

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch(jsonUrl + '?v=' + new Date().getTime());
        if (!response.ok) throw new Error("Could not load the JSON file.");
        let data = await response.json();
        
        // Shuffle the array so the feed is different every time!
        data = data.sort(() => Math.random() - 0.5);
        
        setVideoDatabase(data);
        setLoading(false);
      } catch (error) {
        console.error("Error loading FYP database:", error);
        setLoading(false);
      }
    };
    fetchVideos();
  }, []);

  // --- SWIPE LOGIC ---
  const handleNext = () => {
    if (currentIndex < videoDatabase.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Loop back to start if they reach the end
      setCurrentIndex(0); 
    }
  };

  let touchStartY = 0;
  const handleTouchStart = (e) => { touchStartY = e.changedTouches[0].screenY; };
  const handleTouchEnd = (e) => {
    const touchEndY = e.changedTouches[0].screenY;
    if (touchStartY - touchEndY > 60) handleNext(); // Swiped Up
  };

  // --- DOUBLE TAP LOGIC ---
  const handleVideoTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    
    if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      // It's a double tap!
      triggerHeart();
    }
    lastTapRef.current = now;
  };

  const triggerHeart = () => {
    // Show big heart
    setShowBigHeart(true);
    // Mark this specific video index as "liked" for the sidebar button
    setLikedVideos(prev => ({ ...prev, [currentIndex]: true }));
    
    // Hide big heart after 800ms
    setTimeout(() => {
      setShowBigHeart(false);
    }, 800);
  };

// --- VIDEO PARSER ---
const renderIframe = (videoObj) => {
  if (!videoObj) return null;

  // Force lowercase to prevent accidental typos in your Google Sheet like "Drive" vs "drive"
  const platform = (videoObj.platform || "").toLowerCase();
  let finalId = videoObj.video_id || "";
  const url = videoObj.url || "";

  // 1. If there IS a URL, try to extract the ID from it (for YT, TT, IG)
  if (url) {
    if (platform === "youtube") {
      const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
      if (ytMatch) finalId = ytMatch[1];
    } else if (platform === "tiktok") {
      const ttMatch = url.match(/video\/(\d+)/);
      if (ttMatch) finalId = ttMatch[1];
    }
  }

  // 2. Render based on the platform! (No longer trapped inside the URL check)
  if (platform === "drive") {
    return (
      <iframe 
        src={`https://drive.google.com/file/d/${finalId}/preview`} 
        className="w-full h-full" 
        frameBorder="0" 
        allow="autoplay; fullscreen" 
        allowFullScreen
      ></iframe>
    );
  }

  if (platform === "youtube") {
    let timeParams = "";
    if (videoObj.start) timeParams += `&start=${videoObj.start}`;
    if (videoObj.end) timeParams += `&end=${videoObj.end}`;
    // Added loop=1 and playlist=finalId so YouTube shorts loop infinitely like TikTok!
    return (
      <iframe 
        src={`https://www.youtube.com/embed/${finalId}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${finalId}${timeParams}`} 
        className="w-full h-full pointer-events-none" 
        frameBorder="0" 
        allow="autoplay; encrypted-media" 
        allowFullScreen
      ></iframe>
    );
  }

  if (platform === "tiktok") {
    return (
      <iframe 
        src={`https://www.tiktok.com/embed/v2/${finalId}`} 
        className="w-full h-full pointer-events-none" 
        frameBorder="0" 
        allow="fullscreen; autoplay; encrypted-media;"
      ></iframe>
    );
  }

  // Fallback if the platform is completely unrecognized
  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400 p-4 text-center font-bold">
      Plataforma '{platform || "desconocida"}' no soportada
    </div>
  );
};
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-[100px]"></div>

      {/* Back Button */}
      <div className="absolute top-6 left-6 z-50">
        <Link to="/recreo" className="text-white bg-white/10 hover:bg-white/20 backdrop-blur-md px-4 py-2 rounded-full font-bold transition-all text-sm flex items-center gap-2">
          ← Salir
        </Link>
      </div>

      {/* THE PHONE FRAME */}
      <div className="w-full max-w-[380px] aspect-[9/16] max-h-[85vh] bg-black rounded-[2rem] border-[6px] border-slate-800 relative overflow-hidden shadow-2xl ring-1 ring-white/10">
        
        {/* Header Overlay */}
        <div className="absolute top-4 left-4 z-20 pointer-events-none drop-shadow-md">
          <h2 className="text-white text-xl font-black tracking-tight">Tico Talk</h2>
          <p className="text-slate-300 text-[10px] font-bold uppercase tracking-widest mt-0.5">FYP (Fluidez y Práctica)</p>
        </div>

        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-white font-bold animate-pulse">Sintonizando...</p>
          </div>
        ) : (
          <div className="w-full h-full relative" 
               onTouchStart={handleTouchStart} 
               onTouchEnd={handleTouchEnd}
               onClick={handleVideoTap}>
            
            {/* The Feed Track (Moves up and down based on index) */}
            <div 
              className="w-full h-full transition-transform duration-500 ease-in-out"
              style={{ transform: `translateY(-${currentIndex * 100}%)` }}
            >
              {videoDatabase.map((video, idx) => (
                <div key={idx} className="w-full h-full bg-black flex flex-col items-center justify-center relative">
                  
                  {/* Cinematic Black Wrapper for the Video */}
                  <div className="w-full h-full flex items-center justify-center">
                    {/* STRICT MEMORY MODE: Only render the exact current video. Destroys ghost audio and lag. */}
                    {currentIndex === idx ? (
                      renderIframe(video)
                    ) : (
                      <div className="w-full h-full bg-black flex items-center justify-center">
                        {/* Placeholder to keep the spacing perfect while off-screen */}
                        <div className="w-8 h-8 border-4 border-slate-800 border-t-rose-500 rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>

                  {/* Optional: Hashtag / Caption overlay at the bottom */}
                  <div className="absolute bottom-6 left-4 right-16 z-20 pointer-events-none">
                    <h3 className="text-white font-bold text-sm drop-shadow-md">{video.title || "Video de FYP"}</h3>
                    <p className="text-cyan-400 font-bold text-xs mt-1 drop-shadow-md">#{video.category || "Cultura"}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* FLOATING ACTION BAR (Right Side) */}
            <div className="absolute bottom-16 right-4 z-30 flex flex-col gap-6 items-center">
              
              {/* Heart Button */}
              <button 
                onClick={(e) => { e.stopPropagation(); triggerHeart(); }}
                className="flex flex-col items-center gap-1 transition-transform active:scale-90"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md transition-colors ${likedVideos[currentIndex] ? 'text-red-500' : 'text-white'}`}>
                  <span className="text-2xl leading-none mt-1">
                    {likedVideos[currentIndex] ? '❤️' : '🤍'}
                  </span>
                </div>
              </button>

              {/* Next Button (Visible fallback for desktop users) */}
              <button 
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center transition-transform active:scale-90"
              >
                <span className="text-xl">⬇️</span>
              </button>
            </div>

            {/* GIANT POP-UP HEART (Double Tap Animation) */}
            <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-500 z-50 
              ${showBigHeart ? 'opacity-100 scale-100' : 'opacity-0 scale-50 translate-y-12'}`}>
              <div className="text-9xl drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]">
                ❤️
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default TicoTalk;