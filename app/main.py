from datetime import date, datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .db import connect, init_db
from .ingest import category_for

init_db()

app = FastAPI(title="BK21 Dashboard API")

STATIC_DIR = Path(__file__).resolve().parent / "static"


def _range(from_d: str | None, to_d: str | None) -> tuple[str, str]:
    """Default: semua data. Return (from, to) ISO string."""
    if not from_d or not to_d:
        row = connect().execute(
            "SELECT MIN(tanggal), MAX(tanggal) FROM revenue").fetchone()
        from_d = from_d or row[0]
        to_d = to_d or row[1]
    return str(from_d), str(to_d)


def _prev_range(from_d: str, to_d: str):
    f = date.fromisoformat(from_d)
    t = date.fromisoformat(to_d)
    dur = (t - f).days + 1
    pf = f - timedelta(days=dur)
    pt = f - timedelta(days=1)
    return pf.isoformat(), pt.isoformat()


def _filters(from_d: str, to_d: str, outlet: str | None):
    sql = " WHERE tanggal BETWEEN ? AND ?"
    params: list = [from_d, to_d]
    if outlet:
        sql += " AND outlet = ?"
        params.append(outlet)
    return sql, params


def _totals(table: str, col: str, where: str, params: list) -> float:
    sql = f"SELECT COALESCE(SUM({col}),0) FROM {table}{where}"
    return connect().execute(sql, params).fetchone()[0]


@app.get("/api/meta")
def meta():
    conn = connect()
    outlets = [r[0] for r in conn.execute(
        "SELECT DISTINCT outlet FROM cost UNION SELECT DISTINCT outlet FROM revenue")]
    lo, hi = conn.execute(
        "SELECT MIN(tanggal), MAX(tanggal) FROM revenue").fetchone()
    years = [r[0] for r in conn.execute(
        "SELECT DISTINCT substr(period,1,4) FROM summary ORDER BY period")]
    return {"outlets": sorted(outlets), "min_date": lo, "max_date": hi,
            "periods": years}


def _summary_snapshot(a: str, b: str, outlet: str | None):
    """Agregat sheet Summary bulanan (otoritatif) yang periodenya
    tumpang-tindih rentang [a, b]."""
    conn = connect()
    params: list = [a[:7], b[:7]]
    sql = ("SELECT COALESCE(SUM(total_omzet),0), COALESCE(SUM(expenses),0),"
           " COALESCE(SUM(nett_profit),0), COALESCE(SUM(total_service),0),"
           " COALESCE(SUM(total_sales),0), COUNT(*)"
           " FROM summary WHERE period BETWEEN ? AND ?")
    if outlet:
        sql += " AND outlet = ?"
        params.append(outlet)
    omzet, expense, nett, service, sales, n = conn.execute(sql, params).fetchone()
    margin = (nett / omzet * 100) if omzet else 0.0
    return {"omzet": omzet, "expense": expense, "net_profit": nett,
            "margin_pct": round(margin, 2),
            "avg_net_profit": nett / n if n else 0.0,
            "service": service, "sales": sales}


