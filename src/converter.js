import { chromium } from "playwright";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { ConversionError, parsePublicUrl } from "./security.js";
import { safeFetch, LIMITS } from "./fetch.js";
import { analyzeMarkdown } from "../public/document.js";

function turndown() {
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
    strongDelimiter: "**",
  });
  service.use(gfm);
  service.remove([
    "script",
    "style",
    "noscript",
    "iframe",
    "form",
    "button",
    "svg",
  ]);
  service.addRule("preCode", {
    filter: (node) =>
      node.nodeName === "PRE" && node.firstElementChild?.nodeName === "CODE",
    replacement: (_content, node) => {
      const code = node.firstElementChild;
      const language = (
        code.className.match(/(?:language|lang)-([\w+-]+)/)?.[1] || ""
      ).replace(/[^\w+-]/g, "");
      const value = code.textContent.replace(/\n$/, "");
      const fence = "`".repeat(
        Math.max(
          3,
          ...Array.from(value.matchAll(/`+/g), (match) => match[0].length + 1),
        ),
      );
      return `\n\n${fence}${language}\n${value}\n${fence}\n\n`;
    },
  });
  return service;
}

export function convertHtml(html, url, options = {}) {
  const mode = options.mode || "article";
  if (!["article", "full"].includes(mode))
    throw new ConversionError("Choose article or full page mode.", 400);
  const images = options.images || "retain";
  const links = options.links || "retain";
  if (
    !["retain", "alt", "omit"].includes(images) ||
    !["retain", "text"].includes(links)
  )
    throw new ConversionError("Invalid cleanup options.", 400);
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;
  const title = (
    document.querySelector('meta[property="og:title"]')?.content ||
    document.title ||
    document.querySelector("h1")?.textContent ||
    "Untitled"
  )
    .trim()
    .slice(0, 500);
  const author = (document.querySelector('meta[name="author"]')?.content || "")
    .trim()
    .slice(0, 500);
  // Resolve URLs before Readability clones nodes; it otherwise retains relative paths.
  for (const element of document.querySelectorAll("[href], [src]")) {
    for (const attribute of ["href", "src"]) {
      if (!element.hasAttribute(attribute)) continue;
      try {
        const resolved = new URL(element.getAttribute(attribute), url);
        if (
          ["http:", "https:"].includes(resolved.protocol) ||
          (attribute === "href" && resolved.protocol === "mailto:")
        )
          element.setAttribute(attribute, resolved.href);
        else element.removeAttribute(attribute);
      } catch {
        element.removeAttribute(attribute);
      }
    }
  }
  const article =
    mode === "article"
      ? new Readability(document.cloneNode(true), { keepClasses: true }).parse()
      : null;
  const articleContainer = document.createElement("div");
  articleContainer.innerHTML = article?.content || "";
  const paragraphLength = [...articleContainer.querySelectorAll("p")].reduce(
    (length, paragraph) => length + paragraph.textContent.trim().length,
    0,
  );
  const useArticle = Boolean(article?.content && paragraphLength >= 100);
  const source = useArticle ? article.content : document.body?.innerHTML || "";
  const content = document.createElement("div");
  content.innerHTML = source;
  if (images !== "retain")
    for (const image of content.querySelectorAll("img"))
      image.replaceWith(
        images === "alt"
          ? document.createTextNode(image.getAttribute("alt") || "")
          : document.createTextNode(""),
      );
  if (links === "text")
    for (const link of content.querySelectorAll("a"))
      link.replaceWith(...link.childNodes);
  let body = turndown().turndown(content.innerHTML).trim();
  const pageHeading = document.querySelector("h1")?.textContent?.trim();
  if (
    useArticle &&
    pageHeading &&
    !body
      .split("\n")
      .some(
        (line) => /^#\s+/.test(line) && line.slice(2).trim() === pageHeading,
      )
  ) {
    body = `# ${pageHeading}\n\n${body}`;
  }
  if (!body || !/[\p{L}\p{N}]/u.test(body))
    throw new ConversionError("No readable content was found on this page.");
  const finalTitle = (useArticle ? article.title : title).trim().slice(0, 500);
  const byline = (useArticle ? article.byline || author : author)
    .trim()
    .slice(0, 500);
  const metadata = {
    title: finalTitle,
    source: url,
    date: new Date().toISOString().slice(0, 10),
  };
  if (byline) metadata.author = byline;
  // JSON string literals are valid YAML double-quoted scalars and escape control characters.
  const frontMatter =
    options.frontMatter === false
      ? ""
      : `---\n${Object.entries(metadata)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join("\n")}\n---\n\n`;
  const markdown = `${frontMatter}${body}\n`;
  if (Buffer.byteLength(markdown) > LIMITS.outputBytes)
    throw new ConversionError("The Markdown output exceeded the size limit.");
  const extractionMode =
    mode === "full" ? "full" : useArticle ? "article" : "body";
  const statistics = analyzeMarkdown(markdown);
  return {
    markdown,
    title: finalTitle,
    byline,
    url,
    extractionMode,
    wordCount: statistics.wordCount,
    headingCount: statistics.headingCount,
    warnings:
      extractionMode === "body"
        ? ["Article extraction found no article; used the page body."]
        : [],
  };
}

export async function convertUrlToMarkdown(
  input,
  options = {},
  fetchDependencies = {},
) {
  parsePublicUrl(input);
  const budget = {
    requests: 0,
    bytes: 0,
    deadline: Date.now() + LIMITS.totalMs,
  };
  const initial = await safeFetch(input, budget, {
    ...fetchDependencies,
    accept: "text/html,application/xhtml+xml",
  });
  if (initial.status < 200 || initial.status >= 300)
    throw new ConversionError(`The website returned HTTP ${initial.status}.`);
  if (
    !/^(text\/html|application\/xhtml\+xml)\b/i.test(
      initial.headers["content-type"] || "",
    )
  )
    throw new ConversionError("The URL did not return an HTML page.");
  if (initial.body.length > LIMITS.resourceBytes)
    throw new ConversionError("The page exceeded the size limit.");
  let browser;
  let timer;
  const failedContentResources = new Set();
  try {
    browser = await chromium.launch({
      headless: true,
      timeout: Math.min(10000, Math.max(1, budget.deadline - Date.now())),
      args: [
        "--disable-background-networking",
        "--disable-extensions",
        "--disable-features=Prerender2,SpeculationRulesPrefetchProxy",
        "--disable-features=WebRtcHideLocalIpsWithMdns",
        "--js-flags=--max-old-space-size=128",
      ],
    });
    const context = await browser.newContext({
      serviceWorkers: "block",
      acceptDownloads: false,
      viewport: { width: 1280, height: 800 },
    });
    await context.route("**/*", async (route) => {
      const request = route.request();
      if (
        !["http:", "https:"].includes(new URL(request.url()).protocol) ||
        ["image", "media", "font", "websocket", "eventsource"].includes(
          request.resourceType(),
        ) ||
        request.method() !== "GET"
      ) {
        return route.abort();
      }
      try {
        const result =
          request.isNavigationRequest() && request.url() === initial.url
            ? initial
            : await safeFetch(request.url(), budget, fetchDependencies);
        const contentType =
          result.headers["content-type"] || "application/octet-stream";
        await route.fulfill({
          status: result.status,
          contentType,
          body: result.body,
        });
      } catch {
        if (
          ["document", "script", "xhr", "fetch"].includes(
            request.resourceType(),
          )
        )
          failedContentResources.add(request.resourceType());
        await route.abort();
      }
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.WebSocket = class {
        constructor() {
          throw new Error("WebSocket disabled");
        }
      };
      window.Worker = class {
        constructor() {
          throw new Error("Worker disabled");
        }
      };
      window.SharedWorker = class {
        constructor() {
          throw new Error("Worker disabled");
        }
      };
      window.RTCPeerConnection = class {
        constructor() {
          throw new Error("WebRTC disabled");
        }
      };
      window.EventSource = class {
        constructor() {
          throw new Error("EventSource disabled");
        }
      };
      navigator.sendBeacon = () => false;
      if (navigator.mediaDevices)
        navigator.mediaDevices.getUserMedia = () =>
          Promise.reject(new Error("Media disabled"));
    });
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new ConversionError("Conversion timed out.")),
        Math.max(1, budget.deadline - Date.now()),
      );
    });
    const work = (async () => {
      await page.goto(initial.url, {
        waitUntil: "domcontentloaded",
        timeout: LIMITS.navigationMs,
      });
      // Wait for substantive text to settle, with a cap for slow hydration and noisy pages.
      const readyUntil = Math.min(budget.deadline - 1000, Date.now() + 5000);
      let previous = "";
      let stable = 0;
      while (Date.now() < readyUntil) {
        await page.waitForTimeout(250);
        const signature = await page.evaluate(() =>
          (document.body?.innerText || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 100000),
        );
        stable =
          signature === previous && signature.length >= 80 ? stable + 1 : 0;
        previous = signature;
        if (stable >= 3) break;
      }
      const html = await page.content();
      if (Buffer.byteLength(html) > LIMITS.pageBytes)
        throw new ConversionError("The rendered page exceeded the size limit.");
      const result = convertHtml(html, page.url(), options);
      if (failedContentResources.size)
        result.warnings.push(
          `Some content requests failed (${[...failedContentResources].join(", ")}); the captured page may be incomplete.`,
        );
      return result;
    })();
    return await Promise.race([work, timeout]);
  } catch (error) {
    if (error instanceof ConversionError) throw error;
    if (/Executable doesn't exist/.test(error.message))
      throw new ConversionError(
        "Chromium is unavailable. Install the Playwright browser.",
        503,
      );
    throw new ConversionError("Could not load or convert this page.", 422, {
      cause: error,
    });
  } finally {
    clearTimeout(timer);
    if (browser) await browser.close().catch(() => {});
  }
}
