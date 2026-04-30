const state = {
  summary: null,
  invoices: [],
  reconciliations: [],
  requirements: [],
  stakeholders: [],
  activity: [],
  selectedInvoiceId: null,
  filters: {
    status: "all",
    risk: "all"
  }
};

const labels = {
  draft: "Черновик",
  needs_review: "На проверке",
  approved: "Согласован",
  paid: "Оплачен",
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
  functional: "Функциональное",
  "non-functional": "Нефункциональное",
  must: "Обязательно",
  should: "Желательно",
  could: "Можно позже",
  in_review: "На согласовании",
  matched: "Сверено",
  attention: "Требует внимания"
};

const endpoints = [
  ["GET", "/api/summary", "Итоговые показатели и индикаторы риска"],
  ["GET", "/api/invoices?status=needs_review", "Реестр счетов с фильтрацией"],
  ["GET", "/api/invoices/{id}", "Карточка счета с комментариями"],
  ["PATCH", "/api/invoices/{id}/status", "Изменение статуса с аудиторским комментарием"],
  ["GET", "/api/reconciliations", "Зоны финансовой сверки"],
  ["GET", "/api/requirements", "Функциональные и нефункциональные требования"]
];

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0
});

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value) {
  return moneyFormatter.format(value);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message || "API request failed");
  }

  return payload;
}

async function loadData() {
  const [summary, invoices, reconciliations, requirements, stakeholders, activity] = await Promise.all([
    api("/api/summary"),
    api("/api/invoices"),
    api("/api/reconciliations"),
    api("/api/requirements"),
    api("/api/stakeholders"),
    api("/api/activity")
  ]);

  state.summary = summary;
  state.invoices = invoices.items;
  state.reconciliations = reconciliations.items;
  state.requirements = requirements.items;
  state.stakeholders = stakeholders.items;
  state.activity = activity.items;
  state.selectedInvoiceId = state.invoices[0]?.id || null;
}

function renderMetrics() {
  const summary = state.summary;
  const metrics = [
    ["Открытые счета", summary.openInvoices, `${formatMoney(summary.totalOpenAmount)} к оплате`],
    ["На контроле", summary.atRiskCount, "риск или ручная проверка"],
    ["Средний match", `${summary.averageMatchingScore}%`, "сверка документов"],
    ["Отклонение", formatMoney(summary.reconciliationVariance), "по зонам сверки"]
  ];

  qs("#metricGrid").innerHTML = metrics
    .map(
      ([label, value, hint]) => `
        <article class="metric">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <small>${escapeHtml(hint)}</small>
        </article>
      `
    )
    .join("");
}

function getFilteredInvoices() {
  return state.invoices.filter((invoice) => {
    const statusMatches = state.filters.status === "all" || invoice.status === state.filters.status;
    const riskMatches = state.filters.risk === "all" || invoice.risk === state.filters.risk;
    return statusMatches && riskMatches;
  });
}

function statusPill(status) {
  return `<span class="status-pill status-${status}">${labels[status] || status}</span>`;
}

function riskPill(risk) {
  return `<span class="risk-pill risk-${risk}">${labels[risk] || risk}</span>`;
}

function dictionaryLabel(value) {
  return labels[value] || value;
}

function scoreCell(score) {
  return `
    <div class="score">
      <strong>${score}%</strong>
      <span class="score-track"><span class="score-fill" style="width: ${score}%"></span></span>
    </div>
  `;
}

function renderInvoiceTable() {
  const rows = getFilteredInvoices();

  if (!rows.length) {
    qs("#invoiceTable").innerHTML = `
      <tr>
        <td colspan="7" class="loading">Нет счетов по выбранным фильтрам</td>
      </tr>
    `;
    return;
  }

  if (!rows.some((invoice) => invoice.id === state.selectedInvoiceId)) {
    state.selectedInvoiceId = rows[0].id;
  }

  qs("#invoiceTable").innerHTML = rows
    .map(
      (invoice) => `
        <tr class="${invoice.id === state.selectedInvoiceId ? "is-selected" : ""}" data-invoice-id="${escapeHtml(invoice.id)}">
          <td><strong>${escapeHtml(invoice.id)}</strong><br>${riskPill(invoice.risk)}</td>
          <td>${escapeHtml(invoice.supplier)}<br><span class="muted">${escapeHtml(invoice.inn)}</span></td>
          <td>${escapeHtml(invoice.costCenter)}</td>
          <td>${formatMoney(invoice.amount)}</td>
          <td>${escapeHtml(invoice.dueDate)}</td>
          <td>${statusPill(invoice.status)}</td>
          <td>${scoreCell(invoice.matchingScore)}</td>
        </tr>
      `
    )
    .join("");

  qsa("[data-invoice-id]").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedInvoiceId = row.dataset.invoiceId;
      renderInvoiceTable();
      renderInvoiceDetail();
    });
  });
}

