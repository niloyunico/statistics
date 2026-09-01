# DIMS factual catalogue index

This second scraper creates a reference index of short factual medicine-listing
metadata from DIMS Bangladesh. It intentionally does not copy copyrighted clinical
monographs, descriptive content, or site artwork.

```powershell
cd "C:\xampp\htdocs\unicodb\pc apps\unico-n"
python scripts\scrape-dims.py
```

Output is stored under `scripts/data/dims-current/`:

- `catalogue.csv` — Excel-friendly medicine list
- `catalogue.jsonl` — append-only checkpoint
- `progress.json` — live page and medicine counters

Running the command again resumes and de-duplicates by the canonical DIMS URL.
