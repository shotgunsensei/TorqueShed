import { File } from "expo-file-system";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import { getApiUrl } from "@/lib/query-client";

const TOKEN_KEY = "torqueshed_auth_token";

async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

interface UploadResult {
  url: string;
  uploadURL: string;
}

/**
 * Uploads a local file to Replit Object Storage in two steps:
 *  1. Asks the server for a short-lived presigned PUT URL.
 *  2. PUTs the file bytes directly to the storage URL.
 *
 * Returns the original presigned `uploadURL` (which the server later
 * normalizes into a permanent `/objects/...` path when associated with
 * a record).
 */
export async function uploadFileToStorage(
  fileUri: string,
  mimeType?: string,
): Promise<UploadResult> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const presignRes = await fetch(
    new URL("/api/objects/upload", getApiUrl()).toString(),
    {
      method: "POST",
      headers,
      credentials: "include",
    },
  );
  if (!presignRes.ok) {
    const text = await presignRes.text().catch(() => presignRes.statusText);
    throw new Error(`Failed to get upload URL: ${text}`);
  }
  const { uploadURL } = (await presignRes.json()) as { uploadURL: string };
  if (!uploadURL) throw new Error("Missing uploadURL in server response");

  const file = new File(fileUri);
  const bytes = await file.bytes();

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType || "application/octet-stream",
    },
    body: bytes,
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => putRes.statusText);
    throw new Error(`Upload failed (${putRes.status}): ${text}`);
  }

  return { url: uploadURL, uploadURL };
}

/**
 * Resolves an image source to one that can be passed to <Image>.
 * Handles `/objects/...` and `/public-objects/...` paths by prefixing
 * with the API origin so they load correctly on native devices too.
 */
export function resolveImageUri(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  if (path.startsWith("/")) {
    try {
      return new URL(path, getApiUrl()).toString();
    } catch {
      return path;
    }
  }
  return path;
}
