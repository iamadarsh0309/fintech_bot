// Import the library entry directly to avoid pdf-parse's debug-mode behaviour
// that triggers when the package index is imported as the main module.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function extractTextFromPdf(fileBuffer) {
  const result = await pdfParse(fileBuffer);
  return (result.text || "").trim();
}
