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
}

export default function GlassTicket({ ticketId, role }: { ticketId: string; role: string }) {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isPlaying, setIsPlaying] = useState<{ [key: string]: boolean }>({});
  const [wavesurfers, setWavesurfers] = useState<{ [key: string]: WaveSurfer }>({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    loadMessages();
    return () => cleanup();
  }, [ticketId]);

  useEffect(() => {
    const interval = setInterval(checkNewMessages, 2000);
    return () => clearInterval(interval);
  }, [ticketId, role]);

  const cleanup = () => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    Object.values(wavesurfers).forEach(ws => ws.destroy());
  };

  const loadMessages = () => {
    try {
      const recordings = JSON.parse(localStorage.getItem('voiceRecordings') || '[]');
      const ticketMessages = recordings.filter((r: VoiceMessage) => r.ticketId === ticketId);
      setMessages(ticketMessages);

      // Initialize waveforms for existing messages
      ticketMessages.forEach((message: VoiceMessage) => {
        initializeWaveform(message.id, message.audioData);
      });
    } catch (err) {
      console.error('Error loading messages:', err);
      toast.error('Failed to load voice messages');
    }
  };

  const initializeWaveform = async (messageId: string, audioData: string) => {
    if (wavesurfers[messageId]) {
      wavesurfers[messageId].destroy();
    }

    const container = document.getElementById(`waveform-${messageId}`);
    if (!container) return;

    const wavesurfer = WaveSurfer.create({
      container,
      waveColor: '#4a9eff',
      progressColor: '#2c5282',
      cursorColor: '#ffffff',
      barWidth: 2,
      barGap: 3,
      height: 40,
      normalize: true,
      responsive: true
    });

    wavesurfer.on('finish', () => {
      setIsPlaying(prev => ({ ...prev, [messageId]: false }));
    });

    await wavesurfer.load(audioData);

    setWavesurfers(prev => ({
      ...prev,
      [messageId]: wavesurfer
    }));
  };

  const checkNewMessages = () => {
    if (role === 'admin') {
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
          console.error('Error checking messages:', err);
        }
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);

      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = handleRecordingStop;

      recorder.start();
      setIsRecording(true);
      startTimer();
    } catch (err) {
      console.error('Error starting recording:', err);
      toast.error('Failed to start recording. Please check microphone permissions.');
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
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  const handleRecordingStop = async () => {
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(blob);
    const reader = new FileReader();

    reader.onloadend = () => {
      const base64Audio = reader.result as string;
      saveMessage(base64Audio);
    };

    reader.readAsDataURL(blob);
  };

  const saveMessage = (audioData: string) => {
    const messageId = uuidv4();
    const message: VoiceMessage = {
      id: messageId,
      ticketId,
      timestamp: new Date().toISOString(),
      audioData,
      sender: role
    };

    const updatedMessages = [...messages, message];
    setMessages(updatedMessages);
    localStorage.setItem('voiceRecordings', JSON.stringify(updatedMessages));

    if (role === 'client') {
      localStorage.setItem('adminTicketSync', JSON.stringify({
        ticketId,
        timestamp: message.timestamp
      }));
    }

    initializeWaveform(messageId, audioData);
    toast.success('Voice message saved successfully');
  };

  const togglePlayback = (messageId: string) => {
    const wavesurfer = wavesurfers[messageId];
    if (!wavesurfer) return;

    if (isPlaying[messageId]) {
      wavesurfer.pause();
    } else {
      wavesurfer.play();
    }

    setIsPlaying(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const formatTime = (seconds: number) => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-ticket">
      <h2 className="text-center mb-4 text-white text-lg">
        🎙️ Voice Messages
      </h2>

      {role === 'client' && (
        <div className="mb-6">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className="voice-btn w-full"
          >
            {isRecording ? (
              <>
                <span className="recording-dot"></span>
                Stop Recording ({formatTime(recordingTime)})
              </>
            ) : (
              'Start Recording'
            )}
          </button>
        </div>
      )}

      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className="message-item">
            <div className="message-header">
              <span className="sender">{message.sender === 'client' ? 'Client' : 'Admin'}</span>
              <span className="timestamp">{new Date(message.timestamp).toLocaleString()}</span>
            </div>
            <div className="waveform-container">
              <div id={`waveform-${message.id}`} className="waveform"></div>
              <button
                onClick={() => togglePlayback(message.id)}
                className="play-button"
              >
                {isPlaying[message.id] ? '⏸️' : '▶️'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}