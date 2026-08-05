// Curated royalty-free background tracks (Pixabay / Free Music Archive style CDNs).
// All entries are direct MP3 URLs playable via HTMLAudioElement.

export type LibraryTrack = {
  id: string;
  name: string;
  mood: string;
  duration: number; // seconds (approx)
  src: string;
};

export const MUSIC_LIBRARY: LibraryTrack[] = [
  {
    id: "lofi-chill",
    name: "Lofi Chill Beat",
    mood: "Chill",
    duration: 145,
    src: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3",
  },
  {
    id: "cinematic-inspire",
    name: "Cinematic Inspire",
    mood: "Cinematic",
    duration: 130,
    src: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_1718e49cae.mp3?filename=inspiring-cinematic-ambient-116199.mp3",
  },
  {
    id: "upbeat-corporate",
    name: "Upbeat Corporate",
    mood: "Upbeat",
    duration: 128,
    src: "https://cdn.pixabay.com/download/audio/2022/10/25/audio_946bc7f4e2.mp3?filename=the-best-jazz-club-in-new-orleans-164472.mp3",
  },
  {
    id: "epic-trailer",
    name: "Epic Trailer",
    mood: "Epic",
    duration: 145,
    src: "https://cdn.pixabay.com/download/audio/2022/08/03/audio_884fe94120.mp3?filename=powerful-beat-121791.mp3",
  },
  {
    id: "acoustic-warm",
    name: "Warm Acoustic",
    mood: "Warm",
    duration: 128,
    src: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3?filename=acoustic-guitar-loop-f-91bpm-132687.mp3",
  },
  {
    id: "hiphop-groove",
    name: "Hip-Hop Groove",
    mood: "Hip-Hop",
    duration: 130,
    src: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0c6ff1ead.mp3?filename=hip-hop-rock-beats-118000.mp3",
  },
  {
    id: "ambient-space",
    name: "Ambient Space",
    mood: "Ambient",
    duration: 200,
    src: "https://cdn.pixabay.com/download/audio/2021/11/13/audio_cb31c8bff2.mp3?filename=ambient-piano-amp-strings-10711.mp3",
  },
  {
    id: "energetic-pop",
    name: "Energetic Pop",
    mood: "Energetic",
    duration: 140,
    src: "https://cdn.pixabay.com/download/audio/2022/08/02/audio_2dde668d05.mp3?filename=energetic-indie-rock-119242.mp3",
  },
];
