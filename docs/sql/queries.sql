-- 1. Open amount by status.
SELECT
    status,
    COUNT(*) AS invoice_count,
    SUM(amount) AS total_amount
FROM invoices
WHERE status <> 'paid'
GROUP BY status
ORDER BY total_amount DESC;

-- 2. Review candidates: low matching score or high risk.
SELECT
    i.id,
    s.name AS supplier,
    i.amount,
    i.due_date,
    i.status,
    i.risk,
    i.matching_score
FROM invoices i
JOIN suppliers s ON s.id = i.supplier_id
WHERE i.matching_score < 75
   OR i.risk = 'high'
ORDER BY i.due_date ASC;

-- 3. Reconciliation rows that require attention.
SELECT
    id,
    area,
    system_balance,
    bank_balance,
    variance,
    last_sync_at
FROM reconciliations
WHERE variance <> 0
ORDER BY ABS(variance) DESC;

-- 4. Invoice audit trail.
SELECT
    i.id AS invoice_id,
    s.name AS supplier,
    c.comment_text,
    c.author_name,
    c.created_at
FROM invoices i
JOIN suppliers s ON s.id = i.supplier_id
JOIN invoice_comments c ON c.invoice_id = i.id
WHERE i.id = :invoice_id
ORDER BY c.created_at ASC;

-- 5. Requirement coverage by status.
SELECT
    status,
    COUNT(*) AS requirement_count
FROM requirements
GROUP BY status
ORDER BY requirement_count DESC;

