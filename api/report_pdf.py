"""Vercel Python serverless function: POST /api/report-pdf.

Generates UNICO report PDFs with ReportLab from a PRE-RESOLVED render model the
browser POSTs. The browser owns every clinical derivation (which months, TR-IN
folding, composition groups, deltas); this function is a pure LAYOUT engine that
draws the report on the ReportLab canvas — a structural port of the JS
`buildVectorPDF` vector exporter in renderer/unico/reports.jsx.

Coordinate system mirrors the JS "preview space": all layout math is in preview
px and scaled uniformly onto pt (S = PW/pageW). ReportLab's origin is
bottom-left with y growing up, so every y is flipped (device_y = ph - y*S).

The renderer runs the whole layout twice: pass 1 counts pages, pass 2 draws with
the known total so footers can print "Page n of N".
"""
from http.server import BaseHTTPRequestHandler
from datetime import datetime
import io
import json
import math
import os
import re

from reportlab.lib.pagesizes import A4, A3, letter, landscape
from reportlab.pdfgen import canvas


# ---- constants ported from the renderer -----------------------------------
PAGE_SIZES = {"A4": (700, 1.414), "A3": (815, 1.414), "Letter": (700, 1.294)}
_PT = {"A4": A4, "A3": A3, "Letter": letter}

# theme.css tokens (same hexes as reports.jsx buildVectorPDF `C`)
THEME = {
    "ink": "#16202e", "ink2": "#3c4858", "muted": "#6c7a8c", "faint": "#9aa6b4",
    "line": "#dde3ec", "line2": "#e8edf3", "panel2": "#f7f9fc", "grid": "#eef1f5",
    "grid3": "#e9edf3", "blue": "#0090ca", "blue700": "#0072a3", "blue50": "#eef8fc",
    "rose": "#d23a52", "roseLine": "#f1c6cd", "pos": "#1f9d57", "posBg": "#e7f6ed",
    "negBg": "#fbe9ec", "slate": "#5b6b80", "flatBg": "#eef1f5", "white": "#ffffff",
}
# charts.jsx BAR_COLORS + charts3d.jsx PAL — per-bar palettes.
BARC = ["#0090ca", "#159fbf", "#2bb3a3", "#46b87e", "#7cc35a",
        "#f0a93b", "#ef8049", "#e85c69", "#b65cc6", "#6a6fd4"]
PAL3 = ["#0090ca", "#159fbf", "#2bb3a3", "#46b87e", "#7cc35a", "#f0a93b",
        "#ef8049", "#e85c69", "#e0679b", "#b65cc6", "#6a6fd4", "#4f8df7"]
# charts.jsx PALETTE — dept tone + composition/series colors.
PALETTE = ["#0b66d0", "#0f9b8e", "#e08a1e", "#6a52d4", "#d23a52",
           "#2bb3a3", "#8a93a3", "#4f8df7", "#1f9d57", "#c2486f"]


def hx(h):
    m = str(h or "").lstrip("#")
    if len(m) != 6:
        m = "16202e"
    try:
        n = int(m, 16)
    except ValueError:
        n = 0x16202E
    return ((n >> 16) & 255, (n >> 8) & 255, n & 255)


def lift(c, p):
    return tuple(max(0, min(255, v + p)) for v in c)


def mixw(c, a):
    return tuple(round(v * a + 255 * (1 - a)) for v in c)


def fmt(n):
    """charts.jsx fmt: round to 2dp, thousands-separated; None -> en-dash."""
    if n is None:
        return "–"
    try:
        v = round(float(n) * 100) / 100
    except (TypeError, ValueError):
        return str(n)
    if v == int(v):
        v = int(v)
    return "{:,}".format(v)


def month_lbl(s):
    import re
    s = str(s)
    s = re.sub(r" \d{4}| 20\d\d", "", s)
    return s[:6]


# ---------------------------------------------------------------------------
class Pen:
    """Thin ReportLab drawing wrapper in preview-space coordinates."""

    def __init__(self, c, S, ph):
        self.c = c
        self.S = S
        self.ph = ph
        self._font = "Helvetica"
        self._size = 12.0

    # coordinate helpers (flip y: preview top-left -> pdf bottom-left)
    def _x(self, v):
        return v * self.S

    def _y(self, v):
        return self.ph - v * self.S

    def font(self, style, size, color=None):
        name = "Helvetica-Bold" if style == "bold" else "Helvetica"
        self._font = name
        self._size = size
        self.c.setFont(name, size * self.S)
        c = color if color is not None else hx(THEME["ink"])
        self.c.setFillColorRGB(c[0] / 255.0, c[1] / 255.0, c[2] / 255.0)

    def tw(self, t):
        return self.c.stringWidth(str(t), self._font, self._size * self.S) / self.S

    def text(self, t, x, y, align=None):
        dx, dy = self._x(x), self._y(y)
        t = str(t)
        if align == "center":
            self.c.drawCentredString(dx, dy, t)
        elif align == "right":
            self.c.drawRightString(dx, dy, t)
        else:
            self.c.drawString(dx, dy, t)

    def line(self, x1, y1, x2, y2, color=None, w=1):
        c = color if color is not None else hx(THEME["line"])
        self.c.setStrokeColorRGB(c[0] / 255.0, c[1] / 255.0, c[2] / 255.0)
        self.c.setLineWidth(w * self.S)
        self.c.line(self._x(x1), self._y(y1), self._x(x2), self._y(y2))

    def rect(self, x, y, w, h, color, rx=0):
        self.c.setFillColorRGB(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)
        dx, dy, dw, dh = self._x(x), self._y(y + h), w * self.S, h * self.S
        if rx:
            self.c.roundRect(dx, dy, dw, dh, rx * self.S, stroke=0, fill=1)
        else:
            self.c.rect(dx, dy, dw, dh, stroke=0, fill=1)

    def rect_stroke(self, x, y, w, h, color, lw=1, rx=0, dash=None):
        self.c.setStrokeColorRGB(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)
        self.c.setLineWidth(lw * self.S)
        if dash:
            self.c.setDash([d * self.S for d in dash], 0)
        dx, dy, dw, dh = self._x(x), self._y(y + h), w * self.S, h * self.S
        if rx:
            self.c.roundRect(dx, dy, dw, dh, rx * self.S, stroke=1, fill=0)
        else:
            self.c.rect(dx, dy, dw, dh, stroke=1, fill=0)
        if dash:
            self.c.setDash([], 0)

    def tri(self, x1, y1, x2, y2, x3, y3, color):
        self.c.setFillColorRGB(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)
        p = self.c.beginPath()
        p.moveTo(self._x(x1), self._y(y1))
        p.lineTo(self._x(x2), self._y(y2))
        p.lineTo(self._x(x3), self._y(y3))
        p.close()
        self.c.drawPath(p, stroke=0, fill=1)

    def circle(self, x, y, r, fill=None, stroke=None, lw=1):
        if fill:
            self.c.setFillColorRGB(fill[0] / 255.0, fill[1] / 255.0, fill[2] / 255.0)
        if stroke:
            self.c.setStrokeColorRGB(stroke[0] / 255.0, stroke[1] / 255.0, stroke[2] / 255.0)
            self.c.setLineWidth(lw * self.S)
        self.c.circle(self._x(x), self._y(y), r * self.S,
                      stroke=1 if stroke else 0, fill=1 if fill else 0)

    def polyline(self, pts, color, lw=2):
        if len(pts) < 2:
            return
        self.c.setStrokeColorRGB(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)
        self.c.setLineWidth(lw * self.S)
        self.c.setLineCap(1)
        self.c.setLineJoin(1)
        p = self.c.beginPath()
        p.moveTo(self._x(pts[0][0]), self._y(pts[0][1]))
        for q in pts[1:]:
            p.lineTo(self._x(q[0]), self._y(q[1]))
        self.c.drawPath(p, stroke=1, fill=0)

    def polygon(self, pts, color):
        if len(pts) < 3:
            return
        self.c.setFillColorRGB(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)
        p = self.c.beginPath()
        p.moveTo(self._x(pts[0][0]), self._y(pts[0][1]))
        for q in pts[1:]:
            p.lineTo(self._x(q[0]), self._y(q[1]))
        p.close()
        self.c.drawPath(p, stroke=0, fill=1)

    def wedge(self, cx, cy, rO, rI, a0, a1, color):
        """Solid ring segment via cubic-bezier arc approximation (ports JS wedge)."""
        if a1 - a0 >= math.pi * 2 - 1e-4:
            a1 = a0 + math.pi * 2 - 1e-4

        def pt(r, a):
            return (cx + r * math.cos(a), cy + r * math.sin(a))

        def arc(r, s0, e0):
            out = []
            n = max(1, math.ceil(abs(e0 - s0) / (math.pi / 3)))
            for i in range(n):
                u = s0 + (e0 - s0) * i / n
                v2 = s0 + (e0 - s0) * (i + 1) / n
                k = (4.0 / 3.0) * math.tan((v2 - u) / 4) * r
                out.append((
                    (cx + r * math.cos(u) - k * math.sin(u),
                     cy + r * math.sin(u) + k * math.cos(u)),
                    (cx + r * math.cos(v2) + k * math.sin(v2),
                     cy + r * math.sin(v2) - k * math.cos(v2)),
                    pt(r, v2)))
            return out

        self.c.setFillColorRGB(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)
        p = self.c.beginPath()
        start = pt(rO, a0)
        p.moveTo(self._x(start[0]), self._y(start[1]))
        for c1, c2, end in arc(rO, a0, a1):
            p.curveTo(self._x(c1[0]), self._y(c1[1]),
                      self._x(c2[0]), self._y(c2[1]),
                      self._x(end[0]), self._y(end[1]))
        q = pt(rI, a1)
        p.lineTo(self._x(q[0]), self._y(q[1]))
        for c1, c2, end in arc(rI, a1, a0):
            p.curveTo(self._x(c1[0]), self._y(c1[1]),
                      self._x(c2[0]), self._y(c2[1]),
                      self._x(end[0]), self._y(end[1]))
        p.close()
        self.c.drawPath(p, stroke=0, fill=1)

    def clip_text(self, s, w):
        s = "–" if s is None else str(s)
        if self.tw(s) <= w:
            return s
        while len(s) > 1 and self.tw(s + "…") > w:
            s = s[:-1]
        return s + "…"

    def wrap(self, s, w):
        """Word-wrap `s` to preview width `w` at the current font."""
        words = str(s).split()
        if not words:
            return [""]
        lines, cur = [], words[0]
        for wd in words[1:]:
            if self.tw(cur + " " + wd) <= w:
                cur += " " + wd
            else:
                lines.append(cur)
                cur = wd
        lines.append(cur)
        return lines


