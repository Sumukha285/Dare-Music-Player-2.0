/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Track } from "../types";

const DB_NAME = "DarePlayerOfflineDB";
const DB_VERSION = 1;
const STORE_NAME = "uploaded_tracks";

export interface StoredTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  duration: number;
  coverUrl: string;
  blob: Blob;
  captions: { time: number; text: string }[];
}

/**
 * Open the IndexedDB database
 */
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Failed to open IndexedDB:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

/**
 * Save a new track to IndexedDB
 */
export async function saveTrackToDB(track: Track, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const storedItem: StoredTrack = {
        id: track.id,
        title: track.title,
        artist: track.artist,
        genre: track.genre,
        duration: track.duration,
        coverUrl: track.coverUrl || "",
        blob: blob,
        captions: track.captions || [],
      };

      const request = store.put(storedItem);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("saveTrackToDB failed:", error);
    throw error;
  }
}

/**
 * Load all stored tracks from IndexedDB and re-generate Object URLs
 */
export async function loadTracksFromDB(): Promise<{ track: Track; blob: Blob }[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results: StoredTrack[] = request.result || [];
        const loadedTracks = results.map((item) => {
          // Recreate the object URL from the saved blob
          const url = URL.createObjectURL(item.blob);
          const track: Track = {
            id: item.id,
            title: item.title,
            artist: item.artist,
            genre: item.genre,
            duration: item.duration,
            url: url, // playable blob URL
            coverUrl: item.coverUrl,
            captions: item.captions,
          };
          return { track, blob: item.blob };
        });
        resolve(loadedTracks);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("loadTracksFromDB failed:", error);
    return [];
  }
}

/**
 * Delete a track from IndexedDB
 */
export async function deleteTrackFromDB(trackId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(trackId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("deleteTrackFromDB failed:", error);
  }
}

/**
 * Update captions for a stored track
 */
export async function updateTrackCaptionsInDB(trackId: string, captions: { time: number; text: string }[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(trackId);

      getRequest.onsuccess = () => {
        const data: StoredTrack = getRequest.result;
        if (data) {
          data.captions = captions;
          const putRequest = store.put(data);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve(); // not found
        }
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  } catch (error) {
    console.error("updateTrackCaptionsInDB failed:", error);
  }
}
