/* 24 奇怪星球 封面產生器 — 主邏輯（Fabric.js 5） */
(function () {
  "use strict";

  // ===== 設計座標系統（匯出最終尺寸）=====
  const DESIGN_W = 1080;
  const DESIGN_H = 1920;
  const SAFE_SIZE = 1080;                 // IG 安全區為 1080×1080 正方形
  const SAFE_TOP = (DESIGN_H - SAFE_SIZE) / 2;  // 420
  const SAFE_BOTTOM = SAFE_TOP + SAFE_SIZE;      // 1500

  // 預設值（皆以「設計座標 1080 寬」為基準）
  const TITLE_DEFAULT_SIZE = 130;
  const TITLE_DEFAULT_CY = 1180;          // 標題預設中心 Y：安全區中下偏下
  const LOGO_TARGET_W = 700;              // logo 目標寬（含透明留白）
  const LOGO_CY = 1450;                   // logo 中心 Y：安全區底部附近

  // ===== 計算顯示尺寸（手機優先，貼合螢幕）=====
  function computeDisplay() {
    const wrapMaxW = Math.min(window.innerWidth - 28, 460);
    // 同時受視窗高度限制（保留 header + 控制列空間）
    const maxH = window.innerHeight * 0.62;
    let w = wrapMaxW;
    let h = (w * DESIGN_H) / DESIGN_W;
    if (h > maxH) {
      h = maxH;
      w = (h * DESIGN_W) / DESIGN_H;
    }
    return { w: Math.round(w), h: Math.round(h) };
  }

  const disp = computeDisplay();
  const SCALE = disp.w / DESIGN_W;        // 設計座標 → 顯示座標
  const EXPORT_MULT = 1 / SCALE;          // 顯示 → 匯出（得到 1080×1920）

  // d() 把設計座標換算成顯示座標
  const d = (v) => v * SCALE;

  // ===== 初始化畫布 =====
  const canvasEl = document.getElementById("coverCanvas");
  const canvas = new fabric.Canvas("coverCanvas", {
    width: disp.w,
    height: disp.h,
    backgroundColor: "#d4d4d8",
    preserveObjectStacking: true,
    selection: false,
  });

  // 安全區 overlay 定位（對應顯示座標）
  const safeOverlay = document.getElementById("safeOverlay");
  function layoutSafeOverlay() {
    safeOverlay.style.top = d(SAFE_TOP) + "px";
    safeOverlay.style.height = d(SAFE_SIZE) + "px";
  }
  layoutSafeOverlay();

  // ===== 圖層參照 =====
  let bgImage = null;
  let titleText = null;
  let logoImage = null;
  let illustImage = null;

  // 維持圖層順序：背景(底) < 插畫 < 標題 < logo(頂)
  function restack() {
    if (bgImage) canvas.sendToBack(bgImage);
    if (illustImage && bgImage) illustImage.moveTo(1);
    if (titleText) canvas.bringToFront(titleText);
    if (logoImage) canvas.bringToFront(logoImage);
    canvas.requestRenderAll();
  }

  // ===== 背景照片 =====
  const photoInput = document.getElementById("photoInput");
  const hint = document.getElementById("hint");
  photoInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    readImage(file, (img) => {
      // cover-fit 鋪滿畫布
      const scale = Math.max(disp.w / img.width, disp.h / img.height);
      img.set({
        originX: "center",
        originY: "center",
        left: disp.w / 2,
        top: disp.h / 2,
        scaleX: scale,
        scaleY: scale,
      });
      if (bgImage) canvas.remove(bgImage);
      bgImage = img;
      canvas.add(bgImage);
      restack();
      hint.textContent = "可拖曳照片調整位置・拖角縮放";
      ensureTitle();
      ensureLogo();
    });
  });

  // ===== 標題 =====
  const titleInput = document.getElementById("titleInput");
  const fontSizeSlider = document.getElementById("fontSize");
  const fontSizeVal = document.getElementById("fontSizeVal");

  function makeTitle(textValue) {
    const t = new fabric.Textbox(textValue || "你的標題", {
      originX: "center",
      originY: "center",
      left: disp.w / 2,
      top: d(TITLE_DEFAULT_CY),
      width: d(DESIGN_W * 0.86),
      fontFamily: "JenBoDD",
      fontSize: d(TITLE_DEFAULT_SIZE),
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: d(TITLE_DEFAULT_SIZE * 0.06),
      strokeLineJoin: "round",
      paintFirst: "stroke",
      textAlign: "center",
      lineHeight: 1.05,
      editable: false,
      shadow: new fabric.Shadow({
        color: "rgba(0,0,0,0.35)",
        blur: d(10),
        offsetX: 0,
        offsetY: d(6),
      }),
    });
    return t;
  }

  function ensureTitle() {
    if (titleText) return;
    titleText = makeTitle(titleInput.value);
    canvas.add(titleText);
    restack();
  }

  titleInput.addEventListener("input", () => {
    ensureTitle();
    titleText.set("text", titleInput.value || "你的標題");
    canvas.requestRenderAll();
  });

  fontSizeSlider.addEventListener("input", () => {
    const size = parseInt(fontSizeSlider.value, 10);
    fontSizeVal.textContent = size;
    ensureTitle();
    titleText.set({
      fontSize: d(size),
      strokeWidth: d(size * 0.06),
    });
    canvas.requestRenderAll();
  });

  // ===== logo（預設置底、鎖定）=====
  function ensureLogo() {
    if (logoImage) return;
    fabric.Image.fromURL("assets/logo.png", (img) => {
      const scale = d(LOGO_TARGET_W) / img.width;
      img.set({
        originX: "center",
        originY: "center",
        left: disp.w / 2,
        top: d(LOGO_CY),
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
      });
      logoImage = img;
      canvas.add(logoImage);
      restack();
    });
  }

  // ===== 插畫（選填）=====
  const illustInput = document.getElementById("illustInput");
  illustInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    readImage(file, (img) => {
      const targetW = d(DESIGN_W * 0.35);
      const scale = targetW / img.width;
      img.set({
        originX: "center",
        originY: "center",
        left: disp.w / 2,
        top: d(SAFE_TOP + 260),
        scaleX: scale,
        scaleY: scale,
      });
      if (illustImage) canvas.remove(illustImage);
      illustImage = img;
      canvas.add(illustImage);
      restack();
      canvas.setActiveObject(illustImage);
      canvas.requestRenderAll();
    });
  });

  // ===== 安全區開關 =====
  const safeToggle = document.getElementById("safeToggle");
  safeToggle.addEventListener("change", () => {
    safeOverlay.classList.toggle("hidden", !safeToggle.checked);
  });

  // ===== 刪除選取 =====
  document.getElementById("deleteBtn").addEventListener("click", () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    if (obj === bgImage) bgImage = null;
    if (obj === illustImage) illustImage = null;
    if (obj === titleText) { titleText = null; }
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  });

  // ===== 下載 PNG =====
  const downloadBtn = document.getElementById("downloadBtn");
  downloadBtn.addEventListener("click", () => {
    if (!bgImage) {
      alert("請先上傳一張封面照片！");
      return;
    }
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    // 先以高解析度渲染（可能比 1080×1920 略大幾 px），
    // 再畫到精準 1080×1920 的離屏畫布，保證輸出尺寸完全正確。
    const hi = canvas.toCanvasElement(EXPORT_MULT, { enableRetinaScaling: false });
    const out = document.createElement("canvas");
    out.width = DESIGN_W;
    out.height = DESIGN_H;
    out.getContext("2d").drawImage(hi, 0, 0, hi.width, hi.height, 0, 0, DESIGN_W, DESIGN_H);
    const dataUrl = out.toDataURL("image/png");

    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
    if (isIOS) {
      // iOS Safari 常擋下載：開新分頁讓使用者長按儲存
      const w = window.open();
      if (w) {
        w.document.write(
          '<title>長按圖片儲存</title><body style="margin:0;background:#000;">' +
          '<img src="' + dataUrl + '" style="width:100%;display:block" />' +
          '<p style="color:#fff;text-align:center;font-family:sans-serif">長按上方圖片 →「加入照片」</p></body>'
        );
      } else {
        alert("請允許彈出視窗以儲存圖片");
      }
    } else {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "24planet-cover-" + Date.now() + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  });

  // ===== 工具：讀圖檔成 fabric.Image =====
  function readImage(file, cb) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      fabric.Image.fromURL(ev.target.result, (img) => cb(img), { crossOrigin: "anonymous" });
    };
    reader.readAsDataURL(file);
  }

  // ===== 載入字體後再啟用標題（避免 fallback 字閃爍）=====
  const jenbo = new FontFace("JenBoDD", "url(assets/JenBoDDlongver24.otf)");
  jenbo.load().then((f) => {
    document.fonts.add(f);
    if (titleText) {
      titleText.set("fontFamily", "JenBoDD");
      canvas.requestRenderAll();
    }
  }).catch((err) => {
    console.warn("字體載入失敗，改用系統字", err);
  });

  // 暴露給除錯
  window.__cover = { canvas, get bg() { return bgImage; }, get title() { return titleText; } };
})();
