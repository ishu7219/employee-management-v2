const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL connection configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'Ishu@123',
  database: 'employee',
  port: 3306
};

// Helper for queries
async function query(sql, params) {
  const conn = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await conn.execute(sql, params);
    return rows;
  } finally {
    await conn.end();
  }
}

// Get all employees
app.get('/api/users', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM employee ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error('MySQL Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add employee (with unique username check)
app.post('/api/users', async (req, res) => {
  const { username, role, email, leaves } = req.body;

  if (!username || !role || !email)
    return res.status(400).json({ error: 'Missing fields' });

  try {
    // ✅ Check if username already exists
    const existing = await query('SELECT * FROM employee WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username already exists' }); // Conflict error
    }

    // If unique → insert new employee
    const result = await query(
      'INSERT INTO employee (username, role, email, leaves) VALUES (?, ?, ?, ?)',
      [username, role, email, leaves || 0]
    );

    const inserted = await query('SELECT * FROM employee WHERE id = ?', [result.insertId]);
    res.status(201).json(inserted[0]);
  } catch (err) {
    console.error('MySQL Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update employee
app.put('/api/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { username, role, email, leaves } = req.body;

  try {
    // ✅ Prevent updating to an existing username
    const existing = await query(
      'SELECT * FROM employee WHERE username = ? AND id != ?',
      [username, id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    await query(
      'UPDATE employee SET username = ?, role = ?, email = ?, leaves = ? WHERE id = ?',
      [username, role, email, leaves || 0, id]
    );

    const updated = await query('SELECT * FROM employee WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('MySQL Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete employee
app.delete('/api/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await query('DELETE FROM employee WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('MySQL Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all leaves (including employee name)
app.get('/api/leaves', async (req, res) => {
  try {
    const rows = await query(
      `SELECT leaves.*, employee.username AS employee_name
       FROM leaves
       JOIN employee ON leaves.employee_id = employee.id
       ORDER BY leaves.id`
    );
    res.json(rows);
  } catch (err) {
    console.error('MySQL Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add a new leave request
app.post('/api/leaves', async (req, res) => {
  const { employee_id, leave_type, date_from, date_to, days, reason, leave_type_offer } = req.body;
  try {
    await query(
      `INSERT INTO leaves (employee_id, leave_type, date_from, date_to, days, reason, leave_type_offer, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [employee_id, leave_type, date_from, date_to, days, reason, leave_type_offer]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('MySQL Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Approve/Reject leave
app.put('/api/leaves/:id', async (req, res) => {
  const { status } = req.body;
  try {
    await query('UPDATE leaves SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('MySQL Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.send('Server is running. Use /api/users for data.');
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
