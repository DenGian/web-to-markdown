import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runCli } from "../src/cli.js";

function io() {
  const output = { stdout: "", stderr: "" };
  return {
    output,
    stdout: {
      write: (text) => {
        output.stdout += text;
      },
    },
    stderr: {
      write: (text) => {
        output.stderr += text;
      },
    },
  };
}
test("CLI passes options, writes Markdown, and refuses overwrite", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "web-to-md-"));
  const file = path.join(folder, "result.md");
  const output = io();
  let options;
  const convert = async (_url, received) => {
    options = received;
    return { markdown: "# Edited\n" };
  };
  try {
    assert.equal(
      await runCli(
        [
          "https://example.com/",
          "--full",
          "--no-front-matter",
          "--output",
          file,
        ],
        convert,
        output,
      ),
      0,
    );
    assert.deepEqual(options, { mode: "full", frontMatter: false });
    assert.equal(await readFile(file, "utf8"), "# Edited\n");
    assert.equal(
      await runCli(["https://example.com/", "--output", file], convert, output),
      1,
    );
    assert.match(output.output.stderr, /Conversion failed/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
test("CLI validates output argument", async () => {
  const output = io();
  assert.equal(
    await runCli(["https://example.com/", "--output"], undefined, output),
    2,
  );
  assert.match(output.output.stderr, /requires a filename/);
});
test("CLI forwards cleanup choices and rejects invalid values", async () => {
  const output = io();
  let received;
  assert.equal(
    await runCli(
      ["https://example.com/", "--images", "alt", "--links", "text"],
      async (_url, options) => {
        received = options;
        return { markdown: "done" };
      },
      output,
    ),
    0,
  );
  assert.equal(received.images, "alt");
  assert.equal(received.links, "text");
  assert.equal(
    await runCli(
      ["https://example.com/", "--images", "bad"],
      undefined,
      output,
    ),
    2,
  );
});
