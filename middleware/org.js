const { requireOrgId } = require("../utils/orgScope");

/** Requires authenticated user with org_id (set after Studio Admin creates the org). */
function requireOrg(req, res, next) {
  const orgId = requireOrgId(req, res);
  if (orgId == null) return;
  req.orgId = orgId;
  next();
}

module.exports = { requireOrg };
