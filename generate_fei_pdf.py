import os

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

# ── Palette ──────────────────────────────────────────────────────────────────
NAVY      = colors.HexColor("#0F172A")
NAVY_MID  = colors.HexColor("#1E293B")
SLATE     = colors.HexColor("#334155")
SLATE_LT  = colors.HexColor("#64748B")
EMERALD   = colors.HexColor("#10B981")
BLUE      = colors.HexColor("#3B82F6")
VIOLET    = colors.HexColor("#7C3AED")
AMBER     = colors.HexColor("#F59E0B")
ROSE      = colors.HexColor("#F43F5E")
WHITE     = colors.white
OFF_WHITE = colors.HexColor("#F8FAFC")
LIGHT_BG  = colors.HexColor("#F1F5F9")
BORDER    = colors.HexColor("#E2E8F0")

W, H = A4
MARGIN = 18 * mm
AW = W - 2 * MARGIN  # 493 pts available width

# ── Page header/footer ────────────────────────────────────────────────────────
def on_page(c, doc):
    c.saveState()
    c.setFillColor(NAVY)
    c.rect(0, H - 13*mm, W, 13*mm, fill=1, stroke=0)
    c.setFillColor(EMERALD)
    c.rect(0, H - 13*mm, 3.5*mm, 13*mm, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(WHITE)
    c.drawString(MARGIN, H - 8.5*mm, "Faculty Effectiveness Index (FEI)")
    c.setFont("Helvetica", 7.5)
    c.setFillColor(colors.HexColor("#94A3B8"))
    c.drawRightString(W - MARGIN, H - 8.5*mm, "Student Early Alert System · Management Guide")
    c.setFillColor(BORDER)
    c.rect(MARGIN, 9.5*mm, AW, 0.3*mm, fill=1, stroke=0)
    c.setFont("Helvetica", 7)
    c.setFillColor(SLATE_LT)
    c.drawString(MARGIN, 6.5*mm, "Confidential · Internal Use Only")
    c.drawCentredString(W/2, 6.5*mm, "Version: June 2026")
    c.drawRightString(W - MARGIN, 6.5*mm, f"Page {doc.page}")
    c.restoreState()

# ── Style helpers ─────────────────────────────────────────────────────────────
def ps(name, **kw):
    defaults = dict(fontName="Helvetica", fontSize=9.5, leading=14, textColor=SLATE)
    defaults.update(kw)
    return ParagraphStyle(name, **defaults)

S = {
    "h1":        ps("h1", fontName="Helvetica-Bold", fontSize=17, leading=22, textColor=NAVY, spaceBefore=8, spaceAfter=4),
    "h2":        ps("h2", fontName="Helvetica-Bold", fontSize=12, leading=16, textColor=NAVY, spaceBefore=6, spaceAfter=3),
    "eyebrow":   ps("eyebrow", fontName="Helvetica-Bold", fontSize=7.5, leading=10, textColor=EMERALD, spaceAfter=2),
    "body":      ps("body", spaceAfter=4),
    "small":     ps("small", fontSize=8.5, leading=13, textColor=SLATE_LT),
    "code":      ps("code", fontName="Courier", fontSize=8.5, leading=13, textColor=NAVY),
    "formula":   ps("formula", fontName="Courier-Bold", fontSize=9, leading=14, textColor=NAVY),
    "th":        ps("th", fontName="Helvetica-Bold", fontSize=8.5, leading=12, textColor=WHITE),
    "td":        ps("td", fontSize=8.5, leading=12, textColor=SLATE),
    "tdb":       ps("tdb", fontName="Helvetica-Bold", fontSize=8.5, leading=12, textColor=NAVY),
    "white_b":   ps("white_b", fontName="Helvetica-Bold", fontSize=9, leading=13, textColor=WHITE),
    "white":     ps("white", fontSize=8.5, leading=13, textColor=colors.HexColor("#CBD5E1")),
    "cover_t":   ps("cover_t", fontName="Helvetica-Bold", fontSize=26, leading=32, textColor=WHITE),
    "cover_s":   ps("cover_s", fontSize=13, leading=18, textColor=colors.HexColor("#94A3B8")),
}

def sp(h=4): return Spacer(1, h*mm)
def rule(c=BORDER): return HRFlowable(width="100%", thickness=0.5, color=c, spaceBefore=2*mm, spaceAfter=3*mm)

def tbl_style(extra=None):
    base = [
        ("BACKGROUND", (0,0), (-1,0), NAVY),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [OFF_WHITE, LIGHT_BG]),
        ("GRID", (0,0), (-1,-1), 0.4, BORDER),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ]
    if extra: base += extra
    return TableStyle(base)

