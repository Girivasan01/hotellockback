const db = require("../db/database");

const buildExpenseFilterClause = (filter) => {
  switch (filter) {
    case "today":
      return "WHERE expense_date = CURDATE()";
    case "week":
      return "WHERE expense_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND CURDATE()";
    case "month":
      return "WHERE YEAR(expense_date) = YEAR(CURDATE()) AND MONTH(expense_date) = MONTH(CURDATE())";
    default:
      return "";
  }
};

/* ================= ADD EXPENSE ================= */
exports.createExpense = (req, res) => {
  const { title, amount, category, expense_date } = req.body;

  if (!title || !amount || !expense_date) {
    return res.status(400).json({ message: "Required fields missing" });
  }

  db.run(
  `INSERT INTO expenses (title, amount, category, expense_date, created_at)
   VALUES (?, ?, ?, ?, NOW())`,
  [title, amount, category || null, expense_date],
  function (err) {
    if (err) {
      console.error("DB ERROR:", err);
      return res.status(500).json({ message: "Failed to add expense" });
    }

    res.status(201).json({
      id: this.lastID,
      title,
      amount,
      category,
      expense_date,
    });
  }
);

};



exports.getExpenses = (req, res) => {
  const { filter = "all" } = req.query;

  let query = `SELECT * FROM expenses`;
  let params = [];

  query += ` ${buildExpenseFilterClause(filter)}`;

  query += ` ORDER BY expense_date DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error("DB ERROR:", err);
      return res.status(500).json({ message: "Failed to fetch expenses" });
    }
    res.json(rows);
  });
};


exports.deleteExpense = (req, res) => {
  const { id } = req.params;

  db.run(
    `DELETE FROM expenses WHERE id = ?`,
    [id],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Delete failed" });
      }
      res.json({ message: "Expense deleted" });
    }
  );
};