# ---------------------------------------------------------------------------
class Report:
    def __init__(self, model):
        self.m = model or {}
        self.doc = self.m.get("doc", {}) or {}
        self.depts = self.m.get("depts", []) or []
        ps = self.doc.get("pageSize", "A4")
        if ps not in PAGE_SIZES:
            ps = "A4"
        self.pageSize = ps
        self.orient = self.doc.get("orient", "portrait")
        base, ratio = PAGE_SIZES[ps]
        portrait = self.orient == "portrait"
        self.pageW = base if portrait else round(base * ratio)
        self.pageMinH = round(base * ratio) if portrait else base
        self.MX = 30
        self.MT = 28
        self.CWx = self.pageW - 60
        self.FOOTY = self.pageMinH - self.MT - 21
        self.LIMIT = self.FOOTY - 12
        self.C = {k: hx(v) for k, v in THEME.items()}
        self.total = None
        self.page = 1

    def _pt_size(self):
        size = _PT[self.pageSize]
        return landscape(size) if self.orient == "landscape" else size

    # ---- render (two-pass for page count) --------------------------------
    def build(self):
        _, count = self._run(None)
        data, _ = self._run(count)
        return data

    def _run(self, total):
        self.total = total
        self.page = 1
        buf = io.BytesIO()
        size = self._pt_size()
        c = canvas.Canvas(buf, pagesize=size)
        PW = size[0]
        self.S = PW / self.pageW
        self.p = Pen(c, self.S, size[1])

        t = self.doc.get("type", "summary")
        show_cover = self.doc.get("showCover") and len(self.depts) > 0
        if show_cover:
            self._cover_page()
        if t == "compare":
            if show_cover:
                self._new_page_raw()
            self._compare_page()
        elif t == "board":
            if show_cover:
                self._new_page_raw()
            self._board_page()
        else:
            for i, d in enumerate(self.depts):
                if show_cover or i > 0:
                    self._new_page_raw()
                self._dept_page(d)

        self._footer()  # last page
        c.save()
        return buf.getvalue(), self.page

    def _new_page_raw(self):
        self._footer()
        self.p.c.showPage()
        self.page += 1

    def _new_page(self):
        """Content-driven page break: returns the fresh content y."""
        self._new_page_raw()
        return self._page_header()

    # ---- chrome ----------------------------------------------------------
    def _footer(self):
        if self.total is None:
            return
        p, C = self.p, self.C
        MX, FOOTY = self.MX, self.FOOTY
        p.line(MX, FOOTY, self.pageW - MX, FOOTY, C["line"], 1)
        p.font("normal", 9.5, C["faint"])
        p.text(self.doc.get("hospitalName", "UNICO"), MX, FOOTY + 16)
        p.text("Page %d of %d" % (self.page, self.total), self.pageW / 2, FOOTY + 16, "center")
        note = self.doc.get("footerNote") or ""
        tail = (note + " · " if note else "")
        if self.doc.get("confidential"):
            tail += "Confidential · "
        tail += "%s %s" % (self.pageSize, self.orient)
        p.text(tail, self.pageW - MX, FOOTY + 16, "right")

    def _page_header(self):
        p, C = self.p, self.C
        MX, MT = self.MX, self.MT
        x = MX
        p.font("bold", 14, C["ink"])
        p.text(self.doc.get("hdrTitle") or "Report", x, MT + 16)
        sub = self.doc.get("hdrSub") or ""
        rl = self.doc.get("rangeLabel") or ""
        p.font("normal", 10.5, C["muted"])
        p.text(((sub + " · " if sub else "") + rl).upper(), x, MT + 30)
        p.font("normal", 10, C["faint"])
        p.text("Generated", self.pageW - MX, MT + 12, "right")
        p.font("bold", 10, C["ink2"])
        p.text(self.doc.get("genDate", ""), self.pageW - MX, MT + 25, "right")
        p.line(MX, MT + 52, self.pageW - MX, MT + 52, C["blue"], 2)
        return MT + 52 + 18

    # ---- KPI tiles -------------------------------------------------------
    def _kpi_row(self, y, items):
        p, C = self.p, self.C
        MX, CWx = self.MX, self.CWx
        if not items:
            return y
        gap = 10
        w = (CWx - gap * (len(items) - 1)) / len(items)
        for i, it in enumerate(items):
            x = MX + i * (w + gap)
            p.rect(x, y, w, 56, C["panel2"], 7)
            p.rect(x, y, 3, 56, it["tone"], 1.5)
            p.font("normal", 9.5, C["muted"])
            p.text(str(it["label"]).upper(), x + 14, y + 19)
            p.font("bold", 18, C["ink"])
            p.text(it["value"], x + 14, y + 41)
        return y + 56 + 16

    def _tag_chip(self, x, y, txt):
        p, C = self.p, self.C
        p.font("bold", 10.5, C["blue700"])
        t = str(txt or "").upper()
        w = p.tw(t) + 16
        p.rect(x, y, w, 17, C["blue50"], 5)
        p.font("bold", 10.5, C["blue700"])
        p.text(t, x + 8, y + 12)
        return w

    def _delta_chip(self, xr, y, v):
        p, C = self.p, self.C
        v = v or 0
        pos, neg = v > 0, v < 0
        fg = C["pos"] if pos else C["rose"] if neg else C["slate"]
        bg = C["posBg"] if pos else C["negBg"] if neg else C["flatBg"]
        p.font("bold", 11, fg)
        t = "%s%%" % abs(v)
        w = 9 + p.tw(t) + 16
        p.rect(xr - w, y, w, 18, bg, 9)
        ax, ay = xr - w + 7, y + 6.5
        if pos:
            p.tri(ax, ay + 5, ax + 3, ay, ax + 6, ay + 5, fg)
        elif neg:
            p.tri(ax, ay, ax + 6, ay, ax + 3, ay + 5, fg)
        else:
            p.rect(ax, ay + 2, 6, 1.6, fg)
        p.font("bold", 11, fg)
        p.text(t, ax + 9, y + 13)
        return w

    # ---- charts ----------------------------------------------------------
    def _grid_lines(self, ox, rw, y0, hgt):
        p, C = self.p, self.C
        for g in (0, .25, .5, .75, 1):
            yy = y0 + hgt - 20 - g * (hgt - 44)
            p.line(ox, yy, ox + rw, yy, C["grid"], 1)

    def _bar3d(self, y0, rows, hgt):
        p, C = self.p, self.C
        MX, CWx = self.MX, self.CWx
        n = max(1, len(rows))
        dx, dy = 13, -9
        step = max(46, min(78, 640.0 / n))
        Wv = n * step + dx + 10
        baseY = hgt - 26
        bw = min(30, step - 22)
        mx = max([1] + [r["v"] for r in rows])
        s3 = min(CWx / Wv, 1)
        ox = MX + (CWx - Wv * s3) / 2
        oy = y0 + (hgt - hgt * s3) / 2

        def gx(v):
            return ox + v * s3

        def gy(v):
            return oy + v * s3

        for g in (0, .25, .5, .75, 1):
            gyv = baseY - g * (hgt - 58)
            p.line(gx(0), gy(gyv), gx(n * step), gy(gyv), C["grid3"], s3)
            p.line(gx(n * step), gy(gyv), gx(n * step + dx), gy(gyv + dy), C["grid"], s3)
        for i, r in enumerate(rows):
            v = r["v"] or 0
            bh = (v / mx) * (hgt - 58) if v > 0 else 2
            bx = i * step + 12
            by = baseY - bh
            c = hx(PAL3[i % len(PAL3)])
            p.tri(gx(bx + bw), gy(by), gx(bx + bw + dx), gy(by + dy), gx(bx + bw + dx), gy(baseY + dy), lift(c, -44))
            p.tri(gx(bx + bw), gy(by), gx(bx + bw + dx), gy(baseY + dy), gx(bx + bw), gy(baseY), lift(c, -44))
            p.tri(gx(bx), gy(by), gx(bx + dx), gy(by + dy), gx(bx + bw + dx), gy(by + dy), lift(c, 46))
            p.tri(gx(bx), gy(by), gx(bx + bw + dx), gy(by + dy), gx(bx + bw), gy(by), lift(c, 46))
            p.rect(gx(bx), gy(by), bw * s3, max(bh, 0.1) * s3, c)
            p.font("bold", 11 * s3, C["ink"])
            p.text(fmt(v), gx(bx + bw / 2 + dx / 2), gy(by + dy - 6), "center")
            p.font("normal", 9.5 * s3, C["faint"])
            p.text(month_lbl(r["x"]), gx(bx + bw / 2), gy(hgt - 6), "center")
        return y0 + hgt

    def _bar_flat(self, y0, rows, hgt):
        p, C = self.p, self.C
        MX, CWx = self.MX, self.CWx
        n = max(1, len(rows))
        rw = min(CWx, n * 74)
        sx = rw / (n * 54)
        ox = MX + (CWx - rw) / 2
        mx = max([1] + [r["v"] for r in rows])
        self._grid_lines(ox, rw, y0, hgt)
        for i, r in enumerate(rows):
            v = r["v"] or 0
            bh = (v / mx) * (hgt - 44)
            c = hx(BARC[i % len(BARC)])
            bx = ox + (i * 54 + 14) * sx
            bwv = 26 * sx
            by = y0 + hgt - 20 - bh
            p.rect(bx, by, bwv, max(bh, 0.1), c, min(4, bwv / 2))
            if v > 0:
                p.font("bold", 10.5, c)
                p.text(fmt(v), bx + bwv / 2, by - 6, "center")
            p.font("normal", 9.5, C["faint"])
            p.text(month_lbl(r["x"]), bx + bwv / 2, y0 + hgt - 6, "center")
        return y0 + hgt

    def _line(self, y0, rows, tone, hgt):
        p, C = self.p, self.C
        MX, CWx = self.MX, self.CWx
        n = len(rows)
        if not n:
            p.font("normal", 11, C["faint"])
            p.text("No data", self.pageW / 2, y0 + hgt / 2, "center")
            return y0 + hgt
        viewW = max(360, n * 60)
        rw = min(CWx, max(140, n * 80))
        sx = rw / viewW
        ox = MX + (CWx - rw) / 2
        mx = max([1] + [r["v"] for r in rows])

        def px2(i):
            return ox + (26 + ((viewW - 52) / 2 if n <= 1 else (i / (n - 1)) * (viewW - 52))) * sx

        def py2(v):
            return y0 + hgt - 22 - (v / mx) * (hgt - 44)

        for g in (0, .25, .5, .75, 1):
            p.line(ox + 26 * sx, y0 + 22 + g * (hgt - 44), ox + (viewW - 26) * sx, y0 + 22 + g * (hgt - 44), C["grid"], 1)
        pts = [(px2(i), py2(r["v"] or 0)) for i, r in enumerate(rows)]
        if n > 1:
            p.polygon(pts + [(pts[-1][0], y0 + hgt - 22), (pts[0][0], y0 + hgt - 22)], mixw(tone, 0.12))
            p.polyline(pts, tone, 2.5)
        for q in pts:
            p.circle(q[0], q[1], 3.2, C["white"], tone, 2.5)
        for i, r in enumerate(rows):
            p.font("normal", 9.5, C["faint"])
            p.text(month_lbl(r["x"]), px2(i), y0 + hgt - 6, "center")
        return y0 + hgt

    def _grouped(self, y0, dept, series, hgt):
        p, C = self.p, self.C
        MX, CWx = self.MX, self.CWx
        fs = dept.get("fs", [])
        n = max(1, len(fs))
        ns = max(1, len(series))
        groupW = max(48, ns * 16 + 18)
        bw = min(15, (groupW - 14) / ns - 3)
        rw = min(CWx, n * max(70, groupW))
        sx = rw / (n * groupW)
        ox = MX + (CWx - rw) / 2
        mx = max([1] + [r.get(s["id"], 0) or 0 for r in fs for s in series])
        self._grid_lines(ox, rw, y0, hgt)
        for gi, r in enumerate(fs):
            for si, s in enumerate(series):
                v = r.get(s["id"], 0) or 0
                h2 = (v / mx) * (hgt - 44)
                if h2 <= 0:
                    continue
                c = hx(s["color"])
                bx = ox + (gi * groupW + 9 + si * (bw + 3)) * sx
                by = y0 + hgt - 20 - h2
                p.rect(bx, by, bw * sx, h2, c, min(3, bw * sx / 2))
            p.font("normal", 9.5, C["faint"])
            p.text(month_lbl(r.get("month", "")), ox + (gi * groupW + groupW / 2) * sx, y0 + hgt - 6, "center")
        return y0 + hgt

    def _stacked(self, y0, dept, series, hgt):
        p, C = self.p, self.C
        MX, CWx = self.MX, self.CWx
        fs = dept.get("fs", [])
        n = max(1, len(fs))
        step = max(40, min(70, 600.0 / n))
        rw = min(CWx, n * max(64, step))
        sx = rw / (n * step)
        ox = MX + (CWx - rw) / 2
        totals = [sum((r.get(s["id"], 0) or 0) for s in series) for r in fs]
        mx = max([1] + totals)
        self._grid_lines(ox, rw, y0, hgt)
        for gi, r in enumerate(fs):
            acc = 0
            bx = ox + (gi * step + (step - 24) / 2) * sx
            bwv = 24 * sx
            for si, s in enumerate(series):
                v = r.get(s["id"], 0) or 0
                h2 = (v / mx) * (hgt - 44)
                if h2 <= 0:
                    continue
                by = y0 + hgt - 20 - acc - h2
                acc += h2
                c = hx(s["color"])
                p.rect(bx, by, bwv, h2, c, min(3, bwv / 2) if si == len(series) - 1 else 0)
            p.font("normal", 9.5, C["faint"])
            p.text(month_lbl(r.get("month", "")), ox + (gi * step + step / 2) * sx, y0 + hgt - 6, "center")
        return y0 + hgt

    def _hbar_rows(self, y0, rows):
        p, C = self.p, self.C
        MX, CWx = self.MX, self.CWx
        mx = max([1] + [r["value"] for r in rows])
        y = y0
        for r in rows:
            if y + 20 > self.LIMIT:
                y = self._new_page()
            p.font("bold", 12, C["ink2"])
            p.text(p.clip_text(r["label"], 116), MX, y + 12)
            tx = MX + 130
            twd = CWx - 130 - 64
            p.rect(tx, y + 1.5, twd, 15, C["grid"], 5)
            if r["value"] > 0:
                p.rect(tx, y + 1.5, max(4, twd * (r["value"] / mx)), 15, hx(r["color"]), 5)
            p.font("bold", 12.5, C["ink"])
            p.text(fmt(r["value"]), MX + CWx, y + 12.5, "right")
            y += 24
        return y - 9 + 4

    def _donut(self, x, y, size, thickness, data, center_value, center_label):
        p, C = self.p, self.C
        total = sum(d["value"] for d in data) or 1
        cx = x + size / 2
        cy = y + size / 2
        rO = size / 2
        rI = size / 2 - thickness
        ang = -math.pi / 2
        for i, d in enumerate(data):
            frac = d["value"] / total
            a1 = ang + frac * 2 * math.pi
            if frac > 0:
                p.wedge(cx, cy, rO, rI, ang, a1, hx(d.get("color") or PAL3[i % len(PAL3)]))
            ang = a1
        if center_value is not None:
            p.font("bold", 24, C["ink"])
            p.text(center_value, cx, cy + 3, "center")
            p.font("normal", 10, C["muted"])
            p.text(str(center_label or "").upper(), cx, cy + 16, "center")

    def _donut_legend(self, x, y, data):
        p, C = self.p, self.C
        for i, d in enumerate(data):
            ry = y + i * 21
            p.rect(x, ry, 9, 9, hx(d.get("color") or PAL3[i % len(PAL3)]), 3)
            p.font("normal", 12, C["ink2"])
            p.text(d["label"], x + 17, ry + 9)
        p.font("normal", 12, C["ink2"])
        labw = max(p.tw(d["label"]) for d in data)
        p.font("bold", 12, C["ink"])
        w = 9 + 8 + labw + 14 + max(p.tw(fmt(d["value"])) for d in data)
        for i, d in enumerate(data):
            p.font("bold", 12, C["ink"])
            p.text(fmt(d["value"]), x + w, y + i * 21 + 9, "right")
        return w

    def _donut_legend_w(self, data):
        p, C = self.p, self.C
        p.font("normal", 12, C["ink2"])
        labw = max(p.tw(d["label"]) for d in data)
        p.font("bold", 12, C["ink"])
        return 9 + 8 + labw + 14 + max(p.tw(fmt(d["value"])) for d in data)

    def _donut_block(self, y0, data, hgt):
        MX, CWx = self.MX, self.CWx
        legw = self._donut_legend_w(data)
        size = 188
        legh = len(data) * 21 - 6
        x0 = MX + max(0, (CWx - (size + 18 + legw)) / 2)
        blockH = max(hgt, size)
        self._donut(x0, y0 + (blockH - size) / 2, size, 30, data,
                    fmt(sum(d["value"] for d in data)), "Total")
        self._donut_legend(x0 + size + 18, y0 + (blockH - legh) / 2, data)
        return y0 + blockH

    def _composition_strip(self, y0, data, title):
        p, C = self.p, self.C
        MX, CWx = self.MX, self.CWx
        legh = len(data) * 21 - 6
        boxH = max(124, legh + 20)
        p.rect(MX, y0, CWx, boxH, C["panel2"], 9)
        p.font("bold", 10.5, C["muted"])
        p.text(str(title or "COMPOSITION").upper(), MX + 14, y0 + boxH / 2 + 3)
        dx0 = MX + 14 + 78 + 10
        self._donut(dx0, y0 + (boxH - 104) / 2, 104, 20, data, None, None)
        self._donut_legend(dx0 + 104 + 18, y0 + (boxH - legh) / 2, data)
        return y0 + boxH

    def _chart_h(self, cs, dept):
        cg = dept.get("compGroups", [])
        if cs == "horizontal":
            return max(1, len(dept.get("fs", []))) * 24 - 5
        if cs == "donut":
            return max(205, len(cg) * 210 - 5) if cg else 205
        if cs in ("combo", "pct"):
            return 231
        if cs in ("grouped", "stacked"):
            return 210
        if cs == "area":
            return 200
        if cs in ("bar", "line"):
            return 195
        return 205

    def _draw_chart(self, cs, y, dept, tone):
        chart_rows = dept.get("chartRows", [])
        cg = dept.get("compGroups", [])
        series = dept.get("series", [])
        if cs == "bar":
            return self._bar_flat(y, chart_rows, 195)
        if cs == "line":
            return self._line(y, chart_rows, tone, 195)
        if cs == "area":
            return self._line(y, chart_rows, tone, 200)
        if cs == "grouped" and series:
            return self._grouped(y, dept, series, 210)
        if cs == "stacked" and series:
            return self._stacked(y, dept, series, 210)
        if cs == "pct" and series:
            return self._stacked(y, dept, series, 210)
        if cs == "horizontal":
            rows = [{"label": r.get("full", ""), "value": cr["v"], "color": PAL3[i % len(PAL3)]}
                    for i, (r, cr) in enumerate(zip(dept.get("fs", []), chart_rows))]
            return self._hbar_rows(y, rows)
        if cs == "donut" and cg:
            yy = y
            for g in cg:
                yy = self._donut_block(yy, g["data"], 205) + 8
            return yy
        # bar3d + default (and combo / empty-series fallbacks)
        return self._bar3d(y, chart_rows, 205)

    # ---- table -----------------------------------------------------------
    def _table(self, y, heads, widths, rows, fs=12.5, rpt=False, delta_col=None, total_row=False):
        p, C = self.p, self.C
        MX, CWx = self.MX, self.CWx
        hfs = fs if rpt else 10.5
        padX = 6 if rpt else 12
        padY = 5 if rpt else 8
        rowH = round(fs * 1.3 + padY * 2)
        lh = hfs * 1.18
        xs = []
        ax = MX
        for w in widths:
            xs.append(ax)
            ax += w

        def draw_head(yy):
            p.font("bold", hfs, C["muted"])
            wrapped = [p.wrap(str(h).upper(), max(10, widths[i] - padX - 4)) for i, h in enumerate(heads)]
            maxl = max([1] + [len(w) for w in wrapped])
            hH = round(maxl * lh + padY * 2 + 2)
            p.rect(MX, yy, CWx, hH, C["panel2"])
            for i, lines in enumerate(wrapped):
                right = i > 0
                tx = xs[i] + widths[i] - padX if right else xs[i] + padX
                sy = yy + hH - padY - 3 - (len(lines) - 1) * lh
                for li, ln in enumerate(lines):
                    p.font("bold", hfs, C["muted"])
                    p.text(ln, tx, sy + li * lh, "right" if right else None)
            p.line(MX, yy + hH, MX + CWx, yy + hH, C["line"], 1)
            return yy + hH

        p.font("bold", hfs, C["muted"])
        wrapped0 = [p.wrap(str(h).upper(), max(10, widths[i] - padX - 4)) for i, h in enumerate(heads)]
        hH0 = round(max([1] + [len(w) for w in wrapped0]) * lh + padY * 2 + 2)
        if y + hH0 + rowH > self.LIMIT:
            y = self._new_page()
        y = draw_head(y)
        for ri, r in enumerate(rows):
            if y + rowH > self.LIMIT:
                y = self._new_page()
                y = draw_head(y)
            tot = total_row and ri == len(rows) - 1
            if tot:
                p.rect(MX, y, CWx, rowH, C["panel2"])
                p.line(MX, y, MX + CWx, y, C["line"], 2)
            for ci, cell in enumerate(r):
                if delta_col == ci:
                    self._delta_chip(xs[ci] + widths[ci] - padX, y + (rowH - 18) / 2, int(cell or 0))
                    continue
                right = ci > 0
                p.font("bold" if (ci == 0 or tot) else "normal", fs,
                       C["ink"] if (tot or ci == 0) else C["ink2"])
                p.text(p.clip_text(cell, widths[ci] - padX - 4),
                       xs[ci] + widths[ci] - padX if right else xs[ci] + padX,
                       y + rowH - padY - fs * 0.24, "right" if right else None)
            p.line(MX, y + rowH, MX + CWx, y + rowH, C["line2"], 1)
            y += rowH
        return y

    def _sig_block(self, x0, wAll, y):
        p, C = self.p, self.C
        sig = self.doc.get("sig", {}) or {}
        y += 26
        p.font("bold", 9.5, C["muted"])
        p.text(("Authorisation · " + self.doc.get("hospitalName", "")).upper(), x0, y + 9)
        gap = 22
        w3 = (wAll - 3 * gap) / 4
        ly = y + 9 + 12 + 34
        roles = [("Prepared by", sig.get("prepared")), ("Checked by", sig.get("reviewed")),
                 ("Recommended by", sig.get("recommended")), ("Approved by", sig.get("approved"))]
        for i, (role, name) in enumerate(roles):
            x = x0 + i * (w3 + gap)
            p.line(x, ly, x + w3, ly, C["ink2"], 1)
            p.font("bold", 11, C["ink"])
            p.text(name or " ", x, ly + 14)
            p.font("normal", 9.5, C["muted"])
            p.text(role.upper(), x, ly + 26)
        return ly + 32

    # ---- pages -----------------------------------------------------------
    def _cover_page(self):
        p, C = self.p, self.C
        MX, CWx, MT = self.MX, self.CWx, self.MT
        cov = self.m.get("cover", {}) or {}
        sig = self.doc.get("sig", {}) or {}
        has_sig = bool(sig.get("prepared") or sig.get("reviewed") or sig.get("recommended") or sig.get("approved"))
        confidential = self.doc.get("confidential")
        SIGH = 113
        totalH = 16 + 58 + 17 + 28 + 82 + (54 if confidential else 0) + 29 + (SIGH if has_sig else 0)
        y = MT + max(24, (self.FOOTY - MT - totalH) / 2 + 15)
        p.font("bold", 13, C["blue"])
        p.text(str(self.doc.get("hospitalName", "")).upper(), self.pageW / 2, y + 11, "center")
        y += 16
        p.font("bold", 32, C["ink"])
        p.text(self.doc.get("hdrTitle") or "Patient Statistics Report", self.pageW / 2, y + 40, "center")
        y += 58
        sub = self.doc.get("hdrSub") or ""
        p.font("normal", 13, C["muted"])
        p.text((sub + " · " if sub else "") + cov.get("typeLabel", "Statistical Report"), self.pageW / 2, y + 12, "center")
        y += 17
        p.font("bold", 14, C["ink2"])
        p.text(self.doc.get("rangeLabel", ""), self.pageW / 2, y + 21, "center")
        y += 28
        sw = CWx / 4
        PALV = [hx(c) for c in (self.doc.get("palette") or BARC)]
        stats = [("Departments", str(cov.get("deptCount", 0)), PALV[0]),
                 ("Total patients", fmt(cov.get("totAll", 0)), PALV[1 % len(PALV)]),
                 ("Peak month", cov.get("peakMonthLabel") or "—", PALV[2 % len(PALV)]),
                 ("Months covered", str(cov.get("monthsCovered", 0)), PALV[3 % len(PALV)])]
        for i, (lbl, val, col) in enumerate(stats):
            x = MX + i * sw + sw / 2
            p.font("bold", 26, col)
            p.text(val, x, y + 58, "center")
            p.font("normal", 9.5, C["muted"])
            p.text(str(lbl).upper(), x, y + 72, "center")
        y += 82
        if confidential:
            p.font("bold", 10.5, C["rose"])
            t = "CONFIDENTIAL — FOR AUTHORISED RECIPIENTS ONLY"
            w = p.tw(t) + 28
            p.rect_stroke(self.pageW / 2 - w / 2, y + 28, w, 26, C["roseLine"], 1, 6)
            p.font("bold", 10.5, C["rose"])
            p.text(t, self.pageW / 2, y + 44.5, "center")
            y += 54
        p.font("normal", 10, C["faint"])
        p.text("Generated " + self.doc.get("genDate", ""), self.pageW / 2, y + 24, "center")
        y += 29
        if self.doc.get("showSig") and has_sig:
            self._sig_block(max(MX, (self.pageW - 600) / 2), min(600, CWx), y)

    def _dept_page(self, d):
        p, C = self.p, self.C
        MX, CWx = self.MX, self.CWx
        y = self._page_header()
        fs = d.get("fs", [])
        st = d.get("stat", {}) or {}
        tone = hx(d.get("toneHex") or THEME["blue"])
        p.circle(MX + 8, y + 8, 6, tone)
        p.font("bold", 15, C["ink"])
        p.text(d.get("name", ""), MX + 27, y + 15)
        self._tag_chip(MX + 27 + p.tw(d.get("name", "")) + 9, y + 2, d.get("group", ""))
        if fs:
            self._delta_chip(self.pageW - MX, y + 1, st.get("delta", 0))
        y += 31
        if not fs:
            p.rect_stroke(MX, y, CWx, 96, C["line"], 1, 10, dash=[4, 3])
            p.font("normal", 12.5, C["muted"])
            p.text("No data reported for %s in the selected period (%s)." % (d.get("name", ""), self.doc.get("rangeLabel", "")),
                   MX + CWx / 2, y + 52, "center")
            return
        partial = d.get("partial")
        if partial:
            p.font("normal", 10, C["muted"])
            msg = ("Reported data covers %s – %s (%d of the %d months in the selected period); "
                   "months without a report are not plotted." % (partial.get("from", ""), partial.get("to", ""),
                                                                  partial.get("reported", 0), partial.get("periodMonths", 0)))
            lines = len(p.wrap(msg, CWx - 20))
            boxH = lines * 14 + 10
            p.rect(MX, y, CWx, boxH, C["panel2"], 6)
            cy = y + 15
            for ln in p.wrap(msg, CWx - 20):
                p.font("normal", 10, C["muted"])
                p.text(ln, MX + 10, cy)
                cy += 14
            y += boxH + 10
        y = self._kpi_row(y, [
            {"label": st.get("latestFull") or "Latest", "value": fmt(st.get("latestValue", 0)), "tone": tone},
            {"label": "Total", "value": fmt(st.get("total", 0)), "tone": tone},
            {"label": "Peak", "value": fmt(st.get("peak", 0)), "tone": tone},
            {"label": "Average", "value": fmt(st.get("avg", 0)), "tone": tone}])
        chart_styles = self.doc.get("chartStyles", ["bar3d"]) or ["bar3d"]
        cg = d.get("compGroups", [])
        for cs in chart_styles:
            capH = 18 if len(chart_styles) > 1 else 0
            need = capH + self._chart_h(cs, d) + 12
            if y + need > self.LIMIT and y > self.MT + 71:
                y = self._new_page()
            y += 4
            if len(chart_styles) > 1:
                p.font("bold", 9.5, C["muted"])
                p.text(str(cs).upper(), MX, y + 12)
                y += 18
            y = self._draw_chart(cs, y, d, tone)
            y += 8
        if "donut" not in chart_styles:
            for g in cg:
                boxH = max(124, len(g["data"]) * 21 - 6 + 20)
                if y + 6 + boxH > self.LIMIT:
                    y = self._new_page()
                y = self._composition_strip(y + 6, g["data"], g["title"])
        # table
        detailed = self.doc.get("type") == "detail"
        cols = d.get("cols", [])
        ncol = len(cols) + 1
        tblFont = 8 if ncol > 10 else 8.5 if ncol > 8 else 9.5 if ncol > 6 else (10.5 if detailed else 11)
        rpt = detailed or ncol > 7
        p.font("bold", tblFont, C["muted"])
        if rpt:
            firstW = 58
        else:
            firstW = min(120, max([76] + [p.tw(r.get("month" if detailed else "full", "")) + 24 for r in fs]))
        widths = [firstW] + [(CWx - firstW) / len(cols)] * len(cols) if cols else [firstW]
        rows = []
        for r in fs:
            row = [r.get("month" if detailed else "full", "")]
            for c in cols:
                v = r.get(c["id"])
                row.append("–" if v is None else ((str(v) + "%") if c.get("pct") else fmt(v)))
            rows.append(row)
        if detailed and cols:
            trow = ["TOTAL"]
            for c in cols:
                trow.append("—" if c.get("pct") else fmt(sum((r.get(c["id"]) or 0) for r in fs)))
            rows.append(trow)
        heads = ["Month"] + [c["label"] for c in cols]
        self._table(y + 14, heads, widths, rows, fs=tblFont, rpt=rpt, total_row=detailed)

    def _compare_page(self):
        p, C = self.p, self.C
        MX, CWx = self.MX, self.CWx
        cmp = self.m.get("compare", {}) or {}
        y = self._page_header()
        p.font("bold", 15, C["ink"])
        p.text("Cross-department comparison · %d departments" % len(self.depts), MX, y + 14)
        y += 31
        y = self._hbar_rows(y, cmp.get("hbar", [])) + 16
        widths = [CWx * w for w in (0.22, 0.18, 0.11, 0.11, 0.11, 0.11, 0.16)]
        rows = [[r["name"], r["group"], fmt(r["latest"]), fmt(r["total"]), fmt(r["peak"]), fmt(r["avg"]), r["delta"]]
                for r in cmp.get("rows", [])]
        self._table(y, ["Department", "Service line", "Latest", "Total", "Peak", "Avg", "Trend"],
                    widths, rows, fs=11.5, delta_col=6)

    def _board_page(self):
        p, C = self.p, self.C
        MX, CWx = self.MX, self.CWx
        bd = self.m.get("board", {}) or {}
        PALV = [hx(c) for c in (self.doc.get("palette") or BARC)]
        y = self._page_header()
        p.circle(MX + 8, y + 8, 6, PALV[0])
        p.font("bold", 15, C["ink"])
        p.text("Executive Board Report", MX + 27, y + 15)
        self._tag_chip(MX + 27 + p.tw("Executive Board Report") + 9, y + 2, self.doc.get("rangeLabel", ""))
        rl = "%d departments" % len(self.depts)
        p.font("bold", 10.5, C["blue700"])
        self._tag_chip(self.pageW - MX - (p.tw(rl.upper()) + 16), y + 2, rl)
        y += 31
        kpis = bd.get("kpis", [])
        y = self._kpi_row(y, [{"label": k[0], "value": k[1], "tone": PALV[i % len(PALV)]}
                              for i, k in enumerate(kpis)])
        trend = bd.get("trend", [])
        if len(trend) > 1:
            p.font("bold", 9.5, C["muted"])
            p.text("HOSPITAL VOLUME — MONTHLY TREND", MX, y + 12)
            y += 18
            rows = [{"x": t["label"], "v": t["val"]} for t in trend]
            y = self._bar_flat(y, rows, 170) + 12
        p.font("bold", 9.5, C["muted"])
        p.text("DEPARTMENT RANKING (PERIOD TOTAL)", MX, y + 12)
        y += 20
        y = self._hbar_rows(y, bd.get("hbar", [])) + 14
        widths = [CWx * w for w in (0.24, 0.20, 0.13, 0.11, 0.16, 0.16)]
        rows = [[r["name"], r["group"], fmt(r["total"]), r["share"], fmt(r["avg"]), r["delta"]]
                for r in bd.get("ranked", [])]
        self._table(y, ["Department", "Service line", "Total", "Share", "Avg / month", "Trend"],
                    widths, rows, fs=11, delta_col=5)


