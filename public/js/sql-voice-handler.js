// Initialize RecordRTC
if (!window.recordRTCScript) {
  window.recordRTCScript = document.createElement('script');
  window.recordRTCScript.src = 'https://www.webrtc-experiment.com/RecordRTC.js';
  window.recordRTCScript.async = true;
  document.head.appendChild(window.recordRTCScript);
}

// Wait for RecordRTC to load
window.recordRTCScript.onload = () => {
  if (!window.VoiceHandler) {
    window.VoiceHandler = class {
      constructor() {
        this.recorder = null;
        this.stream = null;
        this.recordings = [];
        this.isRecording = false;
        this.recordingTimeout = null;
        this.syncInterval = null;
        console.log('✅ VoiceHandler initialized');
        this.initialize();
      }

      initialize() {
        if (!this.checkBrowserSupport()) {
          console.warn('❌ Browser does not support required features');
          return;
        }

        // Start sync interval
        this.startSync();
      }

      startSync() {
        // Clear any existing interval
        if (this.syncInterval) {
          clearInterval(this.syncInterval);
        }

        // Check for new messages every 2 seconds
        this.syncInterval = setInterval(() => {
          this.checkForNewMessages();
        }, 2000);
      }

      checkForNewMessages() {
        const ticketId = localStorage.getItem('currentTicketId');
        if (!ticketId) return;

        try {
          // Get all recordings
          const allRecordings = JSON.parse(localStorage.getItem('voiceRecordings') || '[]');
          
          // Filter for current ticket
          const ticketRecordings = allRecordings.filter(r => r.ticketId === ticketId);
          
          // Update UI if needed
          if (JSON.stringify(ticketRecordings) !== JSON.stringify(this.recordings)) {
            this.recordings = ticketRecordings;
            this.updateUI();
          }
        } catch (err) {
          console.error('Sync error:', err);
        }
      }

      checkBrowserSupport() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      }

      async requestPermissions() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          return true;
        } catch (err) {
          console.error('Permission error:', err);
          return false;
        }
      }

      async startRecording() {
        try {
          console.log('Starting recording...');
          
          const hasPermission = await this.requestPermissions();
          if (!hasPermission) {
            throw new Error('Microphone permission denied');
          }

          this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 44100,
              channelCount: 1
            }
          });

          this.recorder = new RecordRTC(this.stream, {
            type: 'audio',
            mimeType: 'audio/webm',
            sampleRate: 44100,
            desiredSampRate: 16000,
            recorderType: RecordRTC.StereoAudioRecorder,
            numberOfAudioChannels: 1,
            timeSlice: 1000,
            ondataavailable: (blob) => {
              if (blob.size > 0) {
                console.log('✅ Recording data available:', blob.size, 'bytes');
              }
            }
          });

          this.recorder.startRecording();
          this.isRecording = true;
          console.log('✅ Recording started');

          // Set 1-minute timeout
          this.recordingTimeout = setTimeout(() => {
            console.log('Recording reached 1-minute limit');
            this.stopRecording();
          }, 60000);

        } catch (err) {
          console.error('❌ Recording failed:', err);
          this.cleanup();
          throw err;
        }
      }

      cleanup() {
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        if (this.recordingTimeout) {
          clearTimeout(this.recordingTimeout);
          this.recordingTimeout = null;
        }
        this.recorder = null;
        this.isRecording = false;
      }

      stopRecording() {
        if (!this.recorder || !this.isRecording) return;
        
        console.log('Stopping recording...');
        
        return new Promise((resolve) => {
          this.recorder.stopRecording(async () => {
            const blob = this.recorder.getBlob();
            console.log('Recording stopped, blob size:', blob.size);

            if (blob.size === 0) {
              console.error('Empty recording');
              this.cleanup();
              resolve(false);
              return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
              const base64Audio = reader.result;
              this.saveRecording(base64Audio);
              this.cleanup();
              resolve(true);
            };

            reader.onerror = () => {
              console.error('Failed to read audio data');
              this.cleanup();
              resolve(false);
            };

            reader.readAsDataURL(blob);
          });
        });
      }

      saveRecording(audioData) {
        console.log('Saving recording...');
        const ticketId = localStorage.getItem('currentTicketId');
        if (!ticketId) {
          console.error('No ticket ID found');
          return;
        }

        const timestamp = new Date().toISOString();
        
        const recording = {
          id: Date.now().toString(),
          ticketId,
          timestamp,
          audioData,
          sender: localStorage.getItem('userRole') || 'client'
        };

        // Get existing recordings
        let existingRecordings = [];
        try {
          existingRecordings = JSON.parse(localStorage.getItem('voiceRecordings') || '[]');
        } catch (err) {
          console.error('Error loading existing recordings:', err);
        }

        // Keep only last 5 recordings per ticket
        const otherRecordings = existingRecordings.filter(r => r.ticketId !== ticketId);
        const ticketRecordings = existingRecordings
          .filter(r => r.ticketId === ticketId)
          .slice(-4);

        // Add new recording
        const updatedRecordings = [...otherRecordings, ...ticketRecordings, recording];
        
        // Save to localStorage
        localStorage.setItem('voiceRecordings', JSON.stringify(updatedRecordings));
        console.log('✅ Recording saved to localStorage');

        // Notify admin
        localStorage.setItem('adminTicketSync', JSON.stringify({
          ticketId,
          timestamp,
          hasNewMessage: true
        }));
        console.log('✅ Admin notification set for ticket:', ticketId);

        // Update UI
        this.recordings = [...ticketRecordings, recording];
        this.updateUI();
      }

      updateUI() {
        const recordingsList = document.getElementById('recordingsList');
        if (!recordingsList) return;

        // Clear existing items
        recordingsList.innerHTML = '';

        // Add recordings in reverse chronological order
        this.recordings.slice().reverse().forEach(recording => {
          const li = document.createElement('li');
          li.className = 'recording-item';

          const audio = document.createElement('audio');
          audio.src = recording.audioData;
          audio.controls = true;
          
          const meta = document.createElement('div');
          meta.className = 'recording-meta';
          meta.textContent = new Date(recording.timestamp).toLocaleString();
          
          li.appendChild(audio);
          li.appendChild(meta);
          recordingsList.appendChild(li);
        });
      }
    };
  }

  // Create instance if not exists
  if (!window.voiceHandler) {
    window.voiceHandler = new window.VoiceHandler();
    console.log('✅ Voice handler instance created');
  }
};