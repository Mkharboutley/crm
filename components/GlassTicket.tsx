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
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

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
  };

  const setupMessageSync = () => {
    if (role === 'admin') {
      syncIntervalRef.current = setInterval(() => {
        const sync = localStorage.getItem('adminTicketSync');
        if (sync) {
          try {
            const { ticketId: syncedTicketId } = JSON.parse(sync);
            if (syncedTicketId === ticketId) {
              loadMessages();
              localStorage.removeItem('adminTicketSync');
              toast.info('New voice message received!');
            }
          } catch (err) {
            console.error('Sync error:', err);
          }
        }
      }, 1000);
    }
  };

  const loadMessages = () => {
    try {
      const recordings = JSON.parse(localStorage.getItem('voiceRecordings') || '[]');
      const ticketMessages = recordings
        .filter((r: VoiceMessage) => r.ticketId === ticketId)
        .slice(-5);
      setMessages(ticketMessages);
    } catch (err) {
      console.error('Error loading messages:', err);
      toast.error('Failed to load voice messages');
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
      console.error('Error starting recording:', err);
      toast.error('Failed to access microphone. Please check permissions.');
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
      toast.info('Recording stopped');
    }
  };

  const handleRecordingStop = async () => {
    if (chunksRef.current.length === 0) {
      toast.error('No audio data recorded');
      return;
    }

    const blob = new Blob(chunksRef.current, { 
      type: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
    });

    if (blob.size === 0) {
      toast.error('Recording is empty');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Audio = reader.result as string;
      if (!base64Audio) {
        toast.error('Failed to process audio');
        return;
      }

      const message: VoiceMessage = {
        id: uuidv4(),
        ticketId,
        timestamp: new Date().toISOString(),
        audioData: base64Audio,
        sender: role
      };

      // Get existing recordings
      const allRecordings = JSON.parse(localStorage.getItem('voiceRecordings') || '[]');
      
      // Filter out old messages for this ticket (keep last 4)
      const otherRecordings = allRecordings.filter((r: VoiceMessage) => r.ticketId !== ticketId);
      const ticketRecordings = allRecordings
        .filter((r: VoiceMessage) => r.ticketId === ticketId)
        .slice(-4);
      
      // Add new message
      const updatedRecordings = [...otherRecordings, ...ticketRecordings, message];
      
      // Update localStorage
      localStorage.setItem('voiceRecordings', JSON.stringify(updatedRecordings));
      
      // Update UI
      setMessages([...ticketRecordings, message]);

      // Notify admin if sent by client
      if (role === 'client') {
        localStorage.setItem('adminTicketSync', JSON.stringify({
          ticketId,
          timestamp: message.timestamp,
          hasNewMessage: true
        }));
        toast.success('Voice message sent successfully');
      }
    };

    reader.onerror = () => {
      console.error('Error reading audio file:', reader.error);
      toast.error('Failed to process audio file');
    };

    reader.readAsDataURL(blob);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMessageClick = (messageId: string) => {
    setSelectedMessage(messageId === selectedMessage ? null : messageId);
    const audio = audioRefs.current[messageId];
    if (audio) {
      if (messageId === selectedMessage) {
        audio.pause();
        audio.currentTime = 0;
      } else {
        // Stop all other playing audio
        Object.values(audioRefs.current).forEach(a => {
          if (a && a !== audio) {
            a.pause();
            a.currentTime = 0;
          }
        });
        audio.play().catch(err => {
          console.error('Error playing audio:', err);
          toast.error('Failed to play audio message');
        });
      }
    }
  };

  return (
    <div className="glass-ticket">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className="voice-btn w-full mb-4"
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

      <div className="messages-container">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`message-item ${selectedMessage === message.id ? 'selected' : ''}`}
            onClick={() => handleMessageClick(message.id)}
            style={{ cursor: 'pointer' }}
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
              ref={el => audioRefs.current[message.id] = el}
              src={message.audioData} 
              className="hidden"
            />
            <div className="message-status">
              {selectedMessage === message.id ? '⏸ Pause' : '▶ Play'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}