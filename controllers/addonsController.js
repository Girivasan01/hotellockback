const db = require("../db/database");

exports.getAddOns = (req, res) => {
  db.all(
    "SELECT * FROM add_ons WHERE org_id = ? ORDER BY name",
    [req.orgId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    },
  );
};

exports.createAddOn = (req, res) => {
  const { name, price } = req.body;
  if (!name || price == null)
    return res.status(400).json({ error: "Name and price are required" });

  db.run(
    "INSERT INTO add_ons (name, price, org_id) VALUES (?, ?, ?)",
    [name, price, req.orgId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, name, price });
    },
  );
};

exports.deleteAddOn = (req, res) => {
  const { id } = req.params;
  db.run(
    "DELETE FROM add_ons WHERE id=? AND org_id = ?",
    [id, req.orgId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res.status(404).json({ error: "Add-on not found" });
      res.json({ deleted: true });
    },
  );
};

exports.updateAddOn = (req, res) => {
  const { id } = req.params;
  const { name, price } = req.body;
  db.run(
    "UPDATE add_ons SET name=?, price=? WHERE id=? AND org_id = ?",
    [name, price, id, req.orgId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res.status(404).json({ error: "Add-on not found" });
      res.json({ updated: true });
    },
  );
};
