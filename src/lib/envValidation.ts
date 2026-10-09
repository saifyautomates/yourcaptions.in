import { reportError } from "./errorMonitor";

export type ServiceName = 'AssemblyAI' | 'ElevenLabs' | 'OpenAI' | 'Deepgram' | 'FFMPEG';

export function getValidatedApiKey(service: ServiceName, envVarName: string): string {
  let key = '';

  if (typeof process !== 'undefined' && process.env && process.env[envVarName]) {
    key = process.env[envVarName] as string;
  } else if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[envVarName]) {
    key = import.meta.env[envVarName] as string;
  } else if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[`VITE_${envVarName}`]) {
    key = import.meta.env[`VITE_${envVarName}`] as string;
  } else if (typeof process !== 'undefined' && process.env && process.env[`VITE_${envVarName}`]) {
    key = process.env[`VITE_${envVarName}`] as string;
  }

  if (!key || key.trim() === '') {
    const errorMsg = `Missing required API key for ${service} (${envVarName}). Services may fail to initialize.`;
    console.error(`[Security/Config Error] ${errorMsg}`);
    
    // Log to error monitoring system
    reportError(new Error(errorMsg), {
      severity: "critical",
      context: { service, envVarName },
      functionName: "getValidatedApiKey"
    });
    
    return '';
  }

  return key.trim();
}

export function getConfiguredApiKeys() {
  return {
    sarvam: getValidatedApiKey('Sarvam', 'SARVAM_API_KEY'),
    assemblyAi: getValidatedApiKey('AssemblyAI', 'ASSEMBLYAI_API_KEY'),
    elevenLabs: getValidatedApiKey('ElevenLabs', 'ELEVENLABS_API_KEY'),
    openAi: getValidatedApiKey('OpenAI', 'OPENAI_API_KEY'),
    deepgram: getValidatedApiKey('Deepgram', 'DEEPGRAM_API_KEY'),
    ffmpegKey: getValidatedApiKey('FFMPEG', 'FFMPEG_API_KEY'),
    ffmpegAuth: getValidatedApiKey('FFMPEG', 'FFMPEG_API_AUTH'),
  };
}
