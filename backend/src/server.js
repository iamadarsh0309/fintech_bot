import { createApp } from "./app.js";
import { initializeDatabase } from "./db/init.js";
import { settings } from "./config.js";
import { closeBrowser } from "./services/pdfService.js";

async function main() {
  await initializeDatabase();
  const app = createApp();
  const server = app.listen(settings.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `${settings.projectName} listening on http://localhost:${settings.port}`,
    );
  });

  // Tear down the headless Chromium used for PDF parsing on shutdown.
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      server.close(async () => {
        await closeBrowser().catch(() => {});
        process.exit(0);
      });
    });
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", error);
  process.exit(1);
});
