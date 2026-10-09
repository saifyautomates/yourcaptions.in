import { reportEdgeError } from "./report-error.ts";

export type ServiceName = 'AssemblyAI' | 'ElevenLabs' | 'OpenAI' | 'Deepgram' | 'FFMPEG' | 'Sarvam';

export function getValidatedApiKey(service: ServiceName, envVarName: string, functionName: string): string {
  const key = (Deno.env.get(envVarName) || "").trim();

  if (!key) {
    const errorMsg = `Missing API key for ${service} (${envVarName}). Services may fail to initialize.`;
    console.error(`[Security/Config Error] ${errorMsg}`);
    
    // Log to error monitoring system (fire and forget)
    reportEdgeError(new Error(errorMsg), {
      severity: "critical",
      context: { service, envVarName },
      functionName: functionName || "getValidatedApiKey"
    }).catch(err => console.error("Failed to report edge error", err));
    
    return '';
  }

  return key;
}

export function getConfiguredApiKeys(functionName: string) {
  return {
    sarvam: getValidatedApiKey('Sarvam', 'SARVAM_API_KEY', functionName),
    assemblyAi: getValidatedApiKey('AssemblyAI', 'ASSEMBLYAI_API_KEY', functionName),
    elevenLabs: getValidatedApiKey('ElevenLabs', 'ELEVENLABS_API_KEY', functionName),
    openAi: getValidatedApiKey('OpenAI', 'OPENAI_API_KEY', functionName),
    deepgram: getValidatedApiKey('Deepgram', 'DEEPGRAM_API_KEY', functionName),
    ffmpegKey: getValidatedApiKey('FFMPEG', 'FFMPEG_API_KEY', functionName),
    ffmpegAuth: getValidatedApiKey('FFMPEG', 'FFMPEG_API_AUTH', functionName),
  };
}
