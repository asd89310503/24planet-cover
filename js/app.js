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
  const TITLE_DEFAULT_SIZE = 200;         // 標題預設字級（品牌建議基準）
  const TITLE_DEFAULT_CY = 900;           // 標題預設中心 Y：在副標題上方
  const LOGO_TARGET_W = 350;              // logo 目標寬（含透明留白）— 縮小一半
  const LOGO_CY = 1380;                   // logo 中心 Y：往內移，遠離安全區下緣留呼吸感
  const SUB_DEFAULT_SIZE = 120;           // 副標題預設字級（品牌建議基準）
  const SUB_DEFAULT_CY = 1180;            // 副標題預設中心 Y：標題下方（標題在上、副標在下）

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
  let subtitleGroup = null;

  // 字級狀態（皆為設計座標 px）。規則：副標不可大於標題。
  let titleSizePx = TITLE_DEFAULT_SIZE;
  let subSizePx = SUB_DEFAULT_SIZE;
  let subCenter = null;   // 副標中心（顯示座標），保留拖曳後的位置

  // 維持圖層順序：背景(底) < 插畫 < 標題 < 副標 < logo(頂)
  function restack() {
    if (bgImage) canvas.sendToBack(bgImage);
    if (illustImage && bgImage) illustImage.moveTo(1);
    if (titleText) canvas.bringToFront(titleText);
    if (subtitleGroup) canvas.bringToFront(subtitleGroup);
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
      lockMovementX: true,    // 強制水平置中：只能上下移動
      hasControls: false,     // 不顯示縮放控制點：大小一律用字級滑桿
      lockRotation: true,
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
    titleSizePx = parseInt(fontSizeSlider.value, 10);
    fontSizeVal.textContent = titleSizePx;
    ensureTitle();
    titleText.set({
      fontSize: d(titleSizePx),
      strokeWidth: d(titleSizePx * 0.06),
    });
    // 規則：副標不可大於標題 → 標題縮小時連動夾住副標
    if (subSizePx > titleSizePx) {
      subSizePx = titleSizePx;
      subSizeSlider.value = subSizePx;
      subSizeVal.textContent = subSizePx;
      buildSubtitle();
    }
    canvas.requestRenderAll();
  });

  // ===== 副標題（選填）：白字 + 手繪不規則黑色圓角底 =====
  const subInput = document.getElementById("subInput");
  const subSizeSlider = document.getElementById("subSize");
  const subSizeVal = document.getElementById("subSizeVal");

  const rand = (a, b) => a + Math.random() * (b - a);

  // 產生「稍微不規則」的圓角矩形路徑（顯示座標；w/h 為框尺寸）
  function makeBlobPath(w, h) {
    const r = h * 0.42;                  // 基準圓角
    const j = Math.max(2, h * 0.06);     // 邊緣波動幅度
    const cr = () => r * rand(0.82, 1.18);
    const rTL = cr(), rTR = cr(), rBR = cr(), rBL = cr();
    const jt = rand(-j, j), jr = rand(-j, j), jb = rand(-j, j), jl = rand(-j, j);
    return [
      `M ${rTL} 0`,
      `Q ${w / 2} ${jt} ${w - rTR} 0`,        // 上邊（微凸）
      `Q ${w} 0 ${w} ${rTR}`,                  // 右上角
      `Q ${w + jr} ${h / 2} ${w} ${h - rBR}`,  // 右邊
      `Q ${w} ${h} ${w - rBR} ${h}`,           // 右下角
      `Q ${w / 2} ${h + jb} ${rBL} ${h}`,      // 下邊
      `Q 0 ${h} 0 ${h - rBL}`,                 // 左下角
      `Q ${jl} ${h / 2} 0 ${rTL}`,             // 左邊
      `Q 0 0 ${rTL} 0`,                        // 左上角
      "Z",
    ].join(" ");
  }

  // 依目前 subInput / subSizePx 重建副標題群組（保留原位置）
  function buildSubtitle() {
    // 重建前先記下舊位置
    if (subtitleGroup) {
      subCenter = {
        left: subtitleGroup.left + (subtitleGroup.width * subtitleGroup.scaleX) / 2,
        top: subtitleGroup.top + (subtitleGroup.height * subtitleGroup.scaleY) / 2,
      };
      canvas.remove(subtitleGroup);
      subtitleGroup = null;
    }
    const value = subInput.value.trim();
    if (!value) { canvas.requestRenderAll(); return; }

    const fontPx = d(Math.min(subSizePx, titleSizePx));   // 規則：不超過標題
    const text = new fabric.Text(value, {
      fontFamily: "JenBoDD",
      fontSize: fontPx,
      fill: "#ffffff",
      textAlign: "center",
      lineHeight: 1.1,
    });
    const padX = fontPx * 0.6;   // 左右內距，避免貼邊壓迫
    const padY = fontPx * 0.34;  // 上下內距
    const boxW = text.width + padX * 2;
    const boxH = text.height + padY * 2;

    const box = new fabric.Path(makeBlobPath(boxW, boxH), {
      fill: "#000000",
      left: 0,
      top: 0,
    });
    text.set({ originX: "center", originY: "center", left: boxW / 2, top: boxH / 2 });

    const group = new fabric.Group([box, text], {
      hasControls: false,   // 大小用滑桿，不用拖角
      lockRotation: true,
    });
    const center = subCenter || { left: disp.w / 2, top: d(SUB_DEFAULT_CY) };
    group.set({ left: center.left - group.width / 2, top: center.top - group.height / 2 });
    group.setCoords();
    group.on("modified", () => {
      subCenter = {
        left: group.left + (group.width * group.scaleX) / 2,
        top: group.top + (group.height * group.scaleY) / 2,
      };
    });

    subtitleGroup = group;
    canvas.add(group);
    restack();
  }

  subInput.addEventListener("input", buildSubtitle);
  subSizeSlider.addEventListener("input", () => {
    let v = parseInt(subSizeSlider.value, 10);
    if (v > titleSizePx) { v = titleSizePx; subSizeSlider.value = v; }  // 夾住：不超過標題
    subSizePx = v;
    subSizeVal.textContent = v;
    buildSubtitle();
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
    if (obj === subtitleGroup) { subtitleGroup = null; subCenter = null; }
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
    if (subtitleGroup) buildSubtitle();   // 重建以套用手繪字
  }).catch((err) => {
    console.warn("字體載入失敗，改用系統字", err);
  });

  // 暴露給除錯
  window.__cover = { canvas, get bg() { return bgImage; }, get title() { return titleText; } };
})();
