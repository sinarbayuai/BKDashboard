import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.ingest import run_ingest_penjualan

if __name__ == "__main__":
    run_ingest_penjualan()
