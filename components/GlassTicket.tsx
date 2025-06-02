import { useEffect, useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import WaveSurfer from 'wavesurfer.js';

interface VoiceMessage {
  id: string;
  ticketId: string;
  timestamp: string;
  audioData: string;
  sender: string;
  duration: number;
}

export default function GlassTicket({ ticketId, role }: { ticketId: string; role: string }) {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [wavesurfers, setWavesurfers] = useState<{ [key: string]: WaveSurfer }>({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
    Object.values(wavesurfers).forEach(ws => ws.destroy());
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
        .slice(-2);
      setMessages(ticketMessages);

      setTimeout(() => {
        ticketMessages.forEach(message => {
          initializeWaveform(message);
        });
      }, 100);
    } catch (err) {
      console.error('Error loading messages:', err);
      toast.error('Failed to load voice messages');
    }
  };

  const initializeWaveform = async (message: VoiceMessage) => {
    const container = document.getElementById(`waveform-${message.id}`);
    if (!container) return;

    if (wavesurfers[message.id]) {
      wavesurfers[message.id].destroy();
    }

    const wavesurfer = WaveSurfer.create({
      container,
      height: 30,
      waveColor: '#ffffff',
      progressColor: '#4caf50',
      cursorColor: 'transparent',
      barWidth: 2,
      barGap: 3,
      barRadius: 3,
      normalize: true,
      responsive: true,
      interact: false
    });

    wavesurfer.on('finish', () => {
      setPlayingId(null);
    });

    try {
      await wavesurfer.load(message.audioData);
      setWavesurfers(prev => ({
        ...prev,
        [message.id]: wavesurfer
      }));
    } catch (err) {
      console.error('Error loading audio:', err);
    }
  };

  const togglePlayback = (messageId: string) => {
    const wavesurfer = wavesurfers[messageId];
    if (!wavesurfer) return;

    if (playingId === messageId) {
      wavesurfer.pause();
      setPlayingId(null);
    } else {
      if (playingId && wavesurfers[playingId]) {
        wavesurfers[playingId].pause();
      }
      wavesurfer.play();
      setPlayingId(messageId);
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
    // Check if we have any audio data
    if (chunksRef.current.length === 0) {
      toast.error('No audio data recorded');
      return;
    }

    const blob = new Blob(chunksRef.current, { 
      type: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
    });

    // Check if the blob has actual content
    if (blob.size === 0) {
      toast.error('Recording is empty');
      return;
    }

    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);

    // Handle audio loading errors
    audio.onerror = () => {
      console.error('Error loading audio:', audio.error);
      toast.error('Error processing audio recording');
      URL.revokeObjectURL(audioUrl);
    };

    audio.addEventListener('loadedmetadata', () => {
      // Validate audio duration
      if (!audio.duration || audio.duration <= 0 || !isFinite(audio.duration)) {
        toast.error('Invalid audio recording');
        URL.revokeObjectURL(audioUrl);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result as string;
        // Validate base64 audio data
        if (!base64Audio || typeof base64Audio !== 'string') {
          toast.error('Error processing audio data');
          URL.revokeObjectURL(audioUrl);
          return;
        }
        saveMessage(base64Audio, Math.round(audio.duration));
        URL.revokeObjectURL(audioUrl);
      };

      reader.onerror = () => {
        console.error('Error reading audio file:', reader.error);
        toast.error('Error processing audio file');
        URL.revokeObjectURL(audioUrl);
      };

      reader.readAsDataURL(blob);
    });
  };

  const saveMessage = (audioData: string, duration: number) => {
    const messageId = uuidv4();
    const message: VoiceMessage = {
      id: messageId,
      ticketId,
      timestamp: new Date().toISOString(),
      audioData,
      sender: role,
      duration
    };

    const updatedMessages = [...messages, message].slice(-2);
    setMessages(updatedMessages);
    
    const allRecordings = JSON.parse(localStorage.getItem('voiceRecordings') || '[]');
    const otherRecordings = allRecordings.filter((r: VoiceMessage) => r.ticketId !== ticketId);
    localStorage.setItem('voiceRecordings', JSON.stringify([...otherRecordings, ...updatedMessages]));

    if (role === 'client') {
      localStorage.setItem('adminTicketSync', JSON.stringify({
        ticketId,
        timestamp: message.timestamp,
        hasNewMessage: true
      }));
      toast.success('Voice message sent to admin');
    }

    setTimeout(() => initializeWaveform(message), 100);
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
      )}

      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className="message-item">
            <div className="message-header">
              <span className="message-sender">
                {message.sender === 'client' ? 'Client' : 'Admin'}
              </span>
              <span className="message-time">
                {new Date(message.timestamp).toLocaleString()}
              </span>
            </div>
            <div className="audio-player">
              <button 
                className="play-button"
                onClick={() => togglePlayback(message.id)}
              >
                {playingId === message.id ? '⏸️' : '▶️'}
              </button>
              <div className="waveform-container">
                <div id={`waveform-${message.id}`} className="waveform"></div>
              </div>
              <div className="time-display">
                {formatTime(message.duration)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}