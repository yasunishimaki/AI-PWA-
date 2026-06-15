# -*- coding: utf-8 -*-
"""
株式会社Qureas「AIデジタル問診」概要 A4 1枚（イラスト＋画面/出力イメージ入り）。
python scripts/build_overview_pdf.py 出力.pdf
"""
import os
import sys
import random
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.cidfonts import UnicodeCIDFont


def register_fonts():
    fontdir = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")
    try:
        pdfmetrics.registerFont(TTFont("JP", os.path.join(fontdir, "BIZ-UDGothicR.ttc"), subfontIndex=0))
        pdfmetrics.registerFont(TTFont("JPB", os.path.join(fontdir, "BIZ-UDGothicB.ttc"), subfontIndex=0))
        return "JP", "JPB"
    except Exception:
        pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
        return "HeiseiKakuGo-W5", "HeiseiKakuGo-W5"


JP, JPB = register_fonts()

NAVY = colors.HexColor("#1F4E96")
BLUE = colors.HexColor("#4A90E2")
LBLUE = colors.HexColor("#EAF1FB")
GREEN = colors.HexColor("#2BB673")
RED = colors.HexColor("#E55353")
INK = colors.HexColor("#2C3E50")
GREY = colors.HexColor("#7F8C8D")
LINE = colors.HexColor("#D6DEE8")
WARNBG = colors.HexColor("#FFF8E6")
WARNINK = colors.HexColor("#8B6914")

W, H = A4


def text(c, x, y, s, font=JP, size=10, color=INK, align="l"):
    c.setFillColor(color); c.setFont(font, size)
    if align == "c":
        c.drawCentredString(x, y, s)
    elif align == "r":
        c.drawRightString(x, y, s)
    else:
        c.drawString(x, y, s)


def wrap(c, x, y, s, font, size, color, maxw, leading):
    c.setFont(font, size); c.setFillColor(color)
    line = ""; cy = y
    for ch in s:
        if ch == "\n":
            c.drawString(x, cy, line); line = ""; cy -= leading; continue
        if pdfmetrics.stringWidth(line + ch, font, size) > maxw:
            c.drawString(x, cy, line); line = ch; cy -= leading
        else:
            line += ch
    if line:
        c.drawString(x, cy, line); cy -= leading
    return cy


# ---------- フローアイコン ----------
def icon_phone(c, cx, cy, s=1.0):
    w, h = 30 * s, 56 * s
    c.setLineWidth(1.6); c.setStrokeColor(NAVY); c.setFillColor(colors.white)
    c.roundRect(cx - w / 2, cy - h / 2, w, h, 5 * s, stroke=1, fill=1)
    c.setFillColor(LBLUE)
    c.roundRect(cx - w / 2 + 3 * s, cy - h / 2 + 6 * s, w - 6 * s, h - 12 * s, 2 * s, stroke=0, fill=1)
    c.setFillColor(NAVY); c.circle(cx - 2 * s, cy + 4 * s, 2 * s, stroke=0, fill=1)
    c.setStrokeColor(BLUE); c.setLineWidth(1.4)
    for r in (5, 9, 13):
        c.arc(cx - 1 * s - r * s, cy + 4 * s - r * s, cx - 1 * s + r * s, cy + 4 * s + r * s, -60, 120)


def icon_ai(c, cx, cy, s=1.0):
    c.setStrokeColor(NAVY); c.setLineWidth(1.6); c.setFillColor(colors.white)
    c.roundRect(cx - 22 * s, cy - 16 * s, 44 * s, 32 * s, 7 * s, stroke=1, fill=1)
    p = c.beginPath(); p.moveTo(cx - 6 * s, cy - 16 * s); p.lineTo(cx - 12 * s, cy - 24 * s); p.lineTo(cx + 2 * s, cy - 16 * s)
    c.drawPath(p, stroke=1, fill=1)
    c.setFillColor(BLUE)
    c.circle(cx - 8 * s, cy + 2 * s, 3.2 * s, stroke=0, fill=1)
    c.circle(cx + 8 * s, cy + 2 * s, 3.2 * s, stroke=0, fill=1)
    c.setStrokeColor(NAVY); c.setLineWidth(1.4)
    c.line(cx - 7 * s, cy - 7 * s, cx + 7 * s, cy - 7 * s)
    c.line(cx, cy + 16 * s, cx, cy + 22 * s)
    c.setFillColor(GREEN); c.circle(cx, cy + 23 * s, 2 * s, stroke=0, fill=1)


