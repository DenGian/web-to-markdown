#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { convertUrlToMarkdown } from "./converter.js";

export async function runCli(
  args,
  convert = convertUrlToMarkdown,
  io = process,
) {
  if (args.includes("--help") || args.length === 0) {
    io.stdout.write(
      "Usage: web-to-md <public-url> [--full] [--no-front-matter] [--images retain|alt|omit] [--links retain|text] [--output file.md]\n",
    );
    return args.includes("--help") ? 0 : 2;
  }
  if (args[0].startsWith("--")) {
    io.stderr.write("Provide a public URL first. Use --help for usage.\n");
    return 2;
  }
  const values = {};
  const switches = new Set();
  for (let index = 1; index < args.length; index++) {
    const flag = args[index];
    if (["--output", "--images", "--links"].includes(flag)) {
      if (
        values[flag] !== undefined ||
        !args[index + 1] ||
        args[index + 1].startsWith("--")
      ) {
        io.stderr.write(
          `${flag} requires a ${flag === "--output" ? "filename" : "value"} and may appear once.\n`,
        );
        return 2;
      }
      values[flag] = args[++index];
    } else if (
      ["--full", "--no-front-matter"].includes(flag) &&
      !switches.has(flag)
    ) {
      switches.add(flag);
    } else {
      io.stderr.write(
        `Unknown or repeated option: ${flag}. Use --help for usage.\n`,
      );
      return 2;
    }
  }
  if (
    (values["--images"] &&
      !["retain", "alt", "omit"].includes(values["--images"])) ||
    (values["--links"] && !["retain", "text"].includes(values["--links"]))
  ) {
    io.stderr.write("Invalid cleanup option.\n");
    return 2;
  }
  try {
    const result = await convert(args[0], {
      mode: args.includes("--full") ? "full" : "article",
      frontMatter: !args.includes("--no-front-matter"),
      ...(values["--images"] ? { images: values["--images"] } : {}),
      ...(values["--links"] ? { links: values["--links"] } : {}),
    });
    if (values["--output"])
      await writeFile(values["--output"], result.markdown, { flag: "wx" });
    else io.stdout.write(result.markdown);
    return 0;
  } catch (error) {
    io.stderr.write(`${error.status ? error.message : "Conversion failed."}\n`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await runCli(process.argv.slice(2));
}
