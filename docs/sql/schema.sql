-- LedgerFlow demo schema.
-- Target DBMS: PostgreSQL-compatible SQL.

CREATE TABLE stakeholders (
    id              BIGSERIAL PRIMARY KEY,
    role_name       VARCHAR(80) NOT NULL,
    goal            TEXT NOT NULL
);

CREATE TABLE suppliers (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(180) NOT NULL,
    inn             VARCHAR(12) NOT NULL UNIQUE
);

CREATE TABLE contracts (
    id              BIGSERIAL PRIMARY KEY,
    supplier_id     BIGINT NOT NULL REFERENCES suppliers(id),
    contract_number VARCHAR(40) NOT NULL UNIQUE,
    cost_center     VARCHAR(80) NOT NULL,
    active_from     DATE NOT NULL,
    active_to       DATE
);

CREATE TYPE invoice_status AS ENUM ('draft', 'needs_review', 'approved', 'paid');
CREATE TYPE invoice_risk AS ENUM ('low', 'medium', 'high');

CREATE TABLE invoices (
    id              VARCHAR(24) PRIMARY KEY,
    supplier_id     BIGINT NOT NULL REFERENCES suppliers(id),
    contract_id     BIGINT NOT NULL REFERENCES contracts(id),
    amount          NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    currency        CHAR(3) NOT NULL DEFAULT 'RUB',
    due_date        DATE NOT NULL,
    status          invoice_status NOT NULL DEFAULT 'draft',
    risk            invoice_risk NOT NULL DEFAULT 'low',
    owner_name      VARCHAR(120) NOT NULL,
    matching_score  INTEGER NOT NULL CHECK (matching_score BETWEEN 0 AND 100),
    api_source      VARCHAR(80) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoice_comments (
    id              BIGSERIAL PRIMARY KEY,
    invoice_id      VARCHAR(24) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    author_name     VARCHAR(120) NOT NULL,
    comment_text    TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reconciliations (
    id              VARCHAR(24) PRIMARY KEY,
    area            VARCHAR(120) NOT NULL,
    system_balance  NUMERIC(14, 2) NOT NULL,
    bank_balance    NUMERIC(14, 2) NOT NULL,
    variance        NUMERIC(14, 2) GENERATED ALWAYS AS (system_balance - bank_balance) STORED,
    status          VARCHAR(40) NOT NULL,
    last_sync_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE requirements (
    id                  VARCHAR(16) PRIMARY KEY,
    requirement_type    VARCHAR(40) NOT NULL,
    priority            VARCHAR(16) NOT NULL,
    status              VARCHAR(32) NOT NULL,
    title               TEXT NOT NULL
);

CREATE TABLE requirement_acceptance_criteria (
    id                  BIGSERIAL PRIMARY KEY,
    requirement_id      VARCHAR(16) NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    criterion_text      TEXT NOT NULL
);

CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_risk ON invoices(risk);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_reconciliations_status ON reconciliations(status);

