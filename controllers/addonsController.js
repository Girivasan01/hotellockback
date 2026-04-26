const db = require("../db/database");

// Get all add-ons
exports.getAddOns = (req, res) => {
  db.all("SELECT * FROM add_ons ORDER BY name", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// Create new add-on
exports.createAddOn = (req, res) => {
  const { name, price } = req.body;
  if (!name || price == null) return res.status(400).json({ error: "Name and price are required" });

  db.run("INSERT INTO add_ons (name, price) VALUES (?, ?)", [name, price], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, price });
  });
};

// Delete add-on
exports.deleteAddOn = (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM add_ons WHERE id=?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: true });
  });
};

// Update add-on
exports.updateAddOn = (req, res) => {
  const { id } = req.params;
  const { name, price } = req.body;
  db.run(
    "UPDATE add_ons SET name=?, price=? WHERE id=?",
    [name, price, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Add-on not found" });
      res.json({ updated: true });
    }
  );
};
