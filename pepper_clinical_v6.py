#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════╗
║   PEPPER CLINICAL INFINITY V6                                        ║
║   © 2026 Lamya F. H. Ali — All Rights Reserved                       ║
║                                                                      ║
║   Full desktop application (PyQt6) — backend + frontend in Python.   ║
║   Camera AI · Drawing board · Tasks · Celebration · Parent Dashboard ║
║   (Overview · Analytics · Live · ISAA Assess · AI Advisor).          ║
║                                                                      ║
║   Run:  python pepper_clinical_v6.py                                 ║
║   Deps: PyQt6 PyQt6-WebEngine opencv-python mediapipe pyttsx3 numpy  ║
╚══════════════════════════════════════════════════════════════════════╝
"""
import os
import sys
import time
import math
import random
import threading
import webbrowser
import urllib.parse

from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QPushButton, QLabel, QLineEdit, QTextEdit, QStackedWidget, QFrame, QScrollArea,
    QSpinBox, QComboBox, QButtonGroup, QRadioButton, QMessageBox, QProgressBar,
    QSizePolicy,
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal, QUrl
from PyQt6.QtGui import QFont, QColor, QPixmap, QImage

import database as db
from task_generator import TaskGenerator
from clinical import ISAAAssessment, ClinicalAdvisor
from widgets import DrawingBoard, Celebration

try:
    from widgets import CameraThread
    _HAS_VISION = True
except Exception:
    _HAS_VISION = False

try:
    import pyttsx3
    _HAS_TTS = True
except Exception:
    _HAS_TTS = False

# ── Theme constants ──────────────────────────────────────────────────
PURPLE, PURPLE2, PURPLE3 = "#7c3aed", "#6d28d9", "#a78bfa"
DARK, BG = "#2d1b69", "#f5f0ff"
GREEN, TEAL, GOLD, RED, PINK = "#059669", "#0d9488", "#d97706", "#dc2626", "#db2777"

QSS = f"""
QMainWindow, QWidget {{ background:{BG}; color:{DARK}; font-family:'Segoe UI',Arial; }}
QPushButton {{ background:{PURPLE}; color:white; border:none; border-radius:10px;
    padding:10px 16px; font-size:14px; font-weight:bold; }}
