import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Checks if a file actually exists in the upload directory.
 * Returns false if filename is null/empty or if fs.access fails.
 */
export async function isFileOnDisk(filename: string | null | undefined): Promise<boolean> {
  if (!filename || typeof filename !== 'string') return false;
  
  const cleanName = filename.trim();
  if (!cleanName) return false;

  const cfg = useRuntimeConfig();
  const uploadDir = path.resolve(process.cwd(), String(cfg.uploadDir || './public/uploads'));
  const filePath = path.join(uploadDir, cleanName);

  try {
    // Check if file exists and is readable
    await fs.access(filePath, fs.constants.R_OK);
    // Optionally check if it's a file (not a dir)
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}