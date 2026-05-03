import { Storage, type File } from "@google-cloud/storage";
import type { Response } from "express";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  } as any,
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  let p = path.startsWith("/") ? path : `/${path}`;
  const parts = p.split("/").filter(Boolean);
  const bucketName = parts[0];
  const objectName = parts.slice(1).join("/");
  if (!bucketName || !objectName) {
    throw new Error(`Invalid object path: ${path}`);
  }
  return { bucketName, objectName };
}

async function signObjectURL(opts: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const body = {
    bucket_name: opts.bucketName,
    object_name: opts.objectName,
    method: opts.method,
    expires_at: new Date(Date.now() + opts.ttlSec * 1000).toISOString(),
  };
  const resp = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Failed to sign object URL: ${resp.status} ${text}`);
  }
  const json = (await resp.json()) as { signed_url?: string };
  if (!json.signed_url) {
    throw new Error("Sidecar returned no signed_url");
  }
  return json.signed_url;
}

export type UploadKind = "image" | "video";

export class ObjectStorageService {
  getPublicObjectSearchPaths(): string[] {
    const raw = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths: string[] = Array.from(
      new Set<string>(
        raw
          .split(",")
          .map((s: string) => s.trim())
          .filter((s: string) => Boolean(s)),
      ),
    );
    if (paths.length === 0) {
      throw new Error("PUBLIC_OBJECT_SEARCH_PATHS env var is not set");
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error("PRIVATE_OBJECT_DIR env var is not set");
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`.replace(/\/+/g, "/");
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const file = objectStorageClient.bucket(bucketName).file(objectName);
      const [exists] = await file.exists();
      if (exists) return file;
    }
    return null;
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const entityId = objectPath.slice("/objects/".length);
    if (!entityId) throw new ObjectNotFoundError();
    let dir = this.getPrivateObjectDir();
    if (!dir.endsWith("/")) dir += "/";
    const fullPath = `${dir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFoundError();
    return file;
  }

  async getUploadUrl(
    kind: UploadKind = "image",
    userId?: string,
  ): Promise<{ uploadUrl: string; objectPath: string }> {
    let privateDir = this.getPrivateObjectDir();
    if (!privateDir.endsWith("/")) privateDir += "/";
    const folder = kind === "video" ? "videos" : "photos";
    const objectId = randomUUID();
    const userSegment = userId ? `u/${userId}/` : "";
    const fullPath = `${privateDir}case-uploads/${userSegment}${folder}/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const uploadUrl = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
    return {
      uploadUrl,
      objectPath: `/objects/case-uploads/${userSegment}${folder}/${objectId}`,
    };
  }

  isObjectSafeToDelete(rawUrl: string, ownerUserId: string | null | undefined): boolean {
    if (!rawUrl) return false;
    const normalized = this.normalizeObjectEntityPath(rawUrl);
    if (!normalized.startsWith("/objects/case-uploads/")) return false;
    const userScoped = normalized.match(/\/objects\/case-uploads\/u\/([^/]+)\//);
    if (userScoped) {
      return Boolean(ownerUserId) && userScoped[1] === ownerUserId;
    }
    return true;
  }

  normalizeObjectEntityPath(rawUrl: string): string {
    if (!rawUrl) return rawUrl;
    if (rawUrl.startsWith("/objects/")) return rawUrl;
    try {
      const url = new URL(rawUrl);
      const pathname = url.pathname;
      let dir = this.getPrivateObjectDir();
      if (!dir.endsWith("/")) dir += "/";
      if (pathname.startsWith(dir)) {
        const entityId = pathname.slice(dir.length);
        return `/objects/${entityId}`;
      }
    } catch {
      /* not a URL */
    }
    return rawUrl;
  }

  async deleteObjectByPath(rawUrl: string): Promise<void> {
    if (!rawUrl) return;
    const normalized = this.normalizeObjectEntityPath(rawUrl);
    if (!normalized.startsWith("/objects/")) return;
    const entityId = normalized.slice("/objects/".length);
    if (!entityId) return;
    let dir = this.getPrivateObjectDir();
    if (!dir.endsWith("/")) dir += "/";
    const fullPath = `${dir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    await objectStorageClient.bucket(bucketName).file(objectName).delete({ ignoreNotFound: true });
  }

  isLegacyUnscopedPath(rawUrl: string): boolean {
    if (!rawUrl) return false;
    const normalized = this.normalizeObjectEntityPath(rawUrl);
    if (!normalized.startsWith("/objects/case-uploads/")) return false;
    return !/\/objects\/case-uploads\/u\/[^/]+\//.test(normalized);
  }

  async deleteOwnedObjects(
    items: Array<{ url: string | null | undefined; ownerUserId: string | null | undefined }>,
    options: { isStillReferenced?: (url: string) => Promise<boolean> } = {},
  ): Promise<void> {
    const valid = items.filter(
      (i): i is { url: string; ownerUserId: string | null | undefined } =>
        typeof i.url === "string" && i.url.length > 0,
    );
    await Promise.all(
      valid.map(async ({ url, ownerUserId }) => {
        if (!this.isObjectSafeToDelete(url, ownerUserId)) {
          console.log(`Skip cleanup (unsafe path / cross-user): ${url}`);
          return;
        }
        // For legacy unscoped paths, the object is not provably owned by the
        // record owner; only delete if no other active record still references
        // it. This avoids deleting objects another user/record relies on.
        if (this.isLegacyUnscopedPath(url) && options.isStillReferenced) {
          try {
            if (await options.isStillReferenced(url)) {
              console.log(`Skip cleanup (legacy path still referenced): ${url}`);
              return;
            }
          } catch (refErr) {
            console.error(`Reference check failed for ${url}; skipping:`, refErr);
            return;
          }
        }
        try {
          await this.deleteObjectByPath(url);
        } catch (err) {
          console.error(`Failed to delete object ${url}:`, err);
        }
      }),
    );
  }

  async downloadObject(file: File, res: Response, cacheTtlSec = 3600): Promise<void> {
    try {
      const [metadata] = await file.getMetadata();
      res.set({
        "Content-Type": (metadata.contentType as string) || "application/octet-stream",
        "Content-Length": String(metadata.size ?? ""),
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });
      const stream = file.createReadStream();
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) res.status(500).end();
      });
      stream.pipe(res);
    } catch (err) {
      console.error("downloadObject error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Failed to download object" });
    }
  }
}
