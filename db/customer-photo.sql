-- Run in phpMyAdmin if customer photo upload fails with "unknown column photo"
-- Safe to run more than once (ignore "Duplicate column" errors)

ALTER TABLE customers ADD COLUMN photo VARCHAR(1024) NULL;
ALTER TABLE customers ADD COLUMN org_id INT NULL;

CREATE INDEX idx_customers_org ON customers(org_id);
