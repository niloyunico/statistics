#!/usr/bin/env python3
"""Build a factual, resumable DIMS Bangladesh brand catalogue.

This intentionally indexes only short factual listing metadata and source URLs.
It does not copy DIMS clinical monographs, descriptive content, or site artwork.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import random
import string
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup


BASE_URL = "https://dimsbd.com"
OUTPUT = Path(__file__).parent / "data" / "dims-current"
USER_AGENT = "UNICO-DIMS-Catalogue-Indexer/1.0 (reference index)"


def text(node) -> str:
    return node.get_text(" ", strip=True) if node else ""


def parse_listing(html: str, page_url: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict[str, str]] = []
    for anchor in soup.select('a[href*="/brand/"]'):
        brand = anchor.select_one(".brand_name")
        if not brand:
            continue
        form = anchor.select_one(".form .text-sm")
        strength = anchor.select_one(".strength")
        generic = anchor.select_one(".md\\:flex-grow i")
        grow = anchor.select_one(".md\\:flex-grow")
        company = ""
        if grow:
            direct_divs = grow.find_all("div", recursive=False)
            if direct_divs:
                company = text(direct_divs[-1])
        url = urljoin(BASE_URL, anchor.get("href", ""))
        rows.append({
            "brand_name": text(brand),
            "dosage_form": text(form),
            "strength": text(strength),
            "generic_name": text(generic),
            "manufacturer": company,
            "source_url": url,
            "listing_url": page_url,
        })
    return rows


def last_page(html: str) -> int:
    soup = BeautifulSoup(html, "html.parser")
    pages = [1]
    for anchor in soup.select('a[href*="page="]'):
        try:
            pages.append(int(parse_qs(urlparse(anchor.get("href", "")).query)["page"][0]))
        except (KeyError, ValueError, IndexError):
            pass
    return max(pages)


def args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT)
    parser.add_argument("--delay", type=float, default=2.0)
    parser.add_argument("--retries", type=int, default=4)
    return parser.parse_args()


def main() -> int:
    options = args()
    options.output_dir.mkdir(parents=True, exist_ok=True)
    checkpoint = options.output_dir / "catalogue.jsonl"
    csv_file = options.output_dir / "catalogue.csv"
    progress_file = options.output_dir / "progress.json"
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    known: dict[str, dict[str, str]] = {}
    if checkpoint.exists():
        for line in checkpoint.read_text(encoding="utf-8").splitlines():
            try:
                row = json.loads(line)
                known[row["source_url"]] = row
            except (json.JSONDecodeError, KeyError):
                pass

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "en"})
    letters = ["%23", *string.ascii_lowercase]
    pages_completed = 0
    for letter_index, letter in enumerate(letters, 1):
        page_number = 1
        pages_for_letter = 1
        while page_number <= pages_for_letter:
            page_url = f"{BASE_URL}/brands/{letter}" + (f"?page={page_number}" if page_number > 1 else "")
            response = None
            for attempt in range(options.retries + 1):
                try:
                    response = session.get(page_url, timeout=30)
                    response.raise_for_status()
                    break
                except requests.RequestException:
                    if attempt >= options.retries:
                        raise
                    time.sleep(min(60, options.delay * (2 ** attempt) + random.random()))
            if response is None:
                break
            if page_number == 1:
                pages_for_letter = last_page(response.text)
            found = parse_listing(response.text, response.url)
            added = 0
            with checkpoint.open("a", encoding="utf-8") as handle:
                for row in found:
                    if row["source_url"] in known:
                        continue
                    row["indexed_at"] = datetime.now(timezone.utc).isoformat()
                    known[row["source_url"]] = row
                    handle.write(json.dumps(row, ensure_ascii=False) + "\n")
                    added += 1
            pages_completed += 1

            temporary = csv_file.with_suffix(".csv.tmp")
            fields = ["brand_name", "dosage_form", "strength", "generic_name", "manufacturer", "source_url", "listing_url", "indexed_at"]
            with temporary.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=fields)
                writer.writeheader()
                writer.writerows(sorted(known.values(), key=lambda row: (row["brand_name"].casefold(), row["source_url"])))
            temporary.replace(csv_file)

            progress = {
                "letters_completed": letter_index - (0 if page_number == pages_for_letter else 1),
                "letters_total": len(letters),
                "pages_completed_this_run": pages_completed,
                "current_letter": letter,
                "current_page": page_number,
                "pages_for_current_letter": pages_for_letter,
                "brands_indexed": len(known),
                "last_listing": response.url,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "complete": letter_index == len(letters) and page_number == pages_for_letter,
            }
            tmp_progress = progress_file.with_suffix(".json.tmp")
            tmp_progress.write_text(json.dumps(progress, indent=2), encoding="utf-8")
            tmp_progress.replace(progress_file)
            logging.info("[%s/%s page %s/%s] %s found, %s new, %s total", letter_index, len(letters), page_number, pages_for_letter, len(found), added, len(known))
            page_number += 1
            time.sleep(max(0, options.delay + random.uniform(0, options.delay * 0.25)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
