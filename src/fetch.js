import http from "node:http";
import https from "node:https";
import { gunzipSync, inflateSync, brotliDecompressSync } from "node:zlib";
import { ConversionError, resolvePublicUrl } from "./security.js";

export const LIMITS = Object.freeze({
  totalMs: 30000,
  navigationMs: 15000,
  resourceBytes: 2_000_000,
  pageBytes: 4_000_000,
  totalBytes: 12_000_000,
  outputBytes: 2_000_000,
  maxRequests: 80,
  maxRedirects: 5,
});

export async function safeFetch(input, budget, options = {}) {
  let current = input;
  for (let hop = 0; hop <= LIMITS.maxRedirects; hop++) {
    if (Date.now() >= budget.deadline)
      throw new ConversionError("Conversion timed out.");
    const { url, address, family } = await withTimeout(
      resolvePublicUrl(current, options.resolver),
      Math.min(8000, budget.deadline - Date.now()),
    );
    const response = await (options.transport || requestOnce)(
      url,
      address,
      family,
      budget,
      options,
    );
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (hop === LIMITS.maxRedirects)
        throw new ConversionError("The page redirected too many times.");
      const location = response.headers.location;
      if (!location)
        throw new ConversionError("The page returned an invalid redirect.");
      current = new URL(location, url).href;
      continue;
    }
    return { ...response, url: url.href };
  }
}

export function requestOnce(url, address, family, budget, options) {
  if (++budget.requests > LIMITS.maxRequests)
    throw new ConversionError("The page requested too many resources.");
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: "GET",
        lookup: (_hostname, lookupOptions, callback) => {
          if (lookupOptions.all) callback(null, [{ address, family }]);
          else callback(null, address, family);
        },
        headers: {
          "user-agent": "WebToMD/1.1 (+single-page converter)",
          accept: options.accept || "*/*",
          "accept-encoding": "identity",
        },
        timeout: Math.min(8000, Math.max(1, budget.deadline - Date.now())),
        maxHeaderSize: 16384,
      },
      (response) => {
        const chunks = [];
        let bytes = 0;
        response.on("data", (chunk) => {
          bytes += chunk.length;
          budget.bytes += chunk.length;
          if (
            bytes > LIMITS.resourceBytes ||
            budget.bytes > LIMITS.totalBytes
          ) {
            request.destroy(
              new ConversionError("The page exceeded the download size limit."),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          try {
            let body = Buffer.concat(chunks);
            const encoding = response.headers["content-encoding"];
            if (encoding === "gzip")
              body = gunzipSync(body, {
                maxOutputLength: LIMITS.resourceBytes,
              });
            else if (encoding === "deflate")
              body = inflateSync(body, {
                maxOutputLength: LIMITS.resourceBytes,
              });
            else if (encoding === "br")
              body = brotliDecompressSync(body, {
                maxOutputLength: LIMITS.resourceBytes,
              });
            budget.bytes += Math.max(0, body.length - bytes);
            if (
              body.length > LIMITS.resourceBytes ||
              budget.bytes > LIMITS.totalBytes
            )
              throw new ConversionError(
                "The page exceeded the download size limit.",
              );
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body,
            });
          } catch {
            reject(
              new ConversionError(
                "The page used an unsupported or oversized response.",
              ),
            );
          }
        });
        response.on("error", reject);
      },
    );
    const deadlineTimer = setTimeout(
      () => request.destroy(new ConversionError("Conversion timed out.")),
      Math.max(1, budget.deadline - Date.now()),
    );
    request.on("close", () => clearTimeout(deadlineTimer));
    request.on("timeout", () =>
      request.destroy(
        new ConversionError("The website took too long to respond."),
      ),
    );
    request.on("error", reject);
    request.end();
  });
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new ConversionError("DNS lookup timed out.")),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}
