# -*- coding: utf-8 -*-
"""
clinic-template.js から問診項目を読み出し、先生方に見せる用のPDFを生成する。
使い方:
  1) node で /tmp/template.json を出力（README参照） もしくは下記コマンド
     node -e '...'  > template.json
  2) python scripts/build_questionnaire_pdf.py template.json 出力.pdf
"""
import sys
import json
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
import os
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

# 日本語フォントを実ファイルから埋め込む（どのビューア・プリンタでも確実に表示）。
# Windowsの BIZ UDゴシック（印刷向けUDフォント）を優先。なければCID標準にフォールバック。
def _register_jp_fonts():
    fontdir = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")
    candidates = [
        ("JP", os.path.join(fontdir, "BIZ-UDGothicR.ttc")),
        ("JP-Bold", os.path.join(fontdir, "BIZ-UDGothicB.ttc")),
    ]
    ok = True
    for name, path in candidates:
        try:
            pdfmetrics.registerFont(TTFont(name, path, subfontIndex=0))
        except Exception:
            ok = False
    if ok:
        return "JP", "JP-Bold"
    # フォールバック（フォントファイルが見つからない環境）
    pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
    return "HeiseiKakuGo-W5", "HeiseiKakuGo-W5"

GOTHIC, GOTHIC_BOLD = _register_jp_fonts()
MINCHO = GOTHIC  # 本文も同じUDゴシックで統一（可読性重視）
# <b> タグが太字フォントを使うようにファミリー登録
pdfmetrics.registerFontFamily(GOTHIC, normal=GOTHIC, bold=GOTHIC_BOLD,
                              italic=GOTHIC, boldItalic=GOTHIC_BOLD)

PRIMARY = colors.HexColor("#357ABD")
ACCENT = colors.HexColor("#229960")
WARN_BG = colors.HexColor("#FFF8E6")
HEAD_BG = colors.HexColor("#EDF3FA")
GREY = colors.HexColor("#7F8C8D")
LINE = colors.HexColor("#DCE3EA")


def build(template_path, out_path):
    with open(template_path, encoding="utf-8") as f:
        t = json.load(f)

    styles = getSampleStyleSheet()
    title = ParagraphStyle("title", parent=styles["Title"], fontName=GOTHIC,
                           fontSize=20, leading=26, textColor=PRIMARY, spaceAfter=2)
    subtitle = ParagraphStyle("subtitle", parent=styles["Normal"], fontName=GOTHIC,
                              fontSize=11, leading=16, textColor=GREY, alignment=TA_CENTER, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName=GOTHIC,
                        fontSize=13.5, leading=18, textColor=PRIMARY, spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["Normal"], fontName=MINCHO,
                          fontSize=10.5, leading=16, textColor=colors.HexColor("#2C3E50"))
    note = ParagraphStyle("note", parent=styles["Normal"], fontName=MINCHO,
                          fontSize=9, leading=14, textColor=GREY)
    cell = ParagraphStyle("cell", parent=styles["Normal"], fontName=MINCHO,
                          fontSize=10.5, leading=15, textColor=colors.HexColor("#2C3E50"))
    cell_label = ParagraphStyle("cell_label", parent=cell, fontName=GOTHIC)
    cell_head = ParagraphStyle("cell_head", parent=cell, fontName=GOTHIC,
                               fontSize=10, textColor=PRIMARY)

    story = []

    story.append(Paragraph("事前問診 ヒアリング項目一覧", title))
    story.append(Paragraph(
        f"{t['clinicName']}（{t['department']}）　/　AI事前問診メモ デモ版", subtitle))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceBefore=4, spaceAfter=10))

    story.append(Paragraph(
        "患者さんがスマホで症状を自由に話すと、AIが内容を分析し、下記の項目のうち"
        "<b>まだ語られていない項目だけ</b>を音声で1つずつ追加質問して埋めていきます。"
        "「痛み」「発熱」などの内容に応じて、主訴別の追加項目が動的に加わります。",
        body))
    story.append(Spacer(1, 8))

    col_widths = [14*mm, 46*mm, 110*mm]

    def make_table(rows, head=("No.", "項目", "AIが患者に尋ねる質問")):
        data = [[Paragraph(head[0], cell_head),
                 Paragraph(head[1], cell_head),
                 Paragraph(head[2], cell_head)]]
        styl = [
            ("BACKGROUND", (0, 0), (-1, 0), HEAD_BG),
            ("GRID", (0, 0), (-1, -1), 0.5, LINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ]
        for i, (no, label, q, hl) in enumerate(rows, start=1):
            data.append([
                Paragraph(str(no), cell),
                Paragraph(label + ("　★" if hl else ""), cell_label),
                Paragraph(q, cell),
            ])
            if hl:
                styl.append(("BACKGROUND", (0, i), (-1, i), WARN_BG))
        tbl = Table(data, colWidths=col_widths, repeatRows=1)
        tbl.setStyle(TableStyle(styl))
        return tbl

    # コア項目
    story.append(Paragraph("■ コア項目（主訴に関わらず、全員に確認）", h2))
    core_rows = [(i, it["label"], it["question"], it.get("highlight"))
                 for i, it in enumerate(t["coreItems"], start=1)]
    story.append(make_table(core_rows))
    story.append(Paragraph("★ … 受付メモで強調表示する項目（服薬・アレルギーなど）", note))

    # 主訴別 追加項目
    story.append(Paragraph("■ 主訴別 追加項目（話した内容に応じて自動で追加）", h2))
    for g in t["conditionalGroups"]:
        story.append(Paragraph(f"● {g['label']}", ParagraphStyle(
            "grp", parent=body, fontName=GOTHIC, fontSize=11.5, textColor=ACCENT,
            spaceBefore=8, spaceAfter=4)))
        kw = "、".join(g["match"][:8])
        story.append(Paragraph(f"発話に次の語が含まれると追加: {kw} …", note))
        story.append(Spacer(1, 3))
        rows = [(i, it["label"], it["question"], it.get("highlight"))
                for i, it in enumerate(g["items"], start=1)]
        story.append(make_table(rows))
        story.append(Spacer(1, 4))

    # フッター注記
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.6, color=LINE, spaceAfter=6))
    story.append(Paragraph(
        "※ 本アプリは患者さん本人が受付前にメモを作成するためのものです。"
        "AIは診断・治療提案を行いません。診察は医師が改めて実施します。<br/>"
        "※ 問診項目はクリニックごとに設定変更できます。実際の問診票に合わせて差し替え可能です。",
        note))

    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm, topMargin=16*mm, bottomMargin=16*mm,
        title="事前問診 ヒアリング項目一覧", author=t["clinicName"])
    doc.build(story)
    print("wrote", out_path)


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "template.json"
    out = sys.argv[2] if len(sys.argv) > 2 else "問診項目一覧.pdf"
    build(src, out)
