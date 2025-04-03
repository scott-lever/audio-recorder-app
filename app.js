class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.startButton = document.getElementById('startButton');
        this.stopButton = document.getElementById('stopButton');
        this.videoPlayer = document.getElementById('videoPlayer');
        this.loader = document.getElementById('loader');
        this.recordingTimer = null;
        this.recordingStartTime = null;

        this.startButton.addEventListener('click', () => this.startRecording());
        this.stopButton.addEventListener('click', () => this.stopRecording());

        // Check browser compatibility
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.startButton.disabled = true;
            alert('Audio recording is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.');
        }
    }

    updateTimer() {
        if (!this.recordingStartTime) return;
        const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        const seconds = elapsed % 60;
        const minutes = Math.floor(elapsed / 60);
        this.stopButton.textContent = `Stop Recording (${minutes}:${seconds.toString().padStart(2, '0')})`;
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    channelCount: 1,
                    sampleRate: 44100,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            
            // Use audio/webm which has better browser support
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.audioChunks = [];
            this.recordingStartTime = Date.now();

            // Start the recording timer
            this.recordingTimer = setInterval(() => this.updateTimer(), 1000);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                try {
                    await this.sendAudioToServer();
                } catch (error) {
                    console.error('Error after recording stopped:', error);
                    alert('Error processing audio: ' + error.message);
                }
            };

            // Request data every second to ensure we're getting audio
            this.mediaRecorder.start(1000);
            this.startButton.disabled = true;
            this.stopButton.disabled = false;
            this.startButton.textContent = 'Recording...';
            console.log('Recording started...');

            // Auto-stop after 30 seconds
            setTimeout(() => {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.stopRecording();
                }
            }, 30000);

            // Handle when user revokes microphone permission
            stream.getAudioTracks()[0].onended = () => {
                console.log('Audio track ended - permission might have been revoked');
                this.stopRecording();
                alert('Audio recording stopped - microphone access may have been revoked');
            };

        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Error accessing microphone. Please ensure you have granted microphone permissions and are using a supported browser.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            console.log('Stopping recording...');
            this.mediaRecorder.stop();
            this.startButton.disabled = false;
            this.stopButton.disabled = true;
            this.startButton.textContent = 'Start Recording';
            this.stopButton.textContent = 'Stop Recording';
            
            // Clear the recording timer
            if (this.recordingTimer) {
                clearInterval(this.recordingTimer);
                this.recordingTimer = null;
                this.recordingStartTime = null;
            }

            // Stop all audio tracks
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }

    async sendAudioToServer() {
        if (this.audioChunks.length === 0) {
            throw new Error('No audio data recorded');
        }

        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
        
        // Check file size (max 10MB)
        if (audioBlob.size > 10 * 1024 * 1024) {
            throw new Error('Recording too large. Please try a shorter recording.');
        }

        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');

        this.loader.style.display = 'block';
        this.videoPlayer.style.display = 'none';

        try {
            console.log('Sending audio to server...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch('https://sblfto.app.n8n.cloud/webhook-test/e8d14491-24a7-47e1-9316-61e6bdfb096e', {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Server response:', data);
            
            if (data.video_url) {
                this.videoPlayer.src = data.video_url;
                this.videoPlayer.style.display = 'block';
                
                try {
                    await this.videoPlayer.play();
                } catch (playError) {
                    console.error('Error playing video:', playError);
                    alert('Error playing video. Please try clicking the play button.');
                }
            } else {
                throw new Error('No video URL in response');
            }
        } catch (error) {
            console.error('Error sending audio:', error);
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please try again.');
            }
            throw new Error('Error processing audio. Please try again.');
        } finally {
            this.loader.style.display = 'none';
        }
    }
}

// Initialize the recorder when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AudioRecorder();
    console.log('Audio recorder initialized');
}); 