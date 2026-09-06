import React, { useState, useEffect } from 'react';

const Senordle = ({ targetWord = "PLAYA", gameId = "today", validWords = [] }) => {
  const SAVE_KEY = `senordle_progress_${gameId}`;
  const safeTarget = targetWord.toUpperCase();

  const [guesses, setGuesses] = useState(Array(6).fill("").map(() => Array(5).fill("")));
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [gameOver, setGameOver] = useState(false);

// Load saved progress
useEffect(() => {
  const saved = localStorage.getItem(SAVE_KEY);
  
  if (saved) {
    const parsed = JSON.parse(saved);
    setGuesses(parsed.guesses);
    setCurrentRow(parsed.row);
    setGameOver(parsed.isOver);
  } else {
    // 🛡️ THE CLEAN SLATE: 
    // If no save exists for THIS specific Game ID, reset everything to zero!
    setGuesses(Array(6).fill("").map(() => Array(5).fill("")));
    setCurrentRow(0);
    setCurrentCol(0);
    setGameOver(false);
  }
}, [SAVE_KEY]);

  useEffect(() => {
    const onKeyDown = (e) => handleInput(e.key);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentCol, currentRow, gameOver, guesses, safeTarget]);

  const handleInput = (key) => {
    if (gameOver) return;
    const k = key.toUpperCase();

    if (k === "ENTER") {
      if (currentCol === 5) {
        const guess = guesses[currentRow].join("");
        if (validWords.length > 0 && !validWords.includes(guess) && guess !== safeTarget) {
          alert("No está en la lista de palabras.");
          return;
        }
        submitRow();
      }
    } else if (k === "BACKSPACE" || k === "DELETE" || k === "DEL") {
      if (currentCol > 0) {
        const next = [...guesses];
        next[currentRow][currentCol - 1] = "";
        setGuesses(next);
        setCurrentCol(currentCol - 1);
      }
    } else if (currentCol < 5 && /^[A-ZÑ]$/.test(k)) {
      const next = [...guesses];
      next[currentRow][currentCol] = k;
      setGuesses(next);
      setCurrentCol(currentCol + 1);
    }
  };

  const submitRow = () => {
    const guess = guesses[currentRow].join("");
    const isWin = guess === safeTarget;
    const isLoss = currentRow === 5 && !isWin;

    if (isWin || isLoss) {
      setGameOver(true);
      setTimeout(() => alert(isWin ? "¡Excelente! Pura Vida." : `La palabra era: ${safeTarget}`), 300);
    }

    const nextRow = currentRow + 1;
    setCurrentRow(nextRow);
    setCurrentCol(0);

    localStorage.setItem(SAVE_KEY, JSON.stringify({
      guesses, row: nextRow, isOver: isWin || isLoss
    }));
  };

  // --- NEW LOGIC: CALCULATE ROW STATUSES ---
  // This function handles the duplicate letter logic correctly
  const getRowStatuses = (guessArray) => {
    const statuses = Array(5).fill("absent");
    const targetChars = safeTarget.split("");
    const guessChars = [...guessArray];

    // Frequency map of letters in target
    const letterCounts = {};
    targetChars.forEach(char => {
      letterCounts[char] = (letterCounts[char] || 0) + 1;
    });

    // Pass 1: Mark Greens (Correct)
    guessChars.forEach((char, i) => {
      if (char === targetChars[i]) {
        statuses[i] = "correct";
        letterCounts[char] -= 1;
      }
    });

    // Pass 2: Mark Yellows (Present)
    guessChars.forEach((char, i) => {
      if (statuses[i] !== "correct") {
        if (letterCounts[char] > 0) {
          statuses[i] = "present";
          letterCounts[char] -= 1;
        }
      }
    });

    return statuses;
  };

  const getKeyStatuses = () => {
    const statuses = {};
    for (let r = 0; r < currentRow; r++) {
      const rowStatuses = getRowStatuses(guesses[r]);
      guesses[r].forEach((letter, i) => {
        const currentStat = rowStatuses[i];
        if (currentStat === "correct") {
          statuses[letter] = "correct";
        } else if (currentStat === "present" && statuses[letter] !== "correct") {
          statuses[letter] = "present";
        } else if (currentStat === "absent" && !statuses[letter]) {
          statuses[letter] = "absent";
        }
      });
    }
    return statuses;
  };

  const keyStatuses = getKeyStatuses();

  return (
    <div className="flex flex-col items-center w-full">
      <div className="w-full mb-6">
        {guesses.map((row, rIdx) => {
          // Calculate statuses for the entire row if it has been submitted
          const rowStatuses = rIdx < currentRow ? getRowStatuses(row) : null;
          
          return (
            <div key={rIdx} className="gym-row">
              {row.map((letter, lIdx) => {
                let status = "empty";
                if (rIdx < currentRow) {
                  status = rowStatuses[lIdx];
                } else if (rIdx === currentRow && letter) {
                  status = "active";
                }

                return <Tile key={lIdx} letter={letter} status={status} />;
              })}
            </div>
          );
        })}
      </div>
      
      <VirtualKeyboard onKey={handleInput} keyStatuses={keyStatuses} />
    </div>
  );
};

const Tile = ({ letter, status }) => {
  return <div className={`gym-tile ${status}`}>{letter}</div>;
};

const VirtualKeyboard = ({ onKey, keyStatuses }) => {
  const rows = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "DEL"]
  ];

  return (
    <div className="w-full max-w-[400px] mt-4">
      {rows.map((row, i) => (
        <div key={i} className="gym-keyboard-row">
          {row.map(key => (
            <button 
              key={key} 
              onClick={() => onKey(key)}
              className={`gym-key ${key.length > 1 ? 'large' : ''} ${keyStatuses[key] || ''}`}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Senordle;