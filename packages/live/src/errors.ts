// Only controlled, local audio failures may cross into the user-facing error.
export class LiveAudioError extends Error {
  constructor(code: 'microphone-missing' | 'audio-unavailable') {
    super(code === 'microphone-missing'
      ? 'Le microphone choisi dans VOICE n’est plus connecté. Reconnectez-le ou choisissez « Microphone par défaut de Windows » dans VOICE, puis enregistrez.'
      : 'L’audio LIVE ne peut pas démarrer. Vérifiez le microphone choisi dans VOICE, les autorisations Windows et la sortie audio.');
    this.name = 'LiveAudioError';
  }
}