QPushButton:hover {{ background:{PURPLE2}; }}
QPushButton:disabled {{ background:#b0a8c8; }}
QPushButton#ghost {{ background:rgba(124,58,237,0.12); color:{PURPLE}; }}
QPushButton#green {{ background:{GREEN}; }}
QPushButton#red {{ background:{RED}; }}
QPushButton#gold {{ background:{GOLD}; }}
QPushButton#teal {{ background:{TEAL}; }}
QPushButton#pink {{ background:{PINK}; }}
QLineEdit,QSpinBox,QComboBox,QTextEdit {{ background:white; border:1.5px solid {PURPLE3};
    border-radius:8px; padding:8px; font-size:14px; color:{DARK}; }}
QFrame#card {{ background:white; border:1px solid {PURPLE3}; border-radius:14px; }}
QScrollArea {{ border:none; background:transparent; }}
QProgressBar {{ border:1px solid {PURPLE3}; border-radius:7px; background:#ece6fa;
    height:16px; text-align:center; color:{DARK}; font-weight:bold; }}
QProgressBar::chunk {{ background:{PURPLE}; border-radius:7px; }}
"""

COPYRIGHT = "© 2026 Lamya F. H. Ali — Pepper Clinical Infinity V6 — All Rights Reserved"


def tts(text):
    if not _HAS_TTS:
        return
    def _run():
        try:
            e = pyttsx3.init(); e.setProperty("rate", 150)
            e.say(text); e.runAndWait(); e.stop()
        except Exception:
            pass
    threading.Thread(target=_run, daemon=True).start()


def H(t, size=22, bold=True, color=DARK):
    lbl = QLabel(t)
    f = QFont("Segoe UI", size)
    f.setBold(bold)
    lbl.setFont(f)
    lbl.setStyleSheet(f"color:{color};")
    return lbl


# ════════════════════════════════════════════════════════════════════
#  Bar chart widget (pure Qt, no external deps)
# ════════════════════════════════════════════════════════════════════
class BarChart(QWidget):
    def __init__(self, title=""):
        super().__init__()
        self.title = title
        self.data = []  # list of (label, value, color)
        self.setMinimumHeight(220)

    def set_data(self, data):
        self.data = data
        self.update()

    def paintEvent(self, e):
        from PyQt6.QtGui import QPainter, QPen, QBrush
        qp = QPainter(self)
        qp.setRenderHint(QPainter.RenderHint.Antialiasing)
        w, h = self.width(), self.height()
        qp.fillRect(self.rect(), QColor("white"))
        qp.setPen(QColor(DARK)); qp.setFont(QFont("Segoe UI", 11, QFont.Weight.Bold))
        qp.drawText(10, 20, self.title)
        if not self.data:
            qp.setPen(QColor("#9ca3af")); qp.setFont(QFont("Segoe UI", 10))
            qp.drawText(self.rect(), Qt.AlignmentFlag.AlignCenter, "No data yet")
            return
        top, bottom, left = 36, h - 30, 50
        maxv = max((d[1] for d in self.data), default=1) or 1
        n = len(self.data)
        gap = 14
        bw = max(18, (w - left - 20 - gap * n) / n)
        for i, (label, val, color) in enumerate(self.data):
            x = left + i * (bw + gap)
            bh = (val / maxv) * (bottom - top)
            qp.setBrush(QBrush(QColor(color))); qp.setPen(Qt.PenStyle.NoPen)
            qp.drawRoundedRect(int(x), int(bottom - bh), int(bw), int(bh), 5, 5)
            qp.setPen(QColor(DARK)); qp.setFont(QFont("Segoe UI", 8))
            qp.drawText(int(x - 4), bottom + 16, int(bw + 12), 14,
                        Qt.AlignmentFlag.AlignCenter, label[:8])
            qp.setFont(QFont("Segoe UI", 8, QFont.Weight.Bold))
            qp.drawText(int(x - 4), int(bottom - bh - 16), int(bw + 12), 14,
                        Qt.AlignmentFlag.AlignCenter, str(round(val)))


class LineChart(QWidget):
    def __init__(self, title=""):
        super().__init__()
        self.title = title
        self.values = []
        self.setMinimumHeight(200)

    def set_values(self, values):
        self.values = values
        self.update()

    def paintEvent(self, e):
        from PyQt6.QtGui import QPainter, QPen
        qp = QPainter(self)
        qp.setRenderHint(QPainter.RenderHint.Antialiasing)
        w, h = self.width(), self.height()
        qp.fillRect(self.rect(), QColor("white"))
        qp.setPen(QColor(DARK)); qp.setFont(QFont("Segoe UI", 11, QFont.Weight.Bold))
        qp.drawText(10, 20, self.title)
        if len(self.values) < 2:
            qp.setPen(QColor("#9ca3af")); qp.setFont(QFont("Segoe UI", 10))
            qp.drawText(self.rect(), Qt.AlignmentFlag.AlignCenter, "Need more sessions")
            return
        top, bottom, left, right = 36, h - 24, 40, w - 16
        maxv = max(self.values) or 1
        n = len(self.values)
        pen = QPen(QColor(PURPLE), 3); qp.setPen(pen)
        pts = []
        for i, v in enumerate(self.values):
            x = left + (right - left) * i / (n - 1)
            y = bottom - (v / maxv) * (bottom - top)
            pts.append((x, y))
        for i in range(1, len(pts)):
            qp.drawLine(int(pts[i-1][0]), int(pts[i-1][1]), int(pts[i][0]), int(pts[i][1]))
        qp.setBrush(QColor(PURPLE2))
        for (x, y) in pts:
            qp.drawEllipse(int(x-4), int(y-4), 8, 8)


if __name__ == "__main__":
    print("main module part 1 loaded OK")


# ════════════════════════════════════════════════════════════════════
#  SESSION SCREEN — tasks, camera, drawing, celebration
# ════════════════════════════════════════════════════════════════════
class SessionScreen(QWidget):
    finished = pyqtSignal()

    def __init__(self, app):
        super().__init__()
        self.app = app
        self.child = None
        self.session_id = None
        self.tasks = []
        self.cur = None
        self.score = 0
        self.correct = 0
        self.total = 0
        self.start_t = 0
        self.cam = None
        self.attn_sum = 0
        self.attn_n = 0
        self.emotions = {}
        self._build()

    def _build(self):
        root = QHBoxLayout(self)

        # LEFT: task panel
        left = QVBoxLayout()
        self.hdr = H("Session", 20)
        left.addWidget(self.hdr)

        stats = QHBoxLayout()
        self.lblScore = QLabel("⭐ 0"); self.lblCorrect = QLabel("✅ 0")
        self.lblTask = QLabel("📋 0"); self.lblTimer = QLabel("⏱ 0:00")
        for l in (self.lblScore, self.lblCorrect, self.lblTask, self.lblTimer):
            l.setStyleSheet(f"background:rgba(124,58,237,0.12);border-radius:8px;padding:6px 12px;font-weight:bold;color:{PURPLE};")
            stats.addWidget(l)
        stats.addStretch()
        left.addLayout(stats)

        self.taskCard = QFrame(); self.taskCard.setObjectName("card")
        tc = QVBoxLayout(self.taskCard)
        self.taskEm = QLabel("🎯"); self.taskEm.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.taskEm.setStyleSheet("font-size:64px;")
        self.taskInstr = QLabel("Press Start Session")
        self.taskInstr.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.taskInstr.setWordWrap(True)
        self.taskInstr.setStyleSheet(f"font-size:20px;font-weight:bold;color:{DARK};padding:8px;")
        tc.addWidget(self.taskEm); tc.addWidget(self.taskInstr)

        # options grid
        self.optWrap = QWidget(); self.optGrid = QGridLayout(self.optWrap)
        tc.addWidget(self.optWrap)

        # drawing board (hidden unless drawing task)
        self.board = DrawingBoard(); self.board.completed.connect(self._draw_done)
        self.board.hide()
        tc.addWidget(self.board, alignment=Qt.AlignmentFlag.AlignCenter)
        self.boardBtns = QWidget(); bb = QHBoxLayout(self.boardBtns)
        self.btnCheckDraw = QPushButton("✓ Check Drawing"); self.btnCheckDraw.setObjectName("green")
        self.btnClearDraw = QPushButton("Clear"); self.btnClearDraw.setObjectName("ghost")
        self.btnCheckDraw.clicked.connect(self._check_draw)
        self.btnClearDraw.clicked.connect(self.board.clear)
        bb.addWidget(self.btnCheckDraw); bb.addWidget(self.btnClearDraw)
        self.boardBtns.hide()
        tc.addWidget(self.boardBtns)

        # manual verify buttons (motor/social/etc.)
        self.verifyBtns = QWidget(); vb = QHBoxLayout(self.verifyBtns)
        self.btnYes = QPushButton("✅ Did it!"); self.btnYes.setObjectName("green")
        self.btnSkip = QPushButton("⏭ Skip"); self.btnSkip.setObjectName("ghost")
        self.btnYes.clicked.connect(lambda: self._record(True))
        self.btnSkip.clicked.connect(lambda: self._record(False))
        vb.addWidget(self.btnYes); vb.addWidget(self.btnSkip)
        tc.addWidget(self.verifyBtns)

        left.addWidget(self.taskCard, 1)

        # daily-life tools: YouTube + search
        tools = QHBoxLayout()
        self.btnYT = QPushButton("▶ Watch Video"); self.btnYT.setObjectName("red")
        self.btnYTSearch = QPushButton("🔎 Search YouTube"); self.btnYTSearch.setObjectName("ghost")
        self.btnMusic = QPushButton("🎵 Calm Music"); self.btnMusic.setObjectName("teal")
        self.btnYT.clicked.connect(self._open_video)
        self.btnYTSearch.clicked.connect(self._search_youtube)
        self.btnMusic.clicked.connect(self._play_music)
        tools.addWidget(self.btnYT); tools.addWidget(self.btnYTSearch); tools.addWidget(self.btnMusic)
        left.addLayout(tools)

        self.btnEnd = QPushButton("⏹ End Session"); self.btnEnd.setObjectName("ghost")
        self.btnEnd.clicked.connect(self.end)
        left.addWidget(self.btnEnd)

        root.addLayout(left, 3)

        # RIGHT: camera
        right = QVBoxLayout()
        right.addWidget(H("AI Camera", 16))
        self.camView = QLabel("Camera off")
        self.camView.setFixedSize(360, 300)
        self.camView.setStyleSheet(f"background:#1a1030;border-radius:12px;color:white;")
        self.camView.setAlignment(Qt.AlignmentFlag.AlignCenter)
        right.addWidget(self.camView)

        self.btnCam = QPushButton("📷 Start Camera"); self.btnCam.setObjectName("teal")
        self.btnCam.clicked.connect(self._toggle_cam)
        right.addWidget(self.btnCam)

        self.aiInfo = QLabel("Skeleton · Emotion · Fingers")
        self.aiInfo.setWordWrap(True)
        self.aiInfo.setStyleSheet(f"background:white;border:1px solid {PURPLE3};border-radius:10px;padding:10px;font-size:12px;")
        right.addWidget(self.aiInfo)

        # voice recorder (press to start / stop)
        self.btnRec = QPushButton("🎙 Hold to Record")
        self.btnRec.setCheckable(True)
        self.btnRec.clicked.connect(self._toggle_record)
        right.addWidget(self.btnRec)
        self.recStatus = QLabel("")
        self.recStatus.setStyleSheet("font-size:11px;color:#6b7280;")
        right.addWidget(self.recStatus)

        right.addStretch()
        cr = QLabel(COPYRIGHT); cr.setStyleSheet("font-size:9px;color:#9ca3af;")
        cr.setWordWrap(True)
        right.addWidget(cr)
        root.addLayout(right, 2)

        # celebration overlay
        self.celebration = Celebration(self)

        # timers
        self.timer = QTimer(self); self.timer.timeout.connect(self._tick)
        self._recording = False
        self._rec_data = None

    # ── lifecycle ──
    def start(self, child):
        self.child = child
        self.session_id = db.start_session(child["id"], "ABA-DTT")
        self.score = self.correct = self.total = 0
        self.attn_sum = self.attn_n = 0
        self.emotions = {}
        self.tasks = TaskGenerator.generate(count=60, level=1)
        self.hdr.setText(f"Session — {child['name']}")
        self.start_t = time.time()
        self.timer.start(1000)
        self._next()
        tts(f"Session started for {child['name']}")

    def _tick(self):
        el = int(time.time() - self.start_t)
        self.lblTimer.setText(f"⏱ {el//60}:{el%60:02d}")

    def _clear_opts(self):
        while self.optGrid.count():
            it = self.optGrid.takeAt(0)
            if it.widget():
                it.widget().deleteLater()

    def _next(self):
        if len(self.tasks) < 5:
            self.tasks += TaskGenerator.generate(count=60, level=1)
        self.cur = self.tasks.pop(0)
        self.total += 1
        self.lblTask.setText(f"📋 {self.total}")
        t = self.cur
        self.taskEm.setText(t.get("em", "🎯"))
        self.taskInstr.setText(t.get("instruction", ""))
        self._clear_opts()
        self.optWrap.hide(); self.board.hide(); self.boardBtns.hide(); self.verifyBtns.hide()
        self.btnYT.setEnabled(t["type"] == "daily")

        if t["type"] == "grid":
            self.optWrap.show()
            opts = t["options"]
            for i, o in enumerate(opts):
                b = QPushButton(f"{o['em']}\n{o['label']}")
                b.setMinimumSize(90, 90)
                b.setStyleSheet(f"background:{o.get('color','#ede9fe')};color:{DARK};border-radius:12px;font-size:16px;font-weight:bold;")
                b.clicked.connect(lambda _, idx=i: self._record(idx == t["correct"]))
                self.optGrid.addWidget(b, i // 3, i % 3)
        elif t["type"] == "drawing":
            self.board.show(); self.boardBtns.show()
            self.board.set_target(t.get("draw_kind", "shape"), t.get("draw_target", "circle"))
        else:
            # motor / verbal / social / daily / number → manual verify
            self.verifyBtns.show()
        tts(t.get("instruction", ""))

    def _check_draw(self):
        if self.board.coverage() >= 0.5:
            self._record(True)
        else:
            self.taskInstr.setText("Trace over the light lines a bit more! ✏️")
            tts("Trace over the light lines")

    def _draw_done(self, ok):
        if ok:
            self._record(True)

    def _record(self, success):
        t = self.cur
        if success:
            self.score += t.get("tokens", 1)
            self.correct += 1
            self.lblScore.setText(f"⭐ {self.score}")
            self.lblCorrect.setText(f"✅ {self.correct}")
            tts(t.get("success", "Great job"))
        else:
            tts(t.get("fail", "Try again"))
        db.log_task(self.session_id, self.child["id"], t.get("domain", ""),
                    t.get("type", ""), success,
                    attention=self.app.live_attention, emotion=self.app.live_emotion)
        # celebrate every 10 tasks
        if self.total % 10 == 0:
            self.celebration.resize(self.size())
            self.celebration.celebrate()
            tts("Ten tasks! You are a star! Clap your hands!")
            QTimer.singleShot(2600, self._next)
        else:
            QTimer.singleShot(450, self._next)

    # ── camera ──
    def _toggle_cam(self):
        if self.cam and self.cam.isRunning():
            self.cam.stop(); self.cam = None
            self.btnCam.setText("📷 Start Camera")
            self.camView.setText("Camera off")
            return
        if not _HAS_VISION:
            QMessageBox.information(self, "Camera",
                "Camera needs opencv-python + mediapipe installed on this machine.")
            return
        self.cam = CameraThread()
        self.cam.frame_ready.connect(self._on_frame)
        self.cam.results_ready.connect(self._on_results)
        self.cam.error.connect(lambda m: self.camView.setText(m))
        self.cam.start()
        self.btnCam.setText("⏹ Stop Camera")

    def _on_frame(self, img):
        pix = QPixmap.fromImage(img).scaled(
            self.camView.width(), self.camView.height(),
            Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation)
        self.camView.setPixmap(pix)

    def _on_results(self, res):
        self.app.live_emotion = res.get("emotion", "neutral")
        self.app.live_attention = res.get("attention", 0)
        self.app.live_fingers = res.get("fingers", 0)
        self.app.live_gesture = res.get("gesture", "none")
        if res.get("attention"):
            self.attn_sum += res["attention"]; self.attn_n += 1
        em = res.get("emotion", "neutral")
        self.emotions[em] = self.emotions.get(em, 0) + 1
        self.aiInfo.setText(
            f"Pose: {'✓' if res.get('pose_detected') else '–'}  "
            f"Posture: {res.get('posture','?')}\n"
            f"Fingers: {res.get('fingers',0)} (L{res.get('fingers_left',0)}/R{res.get('fingers_right',0)})  "
            f"Gesture: {res.get('gesture','none')}\n"
            f"Emotion: {res.get('emotion','?')}  Attention: {res.get('attention',0):.0f}%\n"
            f"Hand raised: {'yes' if res.get('hand_raised') else 'no'}  "
            f"Joints: {res.get('joints',{})}")

        # auto-verify some motor/number tasks live
        if self.cur:
            t = self.cur
            if t["type"] == "number" and res.get("fingers") == t.get("target"):
                self._auto_ok()
            elif t["type"] == "motor":
                v = t.get("verify")
                if (v == res.get("gesture")) or (v == "hand_raised" and res.get("hand_raised")) \
                   or (v == "head_touch" and res.get("head_touch")) or (v == "clap" and res.get("clap")):
                    self._auto_ok()

    def _auto_ok(self):
        if getattr(self, "_locked", False):
            return
        self._locked = True
        self._record(True)
        QTimer.singleShot(900, lambda: setattr(self, "_locked", False))

    # ── daily-life tools ──
    def _open_video(self):
        q = self.cur.get("youtube_query", "autism therapy kids") if self.cur else "kids learning"
        webbrowser.open("https://www.youtube.com/results?search_query=" + urllib.parse.quote(q))

    def _search_youtube(self):
        q = self.taskInstr.text() or "autism learning kids"
        webbrowser.open("https://www.youtube.com/results?search_query=" + urllib.parse.quote(q))

    def _play_music(self):
        webbrowser.open("https://www.youtube.com/results?search_query=" +
                        urllib.parse.quote("calming music for autistic children"))

    # ── voice recorder (press start / press stop) ──
    def _toggle_record(self):
        try:
            import sounddevice as sd
            import numpy as np
        except Exception:
            self.recStatus.setText("Install 'sounddevice' to record.")
            self.btnRec.setChecked(False)
            return
        if self.btnRec.isChecked():
            self._recording = True
            self.btnRec.setText("⏹ Stop Recording")
            self.recStatus.setText("● Recording…")
            self._rec_data = sd.rec(int(60 * 44100), samplerate=44100, channels=1)
        else:
            self._recording = False
            self.btnRec.setText("🎙 Hold to Record")
            try:
                sd.stop()
                self.recStatus.setText("Saved recording ✓")
            except Exception:
                self.recStatus.setText("Stopped.")

    def end(self):
        self.timer.stop()
        if self.cam and self.cam.isRunning():
            self.cam.stop(); self.cam = None
        avg_attn = round(self.attn_sum / self.attn_n, 1) if self.attn_n else 0
        dom_emo = max(self.emotions, key=self.emotions.get) if self.emotions else ""
        db.end_session(self.session_id, duration_sec=int(time.time() - self.start_t),
                       score=self.score, tasks_total=self.total, tasks_success=self.correct,
                       tasks_fail=self.total - self.correct, tasks_mastered=self.correct // 10,
                       avg_attention=avg_attn, dominant_emotion=dom_emo)
        QMessageBox.information(self, "Session Complete",
            f"Score: {self.score}\nCorrect: {self.correct}/{self.total}\nAvg attention: {avg_attn}%")
        self.finished.emit()


# ════════════════════════════════════════════════════════════════════
#  PARENT DASHBOARD — Overview · Analytics · Live · Assess · Advisor
# ════════════════════════════════════════════════════════════════════
class ParentDashboard(QWidget):
    def __init__(self, app):
        super().__init__()
        self.app = app
        self.child = None
        self.advisor = ClinicalAdvisor()
        self.isaa_answers = {}
        self._build()

    def _build(self):
        root = QVBoxLayout(self)
        top = QHBoxLayout()
        self.title = H("Parent Dashboard", 20)
        top.addWidget(self.title); top.addStretch()
        self.btnBack = QPushButton("← Back"); self.btnBack.setObjectName("ghost")
        self.btnBack.clicked.connect(lambda: self.app.go("home"))
        top.addWidget(self.btnBack)
        root.addLayout(top)

        # tab buttons
        tabs = QHBoxLayout()
        self.tabBtns = {}
        for key, lbl in [("overview", "📊 Overview"), ("analytics", "📈 Analytics"),
                         ("live", "🔴 Live"), ("assess", "📋 ISAA Assess"),
                         ("advisor", "🤖 AI Advisor")]:
            b = QPushButton(lbl); b.setObjectName("ghost")
            b.clicked.connect(lambda _, k=key: self._show(k))
            tabs.addWidget(b); self.tabBtns[key] = b
        root.addLayout(tabs)

        self.stack = QStackedWidget()
        self.page_overview = self._page_overview()
        self.page_analytics = self._page_analytics()
        self.page_live = self._page_live()
        self.page_assess = self._page_assess()
        self.page_advisor = self._page_advisor()
        for p in (self.page_overview, self.page_analytics, self.page_live,
                  self.page_assess, self.page_advisor):
            self.stack.addWidget(p)
        root.addWidget(self.stack, 1)

        cr = QLabel(COPYRIGHT); cr.setStyleSheet("font-size:9px;color:#9ca3af;")
        root.addWidget(cr)

        # live refresh timer
        self.liveTimer = QTimer(self); self.liveTimer.timeout.connect(self._refresh_live)

    def open_for(self, child):
        self.child = child
        self.title.setText(f"Dashboard — {child['name']}")
        self._show("overview")

    def _show(self, key):
        idx = {"overview": 0, "analytics": 1, "live": 2, "assess": 3, "advisor": 4}[key]
        self.stack.setCurrentIndex(idx)
        for k, b in self.tabBtns.items():
            b.setObjectName("ghost" if k != key else "")
            b.setStyleSheet("")
            self.style().polish(b)
        if key == "overview":
            self._refresh_overview()
        elif key == "analytics":
            self._refresh_analytics()
        elif key == "live":
            self.liveTimer.start(400)
        else:
            self.liveTimer.stop()

    # ── Overview ──
    def _page_overview(self):
        w = QWidget(); lay = QVBoxLayout(w)
        self.ovStats = QHBoxLayout(); lay.addLayout(self.ovStats)
        lay.addWidget(H("Skill Progress", 15))
        self.skillBars = {}
        for name in ["Motor", "Cognitive", "Verbal", "Math", "Social", "Fine Motor"]:
            row = QHBoxLayout()
            lbl = QLabel(name); lbl.setFixedWidth(90)
            bar = QProgressBar(); bar.setValue(0)
            row.addWidget(lbl); row.addWidget(bar)
            self.skillBars[name] = bar
            lay.addLayout(row)
        lay.addStretch()
        return w

    def _refresh_overview(self):
        for i in reversed(range(self.ovStats.count())):
            it = self.ovStats.takeAt(i)
            if it.widget():
                it.widget().deleteLater()
        if not self.child:
            return
        st = db.child_stats(self.child["id"])
        if not st:
            return
        cards = [("Sessions", st["total_sessions"], PURPLE),
                 ("Total Score", st["total_score"], GREEN),
                 ("Mastered", st["total_mastered"], GOLD),
                 ("Avg Attention", f"{st['avg_attention']}%", TEAL)]
        for label, val, color in cards:
            c = QFrame(); c.setObjectName("card")
            cl = QVBoxLayout(c)
            v = QLabel(str(val)); v.setStyleSheet(f"color:{color};font-size:26px;font-weight:bold;")
            v.setAlignment(Qt.AlignmentFlag.AlignCenter)
            t = QLabel(label); t.setAlignment(Qt.AlignmentFlag.AlignCenter)
            t.setStyleSheet("color:#6b7280;font-size:12px;")
            cl.addWidget(v); cl.addWidget(t)
            self.ovStats.addWidget(c)
        for name, bar in self.skillBars.items():
            bar.setValue(int(st["skills"].get(name, 0)))

    # ── Analytics ──
    def _page_analytics(self):
        w = QWidget(); lay = QVBoxLayout(w)
        self.chartScore = LineChart("Score per Session")
        self.chartDomain = BarChart("Success by Domain (%)")
        self.chartSkills = BarChart("Current Skill Levels")
        lay.addWidget(card_wrap(self.chartScore))
        lay.addWidget(card_wrap(self.chartDomain))
        lay.addWidget(card_wrap(self.chartSkills))
        return w

    def _refresh_analytics(self):
        if not self.child:
            return
        st = db.child_stats(self.child["id"])
        if not st:
            return
        sessions = list(reversed(st["sessions"]))
        self.chartScore.set_values([s["score"] for s in sessions] or [])
        dom = []
        palette = [PURPLE, GREEN, TEAL, GOLD, RED, PINK, PURPLE2]
        for i, (d, v) in enumerate(st["domain_stats"].items()):
            pct = (v["success"] / v["total"] * 100) if v["total"] else 0
            dom.append((d, pct, palette[i % len(palette)]))
        self.chartDomain.set_data(dom)
        skills = [(k, v, palette[i % len(palette)]) for i, (k, v) in enumerate(st["skills"].items())]
        self.chartSkills.set_data(skills)

    # ── Live ──
    def _page_live(self):
        w = QWidget(); lay = QVBoxLayout(w)
        lay.addWidget(H("Live State (during a session)", 15))
        self.liveGrid = QGridLayout(); lay.addLayout(self.liveGrid)
        self.liveLabels = {}
        for i, (k, lbl) in enumerate([("emotion", "Emotion"), ("attention", "Attention"),
                                       ("fingers", "Fingers"), ("gesture", "Gesture")]):
            c = QFrame(); c.setObjectName("card"); cl = QVBoxLayout(c)
            v = QLabel("–"); v.setStyleSheet(f"color:{PURPLE};font-size:24px;font-weight:bold;")
            v.setAlignment(Qt.AlignmentFlag.AlignCenter)
            t = QLabel(lbl); t.setAlignment(Qt.AlignmentFlag.AlignCenter)
            t.setStyleSheet("color:#6b7280;")
            cl.addWidget(v); cl.addWidget(t)
            self.liveGrid.addWidget(c, i // 2, i % 2)
            self.liveLabels[k] = v
        self.liveNote = QLabel("Start a session with the camera on to see live AI data.")
        self.liveNote.setStyleSheet("color:#6b7280;")
        lay.addWidget(self.liveNote); lay.addStretch()
        return w

    def _refresh_live(self):
        self.liveLabels["emotion"].setText(str(self.app.live_emotion))
        self.liveLabels["attention"].setText(f"{self.app.live_attention:.0f}%")
        self.liveLabels["fingers"].setText(str(self.app.live_fingers))
        self.liveLabels["gesture"].setText(str(self.app.live_gesture))

    # ── ISAA Assessment ──
    def _page_assess(self):
        w = QWidget(); outer = QVBoxLayout(w)
        outer.addWidget(H("ISAA — Indian Scale for Assessment of Autism", 15))
        info = QLabel("Rate each item 1 (Rarely) to 5 (Always). 40 items across 6 domains.")
        info.setStyleSheet("color:#6b7280;"); outer.addWidget(info)

        scroll = QScrollArea(); scroll.setWidgetResizable(True)
        inner = QWidget(); self.isaaLay = QVBoxLayout(inner)
        items = ISAAAssessment.all_items()
        self.isaaGroups = []
        cur_domain = None
        for idx, it in enumerate(items):
            if it["domain"] != cur_domain:
                cur_domain = it["domain"]
                d = QLabel(f"▸ {cur_domain}")
                d.setStyleSheet(f"color:{PURPLE2};font-weight:bold;font-size:13px;margin-top:8px;")
                self.isaaLay.addWidget(d)
            row = QHBoxLayout()
            q = QLabel(f"{idx+1}. {it['question']}"); q.setWordWrap(True); q.setFixedWidth(380)
            row.addWidget(q)
            grp = QButtonGroup(self)
            for val in range(1, 6):
                rb = QRadioButton(str(val))
                grp.addButton(rb, val)
                rb.toggled.connect(lambda chk, i=idx, v=val: self._isaa_set(i, v) if chk else None)
                row.addWidget(rb)
            self.isaaGroups.append(grp)
            rw = QWidget(); rw.setLayout(row)
            self.isaaLay.addWidget(rw)
        scroll.setWidget(inner)
        outer.addWidget(scroll, 1)

        btnRow = QHBoxLayout()
        self.btnScore = QPushButton("Calculate ISAA Score"); self.btnScore.setObjectName("green")
        self.btnScore.clicked.connect(self._isaa_score)
        btnRow.addWidget(self.btnScore)
        self.isaaResult = QLabel(""); self.isaaResult.setWordWrap(True)
        self.isaaResult.setStyleSheet(f"background:white;border:1px solid {PURPLE3};border-radius:10px;padding:12px;font-weight:bold;")
        btnRow.addWidget(self.isaaResult, 1)
        outer.addLayout(btnRow)
        return w

    def _isaa_set(self, idx, val):
        self.isaa_answers[idx] = val

    def _isaa_score(self):
        if len(self.isaa_answers) < 40:
            QMessageBox.information(self, "ISAA",
                f"Please answer all 40 items. ({len(self.isaa_answers)}/40 done)")
            return
        res = ISAAAssessment.score(self.isaa_answers)
        self.isaaResult.setText(
            f"Total: {res['total']}/{res['max_possible']}  →  {res['level']}\n{res['interpretation']}")
        self.isaaResult.setStyleSheet(
            f"background:white;border:2px solid {res['color']};border-radius:10px;padding:12px;color:{res['color']};font-weight:bold;")
        if self.child:
            db.save_assessment(self.child["id"], res, self.isaa_answers)

    # ── AI Advisor ──
    def _page_advisor(self):
        w = QWidget(); lay = QVBoxLayout(w)
        lay.addWidget(H("Dr. Pepper — AI Clinical Advisor", 15))
        self.advisorLog = QTextEdit(); self.advisorLog.setReadOnly(True)
        self.advisorLog.setStyleSheet("background:white;font-size:13px;")
        self.advisorLog.setPlainText("Dr. Pepper: " + self.advisor.GREETING + "\n")
        lay.addWidget(self.advisorLog, 1)
        row = QHBoxLayout()
        self.advisorIn = QLineEdit(); self.advisorIn.setPlaceholderText("Ask about meltdowns, speech, stimming, sleep…")
        self.advisorIn.returnPressed.connect(self._advisor_ask)
        btn = QPushButton("Ask"); btn.clicked.connect(self._advisor_ask)
        row.addWidget(self.advisorIn, 1); row.addWidget(btn)
        lay.addLayout(row)
        self.advisorMem = QLabel("Memory: 0 questions stored")
        self.advisorMem.setStyleSheet("color:#6b7280;font-size:11px;")
        lay.addWidget(self.advisorMem)
        return w

    def _advisor_ask(self):
        q = self.advisorIn.text().strip()
        if not q:
            return
        self.advisorIn.clear()
        ans = self.advisor.ask(q)
        self.advisorLog.append(f"\nYou: {q}")
        self.advisorLog.append(f"Dr. Pepper: {ans}")
        topics = self.advisor.topics_discussed()
        self.advisorMem.setText(
            f"Memory: {len(self.advisor.history())} questions stored · topics: {topics}")


def card_wrap(widget):
    f = QFrame(); f.setObjectName("card")
    l = QVBoxLayout(f); l.addWidget(widget)
    return f


# ════════════════════════════════════════════════════════════════════
#  HOME SCREEN — child cards, add child, start session, dashboard, PDF
# ════════════════════════════════════════════════════════════════════
class HomeScreen(QWidget):
    def __init__(self, app):
        super().__init__()
        self.app = app
        self._build()

    def _build(self):
        root = QVBoxLayout(self)
        top = QHBoxLayout()
        title = H("🤖 Pepper Clinical Infinity V6", 24)
        top.addWidget(title); top.addStretch()
        self.btnAdd = QPushButton("+ Add Child")
        self.btnAdd.clicked.connect(self._add_child)
        top.addWidget(self.btnAdd)
        root.addLayout(top)

        sub = QLabel("AI autism therapy · skeleton · emotion · fingers · drawing · "
                     "tasks · ISAA · advisor")
        sub.setStyleSheet("color:#6b7280;")
        root.addWidget(sub)

        self.scroll = QScrollArea(); self.scroll.setWidgetResizable(True)
        self.listWidget = QWidget(); self.listLay = QVBoxLayout(self.listWidget)
        self.scroll.setWidget(self.listWidget)
        root.addWidget(self.scroll, 1)

        cr = QLabel(COPYRIGHT); cr.setStyleSheet("font-size:9px;color:#9ca3af;")
        root.addWidget(cr)

    def refresh(self):
        while self.listLay.count():
            it = self.listLay.takeAt(0)
            if it.widget():
                it.widget().deleteLater()
        children = db.list_children()
        if not children:
            empty = QLabel("No children yet. Click '+ Add Child' to begin.")
            empty.setStyleSheet("color:#6b7280;padding:20px;")
            self.listLay.addWidget(empty)
        colors = [PURPLE, TEAL, GREEN, GOLD, RED, PINK]
        for i, c in enumerate(children):
            self.listLay.addWidget(self._child_card(c, colors[i % len(colors)]))
        self.listLay.addStretch()

    def _child_card(self, c, color):
        f = QFrame(); f.setObjectName("card")
        lay = QVBoxLayout(f)
        head = QHBoxLayout()
        av = QLabel(c["name"][:1].upper())
        av.setFixedSize(50, 50)
        av.setAlignment(Qt.AlignmentFlag.AlignCenter)
        av.setStyleSheet(f"background:{color};color:white;border-radius:25px;font-size:22px;font-weight:bold;")
        head.addWidget(av)
        info = QLabel(f"<b style='font-size:16px'>{c['name']}</b><br>"
                      f"<span style='color:#6b7280;font-size:12px'>Age {c['age']} · "
                      f"{c['total_sessions']} sessions · {c['total_score']} pts · PIN {c['pin']}</span>")
        head.addWidget(info, 1)
        lay.addLayout(head)

        btns = QHBoxLayout()
        b1 = QPushButton("▶ Start Session"); b1.setObjectName("green")
        b1.clicked.connect(lambda _, ch=c: self.app.start_session(ch))
        b2 = QPushButton("📊 Dashboard"); b2.setObjectName("ghost")
        b2.clicked.connect(lambda _, ch=c: self.app.open_dashboard(ch))
        b3 = QPushButton("📄 PDF Report"); b3.setObjectName("gold")
        b3.clicked.connect(lambda _, ch=c: self.app.make_pdf(ch))
        b4 = QPushButton("🎮 Games"); b4.setObjectName("teal")
        b4.clicked.connect(lambda _, ch=c: self.app.start_session(ch))
        for b in (b1, b2, b3, b4):
            btns.addWidget(b)
        lay.addLayout(btns)
        return f

    def _add_child(self):
        from PyQt6.QtWidgets import QInputDialog
        name, ok = QInputDialog.getText(self, "Add Child", "Child's name:")
        if not ok or not name.strip():
            return
        age, ok2 = QInputDialog.getInt(self, "Add Child", "Age:", 6, 2, 18)
        if not ok2:
            return
        cid, pin = db.add_child(name.strip(), age, "")
        QMessageBox.information(self, "Child Added",
            f"{name} added.\nPIN: {pin}\n(Save this PIN.)")
        self.refresh()


# ════════════════════════════════════════════════════════════════════
#  MAIN WINDOW
# ════════════════════════════════════════════════════════════════════
class PepperApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Pepper Clinical Infinity V6 — © 2026 Lamya F. H. Ali")
        self.resize(1100, 740)
        self.setStyleSheet(QSS)

        # live AI state shared with dashboard
        self.live_emotion = "neutral"
        self.live_attention = 0.0
        self.live_fingers = 0
        self.live_gesture = "none"

        db.init_db()

        self.stack = QStackedWidget()
        self.home = HomeScreen(self)
        self.session = SessionScreen(self)
        self.dashboard = ParentDashboard(self)
        self.session.finished.connect(lambda: self.go("home"))
        for w in (self.home, self.session, self.dashboard):
            self.stack.addWidget(w)
        self.setCentralWidget(self.stack)

        self.home.refresh()
        self.go("home")

    def go(self, name):
        idx = {"home": 0, "session": 1, "dashboard": 2}[name]
        if name == "home":
            self.home.refresh()
        self.stack.setCurrentIndex(idx)

    def start_session(self, child):
        self.session.start(child)
        self.go("session")

    def open_dashboard(self, child):
        self.dashboard.open_for(child)
        self.go("dashboard")

    def make_pdf(self, child):
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.pdfgen import canvas
            from reportlab.lib.units import cm
        except Exception:
            QMessageBox.information(self, "PDF",
                "Install 'reportlab' to export PDF:\n  pip install reportlab")
            return
        st = db.child_stats(child["id"])
        path = os.path.join(os.path.expanduser("~"), f"Pepper_Report_{child['name']}.pdf")
        c = canvas.Canvas(path, pagesize=A4)
        W, Hh = A4
        c.setFillColorRGB(0.42, 0.22, 0.84)
        c.rect(0, Hh - 3 * cm, W, 3 * cm, fill=1, stroke=0)
        c.setFillColorRGB(1, 1, 1); c.setFont("Helvetica-Bold", 20)
        c.drawString(2 * cm, Hh - 2 * cm, "Pepper Clinical Infinity V6 — Report")
        c.setFillColorRGB(0.1, 0.1, 0.3); c.setFont("Helvetica-Bold", 14)
        y = Hh - 4 * cm
        c.drawString(2 * cm, y, f"Child: {child['name']}   Age: {child['age']}")
        y -= 1 * cm
        c.setFont("Helvetica", 12)
        if st:
            for line in [f"Total sessions: {st['total_sessions']}",
                         f"Total score: {st['total_score']}",
                         f"Tasks mastered: {st['total_mastered']}",
                         f"Average attention: {st['avg_attention']}%"]:
                c.drawString(2 * cm, y, line); y -= 0.7 * cm
            y -= 0.4 * cm
            c.setFont("Helvetica-Bold", 13); c.drawString(2 * cm, y, "Skill Levels:"); y -= 0.7 * cm
            c.setFont("Helvetica", 12)
            for k, v in st["skills"].items():
                c.drawString(2.4 * cm, y, f"{k}: {round(v)}%"); y -= 0.6 * cm
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(2 * cm, 1.5 * cm, COPYRIGHT)
        c.save()
        QMessageBox.information(self, "PDF Saved", f"Report saved to:\n{path}")


def main():
    app = QApplication(sys.argv)
    win = PepperApp()
    win.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