# ===========================================================================
# DATA LAYER — reads the `departments` collection from MongoDB and rebuilds the
# render model IN PYTHON, so a Next.js frontend only has to POST a few params
# (deptIds, period, type, chartStyles...). Ports data.js (month catalog),
# store.js recompute (series), and reports.jsx derivations (fseriesOf / statOf /
# compositionGroups / rptChartRows / reportSeries) + buildRenderModel.
# ===========================================================================
_MMM = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
_MFULL = ["January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"]
MONTHS_FULL = {}
MONTH_ORDER = []
for _y in range(2024, 2046):
    for _m in range(12):
        _k = _MMM[_m] + "-" + str(_y)[-2:]
        MONTHS_FULL[_k] = _MFULL[_m] + " " + str(_y)
        MONTH_ORDER.append(_k)
MONTH_INDEX = {k: i for i, k in enumerate(MONTH_ORDER)}


def _load_departments():
    """Read canonical department docs from Atlas (same DB as the Express app)."""
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise RuntimeError("MONGODB_URI is not set — cannot read report data from MongoDB.")
    from pymongo import MongoClient
    dbname = os.environ.get("DB_NAME", "unico")
    client = MongoClient(uri, serverSelectionTimeoutMS=8000)
    try:
        docs = list(client[dbname]["departments"].find({}).sort([("order", 1), ("_id", 1)]))
    finally:
        client.close()
    for d in docs:
        d.pop("_id", None)
    return docs