def icon_qr(c, cx, cy, s=1.0):
    sz = 34 * s
    c.setFillColor(colors.white); c.setStrokeColor(NAVY); c.setLineWidth(1.4)
    c.rect(cx - sz / 2, cy - sz / 2, sz, sz, stroke=1, fill=1)
    c.setFillColor(NAVY)
    f = 9 * s
    for (fx, fy) in [(-1, 1), (1, 1), (-1, -1)]:
        ox = cx + fx * (sz / 2 - f / 2 - 3 * s); oy = cy + fy * (sz / 2 - f / 2 - 3 * s)
        c.setFillColor(NAVY); c.rect(ox - f / 2, oy - f / 2, f, f, stroke=0, fill=1)
        c.setFillColor(colors.white); c.rect(ox - f / 2 + 2.2 * s, oy - f / 2 + 2.2 * s, f - 4.4 * s, f - 4.4 * s, stroke=0, fill=1)
        c.setFillColor(NAVY); c.rect(ox - 1.4 * s, oy - 1.4 * s, 2.8 * s, 2.8 * s, stroke=0, fill=1)
    random.seed(7); m = 2.4 * s
    for gx in range(4):
        for gy in range(4):
            if random.random() > 0.5:
                c.rect(cx + 2 * s + gx * (m + 1.2 * s), cy - 8 * s + gy * (m + 1.2 * s), m, m, stroke=0, fill=1)


def icon_tablet(c, cx, cy, s=1.0):
    w, h = 52 * s, 38 * s
    c.setStrokeColor(NAVY); c.setLineWidth(1.6); c.setFillColor(colors.white)
    c.roundRect(cx - w / 2, cy - h / 2, w, h, 4 * s, stroke=1, fill=1)
    c.setFillColor(LBLUE)
    c.roundRect(cx - w / 2 + 4 * s, cy - h / 2 + 4 * s, w - 12 * s, h - 8 * s, 2 * s, stroke=0, fill=1)
    c.setFillColor(NAVY); c.circle(cx + w / 2 - 4 * s, cy, 1.4 * s, stroke=0, fill=1)
    c.setStrokeColor(GREEN); c.setLineWidth(1.8)
    bx, by, bs, cor = cx - 6 * s, cy - 8 * s, 16 * s, 5 * s
    c.line(bx, by, bx + cor, by); c.line(bx, by, bx, by + cor)
    c.line(bx + bs, by, bx + bs - cor, by); c.line(bx + bs, by, bx + bs, by + cor)
    c.line(bx, by + bs, bx + cor, by + bs); c.line(bx, by + bs, bx, by + bs - cor)
    c.line(bx + bs, by + bs, bx + bs - cor, by + bs); c.line(bx + bs, by + bs, bx + bs, by + bs - cor)


def icon_printer(c, cx, cy, s=1.0):
    c.setStrokeColor(NAVY); c.setLineWidth(1.6)
    c.setFillColor(LBLUE); c.roundRect(cx - 22 * s, cy - 12 * s, 44 * s, 22 * s, 3 * s, stroke=1, fill=1)
    c.setFillColor(colors.white); c.rect(cx - 14 * s, cy + 8 * s, 28 * s, 12 * s, stroke=1, fill=1)
    c.setFillColor(colors.white); c.rect(cx - 14 * s, cy - 26 * s, 28 * s, 18 * s, stroke=1, fill=1)
    c.setStrokeColor(BLUE); c.setLineWidth(1.0)
    for i in range(3):
        yy = cy - 13 * s - i * 4 * s; c.line(cx - 10 * s, yy, cx + 10 * s, yy)
    c.setFillColor(GREEN); c.circle(cx + 16 * s, cy - 2 * s, 1.6 * s, stroke=0, fill=1)


def arrow(c, x1, y, x2):
    c.setStrokeColor(BLUE); c.setLineWidth(2); c.line(x1, y, x2 - 4, y)
    c.setFillColor(BLUE)
    p = c.beginPath(); p.moveTo(x2, y); p.lineTo(x2 - 7, y + 4); p.lineTo(x2 - 7, y - 4); p.close()
    c.drawPath(p, stroke=0, fill=1)


