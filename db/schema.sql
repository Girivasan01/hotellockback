-- ================== ROOMS ==================
CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'Available',
    price_per_night DECIMAL(10,2) NOT NULL,
    capacity INT DEFAULT 2,
    amenities TEXT,
    add_ons TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS room_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO room_categories (name)
SELECT defaults.name
FROM (
    SELECT 'A frame wooden villa' AS name
    UNION ALL
    SELECT 'Premium room'
    UNION ALL
    SELECT 'Superior room'
) AS defaults
WHERE NOT EXISTS (
    SELECT 1 FROM room_categories LIMIT 1
);

INSERT INTO room_categories (name)
SELECT DISTINCT r.category
FROM rooms r
WHERE COALESCE(TRIM(r.category), '') <> ''
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ================== CUSTOMERS ==================
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    id_type VARCHAR(255),
    id_number VARCHAR(255),
    address TEXT,
    vehicle_no VARCHAR(255),
    dob DATE,
    document VARCHAR(1024),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================== BOOKINGS ==================
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id VARCHAR(255) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    room_id INT NOT NULL,
    check_in DATETIME NOT NULL,
    check_out DATETIME,
    status VARCHAR(255) NOT NULL DEFAULT 'Confirmed',
    price DECIMAL(10,2),
    advance_paid DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    add_ons TEXT,
    people_count INT DEFAULT 1,
    created_by_id INT,
    created_by_name VARCHAR(255),
    created_by_role VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================== CATEGORIES ==================
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================== MENU ITEMS ==================
CREATE TABLE IF NOT EXISTS menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock INT DEFAULT 0,
    status VARCHAR(255) NOT NULL DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================== KITCHEN ORDERS ==================
CREATE TABLE IF NOT EXISTS kitchen_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    booking_id VARCHAR(255),
    item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    status VARCHAR(255) NOT NULL DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (item_id) REFERENCES menu_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================== ADD ONS ==================
CREATE TABLE IF NOT EXISTS add_ons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================== BILLINGS ==================
CREATE TABLE IF NOT EXISTS billings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id VARCHAR(255),
    idempotency_key VARCHAR(255) UNIQUE,
    customer_id INT,
    room_id INT,
    check_in DATETIME,
    check_out DATETIME,
    advance_paid DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    gst_number VARCHAR(255),
    is_downloaded TINYINT(1) DEFAULT 0,
    billed_by_id INT,
    billed_by_name VARCHAR(255),
    billed_by_role VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================== INVOICES (Line Items) ==================
CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    billing_id INT NOT NULL,
    type ENUM('room','kitchen','addon','gst','discount') NOT NULL,
    description TEXT NOT NULL,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    gst_rate DECIMAL(10,2) DEFAULT 0,
    gst_amount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (billing_id) REFERENCES billings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================== BOOKING ADD ONS ==================
CREATE TABLE IF NOT EXISTS booking_addons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id VARCHAR(255) NOT NULL,
    addon_id INT,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (addon_id) REFERENCES add_ons(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================== EXPENSES ==================
CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category VARCHAR(255) NOT NULL,
    expense_date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================== GST SETTINGS ==================
CREATE TABLE IF NOT EXISTS gst_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(255) UNIQUE NOT NULL,
    gst_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================== STAFF ==================
CREATE TABLE IF NOT EXISTS staff (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================== USERS ==================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','staff','kitchen') NOT NULL,
    staff_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================== RESTAURANT ORDERS ==================
CREATE TABLE IF NOT EXISTS restaurant_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_number INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity >= 1),
    status ENUM('Pending','Preparing','Served') NOT NULL DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES menu_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================== INDEXES ==================
-- server.js catches ER_DUP_KEYNAME so these are safe on re-runs
CREATE INDEX idx_billings_booking ON billings(booking_id);
CREATE INDEX idx_billings_idempotency ON billings(idempotency_key);
CREATE INDEX idx_invoices_billing ON invoices(billing_id);
CREATE INDEX idx_booking_addons_booking ON booking_addons(booking_id);
