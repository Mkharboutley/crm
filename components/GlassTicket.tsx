import { useEffect, useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';

interface VoiceMessage {
  id: string;
  ticketId: string;
  timestamp: string;
  audioData: string;
  sender: string;
}

export default function GlassTicket({ ticketId, role }: { ticketId: string; role: string }) {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  useEffect(() => {
    loadMessages();
    setupMessageSync();
    return () => cleanup();
  }, [ticketId]);

  const cleanup = () => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
    // Stop all playing audio
    Object.values(audioRefs.current).forEach(audio => {
      audio?.pause();
      audio.currentTime = 0;
    });
  };

  const setupMessageSync = () => {
    // Clear any existing interval
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }

    // Set up new sync interval
    syncIntervalRef.current = setInterval(() => {
      loadMessages();
    }, 2000);
  };

  const loadMessages = () => {
    try {
      const allRecordings = JSON.parse(localStorage.getItem('voiceRecordings') || '[]');
      const ticketMessages = allRecordings
        .filter((r: VoiceMessage) => r.ticketId === ticketId)
        .slice(-5);
      setMessages(ticketMessages);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      setAudioStream(stream);

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      });
      
      setMediaRecorder(recorder);
      chunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = handleRecordingStop;
      recorder.start(100);
      
      setIsRecording(true);
      startTimer();
      
      toast.info('Recording started');
    } catch (err) {
      console.error('Recording error:', err);
      toast.error('Could not access microphone');
    }
  };

  const startTimer = () => {
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 60) {
          stopRecording();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.stop();
      audioStream?.getTracks().forEach(track => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  const handleRecordingStop = async () => {
    if (chunksRef.current.length === 0) {
      toast.error('No audio recorded');
      return;
    }

    const blob = new Blob(chunksRef.current, { 
      type: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
    });

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Audio = reader.result as string;
      if (!base64Audio) {
        toast.error('Failed to process audio');
        return;
      }

      const newMessage: VoiceMessage = {
        id: uuidv4(),
        ticketId,
        timestamp: new Date().toISOString(),
        audioData: base64Audio,
        sender: role
      };

      // Get existing recordings
      const allRecordings = JSON.parse(localStorage.getItem('voiceRecordings') || '[]');
      
      // Keep only the last 4 messages for this ticket
      const otherRecordings = allRecordings.filter((r: VoiceMessage) => r.ticketId !== ticketId);
      const ticketMessages = allRecordings
        .filter((r: VoiceMessage) => r.ticketId === ticketId)
        .slice(-4);
      
      // Add new message
      const updatedRecordings = [...otherRecordings, ...ticketMessages, newMessage];
      
      // Save to localStorage
      localStorage.setItem('voiceRecordings', JSON.stringify(updatedRecordings));
      
      // Update UI
      setMessages([...ticketMessages, newMessage]);

      // Notify admin of new message
      if (role === 'client') {
        localStorage.setItem('adminTicketSync', JSON.stringify({
          ticketId,
          timestamp: newMessage.timestamp,
          hasNewMessage: true
        }));
        toast.success('Message sent to admin');
      }
    };

    reader.readAsDataURL(blob);
  };

  const handlePlayPause = (messageId: string) => {
    const audio = audioRefs.current[messageId];
    if (!audio) return;

    // Stop all other playing audio
    Object.entries(audioRefs.current).forEach(([id, audioEl]) => {
      if (id !== messageId && audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
      }
    });

    if (isPlaying === messageId) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(null);
    } else {
      audio.play()
        .then(() => setIsPlaying(messageId))
        .catch(err => {
          console.error('Playback error:', err);
          toast.error('Could not play audio');
        });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-ticket">
      {role === 'client' && (
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className="voice-btn"
          disabled={isPlaying !== null}
        >
          {isRecording ? (
            <>
              <span className="recording-dot"></span>
              Stop Recording ({formatTime(recordingTime)})
            </>
          ) : (
            'Record Message'
          )}
        </button>
      )}

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="message-item">
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
              No messages yet
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className={`message-item ${isPlaying === message.id ? 'selected' : ''}`}
              onClick={() => handlePlayPause(message.id)}
            >
              <div className="message-header">
                <span className="message-sender">
                  {message.sender === 'client' ? 'Client' : 'Admin'}
                </span>
                <span className="message-time">
                  {new Date(message.timestamp).toLocaleString()}
                </span>
              </div>
              <audio
                ref={el => {
                  if (el) audioRefs.current[message.id] = el;
                }}
                src={message.audioData}
                onEnded={() => setIsPlaying(null)}
                className="hidden"
              />
              <div className="message-status">
                {isPlaying === message.id ? '⏸ Pause' : '▶ Play'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}