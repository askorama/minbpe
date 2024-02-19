import { build, emptyDir } from "https://deno.land/x/dnt@0.37.0/mod.ts";
import pkg from "./deno.json" assert { type: "json" };

await emptyDir("./npm");

await build({
  entryPoints: ["./src/index.ts"],
  outDir: "./npm",
  shims: {
    deno: false,
  },
  scriptModule: 'cjs',
  test: false,
  package: {
    name: "minbpe",
    version: pkg.version,
    description: "Pure JavaScript port of minbpe",
    license: "Apache 2.0",
    repository: {
      type: "git",
      url: "git+https://github.com/oramasearch/minbpe",
    },
    bugs: {
      url: "https://github.com/oramasearch/minbpe/issues",
    },
    author: {
      name: "Michele Riva",
      url: "https://github.com/MicheleRiva"
    },
    dependencies: {
      'unicode-properties': '^1.4.1'
    },
    devDependencies: {
      '@types/node': '^20.11.19',
      '@types/unicode-properties': '^1.3.2'
    }
  },
  postBuild() {
    Deno.copyFileSync("LICENSE.md", "npm/LICENSE.md");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});