def _prev_months(f: str, t: str) -> tuple[str, str]:
    """N bulan kalender sebelum bulan awal rentang."""
    y, m = int(f[:4]), int(f[5:7])
    n = (int(t[:4]) - y) * 12 + (int(t[5:7]) - m) + 1
    ey, em = (y - 1, 12) if m == 1 else (y, m - 1)
    sy, sm = (ey - (n - 1) // 12, em - (n - 1) % 12)
    if sm <= 0:
        sy, sm = sy - 1, sm + 12
    return f"{sy:04d}-{sm:02d}", f"{ey:04d}-{em:02d}"


@app.get("/api/kpi")
def kpi(from_d: str | None = Query(None, alias="from"),
        to_d: str | None = Query(None, alias="to"),
        outlet: str | None = None):
    f, t = _range(from_d, to_d)
    pf, pt = _prev_months(f, t)

    cur = _summary_snapshot(f, t, outlet)
    prev = _summary_snapshot(pf, pt, outlet)
    keys = ("omzet", "expense", "net_profit", "margin_pct", "avg_net_profit")
    cur = {k: cur[k] for k in keys}
    prev = {k: prev[k] for k in keys}

    def delta(a, b):
        if not b:
            return None
        return round((a - b) / abs(b) * 100, 1) if b else None

    return {
        "period": {"from": f, "to": t},
        "current": cur, "previous": prev,
        "deltas": {k: delta(cur[k], prev[k]) for k in cur},
    }


@app.get("/api/revenue-breakdown")
def revenue_breakdown(from_d: str | None = Query(None, alias="from"),
                      to_d: str | None = Query(None, alias="to"),
                      outlet: str | None = None):
    f, t = _range(from_d, to_d)
    s = _summary_snapshot(f, t, outlet)
    service, sales = s["service"], s["sales"]
    total = service + sales
    pct = lambda v: round(v / total * 100, 1) if total else 0
    return {
        "service": {"total": service, "pct": pct(service)},
        "sales": {"total": sales, "pct": pct(sales)},
        "total_omzet": s["omzet"],
    }


@app.get("/api/monthly-profit")
def monthly_profit(outlet: str | None = None):
    conn = connect()
    sql = ("SELECT period, SUM(nett_profit), SUM(total_omzet)"
           " FROM summary WHERE 1=1")
    params: list = []
    if outlet:
        sql += " AND outlet = ?"
        params.append(outlet)
    sql += " GROUP BY period ORDER BY period"
    return [{"period": r[0], "year": int(r[0][:4]), "month": int(r[0][5:7]),
             "nett_profit": r[1], "omzet": r[2]}
            for r in conn.execute(sql, params)]


@app.get("/api/cashflow")
def cashflow(from_d: str | None = Query(None, alias="from"),
             to_d: str | None = Query(None, alias="to"),
             outlet: str | None = None,
             granularity: str = Query("month", pattern="^(week|month|day)$")):
    f, t = _range(from_d, to_d)
    fmt = {"day": "%Y-%m-%d", "week": "%Y-W%W", "month": "%Y-%m"}[granularity]
    conn = connect()

    def series(table, col):
        w, p = _filters(f, t, outlet)
        rows = conn.execute(
            f"SELECT strftime('{fmt}', tanggal) bucket, SUM({col}) v"
            f" FROM {table}{w} GROUP BY bucket ORDER BY bucket", p).fetchall()
        return {r[0]: r[1] for r in rows}

    rev = series("revenue", "total_omzet")
    exp = series("cost", "total")
    buckets = sorted(set(rev) | set(exp))
    return [{
        "bucket": b, "omzet": rev.get(b, 0), "expense": exp.get(b, 0),
        "profit": rev.get(b, 0) - exp.get(b, 0),
    } for b in buckets]


@app.get("/api/cost-categories")
def cost_categories(from_d: str | None = Query(None, alias="from"),
                    to_d: str | None = Query(None, alias="to"),
                    outlet: str | None = None):
    f, t = _range(from_d, to_d)
    w, p = _filters(f, t, outlet)
    rows = connect().execute(
        f"SELECT expense, SUM(total) v FROM cost{w} GROUP BY expense ORDER BY v DESC",
        p).fetchall()
    cats: dict[str, dict] = {}
    for expense, v in rows:
        cat = category_for(expense)
        c = cats.setdefault(cat, {"category": cat, "total": 0, "items": []})
        c["total"] += v
        c["items"].append({"expense": expense, "total": v})
    out = sorted(cats.values(), key=lambda c: -c["total"])
    grand = sum(c["total"] for c in out)
    for c in out:
        for it in c["items"]:
            it["pct_of_category"] = round(it["total"] / c["total"] * 100, 1) if c["total"] else 0
    return {"categories": out, "grand_total": grand}


@app.get("/api/cost-detail")
def cost_detail(expense: str,
                from_d: str | None = Query(None, alias="from"),
                to_d: str | None = Query(None, alias="to"),
                outlet: str | None = None):
    f, t = _range(from_d, to_d)
    w, p = _filters(f, t, outlet)
    w += " AND expense = ?"
    p = [*p, expense]
    rows = connect().execute(
        f"""SELECT COALESCE(deskripsi,'(tanpa deskripsi)') deskripsi,
            COUNT(*) n, SUM(total) total
            FROM cost{w} GROUP BY deskripsi ORDER BY total DESC""",
        p).fetchall()
    return {"expense": expense,
            "items": [{"deskripsi": r[0], "count": r[1], "total": r[2]} for r in rows]}


@app.get("/api/cogs-daily")
def cogs_daily(from_d: str | None = Query(None, alias="from"),
               to_d: str | None = Query(None, alias="to"),
               outlet: str | None = None):
    f, t = _range(from_d, to_d)
    w, p = _filters(f, t, outlet)
    w += " AND expense = 'Biaya Pemakaian Bahan Habis Pakai'"
    rows = connect().execute(
        f"SELECT tanggal, SUM(total) v FROM cost{w} GROUP BY tanggal ORDER BY tanggal",
        p).fetchall()
    values = [r[1] for r in rows]
    mean = sum(values) / len(values) if values else 0
    var = sum((v - mean) ** 2 for v in values) / len(values) if values else 0
    std = var ** 0.5
    threshold = mean + 2 * std
    return {
        "mean": round(mean, 2), "threshold": round(threshold, 2),
        "days": [{"tanggal": r[0], "total": r[1],
                  "spike": bool(std > 0 and r[1] > threshold)} for r in rows],
    }


class InvestmentIn(BaseModel):
    tipe: str
    nama_aset: str
    dana: float
    tanggal_beli: str
    unit: float
    lokasi: str = ""


@app.get("/api/investments")
def investments_list():
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, tipe, nama_aset, dana, tanggal_beli, unit, lokasi"
            " FROM investments ORDER BY tanggal_beli DESC, id DESC").fetchall()
    return [{"id": r[0], "tipe": r[1], "nama_aset": r[2], "dana": r[3],
             "tanggal_beli": r[4], "unit": r[5], "lokasi": r[6]} for r in rows]


