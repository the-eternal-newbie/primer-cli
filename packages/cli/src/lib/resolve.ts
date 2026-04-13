import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);

export function getTemplatesRoot(type: string): string {
  const entry = require.resolve("@monomit/primer-templates");
  return join(entry, "..", type);
}