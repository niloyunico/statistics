#!/usr/bin/env python3
"""Resumable MedEx brand-page scraper for an existing medicine.csv catalogue.

The input already contains MedEx brand IDs, so this script does not crawl index
pages. It requests one public brand page at a conservative rate, stores an
append-only JSONL checkpoint, and builds a convenient CSV export.

Review MedEx's current Terms of Use and your right to reuse the content before
redistributing it. Product images are not currently present on every brand page;
the visible dosage-form icon is downloaded only when --download-images is used.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag


BASE_URL = "https://medex.com.bd"
DEFAULT_INPUT = Path(__file__).parent / "data" / "medicine.csv"
DEFAULT_OUTPUT = Path(__file__).parent / "data" / "medex-current"
USER_AGENT = "UNICO-Medicine-Enricher/1.0 (internal catalogue maintenance)"
BROWSER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
)
PACKAGING_PATH = "/storage/images/packaging/"


def build_session(args: argparse.Namespace) -> requests.Session:
    """A fresh session: browser-shaped headers, own cookie jar, optional proxy."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT if args.identify_as_bot else BROWSER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    })
    if args.proxy:
        session.proxies.update({"http": args.proxy, "https": args.proxy})
    return session


# A page known to exist, used only to ask "is MedEx answering normally again?".
CANARY_URL = f"{BASE_URL}/brands/4077/a-coldsyrup4-mg5-ml"


def site_is_clear(session: requests.Session, timeout: float) -> bool:
    """True when MedEx serves real content rather than the Security Check page.

    The challenge is served as HTTP 200, so the status code proves nothing here -
    the presence of the brand header is what distinguishes them.
    """
    try:
        response = session.get(CANARY_URL, timeout=timeout)
    except requests.RequestException:
        return False
    return "brand-header" in response.text and "Security Check" not in response.text


def wait_until_clear(args: argparse.Namespace, check_every: float) -> requests.Session:
    """Sit out a block, checking periodically, instead of retrying through it.

    Returns a fresh session once the site answers normally. Waiting costs nothing
    but time; hammering a site that is already challenging us only prolongs it.
    """
    attempt = 0
    while True:
        session = build_session(args)
        if site_is_clear(session, args.timeout):
            if attempt:
                logging.info("MedEx is answering normally again; resuming.")
            return session
        attempt += 1
        pause = check_every + random.uniform(0, check_every * 0.2)
        logging.warning(
            "Still challenged (check %s); waiting %.0fs before looking again.",
            attempt, pause,
        )
        time.sleep(pause)


class Throttle:
    """Adaptive politeness.

    MedEx tolerates a steady slow crawl but starts serving challenge pages when
    pushed. Every block doubles the delay; a long clean streak relaxes it again.
    Repeated blocks trigger a long cooldown instead of hammering through.
    """

    def __init__(self, base: float, max_delay: float, cooldown: float) -> None:
        self.base = base
        self.max_delay = max_delay
        self.cooldown = cooldown
        self.delay = base
        self.clean_streak = 0
        self.recent_blocks = 0

    def wait(self) -> None:
        time.sleep(max(0.0, self.delay + random.uniform(0, self.delay * 0.25)))

    def success(self) -> None:
        self.recent_blocks = 0
        self.clean_streak += 1
        if self.clean_streak >= 25 and self.delay > self.base:
            self.delay = max(self.base, self.delay / 1.5)
            self.clean_streak = 0
            logging.info("Site healthy again; delay relaxed to %.1fs", self.delay)

    def blocked(self) -> bool:
        """Record a block. Returns True when the caller should rebuild its session."""
        self.clean_streak = 0
        self.recent_blocks += 1
        self.delay = min(self.max_delay, max(self.base, self.delay) * 2)
        logging.warning(
            "Blocked (%s in a row); delay raised to %.1fs", self.recent_blocks, self.delay
        )
        if self.recent_blocks >= 3:
            self.recent_blocks = 0
            return True
        return False


class MissingPage(ValueError):
    """The old catalogue ID no longer exists on MedEx."""


class TemporaryPage(ValueError):
    """MedEx returned a block/challenge page instead of medicine content."""


def clean_text(node: Tag | None) -> str:
    return node.get_text(" ", strip=True) if node else ""


