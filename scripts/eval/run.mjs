// Entry point: loads the TypeScript runner with jiti (resolves the "@/" path alias like the app does).
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const jiti = createJiti(import.meta.url, { alias: { "@": root } });
const { main } = await jiti.import("./eval.ts");
process.exitCode = await main();
