const assert = require("node:assert/strict");
const { createServer } = require("../server/index");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const body = await response.json();
  return { response, body };
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

(async () => {
  await runTest("GET /api/summary returns dashboard metrics", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const { response, body } = await request(baseUrl, "/api/summary");

      assert.equal(response.status, 200);
      assert.equal(typeof body.openInvoices, "number");
      assert.equal(typeof body.totalOpenAmount, "number");
      assert.equal(typeof body.averageMatchingScore, "number");
      assert.ok(body.openInvoices > 0);
    } finally {
      server.close();
    }
  });

  await runTest("GET /api/invoices supports status filtering", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const { response, body } = await request(baseUrl, "/api/invoices?status=needs_review");

      assert.equal(response.status, 200);
      assert.ok(body.items.length > 0);
      assert.ok(body.items.every((invoice) => invoice.status === "needs_review"));
    } finally {
      server.close();
    }
  });

  await runTest("PATCH /api/invoices/:id/status validates and updates status", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const payload = {
        status: "approved",
        comment: "Approved in contract test."
      };
      const { response, body } = await request(baseUrl, "/api/invoices/INV-2026-0418/status", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });

      assert.equal(response.status, 200);
      assert.equal(body.status, "approved");
      assert.ok(body.comments.includes(payload.comment));
    } finally {
      server.close();
    }
  });

  await runTest("PATCH /api/invoices/:id/status rejects unsupported status", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const { response, body } = await request(baseUrl, "/api/invoices/INV-2026-0418/status", {
        method: "PATCH",
        body: JSON.stringify({ status: "archived" })
      });

      assert.equal(response.status, 422);
      assert.equal(body.error.message, "Unsupported invoice status.");
      assert.ok(body.error.details.allowedStatuses.includes("approved"));
    } finally {
      server.close();
    }
  });
})();