def safe_name(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-.")
    return value[:120] or "image"


def absolute_image_url(img: Tag | None) -> str:
    if not img:
        return ""
    for key in ("data-src", "data-original", "src"):
        value = img.get(key)
        if value and not str(value).startswith("data:"):
            return urljoin(BASE_URL, str(value))
    return ""


def parse_page(html: str, requested_url: str, final_url: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    header = soup.select_one(".brand-header")
    if not header or not soup.select_one("h1.brand"):
        page_text = soup.get_text(" ", strip=True).lower()
        if "not found" in page_text or "content is not available" in page_text:
            raise MissingPage("medicine page is no longer available")
        raise TemporaryPage("temporary MedEx block/challenge page")

    h1 = soup.select_one("h1.brand")
    dosage = h1.select_one("small[title='Dosage Form']") if h1 else None
    generic_link = header.select_one("div[title='Generic Name'] a")
    strength_node = header.select_one("div[title='Strength']")
    company_link = header.select_one("div[title='Manufactured by'] a")

    packages = []
    for package in soup.select(".packages-wrapper .package-container"):
        text = clean_text(package)
        if text:
            packages.append(text)

    sections: dict[str, dict[str, str]] = {}
    for heading in soup.select(".generic-data-container h3.ac-header"):
        # MedEx wraps each heading in one div and places .ac-body after that wrapper.
        body = heading.parent.find_next_sibling() if heading.parent else None
        while isinstance(body, Tag) and "ac-body" not in (body.get("class") or []):
            body = body.find_next_sibling()
        title = clean_text(heading)
        if title and isinstance(body, Tag):
            sections[title] = {
                "text": clean_text(body),
                "html": body.decode_contents().strip(),
            }

    dosage_img = soup.select_one(".brand-th-block img.dosage-icon")
    # The real pack photo is linked from the "Pack Image" badge, not an <img>.
    pack_images: list[str] = []
    for anchor in soup.select("a[href]"):
        href = urljoin(BASE_URL, str(anchor.get("href") or ""))
        if PACKAGING_PATH in href and href not in pack_images:
            pack_images.append(href)
    for img in soup.select("img"):
        candidate = absolute_image_url(img)
        if PACKAGING_PATH in candidate and candidate not in pack_images:
            pack_images.append(candidate)
    structure_url = absolute_image_url(soup.select_one("img.g-res"))
    unavailable = bool(soup.select_one(".sp-flag"))
    monograph = soup.select_one("a[title^=\"Innovator's Monograph\"]")

    brand_name = clean_text(h1)
    if h1:
        h1_copy = BeautifulSoup(str(h1), "html.parser")
        for subtitle in h1_copy.select("small"):
            subtitle.decompose()
        brand_name = clean_text(h1_copy.select_one("h1"))

    return {
        "requested_url": requested_url,
        "source_url": final_url,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "brand_name": brand_name,
        "dosage_form": clean_text(dosage),
        "generic_name": clean_text(generic_link),
        "generic_url": urljoin(BASE_URL, generic_link.get("href", "")) if generic_link else "",
        "strength": clean_text(strength_node),
        "manufacturer": clean_text(company_link),
        "manufacturer_url": urljoin(BASE_URL, company_link.get("href", "")) if company_link else "",
        "packages": packages,
        "unavailable": unavailable,
        "monograph_url": urljoin(BASE_URL, monograph.get("href", "")) if monograph else "",
        "product_image_url": pack_images[0] if pack_images else "",
        "pack_image_urls": pack_images,
        "generic_structure_url": structure_url,
        "dosage_icon_url": absolute_image_url(dosage_img),
        "sections": sections,
    }


def checkpoint_files(output_dir: Path) -> list[Path]:
    """Every shard checkpoint, including one written by an earlier single-worker run."""
    return sorted(output_dir.glob("medicine-details*.jsonl"))


def load_done(output_dir: Path) -> set[str]:
    done: set[str] = set()
    for checkpoint in checkpoint_files(output_dir):
        with checkpoint.open("r", encoding="utf-8") as handle:
            for number, line in enumerate(handle, 1):
                try:
                    item = json.loads(line)
                    if item.get("status") in {"ok", "missing"}:
                        done.add(str(item["brand_id"]))
                except (json.JSONDecodeError, KeyError):
                    logging.warning(
                        "Ignoring malformed line %s in %s", number, checkpoint.name
                    )
    return done


def export_csv(output_dir: Path, destination: Path) -> int:
    rows: dict[str, dict[str, Any]] = {}
    for checkpoint in checkpoint_files(output_dir):
        with checkpoint.open("r", encoding="utf-8") as handle:
            for line in handle:
                try:
                    item = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if item.get("status") == "ok":
                    rows[str(item["brand_id"])] = item

    fields = [
        "brand_id", "brand_name", "dosage_form", "generic_name", "strength",
        "manufacturer", "packages", "unavailable", "source_url", "scraped_at",
        "generic_url", "manufacturer_url", "monograph_url", "product_image_url",
        "product_image_file", "pack_image_urls", "pack_image_files",
        "generic_structure_url", "dosage_icon_url", "dosage_icon_file", "sections_json",
    ]
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for brand_id in sorted(rows, key=lambda value: int(value)):
            item = rows[brand_id]
            out = {field: item.get(field, "") for field in fields}
            out["packages"] = json.dumps(item.get("packages", []), ensure_ascii=False)
            out["pack_image_urls"] = json.dumps(item.get("pack_image_urls", []), ensure_ascii=False)
            out["pack_image_files"] = json.dumps(item.get("pack_image_files", []), ensure_ascii=False)
            out["sections_json"] = json.dumps(item.get("sections", {}), ensure_ascii=False)
            writer.writerow(out)
    temporary.replace(destination)
    return len(rows)


def download_image(session: requests.Session, url: str, directory: Path, prefix: str) -> str:
    if not url:
        return ""
    parsed = urlparse(url)
    suffix = Path(parsed.path).suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        suffix = ".img"
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]
    destination = directory / f"{safe_name(prefix)}-{digest}{suffix}"
    if destination.exists():
        return str(destination)
    response = session.get(url, timeout=30)
    response.raise_for_status()
    if not response.headers.get("content-type", "").lower().startswith("image/"):
        raise ValueError(f"not an image: {url}")
    directory.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(response.content)
    return str(destination)


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--limit", type=int, help="process at most this many unfinished rows")
    parser.add_argument("--start-id", type=int, help="skip brand IDs below this value")
    parser.add_argument("--delay", type=float, default=3.0, help="base delay in seconds (default: 3.0)")
    parser.add_argument("--max-delay", type=float, default=120.0,
                        help="ceiling the adaptive throttle may back off to (default: 120)")
    parser.add_argument("--cooldown", type=float, default=900.0,
                        help="pause after 3 blocks in a row, in seconds (default: 900)")
    parser.add_argument("--proxy", help="route requests through this proxy URL")
    parser.add_argument("--identify-as-bot", action="store_true",
                        help="send the honest UNICO user agent instead of a browser one")
    parser.add_argument("--timeout", type=float, default=30)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--download-images", action="store_true")
    parser.add_argument("--export-only", action="store_true")
    parser.add_argument("--shards", type=int, default=1,
                        help="split the catalogue across this many worker processes")
    parser.add_argument("--shard", type=int, default=0,
                        help="which shard this worker handles (0-based)")
    return parser.parse_args()


def main() -> int:
    args = arguments()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    if args.shards < 1 or not 0 <= args.shard < args.shards:
        raise SystemExit("--shard must be between 0 and --shards minus 1")
    # Each worker appends to its own files; only the export merges them.
    tag = "" if args.shards == 1 else f".part{args.shard}"
    checkpoint = args.output_dir / f"medicine-details{tag}.jsonl"
    csv_output = args.output_dir / "medicine-details.csv"
    failures = args.output_dir / f"failures{tag}.jsonl"
    progress_file = args.output_dir / f"progress{tag}.json"

    if args.export_only:
        logging.info(
            "Exported %s rows to %s", export_csv(args.output_dir, csv_output), csv_output
        )
        return 0

    done = load_done(args.output_dir)
    session = build_session(args)
    throttle = Throttle(args.delay, args.max_delay, args.cooldown)
    if not site_is_clear(session, args.timeout):
        logging.warning("MedEx is serving the Security Check page; waiting for it to clear.")
        session = wait_until_clear(args, args.cooldown)
    processed = 0

    with args.input.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if "brand id" not in (reader.fieldnames or []):
            raise SystemExit("input CSV must contain a 'brand id' column")
        for position, source_row in enumerate(reader):
            if position % args.shards != args.shard:
                continue
            brand_id = str(source_row.get("brand id", "")).strip()
            if not brand_id or brand_id in done:
                continue
            if args.start_id and int(brand_id) < args.start_id:
                continue
            if args.limit is not None and processed >= args.limit:
                break

            slug = str(source_row.get("slug", "")).strip() or "brand"
            requested_url = f"{BASE_URL}/brands/{brand_id}/{slug}"
            processed += 1
            try:
                last_error: Exception | None = None
                response = None
                item = None
                for attempt in range(args.retries + 1):
                    try:
                        response = session.get(requested_url, timeout=args.timeout)
                        if response.status_code == 429 or response.status_code >= 500:
                            raise requests.HTTPError(f"HTTP {response.status_code}", response=response)
                        response.raise_for_status()
                        item = parse_page(response.text, requested_url, response.url)
                        break
                    except TemporaryPage as error:
                        last_error = error
                        if throttle.blocked():
                            session = wait_until_clear(args, args.cooldown)
                        if attempt >= args.retries:
                            raise
                        wait = min(300.0, 30.0 * (2 ** attempt) + random.uniform(0, 10))
                        logging.warning("%s temporarily blocked; waiting %.1fs", brand_id, wait)
                        time.sleep(wait)
                    except requests.RequestException as error:
                        last_error = error
                        status = getattr(error.response, "status_code", None)
                        if status is not None and status != 429 and status < 500:
                            raise
                        if status == 429 and throttle.blocked():
                            session = build_session(args)
                        if attempt >= args.retries:
                            raise
                        wait = min(60.0, (2 ** attempt) * args.delay + random.random())
                        logging.warning("%s failed; retrying in %.1fs", brand_id, wait)
                        time.sleep(wait)
                if response is None or item is None:
                    raise last_error or RuntimeError("request failed")
                item.update({"brand_id": brand_id, "status": "ok", "input": source_row})
                if args.download_images:
                    images = args.output_dir / "images"
                    saved: list[str] = []
                    for index, image_url in enumerate(item.get("pack_image_urls", []), 1):
                        try:
                            saved.append(download_image(
                                session, image_url, images / "packs", f"{brand_id}-{index}"
                            ))
                        except (requests.RequestException, ValueError, OSError) as error:
                            logging.warning("[%s] pack image failed: %s", brand_id, error)
                    item["pack_image_files"] = saved
                    item["product_image_file"] = saved[0] if saved else ""
                    try:
                        item["dosage_icon_file"] = download_image(
                            session, item["dosage_icon_url"], images / "dosage-forms",
                            item["dosage_form"],
                        )
                    except (requests.RequestException, ValueError, OSError) as error:
                        logging.warning("[%s] dosage icon failed: %s", brand_id, error)
                        item["dosage_icon_file"] = ""
                with checkpoint.open("a", encoding="utf-8") as handle:
                    handle.write(json.dumps(item, ensure_ascii=False) + "\n")
                done.add(brand_id)
                throttle.success()
                logging.info(
                    "[%s] %s (%s sections, %s pack images)",
                    brand_id, item["brand_name"], len(item["sections"]),
                    len(item.get("pack_image_urls", [])),
                )
            except (requests.RequestException, ValueError, OSError) as error:
                status_code = getattr(getattr(error, "response", None), "status_code", None)
                failure = {
                    "brand_id": brand_id,
                    "url": requested_url,
                    "error": str(error),
                    "failed_at": datetime.now(timezone.utc).isoformat(),
                }
                with failures.open("a", encoding="utf-8") as handle:
                    handle.write(json.dumps(failure, ensure_ascii=False) + "\n")
                if status_code in {404, 410} or isinstance(error, MissingPage):
                    with checkpoint.open("a", encoding="utf-8") as handle:
                        handle.write(json.dumps({**failure, "status": "missing"}, ensure_ascii=False) + "\n")
                logging.error("[%s] %s", brand_id, error)

            if processed % 25 == 0:
                count = export_csv(args.output_dir, csv_output)
                progress = {
                    "input_rows": sum(1 for _ in args.input.open("r", encoding="utf-8-sig")) - 1,
                    "successful": count,
                    "processed_this_run": processed,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "csv": str(csv_output),
                }
                temporary_progress = progress_file.with_suffix(".json.tmp")
                temporary_progress.write_text(json.dumps(progress, indent=2), encoding="utf-8")
                temporary_progress.replace(progress_file)

            throttle.wait()

    count = export_csv(args.output_dir, csv_output)
    logging.info("Done. %s successful rows are available in %s", count, csv_output)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nStopped safely; run the same command to resume.", file=sys.stderr)
        raise SystemExit(130)
