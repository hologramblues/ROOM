import { useState, useEffect, useRef, useCallback } from 'react';

export default function useTimer(statsWords) {
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState('chrono'); // 'chrono' or 'sprint'
  const [sprintDuration, setSprintDuration] = useState(25 * 60); // 25 minutes default
  const [sprintTimeLeft, setSprintTimeLeft] = useState(25 * 60);
  const [sessionWordCount, setSessionWordCount] = useState(0);
  const sessionStartWordsRef = useRef(0);

  // Writing timer - supports both chrono (count up) and sprint (countdown) modes
  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        if (timerMode === 'chrono') {
          setTimerSeconds(s => s + 1);
        } else {
          // Sprint mode - countdown
          setSprintTimeLeft(t => {
            if (t <= 1) {
              // Sprint finished!
              setTimerRunning(false);
              // Play sound notification
              try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleB8LZKzW8NJ2KQ5TiMD6zYI+E0R1sbznl0gaMmKe0eOmWyAbJ0+Ax+e+fD8kXqLk9Nhnf0lVhKSsloFzYGJ6mamgejEgI0RtiJuTfl9OUUZ9oL62p4JlPUBakL7NoIVpKnuq1c2RUy4qXIvG7MB3QiQ4WpTK76tiOipGe6/e2aFXMSVCcKPk7MJqPSZAX5XX8NN9QwkqXJjH3pd5MChLkdT+wpqBVzI0');
                audio.play().catch(() => {});
              } catch (e) {}
              // Show alert
              alert('🎉 Sprint terminé ! Bravo !');
              return sprintDuration; // Reset for next sprint
            }
            return t - 1;
          });
          setTimerSeconds(s => s + 1); // Still track total time
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerMode, sprintDuration]);

  // Track session word count
  useEffect(() => {
    if (timerRunning && sessionStartWordsRef.current === 0) {
      sessionStartWordsRef.current = statsWords;
    }
    if (timerRunning) {
      setSessionWordCount(Math.max(0, statsWords - sessionStartWordsRef.current));
    }
  }, [statsWords, timerRunning]);

  const resetTimer = useCallback(() => {
    setTimerSeconds(0);
    setTimerRunning(false);
    setSessionWordCount(0);
    sessionStartWordsRef.current = 0;
    setSprintTimeLeft(sprintDuration);
  }, [sprintDuration]);

  // Change sprint duration
  const setSprintMinutes = useCallback((minutes) => {
    const seconds = minutes * 60;
    setSprintDuration(seconds);
    setSprintTimeLeft(seconds);
  }, []);

  return {
    timerSeconds, timerRunning, setTimerRunning, timerMode, setTimerMode,
    sprintDuration, sprintTimeLeft, setSprintTimeLeft,
    sessionWordCount, resetTimer, setSprintMinutes
  };
}