def _decorate(d):
    """store.js recompute: attach `series` (month/full + row values) + primaryLabel."""
    months = d.get("months") or []
    data = d.get("data") or []
    d["series"] = [dict({"month": months[i], "full": MONTHS_FULL.get(months[i], months[i])},
                        **(data[i] if i < len(data) else {})) for i in range(len(months))]
    if not d.get("primaryLabel"):
        pc = next((c for c in d.get("cols", []) if c["id"] == d.get("primary")), None) or (d.get("cols") or [{}])[0]
        d["primaryLabel"] = pc.get("label") if pc else (d.get("primary") or "")
    return d


def _report_series(d):
    cols = [c for c in d.get("cols", []) if c["id"] != d.get("primary") and not c.get("pct")][:6]
    return [{"id": c["id"], "label": c["label"], "color": PALETTE[i % len(PALETTE)]} for i, c in enumerate(cols)]


def _transfer_in_col(d):
    for c in d.get("cols", []):
        if c["id"] == d.get("primary") or c.get("pct"):
            continue
        cid, lbl = c["id"], (c.get("label") or "")
        if cid in ("tin", "trin", "tr_in") or re.match(r"^\s*tr[\s._-]*in\s*$", lbl, re.I) or re.search(r"transfer\s*[-\s]?in", lbl, re.I):
            return c
    return None


def _admits_primary(d):
    pc = next((c for c in d.get("cols", []) if c["id"] == d.get("primary")), {})
    return (d.get("primary") in ("adm", "admission")
            or re.search(r"admission", pc.get("label") or "", re.I)
            or re.search(r"admission", d.get("primaryLabel") or "", re.I))


def _merge_tin(d):
    return _transfer_in_col(d) if _admits_primary(d) else None


def _chart_rows(d, fs):
    t = _merge_tin(d)
    prim = d.get("primary")
    if not t:
        return [dict(r) for r in fs]
    tid = t["id"]
    return [dict(r, **{prim: (r.get(prim, 0) or 0) + (r.get(tid, 0) or 0)}) for r in fs]


def _composition_groups(d, fs):
    def s(idv):
        return sum((r.get(idv, 0) or 0) for r in fs)

    def colby(idv):
        return next((c for c in d.get("cols", []) if c["id"] == idv), None)

    def mk(ids):
        cs = [c for c in (colby(x) for x in ids) if c]
        out = [{"label": c["label"], "value": s(c["id"]), "color": PALETTE[i % len(PALETTE)]} for i, c in enumerate(cs)]
        return [x for x in out if x["value"] > 0]

    if d.get("id") == "dialysis":
        groups = [{"title": "Patients", "data": mk(["ipd", "opd"])},
                  {"title": "Dialysis Type", "data": mk(["conv", "modi", "sled"])}]
        return [g for g in groups if len(g["data"]) > 1]
    tin = _merge_tin(d)
    show_adm = _admits_primary(d)
    breakdown = [c for c in d.get("cols", []) if c["id"] != d.get("primary") and not c.get("pct") and not (tin and c["id"] == tin["id"])]
    lst = [{"label": c["label"], "value": s(c["id"])} for c in breakdown]
    if show_adm:
        pc = colby(d.get("primary")) or {}
        lst = [{"label": pc.get("label") or d.get("primaryLabel") or "Admission",
                "value": s(d.get("primary")) + (s(tin["id"]) if tin else 0)}] + lst
    data = [{"label": x["label"], "value": x["value"], "color": PALETTE[i % len(PALETTE)]} for i, x in enumerate(lst)]
    data = [x for x in data if x["value"] > 0]
    return [{"title": "Composition", "data": data}] if len(data) > 1 else []


def _stat_of(d, fs):
    prim = d.get("primary")
    total = sum((r.get(prim, 0) or 0) for r in fs)
    latest = fs[-1] if fs else {}
    peak = max((r.get(prim, 0) or 0) for r in fs) if fs else 0
    avg = round(total / len(fs)) if fs else 0
    lv = (fs[-1].get(prim, 0) or 0) if fs else 0
    pv = (fs[-2].get(prim, 0) or 0) if len(fs) > 1 else 0
    if len(fs) < 2:
        delta = 0
    elif pv == 0:
        delta = 100 if lv > 0 else 0
    else:
        delta = round((lv - pv) / pv * 100)
    return {"total": total, "latest": latest, "peak": peak, "avg": avg, "delta": delta}


def _period_months(all_months, period):
    mode = (period or {}).get("mode", "all")
    lyy = all_months[-1].split("-")[1] if all_months else str(datetime.now().year)[-2:]
    if mode == "q1":
        return ["Jan-" + lyy, "Feb-" + lyy, "Mar-" + lyy]
    if mode == "apr":
        return ["Apr-" + lyy]
    if mode == "last6":
        return all_months[-6:]
    if mode == "custom":
        fr, to = period.get("from"), period.get("to")
        fi = all_months.index(fr) if fr in all_months else 0
        ti = all_months.index(to) if to in all_months else len(all_months) - 1
        a, b = min(fi, ti), max(fi, ti)
        return all_months[a:b + 1]
    return list(all_months)


def _tone_of(d):
    idv = d.get("id") or "x"
    return PALETTE[ord(idv[0]) % len(PALETTE)]


def build_model_from_params(params):
    """Next.js entry point: params + MongoDB -> the render model build_pdf() draws."""
    docs = [_decorate(d) for d in _load_departments()]
    by_id = {d["id"]: d for d in docs}
    ids = params.get("deptIds") or [d["id"] for d in docs][:4]
    chosen = [by_id[i] for i in ids if i in by_id]
    all_months = sorted({m for d in docs for m in d.get("months", [])}, key=lambda k: MONTH_INDEX.get(k, 10 ** 9))
    period = params.get("period") or {"mode": "all"}
    pmonths = _period_months(all_months, period)
    pset = set(pmonths)
    rtype = params.get("type", "summary")

    def fseries(d):
        return [r for r in d["series"] if r["month"] in pset]

    range_label = ("%s – %s" % (MONTHS_FULL.get(pmonths[0], pmonths[0]), MONTHS_FULL.get(pmonths[-1], pmonths[-1]))
                   if pmonths else "—")
    rows = [{"d": d, "fs": fseries(d), "st": None} for d in chosen]
    for r in rows:
        r["st"] = _stat_of(r["d"], r["fs"])

    depts = []
    for r in rows:
        d, fs, st = r["d"], r["fs"], r["st"]
        cols = [{"id": c["id"], "label": c["label"], "pct": bool(c.get("pct"))} for c in d.get("cols", [])]
        fs_out = []
        for row in fs:
            o = {"month": row["month"], "full": row["full"]}
            for c in d.get("cols", []):
                o[c["id"]] = row.get(c["id"])
            fs_out.append(o)
        chart = _chart_rows(d, fs)
        depts.append({
            "id": d["id"], "name": d.get("name", ""), "short": d.get("short", ""), "group": d.get("group", ""),
            "primary": d.get("primary"), "primaryLabel": d.get("primaryLabel", ""), "toneHex": _tone_of(d),
            "cols": cols, "fs": fs_out,
            "chartRows": [{"x": rr["month"], "full": rr["full"], "v": rr.get(d.get("primary"), 0) or 0} for rr in chart],
            "series": _report_series(d),
            "stat": {"latestFull": st["latest"].get("full") if st["latest"] else "Latest",
                     "latestValue": (st["latest"].get(d.get("primary"), 0) or 0) if st["latest"] else 0,
                     "total": st["total"], "peak": st["peak"], "avg": st["avg"], "delta": st["delta"]},
            "partial": ({"from": fs[0]["full"], "to": fs[-1]["full"], "reported": len(fs), "periodMonths": len(pmonths)}
                        if (0 < len(fs) < len(pmonths)) else None),
            "compGroups": _composition_groups(d, fs),
        })

    tot_all = sum(r["st"]["total"] for r in rows)
    mtot = {}
    for r in rows:
        for row in r["fs"]:
            mtot[row["month"]] = mtot.get(row["month"], 0) + (row.get(r["d"].get("primary"), 0) or 0)
    peak_m = max(mtot, key=lambda k: mtot[k]) if mtot else None
    trend = [{"label": m.split("-")[0], "val": mtot[m]} for m in pmonths if m in mtot]
    b_peak = max(trend, key=lambda t: t["val"]) if trend else None
    ranked = sorted(rows, key=lambda r: -r["st"]["total"])
    b_top = ranked[0] if ranked else None
    type_label = {"summary": "Department Summary Report", "detail": "Detailed Statistical Report",
                  "compare": "Cross-Department Comparison", "board": "Executive Board Report"}.get(rtype, "Statistical Report")

    board = {
        "kpis": [["Total patients", fmt(tot_all)], ["Departments", str(len(rows))],
                 ["Busiest dept", b_top["d"].get("short") if b_top else "—"],
                 ["Peak month", b_peak["label"] if b_peak else "—"]],
        "trend": trend,
        "hbar": sorted([{"label": r["d"].get("short"), "value": r["st"]["total"], "color": _tone_of(r["d"])} for r in rows],
                       key=lambda x: -x["value"]),
        "ranked": [{"name": r["d"].get("name"), "group": r["d"].get("group", ""), "total": r["st"]["total"],
                    "share": (str(round(r["st"]["total"] * 100 / tot_all)) + "%") if tot_all else "—",
                    "avg": r["st"]["avg"], "delta": r["st"]["delta"]} for r in ranked],
    }
    compare = {
        "hbar": sorted([{"label": r["d"].get("short"), "value": r["st"]["total"], "color": _tone_of(r["d"])} for r in rows],
                       key=lambda x: -x["value"]),
        "rows": [{"name": r["d"].get("name"), "group": r["d"].get("group", ""),
                  "latest": (r["st"]["latest"].get(r["d"].get("primary"), 0) or 0) if r["st"]["latest"] else 0,
                  "total": r["st"]["total"], "peak": r["st"]["peak"], "avg": r["st"]["avg"], "delta": r["st"]["delta"]}
                 for r in rows],
    }
    cover = {"typeLabel": type_label, "deptCount": len(chosen), "totAll": tot_all,
             "peakMonthLabel": (peak_m.split("-")[0] + " 20" + peak_m.split("-")[1]) if peak_m else "—",
             "monthsCovered": len(pmonths)}

    doc = {
        "type": rtype, "pageSize": params.get("pageSize", "A4"), "orient": params.get("orient", "portrait"),
        "hdrTitle": params.get("hdrTitle", "Patient Flow Census"), "hdrSub": params.get("hdrSub", ""),
        "hospitalName": params.get("hospitalName", "UNICO HOSPITALS PLC"), "showLogo": params.get("showLogo", True),
        "confidential": params.get("confidential", True), "footerNote": params.get("footerNote", ""),
        "showCover": params.get("showCover", True) and len(chosen) > 0, "showSig": params.get("showSig", True),
        "rangeLabel": range_label, "genDate": params.get("genDate") or datetime.now().strftime("%m/%d/%Y"),
        "chartStyles": params.get("chartStyles") or ["bar3d"], "sig": params.get("sig") or {}, "palette": PALETTE,
    }
    return {"doc": doc, "depts": depts, "board": board, "compare": compare, "cover": cover}


# ===========================================================================
# QUALITY REPORT — the Quality & Hand Hygiene report (quality-console.jsx).
# Reads the `quality` collection and reproduces the quality PDF: cover,
# per-department summary pages (status chip + KPI cards + zero-defect 3D chart +
# colored indicator×month table), Hand Hygiene page, and compare. Ports the
# authoritative resolvers (qiCompute / monthRaw / qcCellVal / qStatus / deptStat
# / qcDeptKpis / qcHHOf) verbatim so numbers match the app.
# ===========================================================================
QP = {  # quality-console.jsx `P` palette
    "blue": "#0090ca", "blue700": "#0072a3", "teal": "#3ab5a7", "violet": "#6a52d4",
    "green": "#1f9d57", "rose": "#d23a52", "amber": "#e08a1e",
    "ink": "#16202e", "ink2": "#3c4858", "muted": "#6c7a8c", "faint": "#9aa6b4",
    "line": "#dde3ec", "line2": "#e8edf3", "panel2": "#f7f9fc", "white": "#ffffff",
}
Q_PAL = ["#0090ca", "#159fbf", "#2bb3a3", "#46b87e", "#7cc35a", "#f0a93b",
         "#ef8049", "#e85c69", "#e0679b", "#b65cc6", "#6a6fd4", "#4f8df7"]
_STATUS_COL = {"ok": "#1f9d57", "breach": "#d23a52", "na": "#9aa6b4"}
_QC_STYLE_LABEL = {"bar3d": "3D Bars", "bar": "Bar", "line": "Line", "area": "Area + Benchmark",
                   "combo": "Bar + Line", "grouped": "Grouped", "stacked": "Stacked",
                   "pct": "100% Stacked", "horizontal": "Horizontal", "donut": "Composition"}
_FY_MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
_QTAG_FY = ["Q1", "Q1", "Q1", "Q2", "Q2", "Q2", "Q3", "Q3", "Q3", "Q4", "Q4", "Q4"]
_QORDER = ["Q1", "Q2", "Q3", "Q4"]


def _fy_axis(year):
    yy = str(year % 100).zfill(2)
    return [[_FY_MONS[i] + "-" + yy, _FY_MONS[i] + " " + str(year), _QTAG_FY[i]] for i in range(12)]


def _fy_of_key(key):
    p = str(key or "").split("-")
    if len(p) < 2 or p[0] not in _FY_MONS:
        return None
    try:
        return 2000 + int(p[1])
    except ValueError:
        return None


def _qi_compute(f, n, d):
    if n is None or n == "":
        return None
    n = float(n)
    if f in ("count", "direct"):
        return n
    if d is None or d == "" or float(d) == 0:
        return None
    d = float(d)
    if f == "rate1000":
        return round(n / d * 1000 * 100) / 100
    if f == "avg":
        return round(n / d * 100) / 100
    return round(n / d * 100 * 100) / 100  # rate100 & pct