def dark_banner(text_para, bg=NAVY_MID, accent=EMERALD):
    t = Table([[text_para]], colWidths=[AW])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), bg),
        ("LEFTPADDING", (0,0), (-1,-1), 14),
        ("RIGHTPADDING", (0,0), (-1,-1), 14),
        ("TOPPADDING", (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 10),
        ("LINEBEFORE", (0,0), (0,-1), 3, accent),
    ]))
    return t

def info_box(title, body, accent=BLUE, bg=None):
    bg = bg or colors.HexColor("#EFF6FF")
    t = Table([[Paragraph(f"<b>{title}</b>  {body}", ps("ib", fontSize=9, leading=13.5, textColor=SLATE))]], colWidths=[AW])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), bg),
        ("LEFTPADDING", (0,0), (-1,-1), 12),
        ("RIGHTPADDING", (0,0), (-1,-1), 12),
        ("TOPPADDING", (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("LINEBEFORE", (0,0), (0,-1), 3, accent),
    ]))
    return t

# ── Build ─────────────────────────────────────────────────────────────────────
def build():
    path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "docs",
        "FEI_Management_Guide.pdf",
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    doc = SimpleDocTemplate(path, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=19*mm, bottomMargin=17*mm,
        title="Faculty Effectiveness Index — Management Guide",
        author="Student Early Alert System")
    story = []

    # ═══════════════════════════════════════════════════════════════════════════
    # COVER
    # ═══════════════════════════════════════════════════════════════════════════
    def nav_block(txt, style, bg, accent=None, pad_top=14, pad_bot=14):
        t = Table([[Paragraph(txt, style)]], colWidths=[AW])
        cmds = [("BACKGROUND",(0,0),(-1,-1),bg),
                ("LEFTPADDING",(0,0),(-1,-1),14),("RIGHTPADDING",(0,0),(-1,-1),14),
                ("TOPPADDING",(0,0),(-1,-1),pad_top),("BOTTOMPADDING",(0,0),(-1,-1),pad_bot)]
        if accent: cmds.append(("LINEBEFORE",(0,0),(0,-1),4,accent))
        t.setStyle(TableStyle(cmds)); return t

    story.append(nav_block("Faculty Effectiveness Index", S["cover_t"], NAVY, pad_top=18, pad_bot=4))
    story.append(nav_block("Plain-Language Guide for University Management", S["cover_s"], NAVY, pad_top=4, pad_bot=16))
    accent_bar = Table([[""]], colWidths=[AW], rowHeights=[1.5*mm])
    accent_bar.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),EMERALD),
        ("LEFTPADDING",(0,0),(-1,-1),0),("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0)]))
    story.append(accent_bar)
    story.append(sp(5))
    story.append(info_box("Purpose:", "This document explains how the Faculty Effectiveness Index (FEI) is calculated, what each component measures, and how to interpret scores. Written for university leadership — no technical background required."))
    story.append(sp(5))
    story.append(Paragraph("GRADE REFERENCE", S["eyebrow"]))

    gd = [
        [Paragraph("Grade", S["th"]), Paragraph("FEI Score", S["th"]), Paragraph("Meaning", S["th"])],
        [Paragraph("A", ps("ga", fontName="Helvetica-Bold", fontSize=11, textColor=EMERALD)), Paragraph("85 – 100", S["tdb"]), Paragraph("Exemplary — strong support and student recovery", S["td"])],
        [Paragraph("B", ps("gb", fontName="Helvetica-Bold", fontSize=11, textColor=BLUE)),    Paragraph("70 – 84", S["tdb"]), Paragraph("Effective — working well with minor gaps", S["td"])],
        [Paragraph("C", ps("gc", fontName="Helvetica-Bold", fontSize=11, textColor=AMBER)),   Paragraph("55 – 69", S["tdb"]), Paragraph("Developing — weak in one or more areas", S["td"])],
        [Paragraph("D", ps("gd", fontName="Helvetica-Bold", fontSize=11, textColor=colors.HexColor("#F97316"))), Paragraph("40 – 54", S["tdb"]), Paragraph("At Risk — major support gaps present", S["td"])],
        [Paragraph("E", ps("ge", fontName="Helvetica-Bold", fontSize=11, textColor=ROSE)),    Paragraph("0 – 39",  S["tdb"]), Paragraph("Critical — support largely absent", S["td"])],
    ]
    gt = Table(gd, colWidths=[16*mm, 26*mm, AW-46*mm])
    gt.setStyle(tbl_style()); story.append(gt)
    story.append(sp(5))

    # Tags row
    tags = Table([[
        Paragraph("Student Early Alert System", ps("t1", fontName="Helvetica-Bold", fontSize=8, textColor=EMERALD)),
        Paragraph("Version: June 2026", ps("t2", fontName="Helvetica-Bold", fontSize=8, textColor=SLATE_LT)),
        Paragraph("Confidential", ps("t3", fontName="Helvetica-Bold", fontSize=8, textColor=ROSE, alignment=TA_RIGHT)),
    ]], colWidths=[70*mm, 60*mm, AW-134*mm])
    tags.setStyle(TableStyle([("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
                               ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0)]))
    story.append(tags)
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # SEC 1 — What is FEI
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("SECTION 1", S["eyebrow"]))
    story.append(Paragraph("What is the FEI?", S["h1"]))
    story.append(rule())
    story.append(Paragraph("The Faculty Effectiveness Index (FEI) is a score from <b>0 to 100</b> that answers one question:", S["body"]))
    story.append(sp(2))
    story.append(dark_banner(Paragraph("When the system flags a struggling student, does this faculty actually help them — and do students improve?",
        ps("q", fontName="Helvetica-Bold", fontSize=11, leading=16, textColor=WHITE)), bg=NAVY, accent=EMERALD))
    story.append(sp(3))
    story.append(Paragraph("It is <b>not</b> a measure of how many students are struggling. A faculty with many alerts is not a bad faculty — it may simply have more at-risk students. The FEI measures <b>what happens after the flag is raised.</b>", S["body"]))
    story.append(sp(4))

    # Journey diagram as simple table
    story.append(Paragraph("THE STUDENT SUPPORT JOURNEY", S["eyebrow"]))
    jcols = [38*mm, 8*mm, 30*mm, 8*mm, 32*mm, 8*mm, 40*mm, 8*mm, 34*mm]
    jd = [[
        Paragraph("Student\nStruggles", S["white_b"]),
        Paragraph("→", ps("arr", fontName="Helvetica-Bold", fontSize=12, textColor=colors.HexColor("#64748B"), alignment=TA_CENTER)),
        Paragraph("Alert\nRaised", S["white_b"]),
        Paragraph("→", ps("arr2", fontName="Helvetica-Bold", fontSize=12, textColor=colors.HexColor("#64748B"), alignment=TA_CENTER)),
        Paragraph("Staff\nContact", S["white_b"]),
        Paragraph("→", ps("arr3", fontName="Helvetica-Bold", fontSize=12, textColor=colors.HexColor("#64748B"), alignment=TA_CENTER)),
        Paragraph("Referral /\nResolution", S["white_b"]),
        Paragraph("→", ps("arr4", fontName="Helvetica-Bold", fontSize=12, textColor=colors.HexColor("#64748B"), alignment=TA_CENTER)),
        Paragraph("Student\nRecovers", S["white_b"]),
    ],[
        Paragraph("", S["white"]),
        Paragraph("", S["white"]),
        Paragraph("", S["white"]),
        Paragraph("", S["white"]),
        Paragraph("RESPONSE", ps("rl", fontName="Helvetica-Bold", fontSize=8, textColor=BLUE, alignment=TA_CENTER)),
        Paragraph("", S["white"]),
        Paragraph("WELLBEING", ps("wl", fontName="Helvetica-Bold", fontSize=8, textColor=VIOLET, alignment=TA_CENTER)),
        Paragraph("", S["white"]),
        Paragraph("OUTCOME", ps("ol", fontName="Helvetica-Bold", fontSize=8, textColor=EMERALD, alignment=TA_CENTER)),
    ]]
    jt = Table(jd, colWidths=jcols)
    jt.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),NAVY_MID),
        ("ALIGN",(0,0),(-1,-1),"CENTER"),("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("LEFTPADDING",(0,0),(-1,-1),3),("RIGHTPADDING",(0,0),(-1,-1),3),
        ("TOPPADDING",(0,0),(-1,0),10),("BOTTOMPADDING",(0,0),(-1,0),4),
        ("TOPPADDING",(0,1),(-1,1),4),("BOTTOMPADDING",(0,1),(-1,1),10),
    ]))
    story.append(jt)
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # SEC 2 — Five Pillars
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("SECTION 2", S["eyebrow"]))
    story.append(Paragraph("The Five Pillars", S["h1"]))
    story.append(rule())
    story.append(Paragraph("The FEI is built from five pillars, each measuring a different stage of the student support journey.", S["body"]))
    story.append(sp(3))

    pd_ = [
        [Paragraph("Pillar", S["th"]), Paragraph("Weight", S["th"]), Paragraph("One-Line Meaning", S["th"])],
        [Paragraph("Outcome",   ps("po",  fontName="Helvetica-Bold", fontSize=9, textColor=EMERALD)), Paragraph("30%", S["tdb"]), Paragraph("Did students actually improve?", S["td"])],
        [Paragraph("Wellbeing", ps("pw",  fontName="Helvetica-Bold", fontSize=9, textColor=VIOLET)),  Paragraph("25%", S["tdb"]), Paragraph("Were students properly supported or referred to professional services?", S["td"])],
        [Paragraph("Response",  ps("pr",  fontName="Helvetica-Bold", fontSize=9, textColor=BLUE)),    Paragraph("25%", S["tdb"]), Paragraph("Did staff reach students quickly and follow cases through to conclusion?", S["td"])],
        [Paragraph("Readiness", ps("prd", fontName="Helvetica-Bold", fontSize=9, textColor=AMBER)),   Paragraph("10%", S["tdb"]), Paragraph("Is attendance data reliable enough to generate trustworthy alerts?", S["td"])],
        [Paragraph("Sustained", ps("ps",  fontName="Helvetica-Bold", fontSize=9, textColor=colors.HexColor("#F97316"))), Paragraph("10%", S["tdb"]), Paragraph("Is improvement lasting, not just temporary?", S["td"])],
    ]
    pt = Table(pd_, colWidths=[34*mm, 18*mm, AW-56*mm])
    pt.setStyle(tbl_style()); story.append(pt)
    story.append(sp(5))

    story.append(Paragraph("FINAL FORMULA", S["eyebrow"]))
    story.append(dark_banner(
        Paragraph("FEI  =  (Outcome × 30%)  +  (Wellbeing × 25%)  +  (Response × 25%)  +  (Readiness × 10%)  +  (Sustained × 10%)",
            S["formula"]), bg=NAVY, accent=EMERALD))
    story.append(sp(5))

    story.append(Paragraph("TWO HARD RULES", S["eyebrow"]))
    rd = [
        [Paragraph("Rule 1 — Zero Intervention Penalty", ps("r1h", fontName="Helvetica-Bold", fontSize=9, textColor=NAVY)),
         Paragraph("If a faculty contacted zero flagged students, FEI cannot exceed 40 (Grade D) regardless of any other score. Detecting a struggling student and doing nothing is a fundamental failure of the system's purpose.", S["td"])],
        [Paragraph("Rule 2 — Coverage Floor", ps("r2h", fontName="Helvetica-Bold", fontSize=9, textColor=NAVY)),
         Paragraph("If fewer than 10% of flagged students were contacted, the Response pillar cannot exceed 40, regardless of how quickly or cleanly other response sub-metrics perform.", S["td"])],
    ]
    rt = Table(rd, colWidths=[50*mm, AW-54*mm])
    rt.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0), colors.HexColor("#FFF7ED")),
        ("BACKGROUND",(0,1),(-1,1), colors.HexColor("#FFF1F2")),
        ("LINEBEFORE",(0,0),(0,0),3,AMBER),("LINEBEFORE",(0,1),(0,1),3,ROSE),
        ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
        ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("VALIGN",(0,0),(-1,-1),"TOP"),("GRID",(0,0),(-1,-1),0.3,BORDER),
    ]))
    story.append(rt)
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # SEC 3 — Nine Measurements (flat table, no nesting)
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("SECTION 3", S["eyebrow"]))
    story.append(Paragraph("The Nine Measurements", S["h1"]))
    story.append(rule())
    story.append(Paragraph(
        "Every faculty is measured on nine things. Each is a simple percentage or number of days. "
        "<b>The measurement itself becomes the score</b> — no translation to arbitrary bands.",
        S["body"]))
    story.append(sp(3))
    story.append(info_box("Missing Data Rule:", "If a measurement cannot be calculated (e.g. zero referred students), it scores 50 — neutral. The faculty is neither rewarded nor penalised.", accent=AMBER, bg=colors.HexColor("#FFFBEB")))
    story.append(sp(4))

    metrics = [
        ("①", "Coverage %", BLUE,
         "Of every student the system flagged as at-risk, what percentage did staff actually contact?",
         "Example: 73 flagged, 40 contacted → 54.7%",
         "Score = Coverage % directly"),
        ("②", "Critical Coverage %", BLUE,
         "Same as Coverage, but only for the most serious (critical) alerts — the highest-risk students.",
         "Critical alerts are prioritised separately to ensure urgent cases are not missed.",
         "Score = Critical Coverage % directly"),
        ("③", "Time to First Contact — TTFC (days)", ROSE,
         "After a student is flagged, how many days before staff first make contact? Lower is better. Measured as the median across all students.",
         "4 days → score 87   |   14 days → score 53   |   30+ days → score 0",
         "Score = 100 - (days / 30) x 100"),
        ("④", "Conclusion Rate %", VIOLET,
         "Of students who were contacted, what percentage had their case properly closed? A closed case = Resolved, No Action Required, or Referred to Wellbeing.",
         "Example: 73 contacted, 55 concluded → 75.3%",
         "Score = Conclusion Rate % directly"),
        ("⑤", "Wellbeing Uptake %", VIOLET,
         "Of students whose cases were concluded, how many were also seen by the Wellbeing Centre?",
         "Example: 55 concluded, 20 seen by Wellbeing → 36.4%",
         "Score = Wellbeing Uptake % directly"),
        ("⑥", "Recovery %", EMERALD,
         "Of students who were contacted, how many are no longer showing a warning or critical alert? This is the single most important measurement.",
         "Example: 73 contacted, 31 no longer in alert → 42.5%",
         "Score = Recovery % directly"),
        ("⑦", "Repeat Alert %", AMBER,
         "Of all flagged students, how many were previously resolved but have fallen back into alert? Lower is better.",
         "Example: 159 flagged, 8 repeats = 5% → score 95",
         "Score = 100 - Repeat Alert %"),
        ("⑧", "Stale Cases %", ROSE,
         "Of all open interventions, how many have had no update for more than 14 days? Lower is better. Stale = contacted once and forgotten.",
         "Example: 156 of 159 open cases stale = 98% → score 2",
         "Score = 100 - Stale Cases %"),
        ("⑨", "Attendance Posting %", AMBER,
         "Are teaching staff marking attendance reliably? The alert system depends on this data — if attendance is not posted, alerts cannot fire.",
         "Example: 95% of sessions marked → score 95",
         "Score = Attendance Posting % (maximum 100)"),
    ]

    # Flat 4-column table for metrics
    mhdr = [Paragraph(h, S["th"]) for h in ["#", "Metric", "What It Measures & Example", "Score Formula"]]
    mrows = [mhdr]
    for num, name, color, desc, example, formula in metrics:
        mrows.append([
            Paragraph(num, ps(f"mn{num}", fontName="Helvetica-Bold", fontSize=11, textColor=color, alignment=TA_CENTER)),
            Paragraph(f"<b>{name}</b>", ps(f"ml{num}", fontName="Helvetica-Bold", fontSize=8.5, leading=12, textColor=color)),
            Paragraph(f"{desc}<br/><font color='#64748B' size='8'>{example}</font>",
                      ps(f"md{num}", fontSize=8.5, leading=13, textColor=SLATE)),
            Paragraph(formula, ps(f"mf{num}", fontName="Courier", fontSize=7.5, leading=12, textColor=NAVY)),
        ])

    mt = Table(mrows, colWidths=[10*mm, 38*mm, 260*pts_from_mm(1), AW-10*mm-38*mm-260*pts_from_mm(1)])
    # recalc last col
    c1,c2,c3 = 10*mm, 38*mm, 95*mm
    c4 = AW - c1 - c2 - c3
    mt = Table(mrows, colWidths=[c1, c2, c3, c4])
    mt.setStyle(tbl_style([
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[OFF_WHITE, LIGHT_BG]),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("ALIGN",(0,0),(0,-1),"CENTER"),
    ]))
    story.append(mt)
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # SEC 4 — Pillar Calculations
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("SECTION 4", S["eyebrow"]))
    story.append(Paragraph("How Pillar Scores Are Calculated", S["h1"]))
    story.append(rule())

    pillars = [
        ("Response", BLUE, "25% of FEI",
         "How well staff reach and maintain contact with flagged students.",
         "avg(Coverage, Critical Coverage, TTFC, Stale Cases)",
         "Hard rule: if fewer than 10% of flagged students were contacted, Response cannot exceed 40."),
        ("Wellbeing", VIOLET, "25% of FEI",
         "How well students are supported and handed to professional services.",
         "avg(Conclusion Rate, Wellbeing Uptake)", None),
        ("Outcome", EMERALD, "30% of FEI",
         "Whether students actually got better — the most heavily weighted pillar.",
         "(Recovery × 80%)  +  (Repeat Alert × 20%)",
         "Recovery carries 80% because it is the most direct evidence a student improved. A high Repeat Alert score alone cannot rescue a faculty with zero recoveries."),
        ("Readiness", AMBER, "10% of FEI",
         "Whether attendance data is reliable enough to trust.",
         "Attendance Posting score", None),
        ("Sustained", colors.HexColor("#F97316"), "10% of FEI",
         "Whether improvement is lasting. Uses the same formula as Outcome.",
         "(Recovery × 80%)  +  (Repeat Alert × 20%)",
         "Outcome and Sustained are identical in formula. Together they give Recovery + Repeat Alert a combined 40% weight (30% + 10%), reflecting that student recovery is the system's core purpose."),
    ]

    for pname, pcolor, pweight, pdesc, pformula, pnote in pillars:
        hdr = Table([[
            Paragraph(pname, ps(f"ph{pname}", fontName="Helvetica-Bold", fontSize=13, textColor=WHITE)),
            Paragraph(pweight, ps(f"pw{pname}", fontName="Helvetica-Bold", fontSize=9, textColor=colors.HexColor("#CBD5E1"), alignment=TA_RIGHT)),
        ]], colWidths=[AW*0.65, AW*0.35])
        hdr.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),pcolor),
            ("LEFTPADDING",(0,0),(-1,-1),12),("RIGHTPADDING",(0,0),(-1,-1),12),
            ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
            ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ]))
        body_rows = [
            [Paragraph(pdesc, S["body"])],
            [Paragraph(pformula, S["formula"])],
        ]
        if pnote:
            body_rows.append([Paragraph(pnote, S["small"])])
        bt = Table(body_rows, colWidths=[AW])
        bcmds = [
            ("BACKGROUND",(0,0),(-1,-1),OFF_WHITE),
            ("LEFTPADDING",(0,0),(-1,-1),12),("RIGHTPADDING",(0,0),(-1,-1),12),
            ("TOPPADDING",(0,0),(0,0),8),("BOTTOMPADDING",(0,0),(0,0),4),
            ("TOPPADDING",(0,1),(0,1),6),("BOTTOMPADDING",(0,1),(0,1),6),
        ]
        if pnote:
            bcmds += [("TOPPADDING",(0,2),(0,2),6),("BOTTOMPADDING",(0,2),(0,2),10),
                      ("LINEBEFORE",(0,2),(0,2),2,pcolor),
                      ("BACKGROUND",(0,2),(-1,2),colors.HexColor("#F8FAFC"))]
        else:
            bcmds += [("BOTTOMPADDING",(0,1),(0,1),10)]
        bt.setStyle(TableStyle(bcmds))
        story.append(KeepTogether([hdr, bt, sp(3)]))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # SEC 5 — Worked Example
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("SECTION 5", S["eyebrow"]))
    story.append(Paragraph("Worked Example — Social Sciences", S["h1"]))
    story.append(rule())
    story.append(Paragraph(
        "Social Sciences has <b>159 students flagged</b>, <b>73 contacted</b>, "
        "<b>0 cases concluded</b>, and <b>0 students recovered</b>. "
        "Here is every step of the calculation.", S["body"]))
    story.append(sp(3))

    story.append(Paragraph("Step 1 — Raw Counts", S["h2"]))
    cd = [
        [Paragraph(h, S["th"]) for h in ["Count", "Value", "Meaning"]],
        [Paragraph("Students enrolled", S["td"]), Paragraph("1,541", S["tdb"]), Paragraph("Total active students in this faculty", S["td"])],
        [Paragraph("Students alerted", S["td"]), Paragraph("159", S["tdb"]), Paragraph("Students with a warning or critical alert", S["td"])],
        [Paragraph("Students intervened", S["td"]), Paragraph("73", S["tdb"]), Paragraph("Alerted students with any intervention recorded", S["td"])],
        [Paragraph("Cases concluded", S["td"]), Paragraph("0", ps("z1",fontName="Helvetica-Bold",fontSize=8.5,textColor=ROSE)), Paragraph("Interventions ending as Resolved / No Action / Referred", S["td"])],
        [Paragraph("Students recovered", S["td"]), Paragraph("0", ps("z2",fontName="Helvetica-Bold",fontSize=8.5,textColor=ROSE)), Paragraph("Intervened students no longer in alert", S["td"])],
        [Paragraph("Repeat alerts", S["td"]), Paragraph("3", S["tdb"]), Paragraph("Previously resolved students back in alert", S["td"])],
        [Paragraph("Stale cases", S["td"]), Paragraph("156", ps("s1",fontName="Helvetica-Bold",fontSize=8.5,textColor=ROSE)), Paragraph("Open interventions with no update for 14+ days", S["td"])],
    ]
    ct = Table(cd, colWidths=[50*mm, 20*mm, AW-74*mm])
    ct.setStyle(tbl_style()); story.append(ct)
    story.append(sp(3))

    story.append(Paragraph("Step 2 — Each Measurement Becomes a Score", S["h2"]))
    sd = [
        [Paragraph(h, S["th"]) for h in ["Measurement", "Raw Value", "Calculation", "Score"]],
        [Paragraph("Coverage %", S["td"]), Paragraph("73÷159=45.91%", S["td"]), Paragraph("Direct", S["td"]), Paragraph("46", S["tdb"])],
        [Paragraph("Critical Coverage %", S["td"]), Paragraph("44.63%", S["td"]), Paragraph("Direct", S["td"]), Paragraph("45", S["tdb"])],
        [Paragraph("TTFC (days)", S["td"]), Paragraph("No history (null)", S["td"]), Paragraph("Null = neutral", S["td"]), Paragraph("50", S["tdb"])],
        [Paragraph("Stale Cases %", S["td"]), Paragraph("156÷159=97.96%", S["td"]), Paragraph("100 − 97.96", S["td"]), Paragraph("2", ps("sc1",fontName="Helvetica-Bold",fontSize=8.5,textColor=ROSE))],
        [Paragraph("Conclusion Rate %", S["td"]), Paragraph("0÷73=0%", S["td"]), Paragraph("Direct", S["td"]), Paragraph("0", ps("sc2",fontName="Helvetica-Bold",fontSize=8.5,textColor=ROSE))],
        [Paragraph("Wellbeing Uptake %", S["td"]), Paragraph("0÷0=null", S["td"]), Paragraph("Null = neutral", S["td"]), Paragraph("50", S["tdb"])],
        [Paragraph("Recovery %", S["td"]), Paragraph("0÷73=0%", S["td"]), Paragraph("Direct", S["td"]), Paragraph("0", ps("sc3",fontName="Helvetica-Bold",fontSize=8.5,textColor=ROSE))],
        [Paragraph("Repeat Alert %", S["td"]), Paragraph("3÷159=1.89%", S["td"]), Paragraph("100 − 1.89", S["td"]), Paragraph("98", ps("sc4",fontName="Helvetica-Bold",fontSize=8.5,textColor=EMERALD))],
        [Paragraph("Attendance Posting %", S["td"]), Paragraph("119.39% → cap 100", S["td"]), Paragraph("min(119.39, 100)", S["td"]), Paragraph("100", ps("sc5",fontName="Helvetica-Bold",fontSize=8.5,textColor=EMERALD))],
    ]
    st = Table(sd, colWidths=[46*mm, 40*mm, 34*mm, 16*mm])
    st.setStyle(tbl_style([("ALIGN",(3,0),(3,-1),"CENTER")])); story.append(st)
    story.append(sp(3))

    story.append(Paragraph("Step 3 — Pillar Scores", S["h2"]))
    pc = [
        [Paragraph(h, S["th"]) for h in ["Pillar", "Calculation", "Score"]],
        [Paragraph("Response", S["td"]),  Paragraph("avg(46, 45, 50, 2) = 35.75", S["code"]),  Paragraph("36", S["tdb"])],
        [Paragraph("Wellbeing", S["td"]), Paragraph("avg(0, 50) = 25", S["code"]),             Paragraph("25", S["tdb"])],
        [Paragraph("Outcome", S["td"]),   Paragraph("(0 × 80%) + (98 × 20%) = 19.6", S["code"]), Paragraph("20", S["tdb"])],
        [Paragraph("Readiness", S["td"]), Paragraph("100", S["code"]),                          Paragraph("100", S["tdb"])],
        [Paragraph("Sustained", S["td"]), Paragraph("(0 × 80%) + (98 × 20%) = 19.6", S["code"]), Paragraph("20", S["tdb"])],
    ]
    pct = Table(pc, colWidths=[32*mm, AW-52*mm, 16*mm])
    pct.setStyle(tbl_style([("ALIGN",(2,0),(2,-1),"CENTER")])); story.append(pct)
    story.append(sp(3))

    story.append(Paragraph("Step 4 — Final FEI", S["h2"]))
    story.append(dark_banner(Paragraph(
        "(20 × 30%) + (25 × 25%) + (36 × 25%) + (100 × 10%) + (20 × 10%)<br/>"
        "= 6.0  +  6.25  +  9.0  +  10.0  +  2.0  =  <b>33.25</b>",
        ps("ff", fontName="Courier-Bold", fontSize=9.5, leading=16, textColor=WHITE)), bg=NAVY, accent=ROSE))
    story.append(sp(3))

    result = Table([[
        Paragraph("33\nGrade E", ps("rs", fontName="Helvetica-Bold", fontSize=20, leading=26, textColor=ROSE, alignment=TA_CENTER)),
        Paragraph("<b>Critical</b><br/>A faculty with 0% conclusions, 0% recovery, and 98% stale cases is correctly classified as Critical. The score of 33 reflects exactly that — zero wellbeing follow-through cannot be hidden by attendance data or low repeat alerts.",
            ps("rb", fontSize=9, leading=14, textColor=colors.HexColor("#CBD5E1"))),
    ]], colWidths=[35*mm, AW-39*mm])
    result.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),NAVY_MID),
        ("LINEBEFORE",(0,0),(0,-1),4,ROSE),
        ("LEFTPADDING",(0,0),(-1,-1),12),("RIGHTPADDING",(0,0),(-1,-1),12),
        ("TOPPADDING",(0,0),(-1,-1),12),("BOTTOMPADDING",(0,0),(-1,-1),12),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ]))
    story.append(result)
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # SEC 6 — Grade A targets
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("SECTION 6", S["eyebrow"]))
    story.append(Paragraph("What a Grade A Faculty Looks Like", S["h1"]))
    story.append(rule())
    story.append(Paragraph("The metric levels a faculty would need to achieve an Exemplary (A) grade.", S["body"]))
    story.append(sp(3))

    td_ = [
        [Paragraph(h, S["th"]) for h in ["Metric", "Target for Grade A"]],
        [Paragraph("Coverage %", S["tdb"]),          Paragraph("90% or more of flagged students contacted", S["td"])],
        [Paragraph("TTFC", S["tdb"]),                Paragraph("Within 3 days of the alert being raised", S["td"])],
        [Paragraph("Conclusion Rate %", S["tdb"]),   Paragraph("75% or more of cases properly closed (Resolved / No Action / Referred)", S["td"])],
        [Paragraph("Wellbeing Uptake %", S["tdb"]),  Paragraph("70% or more of concluded cases also seen by the Wellbeing Centre", S["td"])],
        [Paragraph("Recovery %", S["tdb"]),          Paragraph("60% or more of contacted students clear their alert", S["td"])],
        [Paragraph("Stale Cases %", S["tdb"]),       Paragraph("Less than 10% of open cases left without update for 14+ days", S["td"])],
        [Paragraph("Repeat Alert %", S["tdb"]),      Paragraph("Less than 5% of students return to alert after resolution", S["td"])],
    ]
    tt = Table(td_, colWidths=[48*mm, AW-52*mm])
    tt.setStyle(tbl_style([("TEXTCOLOR",(0,1),(0,-1),EMERALD)]))
    story.append(tt)
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # SEC 7 — Key Reminders
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("SECTION 7", S["eyebrow"]))
    story.append(Paragraph("Key Things to Remember", S["h1"]))
    story.append(rule())

    reminders = [
        (AMBER,  "High alerts do not mean a bad faculty.",
         "A faculty with 2,000 alerts may simply have more at-risk students. The FEI only measures what happens after the alert is raised, not how many alerts exist."),
        (BLUE,   "The score is the number.",
         "A Coverage score of 46 means 46% of students were reached — not a band, not a category. Every percentage point of real improvement moves the FEI."),
        (EMERALD,"Recovery drives everything.",
         "At 40% combined weight (Outcome 30% + Sustained 10%), whether students actually clear their alert is the dominant signal. Fast response and good attendance data cannot compensate for zero recoveries."),
        (ROSE,   "Stale cases are the most visible quick win.",
         "Closing or updating open interventions costs little effort but immediately moves the Stale score, which feeds directly into Response at 25% of FEI."),
        (VIOLET, "The referral and resolution pipeline matters.",
         "Conclusion Rate and Wellbeing Uptake form the Wellbeing pillar (25%). If staff are not closing cases or referring students, this pillar will be near zero regardless of response speed."),
        (SLATE_LT,"Scores refresh daily.",
         "The system recomputes all scores overnight. Improvements made today appear in tomorrow's dashboard."),
    ]

    for rcolor, rtitle, rbody in reminders:
        rb = Table([[
            Paragraph("", ps("rs_", fontSize=1)),
            Paragraph(f"<b>{rtitle}</b>  {rbody}", ps(f"rp_{rtitle[:4]}", fontSize=9, leading=14, textColor=SLATE)),
        ]], colWidths=[5*mm, AW-9*mm])
        rb.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),OFF_WHITE),
            ("BACKGROUND",(0,0),(0,-1),rcolor),
            ("LEFTPADDING",(0,0),(0,-1),0),("LEFTPADDING",(1,0),(1,-1),12),
            ("RIGHTPADDING",(1,0),(1,-1),12),
            ("TOPPADDING",(0,0),(-1,-1),10),("BOTTOMPADDING",(0,0),(-1,-1),10),
            ("BOX",(0,0),(-1,-1),0.4,BORDER),("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ]))
        story.append(KeepTogether([rb, sp(2)]))

    story.append(sp(5))
    story.append(rule(EMERALD))
    story.append(Paragraph(
        "FEI = (Outcome × 30%) + (Wellbeing × 25%) + (Response × 25%) + (Readiness × 10%) + (Sustained × 10%)",
        ps("ff2", fontName="Courier", fontSize=8, textColor=SLATE_LT, alignment=TA_CENTER)))
    story.append(Paragraph("Student Early Alert System · Faculty Effectiveness Index · Version June 2026",
        ps("df", fontSize=8, textColor=SLATE_LT, alignment=TA_CENTER, spaceBefore=3)))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print("Done:", path)

def pts_from_mm(x): return x * mm

build()
