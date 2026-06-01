/**
 * Multi-tenant helpers — org_id matches Studio Admin enterprises.id
 */

function getOrgId(req) {
  return req.user?.org_id ?? null;
}

function requireOrgId(req, res) {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.status(403).json({
      message:
        "No organization is linked to this account. Contact your administrator.",
    });
    return null;
  }
  return orgId;
}

/** Append AND org_id = ? to a WHERE clause (or start WHERE). */
function withOrgFilter(baseSql, orgId, alias = null) {
  const col = alias ? `${alias}.org_id` : "org_id";
  const clause = `${col} = ?`;
  const sql = baseSql.trim();
  if (/\bwhere\b/i.test(sql)) {
    return { sql: `${sql} AND ${clause}`, params: [orgId] };
  }
  return { sql: `${sql} WHERE ${clause}`, params: [orgId] };
}

module.exports = { getOrgId, requireOrgId, withOrgFilter };