def _month_raw(ind, mk):
    f = ind.get("formula") or ("pct" if ind.get("valueType") == "%" else "direct")
    months = ind.get("months") or {}
    if f == "direct":
        v = months.get(mk)
        return None if (v is None or v == "") else float(v)
    n = (ind.get("mNum") or {}).get(mk)
    if n is None or n == "":
        v = months.get(mk)
        return None if (v is None or v == "") else float(v)
    d = (ind.get("mDen") or {}).get(mk) if f != "count" else None
    r = _qi_compute(f, n, d)
    if r is not None:
        return r
    v = months.get(mk)
    return None if (v is None or v == "") else float(v)


def _q_month_ended(mk):
    p = str(mk or "").split("-")
    if len(p) < 2 or p[0] not in _FY_MONS:
        return False
    try:
        yy = int(p[1])
    except ValueError:
        return False
    mi = _FY_MONS.index(p[0])
    now = datetime.now()
    y = 2000 + yy
    return y < now.year or (y == now.year and mi < now.month - 1)


def _qtr_src(ind, fy):
    qbf = ind.get("quartersByFy") or {}
    if fy is not None and str(fy) in qbf:
        return qbf[str(fy)]
    return ind.get("quarters") or {}


def _qtr_raw(ind, q, fy):
    v = _qtr_src(ind, fy).get(q)
    return None if (v is None or v == "") else float(v)


def _qc_cell_val(ind, m):
    v = _month_raw(ind, m[0])
    if v is not None:
        return v
    if not _q_month_ended(m[0]):
        return None
    fy = _fy_of_key(m[0])
    if fy is None or not m[2]:
        return None
    qmonths = [r for r in _fy_axis(fy) if r[2] == m[2]]
    if any(_month_raw(ind, r[0]) is not None for r in qmonths):
        return None
    return _qtr_raw(ind, m[2], fy)


def _q_status(ind, v):
    if v is None or v == "":
        return "na"
    b = ind.get("benchmarkValue")
    if b is None or b == "":
        return "ok"
    b = float(b)
    if ind.get("goalDirection") == "higher_is_better":
        return "ok" if v >= b else "breach"
    return "ok" if v <= b else "breach"


def _month_status(ind, mk):
    return _q_status(ind, _month_raw(ind, mk))


def _is_pct_ind(ind):
    t = str(ind.get("valueType") or "").lower()
    return "%" in t or t.startswith("per") or ind.get("formula") == "pct"


def _q_fmt(ind, v):
    if v is None or v == "":
        return "—"
    num = round(float(v) * 100) / 100
    if num == int(num):
        num = int(num)
    return ("%s%%" % num) if _is_pct_ind(ind) else "{:,}".format(num)


def _bench_expr(ind):
    bv = ind.get("benchmarkValue")
    if bv is None or bv == "":
        return ind.get("benchmark") or "—"
    op = "≥" if ind.get("goalDirection") == "higher_is_better" else "≤"
    suf = "%" if _is_pct_ind(ind) else ""
    bvn = int(bv) if float(bv) == int(float(bv)) else bv
    return "%s %s%s" % (op, bvn, suf)


def _dept_stat(d, months):
    ok = breach = na = 0
    for ind in d.get("indicators", []):
        for m in months:
            s = _q_status(ind, _qc_cell_val(ind, m))
            if s == "ok":
                ok += 1
            elif s == "breach":
                breach += 1
            else:
                na += 1
    rate = round(ok * 100 / (ok + breach)) if (ok + breach) else 100
    return {"ok": ok, "breach": breach, "na": na, "rate": rate}


def _has_data(ind, months):
    qfy = _fy_of_key(months[0][0]) if months else None
    return (any(_month_raw(ind, m[0]) is not None for m in months)
            or any(_qtr_raw(ind, q, qfy) is not None for q in _QORDER))


def _count_breaches(ind, months):
    return sum(1 for m in months if _q_status(ind, _qc_cell_val(ind, m)) == "breach")


_STATUS_NAME_COL = {"Excellent": "green", "Good": "blue", "Needs Improvement": "rose", "": "muted"}


def _status_color_for(name):
    return QP[_STATUS_NAME_COL.get(name, "muted")]


def _qc_dept_status(d, months):
    st = _dept_stat(d, months)
    tot = st["ok"] + st["breach"]
    br = st["breach"] / tot if tot else 0
    status = "Needs Improvement" if br > 0.16 else "Good" if br > 0.06 else "Excellent"
    return {"status": status, "color": _status_color_for(status), "st": st}


def _qc_dept_kpis(d, months):
    st = _dept_stat(d, months)
    inds = d.get("indicators", [])
    reported = (st["ok"] + st["breach"]) > 0
    latest, latest_status = "—", "na"
    for m in reversed(months):
        rep = any(_month_status(ind, m[0]) != "na" for ind in inds)
        if rep:
            latest = m[1]
            latest_status = "breach" if any(_month_status(ind, m[0]) == "breach" for ind in inds) else "ok"
            break
    if not reported:
        return [["Zero-Defect %", "—", QP["faint"], "no data reported this period"],
                ["Breaches", "—", QP["faint"], "no data reported this period"],
                ["Indicators", str(len(inds)), QP["violet"], "reporting quality KPIs"],
                ["Latest", "—", QP["faint"], "no reported month in this period"]]
    rate = st["rate"]
    rate_col = QP["green"] if rate >= 90 else QP["amber"] if rate >= 70 else QP["rose"]
    lat_mark = "X" if latest_status == "breach" else "OK" if latest_status == "ok" else "·"
    return [["Zero-Defect %", "%d%%" % rate, rate_col, "%d on benchmark · %d breaches" % (st["ok"], st["breach"])],
            ["Breaches", str(st["breach"]), QP["rose"] if st["breach"] else QP["green"], "indicator-months off benchmark"],
            ["Indicators", str(len(inds)), QP["violet"], "reporting quality KPIs"],
            ["Latest", latest.split(" ")[0] + " " + lat_mark,
             _status_color_for("Needs Improvement" if latest_status == "breach" else "Excellent" if latest_status == "ok" else ""),
             "most recent reported month"]]


def _is_event_indicator(ind):
    return ind.get("formula") in ("count", "direct")


def _qc_ind_kpis(ind, months):
    """Indicator-level KPI cards for the Detailed report (ports qcIndKpis)."""
    vals = [_qc_cell_val(ind, m) for m in months]
    q_has_month = {}
    for m in months:
        if _month_raw(ind, m[0]) is not None:
            q_has_month["%s:%s" % (_fy_of_key(m[0]), m[2])] = True
    q_used = set()
    agg = []
    for m in months:
        mv = _month_raw(ind, m[0])
        if mv is not None:
            agg.append(mv)
            continue
        qk = "%s:%s" % (_fy_of_key(m[0]), m[2])
        if q_has_month.get(qk) or qk in q_used:
            continue
        qv = _qtr_raw(ind, m[2], _fy_of_key(m[0]))
        if qv is not None:
            q_used.add(qk)
            agg.append(qv)
    last = None
    for v in reversed(vals):
        if v is not None:
            last = v
            break
    total = sum(agg)
    higher = ind.get("goalDirection") == "higher_is_better"
    peak = (min(agg) if higher else max(agg)) if agg else None
    avg = (total / len(agg)) if agg else None
    event = _is_event_indicator(ind)
    is_ratef = ind.get("formula") in ("pct", "rate100", "rate1000", "avg") or _is_pct_ind(ind)
    lat = _q_status(ind, last)
    cards = [["Latest", "—" if last is None else _q_fmt(ind, last),
              _status_color_for("Needs Improvement" if lat == "breach" else "Excellent" if lat == "ok" else ""),
              _bench_expr(ind)]]
    if event and not is_ratef:
        cards.append(["YTD Total", _q_fmt(ind, total), QP["blue"], "summed over period"])
        cards.append(["Peak (worst)", "—" if peak is None else _q_fmt(ind, peak), QP["amber"], "worst month"])
    elif event:
        ev = 0.0
        has_ev = False
        for m in months:
            n = (ind.get("mNum") or {}).get(m[0])
            if n is not None and n != "":
                ev += float(n)
                has_ev = True
        cards.append(["Total events", (str(int(ev)) if ev == int(ev) else str(ev)) if has_ev else "—",
                      QP["blue"], "numerator sum over period" if has_ev else "no event counts recorded"])
        cards.append(["Peak (worst)", "—" if peak is None else _q_fmt(ind, peak), QP["amber"], "worst month"])
    else:
        cards.append(["Average", "—" if avg is None else _q_fmt(ind, round(avg * 100) / 100), QP["blue"], "mean over period"])
        cards.append(["Worst", "—" if peak is None else _q_fmt(ind, peak), QP["amber"], "lowest month" if higher else "highest month"])
    nb = _count_breaches(ind, months)
    cards.append(["Breaches", str(nb), QP["rose"] if nb > 0 else QP["green"], "months off benchmark"])
    return cards


def _qc_sole_reported_ind(d, months):
    wd = [i for i in d.get("indicators", []) if _has_data(i, months)]
    return wd[0] if len(wd) == 1 else None


def _qc_chart_rows(ind, months):
    rows = []
    for m in months:
        v = _qc_cell_val(ind, m)
        rows.append({"mon": m[1].split(" ")[0], "val": 0 if v is None else v, "has": v is not None})
    return rows


def _qc_dept_summary_rows(d, months):
    inds = d.get("indicators", [])
    out = []
    for m in months:
        ok = breach = 0
        for ind in inds:
            s = _q_status(ind, _qc_cell_val(ind, m))
            if s == "ok":
                ok += 1
            elif s == "breach":
                breach += 1
        tot = ok + breach
        out.append({"mon": m[1].split(" ")[0], "val": round(ok * 100 / tot) if tot else 0, "has": tot > 0})
    return out


def _default_fy_q(docs):
    counts = {}
    for d in docs:
        for ind in d.get("indicators", []):
            for obj in (ind.get("months"), ind.get("mNum")):
                if obj:
                    for k, v in obj.items():
                        if v is not None and v != "":
                            fy = _fy_of_key(k)
                            if fy is not None:
                                counts[fy] = counts.get(fy, 0) + 1
    if not counts:
        return datetime.now().year
    return sorted(counts, key=lambda y: (-counts[y], -y))[0]


def _quality_period(axis, period):
    mode = (period or {}).get("mode", "all")
    seg = {"q1": axis[0:3], "q2": axis[3:6], "q3": axis[6:9], "q4": axis[9:12],
           "h1": axis[0:6], "h2": axis[6:12], "last3": axis[-3:]}
    if mode in seg:
        return seg[mode]
    if mode == "custom":
        keys = [m[0] for m in axis]
        fr, to = period.get("from"), period.get("to")
        fi = keys.index(fr) if fr in keys else 0
        ti = keys.index(to) if to in keys else len(keys) - 1
        a, b = min(fi, ti), max(fi, ti)
        return axis[a:b + 1]
    return list(axis)


def _qc_hh_of(chosen, all_depts, months):
    out = []

    def is_hh(ind):
        nm = (ind.get("name") or "").lower()
        return _is_pct_ind(ind) and ("hygiene" in nm or ("hand" in nm and "hygien" in nm))

    for d in chosen:
        for ind in d.get("indicators", []):
            if is_hh(ind) and any(_month_raw(ind, m[0]) is not None for m in months):
                out.append({"d": d, "ind": ind})
    if not out:
        for d in all_depts:
            for ind in d.get("indicators", []):
                nm = ((d.get("name") or "") + " " + (ind.get("name") or "")).lower()
                if _is_pct_ind(ind) and ("hygiene" in nm or "hand" in nm or "overall" in nm or "hospital" in nm):
                    if any(_month_raw(ind, m[0]) is not None for m in months):
                        out.append({"d": d, "ind": ind})
    return out


def _q_ind_series(d, months):
    inds = [i for i in d.get("indicators", []) if _has_data(i, months)][:6]
    return [{"id": "i%d" % k, "label": ind.get("name", ""), "color": Q_PAL[k % len(Q_PAL)]} for k, ind in enumerate(inds)]


def _q_dept_compare_rows(d, months):
    inds = [i for i in d.get("indicators", []) if _has_data(i, months)][:6]
    out = []
    for m in months:
        row = {"mon": m[1].split(" ")[0]}
        for k, ind in enumerate(inds):
            v = _qc_cell_val(ind, m)
            row["i%d" % k] = v if v is not None else 0
        out.append(row)
    return out


def _q_donut_data(d, months):
    out = [{"label": ind.get("name", ""), "value": _count_breaches(ind, months), "color": Q_PAL[k % len(Q_PAL)]}
           for k, ind in enumerate(d.get("indicators", []))]
    return [x for x in out if x["value"] > 0]


def _load_quality():
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise RuntimeError("MONGODB_URI is not set — cannot read quality data from MongoDB.")
    from pymongo import MongoClient
    dbname = os.environ.get("DB_NAME", "unico")
    client = MongoClient(uri, serverSelectionTimeoutMS=8000)
    try:
        docs = list(client[dbname]["quality"].find({}))
    finally:
        client.close()
    for d in docs:
        d.pop("_id", None)
    return docs


def build_quality_model_from_params(params, docs=None):
    docs = docs if docs is not None else _load_quality()
    by_key = {}
    for d in docs:
        by_key[d.get("key") or d.get("name")] = d
    fy = int(params.get("fy") or _default_fy_q(docs))
    axis = _fy_axis(fy)
    sel = _quality_period(axis, params.get("period") or {"mode": "all"})
    rtype = params.get("type", "summary")
    ids = params.get("deptIds") or params.get("deptKeys")
    chosen = [by_key[k] for k in ids if k in by_key] if ids else list(docs)
    scope = docs if rtype == "handhygiene" else chosen
    pmonths = [m for m in sel if any(_qc_cell_val(ind, m) is not None
                                     for d in scope for ind in d.get("indicators", []))]
    if not pmonths:
        pmonths = sel
    range_label = ("%s – %s" % (pmonths[0][1], pmonths[-1][1])) if pmonths else "—"
    doc = {
        "type": rtype, "pageSize": params.get("pageSize", "A4"), "orient": params.get("orient", "portrait"),
        "hdrTitle": params.get("hdrTitle", "Quality Indicator Report"), "hdrSub": params.get("hdrSub", ""),
        "orgName": params.get("hospitalName") or params.get("orgName", "UNICO HOSPITALS PLC"),
        "confidential": params.get("confidential", True), "footerNote": params.get("footerNote", ""),
        "showCover": params.get("showCover", True), "showSig": params.get("showSig", True),
        "rangeLabel": range_label, "genDate": params.get("genDate") or datetime.now().strftime("%m/%d/%Y"),
        "sig": params.get("sig") or {}, "fy": fy, "fyLabel": "Year %d" % fy,
    }
    return {"quality": True, "doc": doc, "depts": chosen, "allDepts": docs, "pMonths": pmonths, "fy": fy}


