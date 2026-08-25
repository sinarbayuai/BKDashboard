import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "bk21.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS cost (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    no_akun INTEGER,
    tanggal TEXT NOT NULL,
    outlet TEXT NOT NULL,
    expense TEXT NOT NULL,
    deskripsi TEXT,
    total REAL NOT NULL,
    source_file TEXT NOT NULL,
    row_idx INTEGER NOT NULL,
    UNIQUE(source_file, row_idx)
);
CREATE INDEX IF NOT EXISTS idx_cost_tanggal ON cost(tanggal);
CREATE INDEX IF NOT EXISTS idx_cost_expense ON cost(expense);

CREATE TABLE IF NOT EXISTS revenue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tanggal TEXT NOT NULL,
    outlet TEXT NOT NULL,
    total_service REAL NOT NULL DEFAULT 0,
    total_sales REAL NOT NULL DEFAULT 0,
    total_omzet REAL NOT NULL DEFAULT 0,
    source_file TEXT NOT NULL,
    row_idx INTEGER NOT NULL,
    UNIQUE(source_file, row_idx)
);
CREATE INDEX IF NOT EXISTS idx_revenue_tanggal ON revenue(tanggal);
CREATE TABLE IF NOT EXISTS summary (
    source_file TEXT PRIMARY KEY,
    outlet TEXT NOT NULL,
    period TEXT NOT NULL,
    total_service REAL NOT NULL DEFAULT 0,
    total_sales REAL NOT NULL DEFAULT 0,
    total_omzet REAL NOT NULL DEFAULT 0,
    expenses REAL NOT NULL DEFAULT 0,
    nett_profit REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_summary_period ON summary(period);
"""


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with connect() as conn:
        conn.executescript(SCHEMA)