@app.post("/api/investments")
def investments_create(inv: InvestmentIn):
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO investments (tipe, nama_aset, dana, tanggal_beli,"
            " unit, lokasi) VALUES (?,?,?,?,?,?)",
            (inv.tipe, inv.nama_aset, inv.dana, inv.tanggal_beli, inv.unit,
             inv.lokasi))
    return {"id": cur.lastrowid}


@app.put("/api/investments/{inv_id}")
def investments_update(inv_id: int, inv: InvestmentIn):
    with connect() as conn:
        cur = conn.execute(
            "UPDATE investments SET tipe=?, nama_aset=?, dana=?,"
            " tanggal_beli=?, unit=?, lokasi=? WHERE id=?",
            (inv.tipe, inv.nama_aset, inv.dana, inv.tanggal_beli,
             inv.unit, inv.lokasi, inv_id))
    if cur.rowcount == 0:
        raise HTTPException(404, "Investasi tidak ditemukan")
    return {"status": "ok"}


@app.delete("/api/investments/{inv_id}")
def investments_delete(inv_id: int):
    with connect() as conn:
        cur = conn.execute("DELETE FROM investments WHERE id=?", (inv_id,))
    if cur.rowcount == 0:
        raise HTTPException(404, "Investasi tidak ditemukan")
    return {"status": "ok"}


class LokasiValueIn(BaseModel):
    nilai: float


@app.get("/api/investments/lokasi-values")
def lokasi_values_list():
    rows = connect().execute(
        "SELECT lokasi, nilai, updated_at FROM lokasi_values ORDER BY lokasi").fetchall()
    return [{"lokasi": r[0], "nilai": r[1], "updated_at": r[2]} for r in rows]


@app.put("/api/investments/lokasi-values/{lokasi}")
def lokasi_value_update(lokasi: str, body: LokasiValueIn):
    now = datetime.now().isoformat(timespec="seconds")
    with connect() as conn:
        conn.execute(
            "INSERT INTO lokasi_values (lokasi, nilai, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(lokasi) DO UPDATE SET nilai = excluded.nilai, "
            "updated_at = excluded.updated_at",
            (lokasi, body.nilai, now),
        )
    return {"status": "ok"}


@app.post("/api/sync")
def sync():
    from .ingest import run_ingest
    run_ingest()
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
def index():
    return (STATIC_DIR / "index.html").read_text(encoding="utf-8")


app.mount("/", StaticFiles(directory=STATIC_DIR), name="static")
