const { spawn } = require("child_process");
const path = require("path");

function runNodeScript(scriptName) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn(process.execPath, [scriptPath], {
      cwd: __dirname,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => {
      const text = d.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (d) => {
      const text = d.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr, scriptName });
    });
  });
}

function extractSummary(stdout, marker) {
  const line = stdout
    .split(/\r?\n/)
    .find((l) => l.startsWith(marker));
  if (!line) return null;
  const payload = line.slice(marker.length);
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function main() {
  const tests = [
    {
      script: "category-upload-stress-test.js",
      marker: "CATEGORY_STRESS_TEST_SUMMARY=",
      name: "Category Stress V1",
    },
    {
      script: "category-upload-stress-test-v2.js",
      marker: "CATEGORY_STRESS_TEST_V2_SUMMARY=",
      name: "Category Stress V2",
    },
  ];

  const results = [];

  for (const test of tests) {
    console.log(`\nRUNNING: ${test.name} (${test.script})`);
    const r = await runNodeScript(test.script);
    const summary = extractSummary(r.stdout, test.marker);

    const pass =
      r.code === 0 &&
      summary &&
      (summary.pass === true || summary.pass === "true");

    results.push({
      name: test.name,
      script: test.script,
      exitCode: r.code,
      pass,
      summary,
    });
  }

  const overallPass = results.every((r) => r.pass);

  const output = {
    timestamp: new Date().toISOString(),
    overallPass,
    tests: results.map((r) => ({
      name: r.name,
      script: r.script,
      pass: r.pass,
      exitCode: r.exitCode,
      importCounts: r.summary?.importCounts || null,
      executionTime: r.summary?.executionTime || r.summary?.uploadExecutionTime || null,
    })),
  };

  console.log("\nUPLOAD_VALIDATION_GATE_SUMMARY=" + JSON.stringify(output));

  if (!overallPass) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("UPLOAD_VALIDATION_GATE_ERROR=" + err.message);
  process.exit(1);
});
