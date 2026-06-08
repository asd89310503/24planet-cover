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
  const TITLE_DEFAULT_SIZE = 220;         // 標題預設字級（品牌建議基準）
  const TITLE_DEFAULT_CY = 900;           // 標題預設中心 Y：在副標題上方
  const TITLE_STROKE_RATIO = 0.1;         // 標題黑描邊粗細 = 字級 × 此比例（加粗）
  const TITLE_MAX_PER_LINE = 6;           // 標題一行最多字數
  const LOGO_TARGET_W = 350;              // logo 目標寬（含透明留白）— 縮小一半
  const LOGO_CY = 1380;                   // logo 中心 Y：往內移，遠離安全區下緣留呼吸感
  const SUB_DEFAULT_SIZE = 150;           // 副標題預設字級（品牌建議基準）
  const SUB_DEFAULT_CY = 1180;            // 副標題預設中心 Y：標題下方（標題在上、副標在下）
  const SUB_MAX_CHARS = 8;                // 副標題最多字數
  const NOTE_DEFAULT_SIZE = 90;           // 說明標籤（ep 數／短評）預設字級
  const NOTE_DEFAULT_CY = 600;            // 說明標籤預設中心 Y：上方

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

  // 依字數硬斷行：保留使用者手動換行，並把每行夾在 n 字以內
  function wrapByCount(str, n) {
    return str.split("\n").map((line) => {
      const chars = Array.from(line);
      if (chars.length <= n) return line;
      const out = [];
      for (let i = 0; i < chars.length; i += n) out.push(chars.slice(i, i + n).join(""));
      return out.join("\n");
    }).join("\n");
  }

  // 依字數截斷（以字為單位，正確處理多位元字元）
  function capChars(str, n) {
    const chars = Array.from(str);
    return chars.length <= n ? str : chars.slice(0, n).join("");
  }

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
  let noteGroup = null;
  let subjectImage = null;   // 自動去背後的主體層（疊在標題上方，跟著背景照片）
  let bgBaseScale = 1;    // 封面照片 cover-fit 基準縮放（= 100%）

  // 字級狀態（皆為設計座標 px）。規則：副標不可大於標題。
  let titleSizePx = TITLE_DEFAULT_SIZE;
  let subSizePx = SUB_DEFAULT_SIZE;
  let subCenter = null;   // 副標中心（顯示座標），保留拖曳後的位置
  let noteSizePx = NOTE_DEFAULT_SIZE;
  let noteCenter = null;  // 說明標籤中心（顯示座標），保留拖曳後的位置

  // 維持圖層順序：背景(底) < 插畫 < 標題 < 副標 < logo(頂)
  function restack() {
    if (bgImage) canvas.sendToBack(bgImage);
    if (illustImage && bgImage) illustImage.moveTo(1);
    if (titleText) canvas.bringToFront(titleText);
    if (subjectImage) canvas.bringToFront(subjectImage);   // 主體蓋住標題（在標題上、副標下）
    if (subtitleGroup) canvas.bringToFront(subtitleGroup);
    if (noteGroup) canvas.bringToFront(noteGroup);
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
      // cover-fit 鋪滿畫布（此縮放 = 100% 基準，剛好蓋滿不留灰）
      bgBaseScale = Math.max(disp.w / img.width, disp.h / img.height);
      img.set({
        originX: "center",
        originY: "center",
        left: disp.w / 2,
        top: disp.h / 2,
        scaleX: bgBaseScale,
        scaleY: bgBaseScale,
        hasControls: false,   // 角落控制點常落在畫布外難按，改用縮放滑桿
        lockRotation: true,
      });
      if (bgImage) canvas.remove(bgImage);
      bgImage = img;
      canvas.add(bgImage);
      removeSubjectLayer();   // 換照片 → 舊的去背主體層作廢
      restack();
      // 重置縮放滑桿為 100%
      photoZoom.value = 100;
      photoZoomVal.textContent = "100%";
      hint.textContent = "拖曳照片喬位置・用「照片縮放」滑桿放大來填滿/重新取景";
      ensureTitle();
      ensureLogo();
      updateGrayWarn();   // 剛載入為置中蓋滿，隱藏警告
    });
  });

  // 封面照片縮放滑桿（100% = 剛好蓋滿；放大可重新取景而不露灰）
  const photoZoom = document.getElementById("photoZoom");
  const photoZoomVal = document.getElementById("photoZoomVal");
  photoZoom.addEventListener("input", () => {
    photoZoomVal.textContent = photoZoom.value + "%";
    if (!bgImage) return;
    const s = bgBaseScale * (parseInt(photoZoom.value, 10) / 100);
    bgImage.set({ scaleX: s, scaleY: s });   // 以中心縮放，位置不變
    clampBg();                                // 縮小後若露邊，夾回蓋滿
    updateGrayWarn();
    syncSubject();                            // 去背主體層跟著縮放
    canvas.requestRenderAll();
  });

  // ===== 防呆：封面照片不可露出灰底 =====
  // 半寬／半高（顯示座標）
  function bgHalfSize() {
    return { hw: (bgImage.width * bgImage.scaleX) / 2, hh: (bgImage.height * bgImage.scaleY) / 2 };
  }
  // 四邊是否都蓋過畫布（容許 0.5px 誤差）
  function isBgCovered() {
    if (!bgImage) return true;   // 還沒上傳照片，不算露灰底
    const { hw, hh } = bgHalfSize();
    const L = bgImage.left, T = bgImage.top;
    return (L - hw <= 0.5) && (L + hw >= disp.w - 0.5) &&
           (T - hh <= 0.5) && (T + hh >= disp.h - 0.5);
  }
  // 把照片中心夾在「四邊都蓋住畫布」的範圍內（源頭防呆）
  function clampBg() {
    if (!bgImage) return;
    const { hw, hh } = bgHalfSize();
    const minL = disp.w - hw, maxL = hw;
    const minT = disp.h - hh, maxT = hh;
    let L = bgImage.left, T = bgImage.top;
    if (minL <= maxL) L = Math.min(maxL, Math.max(minL, L));
    if (minT <= maxT) T = Math.min(maxT, Math.max(minT, T));
    bgImage.set({ left: L, top: T });
    bgImage.setCoords();
  }
  const grayWarn = document.getElementById("grayWarn");
  function updateGrayWarn() {
    grayWarn.classList.toggle("hidden", isBgCovered());
  }
  // 拖曳照片即時夾邊（拖到邊界就停住，無法露出灰底）
  canvas.on("object:moving", (e) => {
    if (e.target === bgImage) { clampBg(); updateGrayWarn(); syncSubject(); }
  });

  // ===== 標題 =====
  const titleInput = document.getElementById("titleInput");
  const fontSizeSlider = document.getElementById("fontSize");
  const fontSizeVal = document.getElementById("fontSizeVal");

  function makeTitle(textValue) {
    const t = new fabric.Textbox(wrapByCount(textValue || "你的標題", TITLE_MAX_PER_LINE), {
      originX: "center",
      originY: "center",
      left: disp.w / 2,
      top: d(TITLE_DEFAULT_CY),
      width: d(DESIGN_W * 0.9),
      fontFamily: "JenBoDD",
      fontSize: d(TITLE_DEFAULT_SIZE),
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: d(TITLE_DEFAULT_SIZE * TITLE_STROKE_RATIO),
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
    titleText.set("text", wrapByCount(titleInput.value || "你的標題", TITLE_MAX_PER_LINE));
    canvas.requestRenderAll();
  });

  fontSizeSlider.addEventListener("input", () => {
    titleSizePx = parseInt(fontSizeSlider.value, 10);
    fontSizeVal.textContent = titleSizePx;
    ensureTitle();
    titleText.set({
      fontSize: d(titleSizePx),
      strokeWidth: d(titleSizePx * TITLE_STROKE_RATIO),
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
    const value = capChars(subInput.value.trim(), SUB_MAX_CHARS);   // 規則：最多 SUB_MAX_CHARS 字
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

  // ===== 說明標籤（選填）：深字 + 品牌黃手繪圓角底（放 ep 數／吃好飽等短標）=====
  const noteInput = document.getElementById("noteInput");
  const noteSizeSlider = document.getElementById("noteSize");
  const noteSizeVal = document.getElementById("noteSizeVal");

  // 依目前 noteInput / noteSizePx 重建說明標籤群組（保留原位置）
  function buildNote() {
    if (noteGroup) {
      noteCenter = {
        left: noteGroup.left + (noteGroup.width * noteGroup.scaleX) / 2,
        top: noteGroup.top + (noteGroup.height * noteGroup.scaleY) / 2,
      };
      canvas.remove(noteGroup);
      noteGroup = null;
    }
    const value = noteInput.value.trim();
    if (!value) { canvas.requestRenderAll(); return; }

    const fontPx = d(noteSizePx);
    const text = new fabric.Text(value, {
      fontFamily: "JenBoDD",
      fontSize: fontPx,
      fill: "#1f2937",          // 深墨色字（配品牌黃底）
      textAlign: "center",
      lineHeight: 1.1,
    });
    const padX = fontPx * 0.55;
    const padY = fontPx * 0.3;
    const boxW = text.width + padX * 2;
    const boxH = text.height + padY * 2;

    const box = new fabric.Path(makeBlobPath(boxW, boxH), {
      fill: "#fcd34d",          // 品牌黃手繪底
      left: 0,
      top: 0,
    });
    text.set({ originX: "center", originY: "center", left: boxW / 2, top: boxH / 2 });

    const group = new fabric.Group([box, text], {
      hasControls: false,   // 大小用滑桿，不用拖角
      lockRotation: true,
    });
    const center = noteCenter || { left: disp.w / 2, top: d(NOTE_DEFAULT_CY) };
    group.set({ left: center.left - group.width / 2, top: center.top - group.height / 2 });
    group.setCoords();
    group.on("modified", () => {
      noteCenter = {
        left: group.left + (group.width * group.scaleX) / 2,
        top: group.top + (group.height * group.scaleY) / 2,
      };
    });

    noteGroup = group;
    canvas.add(group);
    restack();
  }

  noteInput.addEventListener("input", buildNote);
  noteSizeSlider.addEventListener("input", () => {
    noteSizePx = parseInt(noteSizeSlider.value, 10);
    noteSizeVal.textContent = noteSizePx;
    buildNote();
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

  // ===== 自動去背：把封面主體疊到標題上方（標題被主體擋住）=====
  const subjectBtn = document.getElementById("subjectBtn");
  const SUBJECT_BTN_TEXT = "✨ 主體蓋住標題（自動去背）";
  let _remover = null;   // 懶載入去背函式（首次點擊才下載模型）

  async function getRemover() {
    if (_remover) return _remover;
    const mod = await import("https://esm.sh/@imgly/background-removal@1.5.8");
    _remover = mod.removeBackground;
    return _remover;
  }

  // 去背主體層永遠跟背景照片同位置、同縮放（製造「主體在標題前面」的錯覺）
  function syncSubject() {
    if (!subjectImage || !bgImage) return;
    subjectImage.set({
      left: bgImage.left,
      top: bgImage.top,
      scaleX: bgImage.scaleX,
      scaleY: bgImage.scaleY,
    });
    subjectImage.setCoords();
  }

  function removeSubjectLayer() {
    if (subjectImage) { canvas.remove(subjectImage); subjectImage = null; }
    if (subjectBtn) { subjectBtn.textContent = SUBJECT_BTN_TEXT; subjectBtn.disabled = false; }
    canvas.requestRenderAll();
  }

  subjectBtn.addEventListener("click", async () => {
    if (subjectImage) { removeSubjectLayer(); return; }   // 再按一次＝移除主體層
    if (!bgImage) { alert("請先上傳一張封面照片！"); return; }
    const src = bgImage.getSrc ? bgImage.getSrc() : (bgImage._element && bgImage._element.src);
    if (!src) { alert("讀不到照片來源，請重新上傳照片。"); return; }

    subjectBtn.disabled = true;
    subjectBtn.textContent = "去背中…首次需下載模型，請稍候";
    try {
      const removeBackground = await getRemover();
      const blob = await removeBackground(src, {
        progress: (key, cur, total) => {
          if (key && key.indexOf("fetch") === 0 && total) {
            subjectBtn.textContent = "下載去背模型 " + Math.round((cur / total) * 100) + "%…";
          }
        },
      });
      const url = URL.createObjectURL(blob);
      fabric.Image.fromURL(url, (img) => {
        img.set({
          originX: "center",
          originY: "center",
          left: bgImage.left,
          top: bgImage.top,
          scaleX: bgImage.scaleX,
          scaleY: bgImage.scaleY,
          selectable: false,   // 純視覺、跟著背景照片，不可單獨選取/移動
          evented: false,
          lockRotation: true,
        });
        if (subjectImage) canvas.remove(subjectImage);
        subjectImage = img;
        canvas.add(img);
        restack();
        URL.revokeObjectURL(url);
        subjectBtn.disabled = false;
        subjectBtn.textContent = "✖ 移除主體層";
      });
    } catch (err) {
      console.error("自動去背失敗", err);
      alert("自動去背失敗 😢\n可能是網路問題或瀏覽器不支援 WebGPU/WASM。\n備案：用手機內建去背存成 PNG，再用「上傳插畫」疊上去。");
      subjectBtn.disabled = false;
      subjectBtn.textContent = SUBJECT_BTN_TEXT;
    }
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
    if (obj === bgImage) { bgImage = null; removeSubjectLayer(); }
    if (obj === illustImage) illustImage = null;
    if (obj === titleText) { titleText = null; }
    if (obj === subtitleGroup) { subtitleGroup = null; subCenter = null; }
    if (obj === noteGroup) { noteGroup = null; noteCenter = null; }
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
    // 防呆：露灰底就先擋下，避免存檔後才發現邊緣破圖
    if (!isBgCovered()) {
      const ok = confirm("⚠️ 封面有露出灰底！\n建議先拖曳或放大照片把畫面蓋滿，再下載。\n\n仍要繼續下載嗎？");
      if (!ok) return;
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

    // 手機（iOS/Android）常擋 Canvas 直接下載 → 用「頁內彈窗」顯示圖片，
    // 使用者長按儲存，按「返回編輯」即可關閉，不必關掉整個網頁。
    const isMobile = /iP(hone|ad|od)|Android/.test(navigator.userAgent);
    if (isMobile) {
      saveImg.src = dataUrl;
      saveOverlay.classList.remove("hidden");
    } else {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "24planet-cover-" + Date.now() + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  });

  // 儲存彈窗：關閉返回編輯
  const saveOverlay = document.getElementById("saveOverlay");
  const saveImg = document.getElementById("saveImg");
  document.getElementById("saveClose").addEventListener("click", () => {
    saveOverlay.classList.add("hidden");
    saveImg.src = "";
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
    if (noteGroup) buildNote();           // 重建以套用手繪字
  }).catch((err) => {
    console.warn("字體載入失敗，改用系統字", err);
  });

  // 暴露給除錯
  window.__cover = { canvas, get bg() { return bgImage; }, get title() { return titleText; } };
})();
