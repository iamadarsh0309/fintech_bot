import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import puppeteer from "puppeteer";

// PDF text extraction runs Mozilla's PDF.js inside a headless Chromium page.
// We inject the UMD (legacy) PDF.js build, hand the document to it as bytes,
// and concatenate the text content of every page.
const require = createRequire(import.meta.url);
const PDFJS_PATH = require.resolve("pdfjs-dist/legacy/build/pdf.js");
const PDFJS_WORKER_SOURCE = readFileSync(
  require.resolve("pdfjs-dist/legacy/build/pdf.worker.js"),
  "utf8",
);

let browserPromise = null;

// Reuse a single Chromium instance across uploads instead of paying the
// launch cost on every request.
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    browserPromise = null;
    await browser.close();
  }
}

export async function extractTextFromPdf(fileBuffer) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.addScriptTag({ path: PDFJS_PATH });

    const base64 = fileBuffer.toString("base64");
    const text = await page.evaluate(
      async (b64, workerSource) => {
        const pdfjsLib = window.pdfjsLib;

        // Run the worker from an in-page blob URL (no network, no file server).
        const workerBlob = new Blob([workerSource], {
          type: "application/javascript",
        });
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          URL.createObjectURL(workerBlob);

        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }

        // isEvalSupported:false mitigates GHSA-wgrm-67xf-hhpq (JS execution
        // from a crafted PDF); we also run inside an isolated Chromium page.
        const doc = await pdfjsLib.getDocument({
          data: bytes,
          isEvalSupported: false,
          disableFontFace: true,
        }).promise;
        const pages = [];
        for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
          const pdfPage = await doc.getPage(pageNumber);
          const content = await pdfPage.getTextContent();
          pages.push(content.items.map((item) => item.str).join(" "));
        }
        return pages.join("\n");
      },
      base64,
      PDFJS_WORKER_SOURCE,
    );

    return text.trim();
  } finally {
    await page.close();
  }
}