class QualityReport:
    """Quality & Hand Hygiene report — works directly in points (S=1) to match the
    quality-console.jsx vector exporter geometry (M=42, CW=PW-84)."""

    def __init__(self, model):
        self.m = model or {}
        self.doc = self.m.get("doc", {})
        self.depts = self.m.get("depts", [])
        self.all_depts = self.m.get("allDepts", self.depts)
        self.pmonths = self.m.get("pMonths", [])
        ps = self.doc.get("pageSize", "A4")
        self.pageSize = ps if ps in _PT else "A4"
        self.orient = self.doc.get("orient", "portrait")
        self.C = {k: hx(v) for k, v in QP.items()}
        self.M = 42
        self.sections = self.doc.get("sections") or {}
        self._lead = True

    def _size(self):
        s = _PT[self.pageSize]
        return landscape(s) if self.orient == "landscape" else s

    def build(self):
        buf = io.BytesIO()
        size = self._size()
        c = canvas.Canvas(buf, pagesize=size)
        self.PW, self.PH = size
        self.CW = self.PW - 84
        self.p = Pen(c, 1.0, self.PH)
        self._first = True

        t = self.doc.get("type", "summary")
        if self.doc.get("showCover") and self.depts:
            self._cover()
            self._first = False
        if t == "handhygiene":
            self._new_if_needed()
            self._hh_page()
        elif t == "compare":
            self._new_if_needed()
            self._compare_page()
        elif t == "detail":
            for d in self.depts:
                inds = d.get("indicators", [])
                if not inds:
                    self._new_if_needed()
                    self._dept_page(d)
                    continue
                for ind in inds:
                    self._new_if_needed()
                    self._detail_page(d, ind)
        else:
            for d in self.depts:
                self._new_if_needed()
                self._dept_page(d)
        c.save()
        return buf.getvalue()

    def _new_if_needed(self):
        if self._first:
            self._first = False
        else:
            self.p.c.showPage()

    def _new_page(self):
        self.p.c.showPage()
        return self._header()

    # ---- chrome ----
    def _header(self):
        p, C, M, PW = self.p, self.C, self.M, self.PW
        p.font("bold", 13, C["ink"])
        p.text(self.doc.get("hdrTitle") or "Quality Indicator Report", M, M + 13)
        sub = self.doc.get("hdrSub") or ""
        rl = self.doc.get("rangeLabel") or ""
        p.font("normal", 8, C["muted"])
        p.text(((sub + " · " if sub else "") + rl).upper(), M, M + 25)
        p.font("normal", 8, C["faint"])
        p.text("Generated", PW - M, M + 11, "right")
        p.font("bold", 8, C["ink2"])
        p.text(self.doc.get("genDate", ""), PW - M, M + 23, "right")
        p.line(M, M + 33, PW - M, M + 33, C["blue"], 2)
        self._footer()
        return M + 33 + 16

    def _footer(self):
        p, C, M, PW, PH = self.p, self.C, self.M, self.PW, self.PH
        p.line(M, PH - 30, PW - M, PH - 30, C["line"], 1)
        p.font("normal", 8, C["faint"])
        p.text(self.doc.get("orgName", ""), M, PH - 18)
        if self.doc.get("confidential"):
            p.text("CONFIDENTIAL", PW - M, PH - 18, "right")

    def _kpi_row(self, y, items):
        p, C, M, CW = self.p, self.C, self.M, self.CW
        if not items:
            return y
        gap = 10
        w = (CW - gap * (len(items) - 1)) / len(items)
        for i, it in enumerate(items):
            x = M + i * (w + gap)
            p.rect(x, y, w, 46, C["panel2"], 5)
            tone = it.get("tone") or C["blue"]
            p.rect(x, y, 3, 46, tone)
            p.font("normal", 6.4, C["muted"])
            p.text(p.clip_text(str(it["label"]).upper(), w - 14), x + 10, y + 13)
            p.font("bold", 14, tone if it.get("toneVal") else C["ink"])
            p.text(p.clip_text(str(it["value"]), w - 14), x + 10, y + 31)
            if it.get("foot"):
                p.font("normal", 5.6, C["faint"])
                p.text(p.clip_text(str(it["foot"]), w - 14), x + 10, y + 41)
        return y + 46 + 12

    def _v_bars(self, y, ind, rows, hgt=165):
        """Isometric 3D bars — the SAME renderer the statistics report uses
        (charts3d.jsx Bar3D): iso floor grid, per-month palette, value + month
        labels. Percentage charts scale against 100 so 80% reads as 80% height."""
        p, C, M, CW = self.p, self.C, self.M, self.CW
        n = max(1, len(rows))
        vals = [float(r.get("val") or 0) for r in rows]
        pct = _is_pct_ind(ind)
        dmax = max(vals) if vals else 0
        mx = 100.0 if (pct and dmax <= 100) else max([1.0] + vals)
        dx, dy = 13, -9
        step = max(46.0, min(78.0, 640.0 / n))
        Wv = n * step + dx + 10
        baseY = hgt - 26
        bw = min(30.0, step - 22)
        s3 = min(CW / Wv, 1)
        ox = M + (CW - Wv * s3) / 2
        oy = y + (hgt - hgt * s3) / 2
        grid3, grid = hx("#e9edf3"), hx("#eef1f5")

        def gx(v):
            return ox + v * s3

        def gy(v):
            return oy + v * s3

        for g in (0, .25, .5, .75, 1):
            gyv = baseY - g * (hgt - 58)
            p.line(gx(0), gy(gyv), gx(n * step), gy(gyv), grid3, s3)
            p.line(gx(n * step), gy(gyv), gx(n * step + dx), gy(gyv + dy), grid, s3)
        for i, r in enumerate(rows):
            v = float(r.get("val") or 0)
            bh = (v / mx) * (hgt - 58) if v > 0 else 2
            bx = i * step + 12
            by = baseY - bh
            c = hx(Q_PAL[i % len(Q_PAL)])
            p.tri(gx(bx + bw), gy(by), gx(bx + bw + dx), gy(by + dy), gx(bx + bw + dx), gy(baseY + dy), lift(c, -44))
            p.tri(gx(bx + bw), gy(by), gx(bx + bw + dx), gy(baseY + dy), gx(bx + bw), gy(baseY), lift(c, -44))
            p.tri(gx(bx), gy(by), gx(bx + dx), gy(by + dy), gx(bx + bw + dx), gy(by + dy), lift(c, 46))
            p.tri(gx(bx), gy(by), gx(bx + bw + dx), gy(by + dy), gx(bx + bw), gy(by), lift(c, 46))
            p.rect(gx(bx), gy(by), bw * s3, max(bh, 0.1) * s3, c)
            p.font("bold", 11 * s3, C["ink"])
            p.text(_q_fmt(ind, v), gx(bx + bw / 2 + dx / 2), gy(by + dy - 6), "center")
            p.font("normal", 9.5 * s3, C["faint"])
            p.text(str(r.get("mon", "")), gx(bx + bw / 2), gy(hgt - 6), "center")
        return y + hgt

    def _dept_table(self, y, d):
        p, C, M, CW, PH = self.p, self.C, self.M, self.CW, self.PH
        inds = d.get("indicators", [])
        mcols = self.pmonths
        if not mcols:
            return y
        nameW = min(150, max(96, CW * 0.26))
        benchW = 54
        mW = (CW - nameW - benchW) / len(mcols)
        rowH, headH = 13, 15

        def head(yy):
            p.rect(M, yy, CW, headH, C["blue"])
            p.font("bold", 6.4, C["white"])
            p.text("INDICATOR", M + 4, yy + 10)
            p.text("BENCH", M + nameW + 3, yy + 10)
            for i, m in enumerate(mcols):
                p.text(m[1].split(" ")[0][:3].upper(), M + nameW + benchW + i * mW + mW / 2, yy + 10, "center")
            return yy + headH

        y = head(y)
        for ri, ind in enumerate(inds):
            if y + rowH > PH - 40:
                y = self._new_page()
                y = head(y)
            if ri % 2:
                p.rect(M, y, CW, rowH, hx("#f7fafd"))
            p.font("normal", 6.6, C["ink"])
            p.text(p.clip_text(ind.get("name", ""), nameW - 6), M + 4, y + 9)
            p.font("normal", 5.8, C["muted"])
            p.text(p.clip_text(_bench_expr(ind), benchW - 3), M + nameW + 2, y + 9)
            for i, m in enumerate(mcols):
                v = _qc_cell_val(ind, m)
                s = _q_status(ind, v)
                cx = M + nameW + benchW + i * mW + mW / 2
                p.font("normal", 6.2, hx(_STATUS_COL[s]))
                p.text("·" if s == "na" else p.clip_text(_q_fmt(ind, v), mW - 1), cx, y + 9, "center")
            y += rowH
            p.line(M, y, M + CW, y, C["line"], 0.35)
        return y + 12

    def _sig_block(self, y):
        p, C, M, CW, PH = self.p, self.C, self.M, self.CW, self.PH
        sig = self.doc.get("sig") or {}
        if not self.doc.get("showSig"):
            return y
        if not (sig.get("prepared") or sig.get("reviewed") or sig.get("recommended") or sig.get("approved")):
            return y
        y = max(y + 8, PH - 118)
        p.font("bold", 7, C["muted"])
        p.text(("AUTHORISATION · " + str(self.doc.get("orgName") or "")).upper(), M, y)
        cols = [("Prepared by", sig.get("prepared")), ("Checked by", sig.get("reviewed")),
                ("Recommended by", sig.get("recommended")), ("Approved by", sig.get("approved"))]
        cw = CW / 4
        for i, (role, name) in enumerate(cols):
            x = M + i * cw
            p.line(x, y + 42, x + cw - 22, y + 42, C["ink2"], 0.8)
            p.font("bold", 8.5, C["ink"])
            p.text(p.clip_text(name or "", cw - 26), x, y + 54)
            p.font("normal", 6.2, C["muted"])
            p.text(role.upper(), x, y + 63)
        return y + 72

    def _status_chip(self, xr, y, label, color):
        p = self.p
        p.font("bold", 7.5, color)
        p.text(str(label).upper(), xr, y, "right")

    # ---- pages ----
    def _cover(self):
        p, C, M, CW = self.p, self.C, self.M, self.CW
        y = self._header()
        p.font("bold", 24, C["ink"])
        p.text(p.clip_text(self.doc.get("hdrTitle") or "Quality Indicator Report", CW), M, y + 34)
        p.font("normal", 12, C["muted"])
        p.text(str(self.doc.get("rangeLabel", "")), M, y + 54)
        ok = breach = inds = 0
        for d in self.depts:
            s = _dept_stat(d, self.pmonths)
            ok += s["ok"]
            breach += s["breach"]
            inds += len(d.get("indicators", []))
        any_rep = (ok + breach) > 0
        rate = round(ok * 100 / (ok + breach)) if any_rep else None
        rate_col = C["muted"] if not any_rep else C["green"] if rate >= 90 else C["amber"] if rate >= 70 else C["rose"]
        self._kpi_row(y + 72, [
            {"label": "Zero-Defect %", "value": (str(rate) + "%") if any_rep else "—", "tone": rate_col, "toneVal": True,
             "foot": ("%d on benchmark" % ok) if any_rep else "no data reported this period"},
            {"label": "Breaches", "value": str(breach) if any_rep else "—",
             "tone": (C["muted"] if not any_rep else C["rose"] if breach else C["green"]), "toneVal": True,
             "foot": "indicator-months off benchmark" if any_rep else "no data reported this period"},
            {"label": "Departments", "value": str(len(self.depts)), "tone": C["blue"], "foot": "in this report"},
            {"label": "Indicators", "value": str(inds), "tone": C["violet"], "foot": "quality KPIs"},
        ])
        self._sig_block(self.PH - 118)

    def _exec_summary(self, y, text, tone):
        p, C, M, CW = self.p, self.C, self.M, self.CW
        p.font("normal", 9.5, C["ink2"])
        lines = p.wrap(text, CW - 30)
        boxH = 26 + len(lines) * 13 + 8
        if y + boxH > self.PH - 40:
            y = self._new_page()
        p.rect(M, y, CW, boxH, C["panel2"], 8)
        p.rect(M, y, 4, boxH, hx(tone))
        p.font("bold", 7, C["muted"])
        p.text("EXECUTIVE SUMMARY", M + 16, y + 15)
        cy = y + 30
        for ln in lines:
            p.font("normal", 9.5, C["ink2"])
            p.text(ln, M + 16, cy)
            cy += 13
        return y + boxH + 10

    def _q_tag(self, x, y, txt):
        p, C = self.p, self.C
        p.font("bold", 7, C["blue700"])
        t = str(txt).upper()
        w = p.tw(t) + 12
        p.rect(x, y, w, 14, hx("#eef8fc"), 4)
        p.font("bold", 7, C["blue700"])
        p.text(t, x + 6, y + 9)
        return w

    def _chart(self, cs, y, ind, rows, d):
        if cs == "bar":
            return self._q_bar_flat(y, ind, rows)
        if cs == "line":
            return self._q_line(y, ind, rows, False)
        if cs == "area":
            return self._q_line(y, ind, rows, True)
        if cs == "horizontal":
            return self._q_hbar(y, ind, rows)
        if cs == "combo":
            return self._q_combo(y, ind, rows)
        if cs == "donut":
            return self._q_donut_chart(y, d)
        if cs in ("grouped", "stacked", "pct"):
            series = _q_ind_series(d, self.pmonths)
            if len(series) > 1:
                return self._q_multi(y, _q_dept_compare_rows(d, self.pmonths), series, cs)
            return self._q_bar_flat(y, ind, rows)
        return self._v_bars(y, ind, rows)  # bar3d + default

    def _q_hbar(self, y, ind, rows, hgt=None):
        p, C, M, CW = self.p, self.C, self.M, self.CW
        n = max(1, len(rows))
        vals = [float(r.get("val") or 0) for r in rows]
        pct = _is_pct_ind(ind)
        mx = 100.0 if (pct and (max(vals) if vals else 0) <= 100) else max([1.0] + vals)
        ry = y
        for r in rows:
            if ry + 22 > self.PH - 40:
                ry = self._new_page()
            v = float(r.get("val") or 0)
            p.font("bold", 9, C["ink2"])
            p.text(str(r.get("mon", "")), M, ry + 11)
            tx = M + 70
            twd = CW - 70 - 60
            p.rect(tx, ry + 1.5, twd, 13, hx("#eef1f5"), 4)
            if v > 0:
                p.rect(tx, ry + 1.5, max(4, twd * (v / mx)), 13, hx(QP["teal"]), 4)
            p.font("bold", 9, C["ink"])
            p.text(_q_fmt(ind, v), M + CW, ry + 11, "right")
            ry += 22
        return ry + 4

    def _q_combo(self, y, ind, rows, hgt=165):
        # bars (value) + a dashed benchmark line
        p, C, M, CW = self.p, self.C, self.M, self.CW
        bench = None
        bv = ind.get("benchmarkValue")
        if bv is not None and bv != "":
            bench = float(bv)
        elif _is_pct_ind(ind):
            bench = 90.0
        y2 = self._q_bar_flat(y, ind, rows, hgt)
        if bench is not None:
            n = max(1, len(rows))
            vals = [float(r.get("val") or 0) for r in rows]
            pct = _is_pct_ind(ind)
            mx = 100.0 if (pct and (max(vals) if vals else 0) <= 100) else max([1.0] + vals + [bench])
            rw = min(CW, n * 74.0)
            ox = M + (CW - rw) / 2
            ly = y + hgt - 20 - (bench / mx) * (hgt - 44)
            try:
                p.c.setDash([3, 3])
                p.line(ox, ly, ox + rw, ly, C["rose"], 1)
                p.c.setDash([])
            except Exception:
                pass
            p.font("bold", 7, C["rose"])
            p.text("benchmark %s" % _q_fmt(ind, bench), ox + rw, ly - 3, "right")
        return y2

    def _q_donut_chart(self, y, d, hgt=185):
        p, C, M, CW = self.p, self.C, self.M, self.CW
        data = _q_donut_data(d, self.pmonths)
        center = "Breaches"
        if not data:
            data = [x for x in [
                {"label": "On benchmark", "value": _dept_stat(d, self.pmonths)["ok"], "color": "#2fb56a"},
                {"label": "Breaches", "value": _dept_stat(d, self.pmonths)["breach"], "color": "#e2445c"},
                {"label": "Not reported", "value": _dept_stat(d, self.pmonths)["na"], "color": "#c3ccd8"}] if x["value"] > 0]
            center = "Ind-months"
        if not data:
            return y + hgt
        size = 150
        cx = M + 30 + size / 2
        self._q_donut(M + 30, y + (hgt - size) / 2, size, 26, data)
        total = sum(x["value"] for x in data)
        p.font("bold", 16, C["ink"])
        p.text(str(total), cx, y + hgt / 2, "center")
        p.font("normal", 7, C["muted"])
        p.text(center.upper(), cx, y + hgt / 2 + 12, "center")
        lx = M + 30 + size + 30
        ly = y + (hgt - len(data) * 20) / 2 + 12
        for i, dd in enumerate(data):
            ry = ly + i * 20
            p.rect(lx, ry - 8, 10, 10, hx(dd["color"]), 2)
            p.font("normal", 9.5, C["ink2"])
            p.text(p.clip_text(dd["label"], CW - (lx - M) - 60), lx + 16, ry)
            p.font("bold", 9.5, C["ink"])
            p.text(str(dd["value"]), M + CW, ry, "right")
        return y + hgt

    def _q_multi(self, y, comp, series, mode, hgt=185):
        p, C, M, CW = self.p, self.C, self.M, self.CW
        n = max(1, len(comp))
        ns = max(1, len(series))
        ox, rw = M, CW
        for g in (0, .25, .5, .75, 1):
            yy = y + hgt - 20 - g * (hgt - 44)
            p.line(ox, yy, ox + rw, yy, hx("#eef1f5"), 0.75)
        step = rw / n
        if mode == "grouped":
            mx = max([1.0] + [float(r.get(s["id"], 0) or 0) for r in comp for s in series])
            bw = min(14.0, (step * 0.7) / ns)
            for gi, r in enumerate(comp):
                x0 = ox + gi * step + (step - (bw * ns + 2 * (ns - 1))) / 2
                for si, s in enumerate(series):
                    v = float(r.get(s["id"], 0) or 0)
                    bh = (v / mx) * (hgt - 44)
                    if bh <= 0:
                        continue
                    bx = x0 + si * (bw + 2)
                    p.rect(bx, y + hgt - 20 - bh, bw, bh, hx(s["color"]), min(3, bw / 2))
                p.font("normal", 8, C["faint"])
                p.text(str(r.get("mon", "")), ox + gi * step + step / 2, y + hgt - 6, "center")
        else:  # stacked / pct
            bw = min(30.0, step * 0.5)
            for gi, r in enumerate(comp):
                tot = sum(float(r.get(s["id"], 0) or 0) for s in series)
                denom = tot if (mode == "pct" and tot > 0) else None
                mx = 1.0 if mode == "pct" else max([1.0] + [sum(float(rr.get(s["id"], 0) or 0) for s in series) for rr in comp])
                bx = ox + gi * step + (step - bw) / 2
                acc = 0.0
                for si, s in enumerate(series):
                    v = float(r.get(s["id"], 0) or 0)
                    frac = (v / denom) if denom else (v / mx)
                    bh = frac * (hgt - 44)
                    if bh <= 0:
                        continue
                    by = y + hgt - 20 - acc - bh
                    acc += bh
                    p.rect(bx, by, bw, bh, hx(s["color"]), min(3, bw / 2) if si == len(series) - 1 else 0)
                p.font("normal", 8, C["faint"])
                p.text(str(r.get("mon", "")), bx + bw / 2, y + hgt - 6, "center")
        # legend
        ly = y + hgt + 6
        lx = ox
        for s in series:
            p.rect(lx, ly, 9, 9, hx(s["color"]), 2)
            p.font("normal", 8, C["ink2"])
            lbl = p.clip_text(s["label"], 120)
            p.text(lbl, lx + 13, ly + 8)
            lx += 13 + p.tw(lbl) + 16
            if lx > ox + CW - 80:
                lx = ox
                ly += 14
        return ly + 16

    def _q_bar_flat(self, y, ind, rows, hgt=165):
        p, C, M, CW = self.p, self.C, self.M, self.CW
        n = max(1, len(rows))
        vals = [float(r.get("val") or 0) for r in rows]
        pct = _is_pct_ind(ind)
        mx = 100.0 if (pct and (max(vals) if vals else 0) <= 100) else max([1.0] + vals)
        rw = min(CW, n * 74.0)
        sx = rw / (n * 54.0)
        ox = M + (CW - rw) / 2
        for g in (0, .25, .5, .75, 1):
            yy = y + hgt - 20 - g * (hgt - 44)
            p.line(ox, yy, ox + rw, yy, hx("#eef1f5"), 0.75)
        for i, r in enumerate(rows):
            v = float(r.get("val") or 0)
            bh = (v / mx) * (hgt - 44)
            c = hx(Q_PAL[i % len(Q_PAL)])
            bx = ox + (i * 54 + 14) * sx
            bwv = 26 * sx
            by = y + hgt - 20 - bh
            p.rect(bx, by, bwv, max(bh, 0.1), c, min(4, bwv / 2))
            if v > 0:
                p.font("bold", 9, c)
                p.text(_q_fmt(ind, v), bx + bwv / 2, by - 5, "center")
            p.font("normal", 8, C["faint"])
            p.text(str(r.get("mon", "")), bx + bwv / 2, y + hgt - 6, "center")
        return y + hgt

    def _q_line(self, y, ind, rows, area, hgt=165):
        p, C, M, CW = self.p, self.C, self.M, self.CW
        n = len(rows)
        if not n:
            return y + hgt
        vals = [float(r.get("val") or 0) for r in rows]
        pct = _is_pct_ind(ind)
        mx = 100.0 if (pct and (max(vals) if vals else 0) <= 100) else max([1.0] + vals)
        ox, rw = M, CW
        tone = hx(QP["teal"])

        def px(i):
            return ox + rw * (0.05 + (0 if n <= 1 else i / (n - 1)) * 0.9)

        def py(v):
            return y + hgt - 20 - (v / mx) * (hgt - 36)

        for g in (0, .25, .5, .75, 1):
            yy = y + 16 + g * (hgt - 36)
            p.line(ox, yy, ox + rw, yy, hx("#eef1f5"), 0.75)
        pts = [(px(i), py(float(r.get("val") or 0))) for i, r in enumerate(rows)]
        if area and n > 1:
            p.polygon(pts + [(pts[-1][0], y + hgt - 20), (pts[0][0], y + hgt - 20)], mixw(tone, 0.14))
        if n > 1:
            p.polyline(pts, tone, 2)
        for i, pt in enumerate(pts):
            v = float(rows[i].get("val") or 0)
            p.circle(pt[0], pt[1], 2.6, C["white"], tone, 2)
            p.font("bold", 7.5, C["ink2"])
            p.text(_q_fmt(ind, v), pt[0], pt[1] - 6, "center")
            p.font("normal", 8, C["faint"])
            p.text(str(rows[i].get("mon", "")), pt[0], y + hgt - 6, "center")
        return y + hgt

    def _dept_page(self, d):
        p, C, M, CW, PW = self.p, self.C, self.M, self.CW, self.PW
        sec = self.sections
        y = self._header()
        if self._lead and sec.get("execSummary", True) is not False and self.doc.get("execSummary"):
            y = self._exec_summary(y, self.doc["execSummary"], self.doc.get("execTone", "#6c7a8c"))
        self._lead = False
        ds = _qc_dept_status(d, self.pmonths)
        st = ds["st"]
        reported = (st["ok"] + st["breach"]) > 0
        p.font("bold", 15, C["ink"])
        name = p.clip_text(d.get("name", ""), CW - 220)
        p.text(name, M, y + 4)
        if d.get("secLabel"):
            self._q_tag(M + p.tw(name) + 10, y - 6, d["secLabel"])
        if reported:
            self._status_chip(PW - M, y + 2, ds["status"], hx(_STATUS_COL["breach" if st["breach"] else "ok"]))
        else:
            self._status_chip(PW - M, y + 2, "NO DATA", C["muted"])
        y += 18
        if sec.get("kpis", True) is not False:
            kp = _qc_dept_kpis(d, self.pmonths)
            y = self._kpi_row(y, [{"label": k[0], "value": k[1], "tone": hx(k[2]), "toneVal": True, "foot": k[3]} for k in kp])
        sole = _qc_sole_reported_ind(d, self.pmonths)
        rows = [r for r in (_qc_chart_rows(sole, self.pmonths) if sole else _qc_dept_summary_rows(d, self.pmonths)) if r["has"]]
        if rows and sec.get("chart", True) is not False:
            cap = (sole.get("name") + " — monthly value vs benchmark") if sole else "Zero-defect % by month — reported indicators on benchmark"
            p.font("bold", 8, C["ink2"])
            p.text(p.clip_text(cap.upper(), CW), M, y + 2)
            y += 6
            cind = sole or {"valueType": "%"}
            styles = self.doc.get("chartStyles") or ["bar3d"]
            for cs in styles:
                if len(styles) > 1:
                    p.font("bold", 7, C["muted"])
                    p.text(_QC_STYLE_LABEL.get(cs, cs).upper(), M, y + 10)
                    y += 14
                y = self._chart(cs, y + 8, cind, rows, d) + 4
        if sec.get("breachDonut", True) is not False:
            y = self._status_mix(y + 6, d)
        if sec.get("table", True) is not False:
            self._dept_table(y + 4, d)

    def _indicator_detail(self, y, d, ind):
        p, C, M, CW = self.p, self.C, self.M, self.CW
        ft = ind.get("formulaText") or ""
        parts = []
        if ind.get("numeratorDef"):
            parts.append("Numerator: " + str(ind["numeratorDef"]))
        if ind.get("denominatorDef"):
            parts.append("Denominator: " + str(ind["denominatorDef"]))
        bench_line = "Benchmark " + _bench_expr(ind)
        if ind.get("indSec"):
            bench_line += " · " + ind["indSec"]
        p.font("normal", 9.5, C["ink2"])
        chunks = ([("mono", l) for l in p.wrap(ft, CW - 30)] if ft else [])
        for pt in parts:
            chunks += [("body", l) for l in p.wrap(pt, CW - 30)]
        chunks += [("muted", l) for l in p.wrap(bench_line, CW - 30)]
        boxH = 24 + 13 * len(chunks) + 8
        y += 14
        if y + boxH > self.PH - 40:
            y = self._new_page()
        p.rect(M, y, CW, boxH, C["panel2"], 9)
        p.font("bold", 7, C["muted"])
        p.text("DEFINITION & FORMULA", M + 14, y + 14)
        cy = y + 30
        for kind, ln in chunks:
            col = C["ink"] if kind == "mono" else C["muted"] if kind == "muted" else C["ink2"]
            p.font("normal", 9 if kind == "mono" else 9.5, col)
            p.text(ln, M + 14, cy)
            cy += 13
        return y + boxH + 10

    def _detail_page(self, d, ind):
        p, C, M, CW, PW = self.p, self.C, self.M, self.CW, self.PW
        sec = self.sections
        y = self._header()
        if self._lead and sec.get("execSummary", True) is not False and self.doc.get("execSummary"):
            y = self._exec_summary(y, self.doc["execSummary"], self.doc.get("execTone", "#6c7a8c"))
        self._lead = False
        ds = _qc_dept_status(d, self.pmonths)
        st = ds["st"]
        reported = (st["ok"] + st["breach"]) > 0
        p.font("bold", 15, C["ink"])
        title = p.clip_text("%s · %s" % (d.get("name", ""), ind.get("name", "")), CW - 140)
        p.text(title, M, y + 4)
        self._status_chip(PW - M, y + 2, ds["status"] if reported else "NO DATA",
                          hx(_STATUS_COL["breach" if st["breach"] else "ok"]) if reported else C["muted"])
        y += 18
        if sec.get("kpis", True) is not False:
            kp = _qc_ind_kpis(ind, self.pmonths)
            y = self._kpi_row(y, [{"label": k[0], "value": k[1], "tone": hx(k[2]), "toneVal": True, "foot": k[3]} for k in kp])
        if sec.get("chart", True) is not False:
            rows = [r for r in _qc_chart_rows(ind, self.pmonths) if r["has"]]
            if rows:
                p.font("bold", 8, C["ink2"])
                p.text(p.clip_text((ind.get("name", "") + " — monthly value vs benchmark").upper(), CW), M, y + 2)
                y += 6
                styles = self.doc.get("chartStyles") or ["bar3d"]
                for cs in styles:
                    if len(styles) > 1:
                        p.font("bold", 7, C["muted"])
                        p.text(_QC_STYLE_LABEL.get(cs, cs).upper(), M, y + 10)
                        y += 14
                    y = self._chart(cs, y + 8, ind, rows, d) + 4
        if sec.get("table", True) is not False:
            y = self._dept_table(y + 4, {"indicators": [ind]})
        if sec.get("indicatorDetail", True) is not False:
            self._indicator_detail(y, d, ind)

    def _q_donut(self, x, y, size, thickness, data):
        p = self.p
        total = sum(d["value"] for d in data) or 1
        cx, cy = x + size / 2, y + size / 2
        rO, rI = size / 2, size / 2 - thickness
        ang = -math.pi / 2
        for d in data:
            frac = d["value"] / total
            a1 = ang + frac * 2 * math.pi
            if frac > 0:
                p.wedge(cx, cy, rO, rI, ang, a1, hx(d["color"]))
            ang = a1

    def _status_mix(self, y, d):
        """Breach-composition donut (On benchmark / Breaches / Not reported) — the
        'STATUS MIX' strip shown under the chart on the on-screen Summary page."""
        p, C, M, CW = self.p, self.C, self.M, self.CW
        st = _dept_stat(d, self.pmonths)
        data = [x for x in [
            {"label": "On benchmark", "value": st["ok"], "color": "#2fb56a"},
            {"label": "Breaches", "value": st["breach"], "color": "#e2445c"},
            {"label": "Not reported", "value": st["na"], "color": "#c3ccd8"}] if x["value"] > 0]
        if not data:
            return y
        boxH = 100
        if y + boxH > self.PH - 40:
            y = self._new_page()
        p.rect(M, y, CW, boxH, C["panel2"], 8)
        p.font("bold", 7, C["muted"])
        p.text("STATUS MIX", M + 14, y + boxH / 2 + 3)
        size = 74
        dx0 = M + 14 + 74
        self._q_donut(dx0, y + (boxH - size) / 2, size, 15, data)
        lx = dx0 + size + 26
        ly = y + (boxH - len(data) * 20) / 2 + 12
        legw = max(p.tw(dd["label"]) for dd in data)
        for i, dd in enumerate(data):
            ry = ly + i * 20
            p.rect(lx, ry - 8, 10, 10, hx(dd["color"]), 2)
            p.font("normal", 9.5, C["ink2"])
            p.text(dd["label"], lx + 18, ry)
            p.font("bold", 9.5, C["ink"])
            p.text(str(dd["value"]), lx + 18 + legw + 46, ry, "right")
        return y + boxH + 8

    def _hh_page(self):
        p, C, M, CW, PW = self.p, self.C, self.M, self.CW, self.PW
        y = self._header()
        hh = _qc_hh_of(self.depts, self.all_depts, self.pmonths)
        if not hh:
            p.font("bold", 16, C["ink"])
            p.text("Hand Hygiene Compliance", M, y + 40)
            p.font("normal", 11, C["muted"])
            p.text("No hand hygiene data found in the selected departments or hospital-wide records.", M, y + 62)
            return
        primary = next((h for h in hh if re.search(r"overall|hospital", (h["d"].get("name", "") + " " + h["ind"].get("name", "")), re.I)), None)
        if not primary:
            primary = max(hh, key=lambda h: sum(1 for m in self.pmonths if _month_raw(h["ind"], m[0]) is not None))
        pind = primary["ind"]
        bv = pind.get("benchmarkValue")
        bench = float(bv) if (bv is not None and bv != "") else 90

        def month_agg(m):
            num = den = ndc = tot = 0
            comps = []
            for h in hh:
                v = _month_raw(h["ind"], m[0])
                if v is None:
                    continue
                tot += 1
                comps.append(v)
                nn = (h["ind"].get("mNum") or {}).get(m[0])
                dd = (h["ind"].get("mDen") or {}).get(m[0])
                if nn not in (None, "") and dd not in (None, "") and float(dd) > 0:
                    num += float(nn)
                    den += float(dd)
                    ndc += 1
            if not tot:
                return {"value": None, "num": None, "den": None}
            if ndc == tot and den > 0:
                return {"value": round(num / den * 10000) / 100, "num": num, "den": den}
            return {"value": round(sum(comps) / len(comps) * 100) / 100, "num": None, "den": None}

        series = [dict({"m": m, "label": m[1].split(" ")[0]}, **month_agg(m)) for m in self.pmonths]
        withval = [r for r in series if r["value"] is not None]
        latest = withval[-1] if withval else None
        avg = round(sum(r["value"] for r in withval) / len(withval) * 10) / 10 if withval else None
        on_target = sum(1 for r in withval if r["value"] >= bench)

        def who(pct):
            if pct is None:
                return ("—", C["faint"])
            if pct >= bench:
                return ("Compliant", C["green"])
            if pct >= 75:
                return ("Needs improvement", C["amber"])
            return ("Unacceptable", C["rose"])

        st_label, st_col = who(latest["value"] if latest else None)
        # band
        p.circle(M + 8, y + 6, 7, hx("#e6f3ea"))
        p.font("bold", 14, C["ink"])
        p.text("Hand Hygiene Compliance", M + 22, y + 10)
        self._status_chip(PW - M, y + 8, st_label, st_col)
        y += 22
        bench_i = int(bench) if bench == int(bench) else bench
        cards = [
            {"label": "Latest" + (" · " + latest["label"] if latest else ""),
             "value": (str(latest["value"]) + "%") if (latest and latest["value"] is not None) else "—", "tone": st_col, "toneVal": True,
             "foot": st_label},
            {"label": "Average", "value": (str(avg) + "%") if avg is not None else "—", "tone": C["blue"],
             "foot": "%d month%s reported" % (len(withval), "" if len(withval) == 1 else "s")},
            {"label": "Benchmark", "value": "≥ %s%%" % bench_i, "tone": C["violet"], "foot": "WHO compliant target"},
            {"label": "Months on target", "value": "%d/%d" % (on_target, len(withval)),
             "tone": C["green"] if (withval and on_target == len(withval)) else C["amber"], "toneVal": True, "foot": "within the period"},
        ]
        y = self._kpi_row(y, cards)
        p.font("bold", 8, C["ink2"])
        p.text("MONTHLY COMPLIANCE TREND (%%) · TARGET ≥ %s%%" % bench_i, M, y + 2)
        chart_rows = [{"mon": r["label"], "val": r["value"]} for r in withval]
        y = self._hh_chart(y + 8, chart_rows, bench, C["green"])
        # table
        heads = ["Month", "Compliant", "Opportunities", "Compliance", "Status"]
        nameW = CW * 0.30
        rest = (CW - nameW) / 4
        widths = [nameW, rest, rest, rest, rest]
        xs = []
        ax = M
        for w in widths:
            xs.append(ax)
            ax += w
        headH = 16
        p.rect(M, y, CW, headH, C["panel2"])
        p.font("bold", 8, C["muted"])
        for i, hd in enumerate(heads):
            al = None if i == 0 else ("center" if i == 4 else "right")
            tx = xs[i] + 6 if i == 0 else (xs[i] + widths[i] / 2 if i == 4 else xs[i] + widths[i] - 6)
            p.text(hd.upper(), tx, y + 11, al)
        y += headH
        for r in series:
            if y + 15 > self.PH - 40:
                y = self._new_page()
            lbl, col = who(r["value"])
            p.font("bold", 8.5, C["ink"])
            p.text(r["m"][1], xs[0] + 6, y + 10)
            p.font("normal", 8.5, C["ink2"])
            p.text(fmt(r["num"]) if r["num"] is not None else "—", xs[1] + widths[1] - 6, y + 10, "right")
            p.text(fmt(r["den"]) if r["den"] is not None else "—", xs[2] + widths[2] - 6, y + 10, "right")
            p.font("bold", 8.5, C["ink"] if r["value"] is not None else C["faint"])
            p.text((str(r["value"]) + "%") if r["value"] is not None else "—", xs[3] + widths[3] - 6, y + 10, "right")
            p.font("bold", 7.5, col)
            p.text(lbl, xs[4] + widths[4] / 2, y + 10, "center")
            y += 15
            p.line(M, y, M + CW, y, C["line2"], 0.35)
        return y

    def _hh_chart(self, y, rows, bench, tone, hgt=150):
        p, C, M, CW = self.p, self.C, self.M, self.CW
        n = len(rows)
        if not n:
            p.font("normal", 10, C["faint"])
            p.text("No hand-hygiene data in this period", M + CW / 2, y + hgt / 2, "center")
            return y + hgt
        mx = max([bench, 1] + [r["val"] for r in rows])
        ox = M
        rw = CW

        def px(i):
            return ox + rw * (0.05 + (0 if n <= 1 else i / (n - 1)) * 0.9)

        def py(v):
            return y + hgt - 18 - (v / mx) * (hgt - 30)

        for g in (0, .25, .5, .75, 1):
            yy = y + 12 + g * (hgt - 30)
            p.line(ox, yy, ox + rw, yy, C["line"], 0.5)
        pts = [(px(i), py(r["val"])) for i, r in enumerate(rows)]
        if n > 1:
            p.polygon(pts + [(pts[-1][0], y + hgt - 18), (pts[0][0], y + hgt - 18)], mixw(tone, 0.12))
            p.polyline(pts, tone, 2)
        # target line
        try:
            p.c.setDash([3, 3])
            p.line(ox, py(bench), ox + rw, py(bench), C["rose"], 1)
            p.c.setDash([])
        except Exception:
            pass
        p.font("bold", 7, C["rose"])
        bench_i = int(bench) if bench == int(bench) else bench
        p.text("target %s%%" % bench_i, ox + rw, py(bench) - 3, "right")
        for i, r in enumerate(rows):
            p.circle(pts[i][0], pts[i][1], 2.6, C["white"], tone, 2)
            p.font("normal", 6.5, C["faint"])
            p.text(str(r["mon"]), pts[i][0], y + hgt - 4, "center")
        return y + hgt + 6

    def _compare_page(self):
        p, C, M, CW = self.p, self.C, self.M, self.CW
        y = self._header()
        p.font("bold", 15, C["ink"])
        p.text("Cross-department quality comparison · %d departments" % len(self.depts), M, y + 4)
        y += 22
        rows = []
        for d in self.depts:
            ds = _qc_dept_status(d, self.pmonths)
            rows.append({"d": d, "st": ds["st"], "status": ds["status"]})
        hbar = sorted([{"label": r["d"].get("key") or r["d"].get("name"), "value": r["st"]["rate"],
                        "color": Q_PAL[(ord((r["d"].get("key") or "x")[0]) % len(Q_PAL))]} for r in rows],
                      key=lambda x: -x["value"])
        # zero-defect % bars
        mxb = max([1] + [b["value"] for b in hbar])
        for b in hbar:
            if y + 20 > self.PH - 40:
                y = self._new_page()
            p.font("bold", 9, C["ink2"])
            p.text(p.clip_text(b["label"], 116), M, y + 11)
            tx = M + 130
            twd = CW - 130 - 54
            p.rect(tx, y + 1.5, twd, 13, C["line"], 4)
            if b["value"] > 0:
                p.rect(tx, y + 1.5, max(4, twd * (b["value"] / mxb)), 13, hx(b["color"]), 4)
            p.font("bold", 9, C["ink"])
            p.text("%d%%" % b["value"], M + CW, y + 11, "right")
            y += 22
        y += 10
        # table
        heads = ["Department", "Indicators", "Zero-Defect %", "Breaches", "Status"]
        nameW = CW * 0.34
        rest = (CW - nameW) / 4
        widths = [nameW, rest, rest, rest, rest]
        xs = []
        ax = M
        for w in widths:
            xs.append(ax)
            ax += w
        p.rect(M, y, CW, 16, C["panel2"])
        p.font("bold", 8, C["muted"])
        for i, hd in enumerate(heads):
            al = None if i == 0 else "right"
            tx = xs[i] + 6 if i == 0 else xs[i] + widths[i] - 6
            p.text(hd.upper(), tx, y + 11, al)
        y += 16
        for r in sorted(rows, key=lambda r: -r["st"]["rate"]):
            if y + 15 > self.PH - 40:
                y = self._new_page()
            st = r["st"]
            p.font("bold", 8.5, C["ink"])
            p.text(p.clip_text(r["d"].get("name", ""), nameW - 8), xs[0] + 6, y + 10)
            p.font("normal", 8.5, C["ink2"])
            p.text(str(len(r["d"].get("indicators", []))), xs[1] + widths[1] - 6, y + 10, "right")
            rep = (st["ok"] + st["breach"]) > 0
            p.text(("%d%%" % st["rate"]) if rep else "—", xs[2] + widths[2] - 6, y + 10, "right")
            p.text(str(st["breach"]) if rep else "—", xs[3] + widths[3] - 6, y + 10, "right")
            p.font("bold", 7.5, hx(_STATUS_COL["breach" if st["breach"] else "ok"]) if rep else C["muted"])
            p.text(r["status"] if rep else "NO DATA", xs[4] + widths[4] - 6, y + 10, "right")
            y += 15
            p.line(M, y, M + CW, y, C["line2"], 0.35)
        return y


