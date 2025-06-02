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
        console.log('✅ VoiceHandler initialized');
        this.initialize();
      }

      initialize() {
        if (!this.checkBrowserSupport()) {
          console.warn('❌ Browser does not support required features');
          return;
        }

        const recordBtn = document.getElementById('record');
        const stopBtn = document.getElementById('stop');

        if (recordBtn && stopBtn) {
          recordBtn.onclick = () => this.startRecording();
          stopBtn.onclick = () => this.stopRecording();
        }

        this.loadRecordings();
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
              sampleRate: 44100
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
              console.log('Recording data available:', blob.size, 'bytes');
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
          alert('Could not start recording. Please check permissions and try again.');
          this.cleanup();
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

            const reader = new FileReader();
            reader.onloadend = () => {
              const base64Audio = reader.result;
              this.saveRecording(base64Audio);
              this.cleanup();
              resolve(true);
            };
            reader.readAsDataURL(blob);
          });
        });
      }

      saveRecording(audioData) {
        console.log('Saving recording...');
        const ticketId = localStorage.getItem('currentTicketId');
        const timestamp = new Date().toISOString();
        
        const recording = {
          id: Date.now().toString(),
          ticketId,
          timestamp,
          audioData
        };

        let existingRecordings = [];
        try {
          existingRecordings = JSON.parse(localStorage.getItem('voiceRecordings') || '[]');
        } catch (err) {
          console.error('Error loading existing recordings:', err);
        }

        existingRecordings.push(recording);
        localStorage.setItem('voiceRecordings', JSON.stringify(existingRecordings));
        console.log('✅ Recording saved to localStorage');

        localStorage.setItem('adminTicketSync', JSON.stringify({
          ticketId,
          timestamp,
          hasAudio: true
        }));
        console.log('✅ Admin notification set for ticket:', ticketId);

        this.displayRecording(recording);
      }

      displayRecording(recording) {
        const li = document.createElement('li');
        const audio = document.createElement('audio');
        audio.src = recording.audioData;
        audio.controls = true;
        
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = new Date(recording.timestamp).toLocaleString();
        
        li.appendChild(audio);
        li.appendChild(meta);
        
        const recordingsList = document.getElementById('recordingsList');
        if (recordingsList) {
          recordingsList.insertBefore(li, recordingsList.firstChild);
          console.log('✅ Recording displayed in UI');
        }
      }

      loadRecordings() {
        try {
          const savedRecordings = JSON.parse(localStorage.getItem('voiceRecordings') || '[]');
          const ticketId = localStorage.getItem('currentTicketId');
          console.log('Loading recordings for ticket:', ticketId);
          
          this.recordings = savedRecordings.filter(r => r.ticketId === ticketId);
          this.recordings.forEach(r => this.displayRecording(r));
        } catch (err) {
          console.error('Failed to load recordings:', err);
        }
      }
    };
  }

  if (!window.voiceHandler) {
    window.voiceHandler = new window.VoiceHandler();
    console.log('✅ Voice handler instance created');
  }
};