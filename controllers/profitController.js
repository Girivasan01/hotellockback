const db = require("../db/database");

const buildBillingFilterClause = (filter) => {
  switch (filter) {
    case "today":
      return "AND DATE(created_at) = CURDATE()";
    case "week":
      return "AND DATE(created_at) BETWEEN DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND CURDATE()";
    case "month":
      return "AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())";
    default:
      return "";
  }
};

exports.getProfit = (req, res) => {
  try {
    const { filter = "all" } = req.query;
    const orgId = req.orgId;
    const dateFilter = buildBillingFilterClause(filter);

    const query = `
      SELECT 
        COALESCE(SUM(total_amount), 0) AS profit
      FROM billings
      WHERE org_id = ?
      AND payment_status = 'paid'
      ${dateFilter}
    `;

    db.get(query, [orgId], (err, row) => {
      if (err) {
        console.error("Profit query error:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to fetch profit",
        });
      }

      return res.json({
        success: true,
        profit: Number(row.profit || 0),
        filter,
      });
    });
  } catch (error) {
    console.error("Profit controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
