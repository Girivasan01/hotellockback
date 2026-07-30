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

function buildStorageUsage(usedBytes, limitGb, source) {
  const usedGb = usedBytes / 1024 ** 3;
  return {
    usedBytes,
    usedGb,
    limitGb,
    remainingGb: Math.max(0, limitGb - usedGb),
    source,
  };
}

async function queryVaultStorageUsage(db, orgId) {
  const studioDbName = getStudioDbName();
  try {
    const [rows] = await db.query(
      `SELECT a.storage_limit_gb AS storageLimitGb,
              COALESCE(SUM(CASE WHEN b.status = 'SUCCESS' THEN b.size_bytes ELSE 0 END), 0) AS usedBytes
       FROM \`${studioDbName}\`.applications a
       LEFT JOIN \`${studioDbName}\`.backups b ON b.application_id = a.id
       WHERE a.is_active = 1
         AND (a.enterprise_id = ? OR a.hotel_org_id = ?)
       GROUP BY a.id
       ORDER BY a.created_at ASC
       LIMIT 1`,
      [orgId, orgId],
    );
    const row = rows[0];
    if (!row) return null;

    const usedBytes = Number(row.usedBytes || 0);
    const limitGb = Number(row.storageLimitGb || 0);
    if (limitGb <= 0 && usedBytes <= 0) return null;

    return buildStorageUsage(usedBytes, limitGb, "vault");
  } catch {
    return null;
  }
}

async function loadStorageUsage(db, orgId) {
  if (!orgId) {
    return { usedBytes: 0, usedGb: 0, limitGb: 0, remainingGb: 0, source: "none" };
  }

  const vaultUsage = await queryVaultStorageUsage(db, orgId);
  if (vaultUsage) return vaultUsage;

  const local = await queryLocalEnterprise(db, orgId);
  if (local) {
    const usedBytes = Number(local.storageUsedBytes || 0);
    const limitGb = Number(local.storageLimitGb || 0);
    if (limitGb > 0 || usedBytes > 0) {
      return buildStorageUsage(usedBytes, limitGb, "local");
    }
  }

  return { usedBytes: 0, usedGb: 0, limitGb: 0, remainingGb: 0, source: "none" };
}

module.exports = {
  getStudioDbName,
  loadEnterpriseRecord,
  loadStorageUsage,
};