def check(c, x, y, s=4):
    c.setStrokeColor(GREEN); c.setLineWidth(2)
    c.line(x - s, y, x - s * 0.2, y - s * 0.9)
    c.line(x - s * 0.2, y - s * 0.9, x + s * 1.1, y + s * 0.9)


# ---------- スマホ画面イメージ（患者アプリ：AIが質問） ----------
def phone_mockup(c, x, y, w, h):
    # 端末
    c.setFillColor(colors.HexColor("#33373D")); c.roundRect(x, y, w, h, 14, stroke=0, fill=1)
    sx, sy, sw, sh = x + 6, y + 8, w - 12, h - 16
    c.setFillColor(colors.HexColor("#F5F7FA")); c.roundRect(sx, sy, sw, sh, 8, stroke=0, fill=1)
    # ノッチ
    c.setFillColor(colors.HexColor("#33373D")); c.roundRect(x + w / 2 - 16, y + h - 12, 32, 7, 3, stroke=0, fill=1)
    top = sy + sh
    # ヘッダー
    c.setFillColor(NAVY); c.roundRect(sx, top - 30, sw, 30, 0, stroke=0, fill=1)
    c.rect(sx, top - 30, sw, 8, stroke=0, fill=1)
    text(c, sx + sw / 2, top - 20, "問診メモ", JPB, 9, colors.white, "c")
    # 進捗バー
    by = top - 48
    text(c, sx + 8, by + 2, "あと少しで完了", JP, 6.5, GREY)
    c.setFillColor(colors.HexColor("#E2E8F0")); c.roundRect(sx + 8, by - 6, sw - 16, 6, 3, stroke=0, fill=1)
    c.setFillColor(GREEN); c.roundRect(sx + 8, by - 6, (sw - 16) * 0.7, 6, 3, stroke=0, fill=1)
    text(c, sx + sw - 8, by - 16, "7 / 9 項目", JP, 6, GREY, "r")
    # 質問カード
    qy = by - 30
    c.setFillColor(colors.white); c.setStrokeColor(LINE); c.setLineWidth(1)
    c.roundRect(sx + 8, qy - 76, sw - 16, 76, 8, stroke=1, fill=1)
    text(c, sx + 16, qy - 14, "服薬中の薬", JPB, 6.5, GREEN)
    # ロボットアバター
    ax, ay = sx + 22, qy - 40
    c.setFillColor(NAVY); c.circle(ax, ay, 11, stroke=0, fill=1)
    c.setFillColor(colors.white); c.circle(ax - 3.5, ay + 1, 2, stroke=0, fill=1); c.circle(ax + 3.5, ay + 1, 2, stroke=0, fill=1)
    c.setStrokeColor(colors.white); c.setLineWidth(1.2); c.line(ax - 3, ay - 4, ax + 3, ay - 4)
    wrap(c, sx + 40, qy - 32, "今、飲んでいる\nお薬はありますか？", JPB, 8.5, INK, sw - 56, 12)
    # マイク
    mx, my = sx + sw / 2, qy - 110
    c.setFillColor(RED); c.circle(mx, my, 20, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.roundRect(mx - 4, my - 3, 8, 13, 4, stroke=0, fill=1)
    c.setStrokeColor(colors.white); c.setLineWidth(1.6)
    c.arc(mx - 8, my - 12, mx + 8, my + 4, 200, 140)
    c.line(mx, my - 12, mx, my - 16)
    text(c, mx, my - 30, "押してお答えください", JP, 6.2, GREY, "c")


# ---------- 出力イメージ（受付プリント：問診メモ） ----------
def memo_mockup(c, x, y, w, h):
    # 影
    c.setFillColor(colors.HexColor("#DCE3EA")); c.roundRect(x + 3, y - 3, w, h, 4, stroke=0, fill=1)
    c.setFillColor(colors.white); c.setStrokeColor(LINE); c.setLineWidth(1)
    c.roundRect(x, y, w, h, 4, stroke=1, fill=1)
    top = y + h
    text(c, x + 14, top - 22, "事前問診メモ", JPB, 11, INK)
    text(c, x + w - 14, top - 16, "クレアスクリニック", JP, 7, NAVY, "r")
    text(c, x + w - 14, top - 26, "2026/07/02 10:23", JP, 6.5, GREY, "r")
    c.setStrokeColor(NAVY); c.setLineWidth(1.4); c.line(x + 14, top - 30, x + w - 14, top - 30)
    rows = [
        ("主訴", "後頭部のズキズキする頭痛・吐き気", False),
        ("発症時期", "昨夜、寝る前ごろから", False),
        ("症状の性質", "拍動性で、夜間に強くなる", False),
        ("服薬中の薬", "降圧薬を毎朝1錠 服用", True),
        ("アレルギー", "特になし", True),
        ("既往歴", "高血圧で通院中", False),
        ("発熱の有無", "なし", False),
        ("随伴症状", "吐き気あり", False),
    ]
    ry = top - 30
    rh = (h - 56) / len(rows)
    for label, val, hl in rows:
        ry -= rh
        if hl:
            c.setFillColor(WARNBG); c.rect(x + 8, ry, w - 16, rh, stroke=0, fill=1)
        c.setStrokeColor(colors.HexColor("#EDF1F5")); c.setLineWidth(0.6)
        c.line(x + 14, ry, x + w - 14, ry)
        lab_color = WARNINK if hl else GREY
        text(c, x + 16, ry + rh / 2 - 3, label + ("★" if hl else ""), JPB, 7, lab_color)
        text(c, x + 96, ry + rh / 2 - 3, val, JP, 7.5, INK)
    text(c, x + 14, y + 12, "※ 患者本人がAIで作成した事前メモ。診察で確認します。", JP, 5.8, GREY)


# ---------- ページ生成 ----------
def build(out_path):
    c = canvas.Canvas(out_path, pagesize=A4)
    M = 32

    # ヘッダー
    c.setFillColor(NAVY); c.rect(0, H - 92, W, 92, stroke=0, fill=1)
    c.setFillColor(BLUE); c.rect(0, H - 96, W, 4, stroke=0, fill=1)
    text(c, M, H - 30, "株式会社 Qureas", JPB, 13, colors.white)
    text(c, M, H - 58, "AIデジタル問診", JPB, 22, colors.white)
    text(c, M, H - 80, "話すだけで、受付前の問診メモが完成。看護業務を、もっとスマートに。", JP, 11, colors.HexColor("#CFE0F6"))
    c.setFillColor(colors.white)
    cxp, cyp = W - 52, H - 50
    c.roundRect(cxp - 6, cyp - 19, 12, 38, 2, stroke=0, fill=1)
    c.roundRect(cxp - 19, cyp - 6, 38, 12, 2, stroke=0, fill=1)

    # リード文
    y = H - 116
    text(c, M, y, "患者さんがスマホに症状を話すだけ。AIが足りない情報を質問して、問診メモを自動で仕上げます。",
         JPB, 11, INK)
    y -= 16
    y = wrap(c, M, y, "クリニックごとに「聞き取るべき項目」を設定でき、必須項目の抜けを防止。"
                      "完成したメモはQRコードで受付に渡し、その場で表示・印刷できます。",
             JP, 9.5, GREY, W - 2 * M, 13)

    # ご利用の流れ
    y -= 6
    text(c, M, y, "■ ご利用の流れ（患者さん → 受付）", JPB, 12.5, NAVY)
    flow_y = y - 96
    steps = [
        ("①", "スマホで話す", "症状を自由に\nお話しください", icon_phone),
        ("②", "AIが質問", "足りない項目を\n音声で確認", icon_ai),
        ("③", "QRを表示", "問診メモが\n完成", icon_qr),
        ("④", "受付で読取", "iPadのカメラで\nスキャン", icon_tablet),
        ("⑤", "メモを出力", "プリンタで\n印刷・共有", icon_printer),
    ]
    n = len(steps); colw = (W - 2 * M) / n
    for i, (no, title, desc, icon) in enumerate(steps):
        cx = M + colw * i + colw / 2
        c.setFillColor(colors.white); c.setStrokeColor(LINE); c.setLineWidth(1)
        c.roundRect(cx - colw / 2 + 5, flow_y - 6, colw - 10, 86, 7, stroke=1, fill=1)
        icon(c, cx, flow_y + 50, 0.64)
        c.setFillColor(BLUE); c.circle(cx - colw / 2 + 15, flow_y + 72, 7.5, stroke=0, fill=1)
        text(c, cx - colw / 2 + 15, flow_y + 69, no, JPB, 9, colors.white, "c")
        text(c, cx, flow_y + 22, title, JPB, 9.4, NAVY, "c")
        for k, ln in enumerate(desc.split("\n")):
            text(c, cx, flow_y + 10 - k * 10, ln, JP, 7.6, GREY, "c")
        if i < n - 1:
            arrow(c, cx + colw / 2 - 6, flow_y + 42, cx + colw / 2 + 6)

    # 画面・出力イメージ
    y = flow_y - 24
    text(c, M, y, "■ 画面・出力イメージ", JPB, 12.5, NAVY)
    img_top = y - 12
    img_h = 300
    img_bottom = img_top - img_h
    # 左：スマホ画面
    pw, ph = 156, img_h
    px = M + 24
    c.setFillColor(LBLUE); c.roundRect(M, img_bottom - 26, (W - 2 * M - 16) * 0.40, img_h + 26, 10, stroke=0, fill=1)
    phone_mockup(c, px, img_bottom, pw, ph)
    text(c, M + (W - 2 * M - 16) * 0.40 / 2, img_bottom - 16, "患者さんのスマホ画面（AIが追加質問）", JPB, 8.5, NAVY, "c")
    # 右：出力メモ
    rx = M + (W - 2 * M - 16) * 0.40 + 16
    rw = (W - 2 * M) - (rx - M)
    c.setFillColor(LBLUE); c.roundRect(rx, img_bottom - 26, rw, img_h + 26, 10, stroke=0, fill=1)
    memo_mockup(c, rx + 16, img_bottom + 6, rw - 32, img_h - 12)
    text(c, rx + rw / 2, img_bottom - 16, "受付でのプリント出力イメージ", JPB, 8.5, NAVY, "c")

    # 導入メリット
    y = img_bottom - 44
    text(c, M, y, "■ 導入メリット", JPB, 12.5, NAVY)
    y -= 10
    benefits = [
        ("聞き取り負担を軽減", "基本ヒアリングをAIが代行。要点が揃った状態で受付・診察へ。"),
        ("記入漏れを防止", "クリニック別の必須項目をAIが必ず確認。抜けのないメモに。"),
        ("既存運用になじむ", "QRで受付に渡し、その場で印刷。紙でもデジタルでも共有可能。"),
    ]
    bw = (W - 2 * M - 2 * 12) / 3
    bh = 52
    for i, (t1, t2) in enumerate(benefits):
        bx = M + i * (bw + 12); by = y - bh
        c.setFillColor(colors.white); c.setStrokeColor(LINE); c.setLineWidth(1)
        c.roundRect(bx, by, bw, bh, 6, stroke=1, fill=1)
        c.setFillColor(colors.HexColor("#E8F6EE")); c.circle(bx + 18, by + bh - 16, 9, stroke=0, fill=1)
        check(c, bx + 18, by + bh - 15, 4.5)
        text(c, bx + 32, by + bh - 18, t1, JPB, 9.6, NAVY)
        wrap(c, bx + 12, by + bh - 32, t2, JP, 7.8, GREY, bw - 24, 10)

    # フッター
    fy = 54
    c.setFillColor(WARNBG); c.setStrokeColor(colors.HexColor("#E8D9A8")); c.setLineWidth(1)
    c.roundRect(M, fy, W - 2 * M, 22, 4, stroke=1, fill=1)
    text(c, M + 10, fy + 8, "※ 本サービスは受付前の問診メモ作成を支援するものです。AIは診断・治療提案を行いません。診察は医師が実施します。",
         JP, 8, WARNINK)
    text(c, M, fy - 16, "株式会社 Qureas　AIデジタル問診", JPB, 9.5, NAVY)
    text(c, W - M, fy - 16, "デモ実施: 2026年7月2日", JP, 9, GREY, "r")

    c.showPage(); c.save()
    print("wrote", out_path)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "概要.pdf"
    build(out)
