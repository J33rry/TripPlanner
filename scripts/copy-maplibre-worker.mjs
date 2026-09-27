import { copyFileSync, mkdirSync } from "node:fs";

const source = new URL("../node_modules/maplibre-gl/dist/", import.meta.url);
const target = new URL("../public/vendor/maplibre/", import.meta.url);

mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(new URL(file, source), new URL(file, target));
}
