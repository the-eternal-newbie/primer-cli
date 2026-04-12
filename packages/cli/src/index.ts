#!/usr/bin/env node
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);

// Resolve the templates package location on disk
const templatesRoot = join(
  require.resolve("@primer/templates"),
  ".."
);
console.log("primer CLI running");
console.log("Templates root:", templatesRoot);