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
        this.initialize();
      }

      initialize() {
        if (!this.checkBrowserSupport()) {
          console.warn('Browser does not support required features');
          return;
        }

        const recordBtn = document.getElementById('record');
        const stopBtn = document.getElementById('stop');

        if (recordBtn && stopBtn) {
          recordBtn.onclick = () => this.startRecording();
          stopBtn.onclick = () => this.stopRecording();
        }

        // Load recordings more frequently for admin
        if (localStorage.getItem('dashboardReply')) {
          this.loadRecordings();
          setInterval(() => this.loadRecordings(), 2000); // Check every 2 seconds
        } else if (localStorage.getItem('clientRequest')) {
          this.loadRecordings();
        }
      }

      checkBrowserSupport() {
        const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        const hasAudioContext = !!(window.AudioContext || window.webkitAudioContext);
        
        if (!hasMediaDevices || !hasAudioContext) {
          const recordBtn = document.getElementById('record');
          if (recordBtn) {
            recordBtn.disabled = true;
            recordBtn.title = 'Recording not supported in this browser';
          }
          return false;
        }
        return true;
      }

      async requestPermissions() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          stream.getTracks().forEach(track => track.stop());
          return true;
        } catch (err) {
          console.error('Permission error:', err);
          return false;
        }
      }

      async startRecording() {
        try {
          if (!this.checkBrowserSupport()) {
            throw new Error('Recording not supported in this browser');
          }

          const hasPermission = await this.requestPermissions();
          if (!hasPermission) {
            throw new Error('Microphone permission denied');
          }

          this.stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 44100
            },
            video: false
          });
          
          this.recorder = new RecordRTC(this.stream, {
            type: 'audio',
            mimeType: 'audio/webm',
            sampleRate: 44100,
            desiredSampRate: 16000,
            recorderType: RecordRTC.StereoAudioRecorder,
            numberOfAudioChannels: 1
          });
          
          this.recorder.startRecording();
          this.isRecording = true;
          
          const recordBtn = document.getElementById('record');
          const stopBtn = document.getElementById('stop');
          
          if (recordBtn) recordBtn.disabled = true;
          if (stopBtn) stopBtn.disabled = false;

        } catch (err) {
          console.error('Recording failed:', err);
          alert(err.message || 'Could not start recording. Please check permissions and try again.');
          
          if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
          }
          this.recorder = null;
          this.isRecording = false;
        }
      }

      stopRecording() {
        if (!this.recorder || !this.isRecording) return;

        return new Promise(resolve => {
          this.recorder.stopRecording(() => {
            const blob = this.recorder.getBlob();
            this.saveRecording(blob);
            
            if (this.stream) {
              this.stream.getTracks().forEach(track => track.stop());
            }
            
            this.isRecording = false;
            this.recorder = null;
            this.stream = null;

            const recordBtn = document.getElementById('record');
            const stopBtn = document.getElementById('stop');
            
            if (recordBtn) recordBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;

            resolve();
          });
        });
      }

      saveRecording(blob) {
        const ticketId = localStorage.getItem('currentTicketId');
        const timestamp = new Date().toISOString();
        
        // Convert blob to base64 for storage
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result;
          const recording = {
            ticketId,
            timestamp,
            audio: base64Audio
          };

          // Get existing recordings
          let recordings = JSON.parse(localStorage.getItem('voiceRecordings') || '[]');
          recordings.push(recording);
          localStorage.setItem('voiceRecordings', JSON.stringify(recordings));

          // Notify admin
          if (localStorage.getItem('clientRequest')) {
            localStorage.setItem('adminTicketSync', JSON.stringify({
              ticketId,
              timestamp,
              hasNewMessage: true
            }));
          }

          this.displayRecording(recording);
        };
        reader.readAsDataURL(blob);
      }

      displayRecording(recording) {
        const li = document.createElement('li');
        const audio = document.createElement('audio');
        
        // Convert base64 back to blob for playback
        if (recording.audio) {
          const audioBlob = this.base64ToBlob(recording.audio);
          audio.src = URL.createObjectURL(audioBlob);
        }
        audio.controls = true;
        
        const timestamp = new Date(recording.timestamp).toLocaleString();
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = timestamp;
        
        li.appendChild(audio);
        li.appendChild(meta);
        
        const recordingsList = document.getElementById('recordingsList');
        if (recordingsList) {
          recordingsList.insertBefore(li, recordingsList.firstChild);
        }
      }

      base64ToBlob(base64) {
        const parts = base64.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        
        return new Blob([uInt8Array], { type: contentType });
      }

      loadRecordings() {
        try {
          const recordings = JSON.parse(localStorage.getItem('voiceRecordings') || '[]');
          const ticketId = localStorage.getItem('currentTicketId');
          const recordingsList = document.getElementById('recordingsList');
          
          if (recordingsList) {
            recordingsList.innerHTML = ''; // Clear existing list
            recordings
              .filter(r => r.ticketId === ticketId)
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
              .forEach(recording => this.displayRecording(recording));
          }
        } catch (err) {
          console.error('Failed to load recordings:', err);
        }
      }
    };
  }

  // Initialize voice handler
  if (!window.voiceHandler) {
    window.voiceHandler = new window.VoiceHandler();
  }
};