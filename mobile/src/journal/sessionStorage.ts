/**
 * Session Storage
 * Local persistence for journaling sessions using Expo FileSystem
 */

import * as FileSystem from 'expo-file-system';
import type { JournalSession } from './sessionTypes';

const SESSIONS_DIR = FileSystem.documentDirectory + 'sessions/';

/**
 * Ensure sessions directory exists
 */
async function ensureSessionsDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(SESSIONS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(SESSIONS_DIR, { intermediates: true });
    console.log('[SessionStorage] Created sessions directory');
  }
}

/**
 * Generate filename from session
 */
function generateFilename(session: JournalSession): string {
  const date = new Date(session.startedAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `session_${session.sessionId}_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.json`;
}

/**
 * Save a journal session to local storage
 * @returns The file path where the session was saved
 */
export async function saveSession(session: JournalSession): Promise<string> {
  try {
    await ensureSessionsDirectory();

    const filename = generateFilename(session);
    const filePath = SESSIONS_DIR + filename;

    const jsonContent = JSON.stringify(session, null, 2);
    await FileSystem.writeAsStringAsync(filePath, jsonContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    console.log('[SessionStorage] Session saved successfully:', filePath);
    return filePath;
  } catch (error) {
    console.error('[SessionStorage] Failed to save session:', error);
    throw error;
  }
}

/**
 * List all saved session file paths
 * @returns Array of file paths
 */
export async function listSessions(): Promise<string[]> {
  try {
    await ensureSessionsDirectory();

    const files = await FileSystem.readDirectoryAsync(SESSIONS_DIR);
    const sessionFiles = files
      .filter((file) => file.startsWith('session_') && file.endsWith('.json'))
      .map((file) => SESSIONS_DIR + file);

    console.log('[SessionStorage] Found', sessionFiles.length, 'session files');
    return sessionFiles;
  } catch (error) {
    console.error('[SessionStorage] Failed to list sessions:', error);
    throw error;
  }
}

/**
 * Load a journal session from a file path
 * @param path - Full file path to the session JSON file
 * @returns The loaded JournalSession
 */
export async function loadSession(path: string): Promise<JournalSession> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(path);
    if (!fileInfo.exists) {
      throw new Error(`Session file not found: ${path}`);
    }

    const jsonContent = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const session = JSON.parse(jsonContent) as JournalSession;
    console.log('[SessionStorage] Session loaded successfully:', path);
    return session;
  } catch (error) {
    console.error('[SessionStorage] Failed to load session:', error);
    throw error;
  }
}

