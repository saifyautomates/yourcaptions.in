import { describe, it } from 'vitest';
import { getValidatedApiKey } from './envValidation';

describe('debug2', () => {
  it('prints', () => {
    console.log("process.env.FFMPEG_API_KEY:", process.env.FFMPEG_API_KEY);
    console.log("import.meta.env.FFMPEG_API_KEY:", import.meta.env.FFMPEG_API_KEY);
    console.log("import.meta.env.VITE_FFMPEG_API_KEY:", import.meta.env.VITE_FFMPEG_API_KEY);
  });
});
