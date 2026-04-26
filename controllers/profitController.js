const db = require("../db/database");

const buildBillingFilterClause = (filter) => {
  switch (filter) {
    case "today":
      return "WHERE DATE(created_at) = CURDATE()";
    case "week":
      return "WHERE DATE(created_at) BETWEEN DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND CURDATE()";
    case "month":
      return "WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())";
    default:
      return "";
  }
};

/**
 * GET PROFIT
 * URL: /api/billings/profit?filter=all|today|week|month
 */
exports.getProfit = (req, res) => {
  try {
    const { filter = "all" } = req.query;
    const whereClause = buildBillingFilterClause(filter);

    // ===== MAIN QUERY =====
    const query = `
      SELECT 
        COALESCE(SUM(total_amount), 0) AS profit
      FROM billings
      ${whereClause}
    `;

    db.get(query, [], (err, row) => {
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
