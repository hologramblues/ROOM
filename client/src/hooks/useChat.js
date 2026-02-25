import { useState, useEffect, useRef, useCallback } from 'react';
import { generateId } from '../utils/helpers';

export default function useChat({ socketRef, connected, docId, myId, currentUser, users, showChat }) {
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [chatNotificationSound, setChatNotificationSound] = useState(true);
  const chatEndRef = useRef(null);

  const chatNotificationSoundRef = useRef(chatNotificationSound);
  useEffect(() => {
    chatNotificationSoundRef.current = chatNotificationSound;
  }, [chatNotificationSound]);

  // Chat notification audio - Web Audio synthesis (reuse single AudioContext)
  const audioCtxRef = useRef(null);
  const playChatNotification = useCallback(() => {
    if (!chatNotificationSoundRef.current) return;
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      [880, 1100].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.2);
      });
    } catch (e) {}
  }, []);

  // Send chat message
  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim() || !socketRef.current || !connected || !docId) return;

    const message = {
      id: generateId(),
      senderId: myId,
      senderName: currentUser?.name || 'Anonyme',
      senderColor: users.find(u => u.id === myId)?.color || '#3b82f6',
      content: chatInput.trim(),
      timestamp: new Date().toISOString()
    };

    socketRef.current.emit('chat-message', { docId, message });
    setChatMessages(prev => [...prev, message]);
    setChatInput('');
  }, [chatInput, connected, docId, myId, currentUser, users, socketRef]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (showChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  // Clear unread when opening chat
  useEffect(() => {
    if (showChat) {
      setUnreadMessages(0);
    }
  }, [showChat]);

  // Save chat history to localStorage
  useEffect(() => {
    if (docId && chatMessages.length > 0) {
      localStorage.setItem(`rooms-chat-${docId}`, JSON.stringify(chatMessages.slice(-100)));
    }
  }, [chatMessages, docId]);

  // Load chat history from localStorage on mount
  useEffect(() => {
    if (docId) {
      const saved = localStorage.getItem(`rooms-chat-${docId}`);
      if (saved) {
        try {
          const messages = JSON.parse(saved);
          if (messages.length > 0 && chatMessages.length === 0) {
            setChatMessages(messages);
          }
        } catch (e) {}
      }
    }
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    chatMessages, setChatMessages, chatInput, setChatInput,
    unreadMessages, setUnreadMessages,
    chatNotificationSound, setChatNotificationSound,
    sendChatMessage, playChatNotification, chatEndRef
  };
}
