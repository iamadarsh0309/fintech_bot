import { createApp } from "./app.js";
import { initializeDatabase } from "./db/init.js";
import { settings } from "./config.js";

async function main() {
  await initializeDatabase();
  const app = createApp();
  app.listen(settings.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `${settings.projectName} listening on http://localhost:${settings.port}`,
    );
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", error);
  process.exit(1);
});
