/**
 * Codenora Firebase Compatibility Stub
 *
 * Replaces external Firebase dependencies with lightweight no-ops.
 * Codenora uses local state and direct AI teaching providers,
 * rendering third-party Firebase persistence unnecessary.
 */

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type { AppState, BinaryFileData } from "@excalidraw/excalidraw/types";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

export const loadFirebaseStorage = async () => null;

export const isSavedToFirebase = (
  _portal: Portal,
  _elements: readonly ExcalidrawElement[],
): boolean => false;

export const saveFilesToFirebase = async ({
  prefix: _prefix,
  files: _files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}): Promise<{
  savedFiles: FileId[];
  erroredFiles: FileId[];
}> => {
  return {
    savedFiles: [],
    erroredFiles: [],
  };
};

export const saveToFirebase = async (
  _portal: Portal,
  _elements: readonly SyncableExcalidrawElement[],
  _appState: AppState,
): Promise<readonly RemoteExcalidrawElement[] | null> => {
  return null;
};

export const loadFromFirebase = async (
  _roomId: string,
  _roomKey: string,
  _socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  return null;
};

export const loadFilesFromFirebase = async (
  _prefix: string,
  _decryptionKey: string,
  _filesIds: readonly FileId[],
): Promise<{
  loadedFiles: BinaryFileData[];
  erroredFiles: Map<FileId, true>;
}> => {
  return {
    loadedFiles: [],
    erroredFiles: new Map<FileId, true>(),
  };
};
