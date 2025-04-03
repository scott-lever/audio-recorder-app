class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.startButton = document.getElementById('startButton');
        this.stopButton = document.getElementById('stopButton');
        this.videoPlayer = document.getElementById('videoPlayer');
        this.loader = document.getElementById('loader');

        this.startButton.addEventListener('click', () => this.startRecording());
        this.stopButton.addEventListener('click', () => this.stopRecording());
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = () => {
                this.sendAudioToServer();
            };

            this.mediaRecorder.start();
            this.startButton.disabled = true;
            this.stopButton.disabled = false;

            // Auto-stop after 30 seconds
            setTimeout(() => {
                if (this.mediaRecorder.state === 'recording') {
                    this.stopRecording();
                }
            }, 30000);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Error accessing microphone. Please ensure you have granted microphone permissions.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.startButton.disabled = false;
            this.stopButton.disabled = true;
        }
    }

    async sendAudioToServer() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('file', audioBlob);

        this.loader.style.display = 'block';
        this.videoPlayer.style.display = 'none';

        try {
            const response = await fetch('https://sblfto.app.n8n.cloud/webhook/e8d14491-24a7-47e1-9316-61e6bdfb096e', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.video_url) {
                this.videoPlayer.src = data.video_url;
                this.videoPlayer.style.display = 'block';
                this.videoPlayer.play();
            } else {
                throw new Error('No video URL in response');
            }
        } catch (error) {
            console.error('Error sending audio:', error);
            alert('Error processing audio. Please try again.');
        } finally {
            this.loader.style.display = 'none';
        }
    }
}

// Initialize the recorder when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AudioRecorder();
}); 