function renderInvoiceDetail() {
  const invoice = state.invoices.find((item) => item.id === state.selectedInvoiceId);

  if (!invoice) {
    qs("#invoiceDetail").innerHTML = `<p class="detail-empty">Выберите счет в реестре</p>`;
    return;
  }

  qs("#invoiceDetail").innerHTML = `
    <div class="detail-header">
      <div>
        <p class="section-kicker">Карточка счета</p>
        <h2>${escapeHtml(invoice.id)}</h2>
      </div>
      ${statusPill(invoice.status)}
    </div>

    <div class="detail-list">
      <div class="detail-row"><span>Поставщик</span><strong>${escapeHtml(invoice.supplier)}</strong></div>
      <div class="detail-row"><span>Договор</span><strong>${escapeHtml(invoice.contract)}</strong></div>
      <div class="detail-row"><span>Источник</span><strong>${escapeHtml(invoice.apiSource)}</strong></div>
      <div class="detail-row"><span>Владелец</span><strong>${escapeHtml(invoice.owner)}</strong></div>
      <div class="detail-row"><span>Сумма</span><strong>${formatMoney(invoice.amount)}</strong></div>
      <div class="detail-row"><span>Риск</span><strong>${riskPill(invoice.risk)}</strong></div>
    </div>

    <h3>Комментарии</h3>
    <ul class="comments-list">
      ${invoice.comments.map((comment) => `<li>${escapeHtml(comment)}</li>`).join("")}
    </ul>

    <form class="status-form" id="statusForm">
      <label>
        Новый статус
        <select name="status">
          ${["draft", "needs_review", "approved", "paid"]
            .map((status) => `<option value="${status}" ${status === invoice.status ? "selected" : ""}>${labels[status]}</option>`)
            .join("")}
        </select>
      </label>
      <label>
        Комментарий
        <input name="comment" maxlength="140" placeholder="Например: согласовано с заказчиком">
      </label>
      <button class="primary-button" type="submit">Сохранить</button>
    </form>
  `;

  qs("#statusForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await updateInvoiceStatus(invoice.id, {
      status: formData.get("status"),
      comment: formData.get("comment")
    });
  });
}

async function updateInvoiceStatus(invoiceId, payload) {
  const updated = await api(`/api/invoices/${invoiceId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

  state.invoices = state.invoices.map((invoice) => (invoice.id === invoiceId ? updated : invoice));
  state.summary = await api("/api/summary");
  renderDashboard();
}

function renderReconciliations() {
  qs("#reconciliationList").innerHTML = state.reconciliations
    .map((item) => {
      const clean = item.variance === 0;
      return `
        <article class="reconciliation-item">
          <div class="reconciliation-top">
            <strong>${escapeHtml(item.area)}</strong>
            <span class="variance ${clean ? "is-clean" : "is-alert"}">${formatMoney(item.variance)}</span>
          </div>
          <span>${escapeHtml(item.id)} | ${escapeHtml(dictionaryLabel(item.status))} | ${escapeHtml(item.lastSync)}</span>
        </article>
      `;
    })
    .join("");
}

function renderActivity() {
  qs("#activityList").innerHTML = state.activity
    .map(
      (item) => `
        <article class="activity-item">
          <time>${escapeHtml(item.time)} | ${escapeHtml(item.actor)}</time>
          <strong>${escapeHtml(item.event)}</strong>
        </article>
      `
    )
    .join("");
}

function renderStakeholders() {
  qs("#stakeholdersList").innerHTML = state.stakeholders
    .map(
      (item) => `
        <article class="stakeholder">
          <strong>${escapeHtml(item.role)}</strong>
          <span>${escapeHtml(item.goal)}</span>
        </article>
      `
    )
    .join("");
}

function renderRequirements() {
  qs("#requirementsGrid").innerHTML = state.requirements
    .map(
      (item) => `
        <article class="requirement">
          <div class="requirement-head">
            <div>
              <p class="section-kicker">${escapeHtml(item.id)}</p>
              <h3>${escapeHtml(item.title)}</h3>
            </div>
            <span class="mini-tag">${escapeHtml(dictionaryLabel(item.priority))}</span>
          </div>
          <div class="requirement-meta">
            <span class="mini-tag">${escapeHtml(dictionaryLabel(item.type))}</span>
            <span class="mini-tag">${escapeHtml(dictionaryLabel(item.status))}</span>
          </div>
          <ul>
            ${item.acceptanceCriteria.map((criterion) => `<li>${escapeHtml(criterion)}</li>`).join("")}
          </ul>
        </article>
      `
    )
    .join("");
}

function renderIntegrations() {
  qs("#endpointList").innerHTML = endpoints
    .map(
      ([method, route, description]) => `
        <article class="endpoint-item">
          <span class="method">${method}</span>
          <div>
            <strong>${escapeHtml(route)}</strong>
            <p>${escapeHtml(description)}</p>
          </div>
        </article>
      `
    )
    .join("");

  qs("#apiSample").textContent = JSON.stringify(
    {
      id: "INV-2026-0418",
      supplier: "Альфа Логистика",
      amount: 184500,
      currency: "RUB",
      status: "needs_review",
      risk: "high",
      matchingScore: 62,
      comments: ["Сумма отличается от акта поставки на 14500 RUB."]
    },
    null,
    2
  );
}

function renderDashboard() {
  renderMetrics();
  renderInvoiceTable();
  renderInvoiceDetail();
  renderReconciliations();
  renderActivity();
}

function bindTabs() {
  qsa("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      qsa("[data-tab]").forEach((item) => item.classList.toggle("is-active", item === button));
      qsa("[data-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === button.dataset.tab));
    });
  });
}

function bindFilters() {
  qs("#statusFilter").addEventListener("change", (event) => {
    state.filters.status = event.target.value;
    renderInvoiceTable();
    renderInvoiceDetail();
  });

  qs("#riskFilter").addEventListener("change", (event) => {
    state.filters.risk = event.target.value;
    renderInvoiceTable();
    renderInvoiceDetail();
  });
}

async function bootstrap() {
  bindTabs();
  bindFilters();

  try {
    await loadData();
    renderStakeholders();
    renderDashboard();
    renderRequirements();
    renderIntegrations();
  } catch (error) {
    qs(".main").innerHTML = `<div class="error">Ошибка загрузки данных: ${escapeHtml(error.message)}</div>`;
  }
}

bootstrap();
