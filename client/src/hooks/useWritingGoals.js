import { useState, useEffect, useRef } from 'react';

export default function useWritingGoals(statsWords) {
  const [writingGoal, setWritingGoal] = useState(() => {
    const saved = localStorage.getItem('rooms-writing-goal');
    return saved ? JSON.parse(saved) : { daily: 1000, todayWords: 0, lastDate: null };
  });

  // Daily reset
  useEffect(() => {
    const today = new Date().toDateString();
    if (writingGoal.lastDate !== today) {
      setWritingGoal(prev => ({ ...prev, todayWords: 0, lastDate: today }));
    }
  }, [writingGoal.lastDate]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('rooms-writing-goal', JSON.stringify(writingGoal));
  }, [writingGoal]);

  // Track word count changes
  const prevWordCountRef = useRef(0);
  useEffect(() => {
    if (statsWords > prevWordCountRef.current && prevWordCountRef.current > 0) {
      const wordsAdded = statsWords - prevWordCountRef.current;
      if (wordsAdded > 0 && wordsAdded < 100) {
        setWritingGoal(prev => ({ ...prev, todayWords: prev.todayWords + wordsAdded }));
      }
    }
    prevWordCountRef.current = statsWords;
  }, [statsWords]);

  return { writingGoal, setWritingGoal };
}
