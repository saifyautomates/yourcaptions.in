import fs from 'fs';
import path from 'path';

export class UploadHelper {
  static async uploadFile(presignedUrl: string, filePath: string, contentType: string): Promise<Response> {
    const fileBuffer = fs.readFileSync(path.resolve(process.cwd(), filePath));
    return await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: fileBuffer,
    });
  }
}
