const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DOCS_DIR = path.join(ROOT_DIR, "docs");
const DEFAULT_DATA_FILE = path.join(ROOT_DIR, "data", "finance-demo.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".yaml": "application/yaml; charset=utf-8",
  ".yml": "application/yaml; charset=utf-8",
  ".sql": "application/sql; charset=utf-8"
};

const ALLOWED_STATUSES = new Set(["draft", "needs_review", "approved", "paid"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadInitialState(dataFile = DEFAULT_DATA_FILE) {
  return clone(readJson(dataFile));
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": MIME_TYPES[".json"],
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendError(res, statusCode, message, details = null) {
  sendJson(res, statusCode, {
    error: {
      message,
      details
    }
  });
}

function sendFile(res, filePath, baseDir) {
  const resolved = path.resolve(filePath);
  const safeBase = path.resolve(baseDir);

  if (!resolved.startsWith(safeBase)) {
    sendError(res, 403, "Path is outside the allowed directory.");
    return;
  }

  fs.readFile(resolved, (error, content) => {
    if (error) {
      sendError(res, error.code === "ENOENT" ? 404 : 500, "File not found.");
      return;
    }

    const extension = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Cache-Control": "public, max-age=120"
    });
    res.end(content);
  });
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Request body must be valid JSON."));
      }
    });

    req.on("error", reject);
  });
}

function calculateSummary(state) {
  const openInvoices = state.invoices.filter((invoice) => invoice.status !== "paid");
  const totalOpenAmount = openInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const atRiskCount = state.invoices.filter((invoice) => invoice.risk === "high" || invoice.status === "needs_review").length;
  const averageMatchingScore = Math.round(
    state.invoices.reduce((sum, invoice) => sum + invoice.matchingScore, 0) / state.invoices.length
  );
  const variance = state.reconciliations.reduce((sum, item) => sum + Math.abs(item.variance), 0);
  const approvedRequirements = state.requirements.filter((item) => item.status === "approved").length;

  return {
    openInvoices: openInvoices.length,
    totalOpenAmount,
    atRiskCount,
    averageMatchingScore,
    reconciliationVariance: variance,
    approvedRequirements,
    totalRequirements: state.requirements.length
  };
}

function filterInvoices(invoices, searchParams) {
  const status = searchParams.get("status");
  const risk = searchParams.get("risk");

  return invoices.filter((invoice) => {
    const statusMatches = !status || status === "all" || invoice.status === status;
    const riskMatches = !risk || risk === "all" || invoice.risk === risk;
    return statusMatches && riskMatches;
  });
}

function updateInvoiceStatus(state, invoiceId, payload) {
  const invoice = state.invoices.find((item) => item.id === invoiceId);

  if (!invoice) {
    return { statusCode: 404, body: { message: "Invoice not found." } };
  }

  if (!ALLOWED_STATUSES.has(payload.status)) {
    return {
      statusCode: 422,
      body: {
        message: "Unsupported invoice status.",
        allowedStatuses: Array.from(ALLOWED_STATUSES)
      }
    };
  }

  invoice.status = payload.status;
  invoice.comments.push(payload.comment || `Status changed to ${payload.status}.`);

  return {
    statusCode: 200,
    body: invoice
  };
}

async function handleApi(req, res, url, state) {
  const segments = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      status: "ok",
      service: "ledgerflow-api"
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/summary") {
    sendJson(res, 200, calculateSummary(state));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/invoices") {
    sendJson(res, 200, {
      items: filterInvoices(state.invoices, url.searchParams)
    });
    return;
  }

  if (req.method === "GET" && segments[0] === "api" && segments[1] === "invoices" && segments[2]) {
    const invoice = state.invoices.find((item) => item.id === segments[2]);
    if (!invoice) {
      sendError(res, 404, "Invoice not found.");
      return;
    }
    sendJson(res, 200, invoice);
    return;
  }

  if (req.method === "PATCH" && segments[0] === "api" && segments[1] === "invoices" && segments[2] && segments[3] === "status") {
    try {
      const payload = await collectBody(req);
      const result = updateInvoiceStatus(state, segments[2], payload);
      if (result.statusCode >= 400) {
        sendError(res, result.statusCode, result.body.message, result.body);
        return;
      }
      sendJson(res, result.statusCode, result.body);
    } catch (error) {
      sendError(res, 400, error.message);
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/reconciliations") {
    sendJson(res, 200, {
      items: state.reconciliations
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/requirements") {
    sendJson(res, 200, {
      items: state.requirements
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/stakeholders") {
    sendJson(res, 200, {
      items: state.stakeholders
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/activity") {
    sendJson(res, 200, {
      items: state.activity
    });
    return;
  }

  sendError(res, 404, "API route not found.");
}

function createServer(options = {}) {
  const state = options.state || loadInitialState(options.dataFile);

  return http.createServer((req, res) => {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url, `http://${host}`);

    if (url.pathname.startsWith("/api/")) {
      handleApi(req, res, url, state);
      return;
    }

    if (url.pathname.startsWith("/docs/")) {
      const relativeDocPath = decodeURIComponent(url.pathname.replace(/^\/docs\//, ""));
      sendFile(res, path.join(DOCS_DIR, relativeDocPath), DOCS_DIR);
      return;
    }

    const relativePath = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    sendFile(res, path.join(PUBLIC_DIR, relativePath), PUBLIC_DIR);
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 5173);
  const server = createServer();

  server.listen(port, () => {
    console.log(`LedgerFlow is running at http://localhost:${port}`);
  });
}

module.exports = {
  createServer,
  calculateSummary,
  updateInvoiceStatus,
  loadInitialState
};