def build_pdf(model):
    if model.get("quality"):
        return QualityReport(model).build()
    return Report(model).build()


def render_html_pdf(body):
    """Render a full HTML document (the browser's exact report preview) to a vector
    PDF using a headless browser via Playwright. Prefers the system Edge/Chrome
    (bundled Chromium can be blocked by antivirus on Windows). Local-only path."""
    from playwright.sync_api import sync_playwright
    html = body.get("html") or ""
    size = body.get("pageSize", "A4")
    landscape = body.get("orient") == "landscape"
    args = ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
    with sync_playwright() as pw:
        browser = None
        last = None
        for ch in ("msedge", "chrome", None):
            try:
                browser = (pw.chromium.launch(headless=True, channel=ch, args=args, timeout=45000)
                           if ch else pw.chromium.launch(headless=True, args=args, timeout=45000))
                break
            except Exception as exc:
                last = exc
                browser = None
        if browser is None:
            raise RuntimeError("no headless browser available (Edge/Chrome/Chromium): %s" % last)
        try:
            page = browser.new_context().new_page()
            page.set_content(html, wait_until="load", timeout=30000)
            try:
                page.emulate_media(media="print")
            except Exception:
                pass
            pdf = page.pdf(format=size, landscape=landscape, print_background=True,
                           prefer_css_page_size=True,
                           margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        finally:
            browser.close()
    return pdf


def build_from_body(body):
    """Route a request body to the right generator: exact-preview HTML render
    (headless browser) or the ReportLab model/params path."""
    if body.get("mode") == "html":
        return render_html_pdf(body)
    return build_pdf(resolve_model(body))


def resolve_model(body):
    """Turn a request body into a render model.

    • pre-resolved model posted   -> {"doc":..,"depts":[..]} or {"quality":true,...}
    • quality params + read Mongo  -> {"module":"quality", ...}
    • statistics params + Mongo    -> {"type":"summary"|"board"|..., "deptIds":[..]}
    """
    if "depts" in body or "doc" in body:
        return body
    if (body.get("module") or body.get("kind")) == "quality":
        return build_quality_model_from_params(body)
    return build_model_from_params(body)


class handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            body = json.loads(raw or b"{}")
            pdf = build_from_body(body)
        except Exception as exc:  # never 500 silently — return a readable error
            import traceback
            msg = json.dumps({"error": str(exc), "trace": traceback.format_exc()[-800:]}).encode("utf-8")
            self.send_response(400)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)
            return

        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Disposition", 'attachment; filename="UNICO-report.pdf"')
        self.send_header("Content-Length", str(len(pdf)))
        self.end_headers()
        self.wfile.write(pdf)


if __name__ == "__main__":
    # CLI mode for the local Express bridge (server/web.js spawns this):
    # reads the request JSON from stdin, writes the PDF bytes to stdout.
    import sys
    _raw = sys.stdin.buffer.read()
    _body = json.loads(_raw or b"{}")
    sys.stdout.buffer.write(build_from_body(_body))
    sys.stdout.buffer.flush()
