import "server-only";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ../src is written for Node 24 native .ts execution and locates its own data files with
// import.meta.url. Bundling it breaks that (the bundler tries to resolve ../../data/*.json at
// build time and rewrites import.meta.url), so the server loads it with Node's own loader.
// Types still come from the real files through `typeof import`, so the calls stay type-checked.
const SRC = path.join(process.cwd(), "..", "src");
const load = (file: string) => import(/* turbopackIgnore: true */ /* webpackIgnore: true */ pathToFileURL(path.join(SRC, file)).href);

export const rwa = () => load("data/rwa.ts") as Promise<typeof import("../../../src/data/rwa.ts")>;
export const web3api = () => load("exec/web3api.ts") as Promise<typeof import("../../../src/exec/web3api.ts")>;
export const multiplierMod = () => load("dividends/multiplier.ts") as Promise<typeof import("../../../src/dividends/multiplier.ts")>;
export const accrualMod = () => load("dividends/accrual.ts") as Promise<typeof import("../../../src/dividends/accrual.ts")>;
export const statementMod = () => load("dividends/statement.ts") as Promise<typeof import("../../../src/dividends/statement.ts")>;
