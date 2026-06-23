/**
 * Reads enterprise subscription/storage from the local hotel DB first
 * (synced by Vault Sync), then falls back to cross-database query on
 * STUDIO_DB_NAME when the vault database is reachable on the same MySQL host.
 */

function getStudioDbName() {
  return process.env.STUDIO_DB_NAME || "studio_admin";
}

async function queryLocalEnterprise(db, orgId) {
  try {
    const [rows] = await db.query(
      `SELECT isActive, expiry_date, storage_limit_gb AS storageLimitGb,
              storage_used_bytes AS storageUsedBytes
       FROM enterprises WHERE id = ? LIMIT 1`,
      [orgId],
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function queryVaultEnterprise(db, orgId) {
  const studioDbName = getStudioDbName();
  try {
    const [rows] = await db.query(
      `SELECT is_active AS isActive, expiry_date
       FROM \`${studioDbName}\`.enterprises
       WHERE id = ? LIMIT 1`,
      [orgId],
    );
    if (rows[0]) return rows[0];
  } catch {
    /* column naming fallback */
  }

  try {
    const [rows] = await db.query(
      `SELECT isActive, expiry_date
       FROM \`${studioDbName}\`.enterprises
       WHERE id = ? LIMIT 1`,
      [orgId],
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function loadEnterpriseRecord(db, orgId) {
  if (!orgId) return null;
  return (await queryLocalEnterprise(db, orgId)) || (await queryVaultEnterprise(db, orgId));
}

async function loadStorageUsage(db, orgId) {
  if (!orgId) {
    return { usedBytes: 0, usedGb: 0, limitGb: 0, remainingGb: 0, source: "none" };
  }

  const local = await queryLocalEnterprise(db, orgId);
  if (local && Number(local.storageLimitGb || 0) > 0) {
    const usedBytes = Number(local.storageUsedBytes || 0);
    const usedGb = usedBytes / 1024 ** 3;
    const limitGb = Number(local.storageLimitGb || 0);
    return {
      usedBytes,
      usedGb,
      limitGb,
      remainingGb: Math.max(0, limitGb - usedGb),
      source: "local",
    };
  }

  const studioDbName = getStudioDbName();
  try {
    const [rows] = await db.query(
      `SELECT a.storage_limit_gb AS storageLimitGb,
              COALESCE(SUM(CASE WHEN b.status = 'SUCCESS' THEN b.size_bytes ELSE 0 END), 0) AS usedBytes
       FROM \`${studioDbName}\`.applications a
       LEFT JOIN \`${studioDbName}\`.backups b ON b.application_id = a.id
       WHERE a.enterprise_id = ? AND a.is_active = 1
       GROUP BY a.id
       LIMIT 1`,
      [orgId],
    );
    const row = rows[0];
    if (row) {
      const usedBytes = Number(row.usedBytes || 0);
      const usedGb = usedBytes / 1024 ** 3;
      const limitGb = Number(row.storageLimitGb || 0);
      return {
        usedBytes,
        usedGb,
        limitGb,
        remainingGb: Math.max(0, limitGb - usedGb),
        source: "vault",
      };
    }
  } catch {
    /* vault DB not reachable — use local cache if any columns exist */
  }

  if (local) {
    const usedBytes = Number(local.storageUsedBytes || 0);
    const usedGb = usedBytes / 1024 ** 3;
    const limitGb = Number(local.storageLimitGb || 0);
    return {
      usedBytes,
      usedGb,
      limitGb,
      remainingGb: Math.max(0, limitGb - usedGb),
      source: "local",
    };
  }

  return { usedBytes: 0, usedGb: 0, limitGb: 0, remainingGb: 0, source: "none" };
}

module.exports = {
  getStudioDbName,
  loadEnterpriseRecord,
  loadStorageUsage,
};
