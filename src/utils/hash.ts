import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * Calculates SHA-256 hash of file contents
 * @param filePath Path to the file
 * @returns SHA-256 hash as hexadecimal string
 */
export function calculateFileHash(filePath: string): string {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    throw new Error(`Failed to calculate hash for ${filePath}: ${error}`);
  }
}

/**
 * Calculates SHA-256 hash of string content
 * @param content String content to hash
 * @returns SHA-256 hash as hexadecimal string
 */
export function calculateStringHash(content: string): string {
  const hashSum = crypto.createHash('sha256');
  hashSum.update(content, 'utf8');
  return hashSum.digest('hex');
}

/**
 * Compares two files by their hash
 * @param filePath1 Path to first file
 * @param filePath2 Path to second file
 * @returns True if files have the same content
 */
export function compareFilesByHash(filePath1: string, filePath2: string): boolean {
  try {
    const hash1 = calculateFileHash(filePath1);
    const hash2 = calculateFileHash(filePath2);
    return hash1 === hash2;
  } catch (error) {
    return false;
  }
}
