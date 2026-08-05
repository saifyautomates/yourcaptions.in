export async function validateFileMagicBytes(buffer: Buffer, expectedType: 'video' | 'audio' | 'image'): Promise<boolean> {
  const signatures = {
    video: [
      '00 00 00 18 66 74 79 70', // MP4
      '00 00 00 20 66 74 79 70', // MP4
      '1A 45 DF A3', // WebM/MKV
      '00 00 00 14 66 74 79 70', // QuickTime (MOV)
    ],
    audio: [
      '49 44 33', // MP3 ID3
      'FF FB', 'FF F3', 'FF F2', // MP3 without ID3
      '52 49 46 46', // WAV/AVI
    ],
    image: [
      'FF D8 FF', // JPG
      '89 50 4E 47 0D 0A 1A 0A', // PNG
      '47 49 46 38', // GIF
      '52 49 46 46', // WEBP uses RIFF too, but followed by WEBP
    ],
  };

  const hex = buffer.slice(0, 12).toString('hex').toUpperCase();
  
  if (expectedType === 'image' && hex.startsWith('52494646')) {
    const webpMagic = buffer.slice(8, 12).toString('utf-8');
    if (webpMagic === 'WEBP') return true;
  }

  return signatures[expectedType].some(sig => hex.startsWith(sig.replace(/ /g, '')));
}

export async function validateFileSize(size: number, expectedType: 'video' | 'audio' | 'image'): Promise<boolean> {
  const limits = {
    video: 10 * 1024 * 1024 * 1024, // 10 GB
    audio: 500 * 1024 * 1024, // 500 MB
    image: 10 * 1024 * 1024, // 10 MB
  };
  return size <= limits[expectedType];
}
