# LedgerFlow

Portfolio project for the **Junior Fullstack Analyst** vacancy at a finance/accounting automation company.

The project demonstrates how a junior analyst can connect business requirements with a working technical prototype:

- business and system requirements;
- user stories and acceptance criteria;
- REST API contract;
- basic SQL data model and analytical queries;
- BPMN/UML documentation;
- small fullstack implementation without external dependencies.

## Scenario

LedgerFlow is an internal tool for outsourced accounting teams. It helps analysts and accountants process incoming invoices, check document matching, monitor reconciliation variance and prepare invoices for payment approval.

## Run

```bash
npm start
```

Open:

```text
http://localhost:5173
```

## Test

```bash
npm test
```

## API

```text
GET    /api/health
GET    /api/summary
GET    /api/invoices
GET    /api/invoices?status=needs_review
GET    /api/invoices/{id}
PATCH  /api/invoices/{id}/status
GET    /api/reconciliations
GET    /api/requirements
GET    /api/stakeholders
GET    /api/activity
```

## Analyst Artifacts

- [Requirements](docs/requirements.md)
- [OpenAPI](docs/openapi.yaml)
- [SQL schema](docs/sql/schema.sql)
- [SQL queries](docs/sql/queries.sql)

## Vacancy Fit

This project maps directly to the vacancy requirements:

- **Business requirements:** finance workflow, stakeholders, process decomposition.
- **System analysis:** REST resources, status transitions, integration boundaries.
- **API:** OpenAPI contract, JSON payloads, route validation.
- **SQL:** schema and queries for invoice control and reconciliation.
- **Documentation:** ТЗ-style requirements, user stories, BPMN/UML diagrams.
- **Fullstack:** Node.js API plus browser interface.

