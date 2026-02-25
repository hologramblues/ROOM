import { useState, useEffect, useRef, useCallback } from 'react';

export default function useTypewriterSound() {
  // eslint-disable-next-line no-unused-vars
  const [typewriterSound, setTypewriterSound] = useState(false);

  const typewriterAudioRef = useRef({
    key: null,
    enter: null,
    backspace: null,
    initialized: false
  });

  const playTypewriterSound = useCallback((type = 'key') => {
    if (!typewriterSound) return;

    // Initialize audio elements on first use
    if (!typewriterAudioRef.current.initialized) {
      typewriterAudioRef.current = {
        initialized: true,
        // Replace these URLs with your own typewriter sound files:
        // key: new Audio('/sounds/typewriter-key.mp3'),
        // enter: new Audio('/sounds/typewriter-return.mp3'),
        // backspace: new Audio('/sounds/typewriter-backspace.mp3'),
        key: null,
        enter: null,
        backspace: null
      };
    }

    const audio = typewriterAudioRef.current;
    try {
      if (type === 'enter' && audio.enter) {
        audio.enter.currentTime = 0;
        audio.enter.volume = 0.4;
        audio.enter.play().catch(() => {});
      } else if (type === 'backspace' && audio.backspace) {
        audio.backspace.currentTime = 0;
        audio.backspace.volume = 0.3;
        audio.backspace.play().catch(() => {});
      } else if (audio.key) {
        audio.key.currentTime = 0;
        audio.key.volume = 0.3;
        audio.key.play().catch(() => {});
      }
    } catch (e) {}
  }, [typewriterSound]);

  // Typewriter sound on keypress
  useEffect(() => {
    if (!typewriterSound) return;
    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        playTypewriterSound('enter');
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        playTypewriterSound('backspace');
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        playTypewriterSound('key');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [typewriterSound, playTypewriterSound]);

  return { typewriterSound, setTypewriterSound };
}
