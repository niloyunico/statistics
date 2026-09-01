# MedEx catalogue enrichment

This scraper enriches the existing `scripts/data/medicine.csv` list (21,714
brands) by brand ID. It saves every successful page immediately, resumes safely,
retries temporary failures, follows canonical redirects, and creates both JSONL
and UTF-8 CSV output.

Before running a complete scrape, review MedEx's current Terms of Use and confirm
that your intended storage/reuse is permitted. Clinical monographs and images may
be copyrighted. The production UNICO importer continues to use the vendored CC0
dataset and is not changed by this tool.

## Install

```powershell
cd "C:\xampp\htdocs\unicodb\pc apps\unico-n"
python -m pip install -r scripts\requirements-medex.txt
```

## Test 10 medicines

```powershell
python scripts\scrape-medex.py --limit 10
```

## Scrape or resume the complete list

```powershell
python scripts\scrape-medex.py
```

At the default 3-second delay, a full run takes roughly 19-22 hours. Stopping
with Ctrl+C is safe; running the command again skips successful brand IDs.

## Images

Pack photos are linked from the "Pack Image" badge (`/storage/images/packaging/*.webp`),
not from an `<img>` tag, so they are collected from the badge href. Roughly two
brands in three have no pack photo at all; those rows keep empty image fields.

```powershell
python scripts\scrape-medex.py --download-images
```

Saved under `images/packs/` (pack photos) and `images/dosage-forms/` (form icons).
An image that fails to download is logged and skipped - the medicine row is still
kept.

## If MedEx starts blocking

The throttle is adaptive: every challenge page or HTTP 429 doubles the delay, three
in a row triggers a long cooldown and a fresh session, and a clean streak relaxes
the delay again. Nothing needs restarting by hand.

```powershell
python scripts\scrape-medex.py --delay 6 --max-delay 300 --cooldown 1800
python scripts\scrape-medex.py --proxy http://user:pass@host:port
python scripts\scrape-medex.py --identify-as-bot
```

Requests are sent with browser-shaped headers by default; `--identify-as-bot` sends
the honest `UNICO-Medicine-Enricher` agent instead.

Outputs are written under `scripts/data/medex-current/`:

- `medicine-details.jsonl`: lossless checkpoint, one complete record per line
- `medicine-details.csv`: Excel-friendly export; clinical sections are JSON
- `progress.json`: live counters, refreshed every 25 attempted rows
- `failures.jsonl`: failures to inspect/retry
- `images/`: only created with `--download-images`

New columns beyond the original export: `pack_image_urls`, `pack_image_files`,
`generic_structure_url`.

A row that failed in an earlier run is not recorded as done, so simply re-running
the command retries it. Only `ok` and `missing` (404/410) rows are skipped.

Rebuild the CSV from an existing checkpoint without network requests:

```powershell
python scripts\scrape-medex.py --export-only
```
