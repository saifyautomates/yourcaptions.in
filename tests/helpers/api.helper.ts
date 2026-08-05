export class APIHelper {
  private baseURL = process.env.API_URL || 'https://api.yourcaptions.com';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async request(method: string, path: string, body?: any): Promise<Response> {
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    };
    if (body) options.body = JSON.stringify(body);
    return await fetch(`${this.baseURL}${path}`, options);
  }

  async checkAuthValid(): Promise<{ valid: boolean; user: any }> {
    const res = await this.request('GET', '/auth/me');
    return { valid: res.ok, user: res.ok ? await res.json() : null };
  }

  async createProject(title: string): Promise<{ id: string }> {
    const res = await this.request('POST', '/projects', { title });
    if (!res.ok) throw new Error('Failed to create project');
    return await res.json();
  }

  async getProject(id: string): Promise<any> {
    const res = await this.request('GET', `/projects/${id}`);
    if (!res.ok) throw new Error('Failed to get project');
    return await res.json();
  }

  async deleteProject(id: string): Promise<void> {
    const res = await this.request('DELETE', `/projects/${id}`);
    if (!res.ok) throw new Error('Failed to delete project');
  }

  async listProjects(): Promise<any[]> {
    const res = await this.request('GET', '/projects');
    if (!res.ok) throw new Error('Failed to list projects');
    return (await res.json()).projects || [];
  }

  async uploadVideo(filePath: string, projectId: string): Promise<{ mediaId: string }> {
    const res = await this.request('POST', `/projects/${projectId}/upload/video`, { filePath });
    return await res.json();
  }

  async uploadAudio(filePath: string, projectId: string): Promise<{ mediaId: string }> {
    const res = await this.request('POST', `/projects/${projectId}/upload/audio`, { filePath });
    return await res.json();
  }

  async getPresignedUrl(filename: string, contentType: string): Promise<{ url: string; key: string }> {
    const res = await this.request('POST', '/storage/presigned-url', { filename, contentType });
    return await res.json();
  }

  async startTranscription(mediaId: string, language?: string): Promise<{ jobId: string }> {
    const res = await this.request('POST', `/media/${mediaId}/transcribe`, { language });
    return await res.json();
  }

  async getTranscriptionStatus(jobId: string): Promise<{ status: string; progress: number; captions?: any[] }> {
    const res = await this.request('GET', `/jobs/${jobId}`);
    return await res.json();
  }

  async pollTranscriptionComplete(jobId: string, timeoutMs: number = 30000): Promise<any[]> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await this.getTranscriptionStatus(jobId);
      if (status.status === 'completed') return status.captions || [];
      if (status.status === 'failed') throw new Error('Transcription failed');
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('Transcription timeout');
  }

  async getCredits(): Promise<{ plan_credits: number; topup_credits: number; total: number }> {
    const res = await this.request('GET', '/credits');
    return await res.json();
  }

  async getCreditHistory(page: number = 1): Promise<any[]> {
    const res = await this.request('GET', `/credits/history?page=${page}`);
    return await res.json();
  }

  async startExport(projectId: string, settings: any): Promise<{ jobId: string; creditsReserved: number }> {
    const res = await this.request('POST', `/projects/${projectId}/export`, { settings });
    return await res.json();
  }

  async getExportStatus(jobId: string): Promise<{ status: string; progress: number; outputUrl?: string }> {
    const res = await this.request('GET', `/exports/${jobId}`);
    return await res.json();
  }

  async pollExportComplete(jobId: string, timeoutMs: number = 60000): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await this.getExportStatus(jobId);
      if (status.status === 'completed' && status.outputUrl) return status.outputUrl;
      if (status.status === 'failed') throw new Error('Export failed');
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('Export timeout');
  }

  async adminGetUsers(page: number = 1): Promise<any[]> {
    const res = await this.request('GET', `/admin/users?page=${page}`);
    return await res.json();
  }

  async adminUpdateUserPlan(userId: string, plan: string): Promise<void> {
    const res = await this.request('POST', `/admin/users/${userId}/plan`, { plan });
    if (!res.ok) throw new Error('Failed to update plan');
  }

  async adminAdjustCredits(userId: string, amount: number, reason: string): Promise<void> {
    const res = await this.request('POST', `/admin/users/${userId}/credits`, { amount, reason });
    if (!res.ok) throw new Error('Failed to adjust credits');
  }

  async adminGetRevenue(from: string, to: string): Promise<any> {
    const res = await this.request('GET', `/admin/revenue?from=${from}&to=${to}`);
    return await res.json();
  }

  async createTeam(name: string): Promise<{ id: string }> {
    const res = await this.request('POST', '/teams', { name });
    return await res.json();
  }

  async inviteTeamMember(email: string, role: string): Promise<void> {
    const res = await this.request('POST', '/teams/invite', { email, role });
    if (!res.ok) throw new Error('Failed to invite team member');
  }

  async getTeamMembers(): Promise<any[]> {
    const res = await this.request('GET', '/teams/members');
    return await res.json();
  }
}
