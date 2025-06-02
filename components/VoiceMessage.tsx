import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';

interface VoiceMessageProps {
  ticketId: string;
  role: 'admin' | 'client';
}

export default function VoiceMessage({ ticketId, role }: VoiceMessageProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [areLibsLoaded, setAreLibsLoaded] = useState(false);

  const recordRTCRef = useRef<any>(null);
  const waveSurferLibRef = useRef<any>(null);
  const recorderRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const wavesurferRefs = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    // Dynamically import RecordRTC and WaveSurfer only on the client side
    if (typeof window !== 'undefined') {
      Promise.all([
        import('recordrtc').then(module => {
          recordRTCRef.current = module.default;
        }),
        import('wavesurfer.js').then(module => {
          waveSurferLibRef.current = module.default;
        })
      ]).then(() => {
        setAreLibsLoaded(true);
      });
    }

    loadMessages();
    const interval = setInterval(loadMessages, 2000);
    return () => {
      clearInterval(interval);
      cleanup();
    };
  }, [ticketId]);

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }
    Object.values(wavesurferRefs.current).forEach(wavesurfer => {
      wavesurfer.destroy();
    });
  };

  const loadMessages = () => {
    try {
      const allMessages = JSON.parse(localStorage.getItem('voiceMessages') || '[]');
      const ticketMessages = allMessages
        .filter((m: any) => m.ticketId === ticketId)
        .slice(-5);
      setMessages(ticketMessages);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const startRecording = async () => {
    if (!recordRTCRef.current) {
      toast.error('Recording functionality not ready');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;
      recorderRef.current = new recordRTCRef.current(stream, {
        type: 'audio',
        mimeType: 'audio/webm',
        recorderType: recordRTCRef.current.StereoAudioRecorder,
        numberOfAudioChannels: 1,
        timeSlice: 1000,
        desiredSampRate: 16000,
      });

      recorderRef.current.startRecording();
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
    timerRef.current = window.setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 60) {
          stopRecording();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = async () => {
    if (!recorderRef.current || !streamRef.current) return;

    return new Promise<void>(resolve => {
      recorderRef.current?.stopRecording(() => {
        const blob = recorderRef.current?.getBlob();
        if (!blob) {
          toast.error('No audio recorded');
          cleanup();
          resolve();
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          saveMessage(base64Audio);
          cleanup();
          setIsRecording(false);
          setRecordingTime(0);
          resolve();
        };

        reader.onerror = () => {
          toast.error('Failed to process audio');
          cleanup();
          resolve();
        };

        reader.readAsDataURL(blob);
      });
    });
  };

  const saveMessage = (audioData: string) => {
    const message = {
      id: uuidv4(),
      ticketId,
      timestamp: new Date().toISOString(),
      audioData,
      sender: role
    };

    const allMessages = JSON.parse(localStorage.getItem('voiceMessages') || '[]');
    const otherMessages = allMessages.filter((m: any) => m.ticketId !== ticketId);
    const ticketMessages = allMessages
      .filter((m: any) => m.ticketId === ticketId)
      .slice(-4);

    localStorage.setItem('voiceMessages', JSON.stringify([
      ...otherMessages,
      ...ticketMessages,
      message
    ]));

    if (role === 'client') {
      localStorage.setItem('adminTicketSync', JSON.stringify({
        ticketId,
        timestamp: message.timestamp,
        hasNewMessage: true
      }));
    }

    loadMessages();
    toast.success('Message saved');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayback = async (messageId: string, audioData: string) => {
    if (typeof window === 'undefined' || !waveSurferLibRef.current) return;

    if (currentAudio === messageId) {
      wavesurferRefs.current[messageId]?.stop();
      setCurrentAudio(null);
    } else {
      if (currentAudio) {
        wavesurferRefs.current[currentAudio]?.stop();
      }
      
      if (!wavesurferRefs.current[messageId]) {
        const container = document.getElementById(`waveform-${messageId}`);
        if (!container) return;

        const wavesurfer = waveSurferLibRef.current.create({
          container,
          waveColor: '#4a9eff',
          progressColor: '#2c5282',
          cursorColor: '#2c5282',
          barWidth: 2,
          barGap: 1,
          height: 30,
          normalize: true
        });

        wavesurfer.on('finish', () => setCurrentAudio(null));
        const response = await fetch(audioData);
        const blob = await response.blob();
        await wavesurfer.loadBlob(blob);
        wavesurferRefs.current[messageId] = wavesurfer;
      }

      wavesurferRefs.current[messageId]?.play();
      setCurrentAudio(messageId);
    }
  };

  if (!areLibsLoaded) {
    return <div>Loading audio components...</div>;
  }

  return (
    <div className="voice-message-container">
      {role === 'client' && (
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className="voice-btn"
          disabled={!!currentAudio}
        >
          {isRecording ? (
            <>
              <span className="recording-dot" />
              Stop Recording ({formatTime(recordingTime)})
            </>
          ) : (
            'Record Message'
          )}
        </button>
      )}

      <div className="messages-container">
        {messages.map(message => (
          <div key={message.id} className="message-item">
            <div className="message-header">
              <span className="message-sender">
                {message.sender === 'client' ? 'Client' : 'Admin'}
              </span>
              <span className="message-time">
                {new Date(message.timestamp).toLocaleString()}
              </span>
            </div>
            <div 
              id={`waveform-${message.id}`}
              className="waveform"
              onClick={() => togglePlayback(message.id, message.audioData)}
            />
            <button 
              className="play-btn"
              onClick={() => togglePlayback(message.id, message.audioData)}
            >
              {currentAudio === message.id ? 'Pause' : 'Play'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}