(function () {
  "use strict";

  const STORAGE_KEY = "instant-invoice:v2";

  // ---------- State ----------
  function defaultState() {
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    return {
      docTitle: "Invoice",
      invoiceNo: "INV-0001",
      date: today,
      dueDate: due,
      fromName: "",
      fromDetails: "",
      fromOrg: "",
      fromEmail: "",
      fromPhone: "",
      toName: "",
      toDetails: "",
      toOrg: "",
      toEmail: "",
      toPhone: "",
      notes: "",
      taxRate: 0,
      discountVal: 0,
      discountUnit: "percent",
      currency: "$",
      paymentTerms: "",
      ocr: "",
      bankName: "",
      iban: "",
      bic: "",
      accountNo: "",
      items: [{ desc: "", qty: 1, rate: 0, disc: 0 }],
    };
  }

  let state = load() || defaultState();

  // ---------- Persistence ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return normalize(parsed);
    } catch (e) {
      return null;
    }
  }

  // Merge an arbitrary object onto defaults so older/partial data still loads.
  function normalize(obj) {
    const base = defaultState();
    const merged = Object.assign(base, obj || {});
    if (!Array.isArray(merged.items) || merged.items.length === 0) {
      merged.items = [{ desc: "", qty: 1, rate: 0, disc: 0 }];
    } else {
      merged.items = merged.items.map((it) => ({
        desc: String(it.desc || ""),
        qty: Number(it.qty) || 0,
        rate: Number(it.rate) || 0,
        disc: Number(it.disc) || 0,
      }));
    }
    return merged;
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        /* storage full/unavailable — app still works in-memory */
      }
    }, 200);
  }

  // ---------- Helpers ----------
  function money(n) {
    const value = Number.isFinite(n) ? n : 0;
    return (
      state.currency +
      value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nl2br(str) {
    return escapeHtml(str).replace(/\n/g, "<br />");
  }

  function filenameBase() {
    const raw = (state.invoiceNo || "invoice").toString().trim() || "invoice";
    return raw.replace(/[^a-z0-9\-_]+/gi, "-").replace(/^-+|-+$/g, "") || "invoice";
  }

  // Luhn / MOD10 checksum — validates the full number incl. its check digit.
  function luhnValid(input) {
    const digits = String(input || "").replace(/\D/g, "");
    if (digits.length < 2) return false;
    let sum = 0;
    let alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits.charCodeAt(i) - 48;
      if (alt) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  // ---------- Totals ----------
  function computeTotals() {
    const subtotal = state.items.reduce((sum, it) => {
      const line = it.qty * it.rate;
      const afterDisc = line * (1 - (Number(it.disc) || 0) / 100);
      return sum + afterDisc;
    }, 0);

    const dVal = parseFloat(state.discountVal) || 0;
    let discount = 0;
    if (state.discountUnit === "fixed") discount = Math.min(dVal, subtotal);
    else discount = subtotal * (dVal / 100);

    const taxable = Math.max(0, subtotal - discount);
    const tax = taxable * ((parseFloat(state.taxRate) || 0) / 100);
    const total = taxable + tax;
    return { subtotal, discount, taxable, tax, total };
  }

  function renderTotals() {
    const t = computeTotals();
    document.getElementById("subtotal").textContent = money(t.subtotal);
    document.getElementById("discount-amount").textContent = "-" + money(t.discount);
    document.getElementById("tax-amount").textContent = money(t.tax);
    document.getElementById("grand-total").textContent = money(t.total);
  }

  // ---------- OCR hint ----------
  function updateOcrHint() {
    const hint = document.getElementById("ocr-hint");
    const val = (state.ocr || "").replace(/\s/g, "");
    if (!val) {
      hint.textContent = "";
      hint.className = "ocr-hint no-print";
      return;
    }
    if (luhnValid(val)) {
      hint.textContent = "✓ valid checksum";
      hint.className = "ocr-hint no-print is-valid";
    } else {
      hint.textContent = "✕ checksum mismatch";
      hint.className = "ocr-hint no-print is-invalid";
    }
  }

  // ---------- Field bindings ----------
  function bindFields() {
    document.querySelectorAll("[data-field]").forEach((el) => {
      const key = el.getAttribute("data-field");
      setFieldValue(el, key);
      el.addEventListener("input", () => {
        if (el.isContentEditable) state[key] = el.textContent.trim();
        else if (el.type === "number") state[key] = parseFloat(el.value) || 0;
        else state[key] = el.value;

        if (["taxRate", "currency", "discountVal", "discountUnit"].includes(key)) renderTotals();
        if (key === "ocr") updateOcrHint();
        save();
      });
    });
  }

  function setFieldValue(el, key) {
    const v = state[key] != null ? state[key] : "";
    if (el.isContentEditable) el.textContent = v;
    else el.value = v;
  }

  function applyStateToFields() {
    document.querySelectorAll("[data-field]").forEach((el) => {
      setFieldValue(el, el.getAttribute("data-field"));
    });
    renderItems();
    renderTotals();
    updateOcrHint();
  }

  // ---------- Line items ----------
  const itemsBody = document.getElementById("items-body");

  function renderItems() {
    itemsBody.innerHTML = "";
    state.items.forEach((item, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="cell-desc"><input type="text" placeholder="Item or service" /></td>' +
        '<td class="cell-qty"><input type="number" min="0" step="1" /></td>' +
        '<td class="cell-rate"><input type="number" min="0" step="0.01" /></td>' +
        '<td class="cell-disc"><input type="number" min="0" max="100" step="1" /></td>' +
        '<td class="cell-amount" data-amount></td>' +
        '<td class="col-remove no-print"><button class="row-remove" type="button" aria-label="Remove line">&times;</button></td>';

      const inputs = tr.querySelectorAll("input");
      const descInput = inputs[0];
      const qtyInput = inputs[1];
      const rateInput = inputs[2];
      const discInput = inputs[3];
      const amountCell = tr.querySelector("[data-amount]");

      descInput.value = item.desc;
      qtyInput.value = item.qty;
      rateInput.value = item.rate;
      discInput.value = item.disc;

      function lineAmount() {
        return item.qty * item.rate * (1 - (Number(item.disc) || 0) / 100);
      }
      amountCell.textContent = money(lineAmount());

      descInput.addEventListener("input", () => {
        item.desc = descInput.value;
        save();
      });
      function recalc() {
        item.qty = parseFloat(qtyInput.value) || 0;
        item.rate = parseFloat(rateInput.value) || 0;
        item.disc = parseFloat(discInput.value) || 0;
        amountCell.textContent = money(lineAmount());
        renderTotals();
        save();
      }
      qtyInput.addEventListener("input", recalc);
      rateInput.addEventListener("input", recalc);
      discInput.addEventListener("input", recalc);

      tr.querySelector(".row-remove").addEventListener("click", () => {
        state.items.splice(idx, 1);
        if (state.items.length === 0) state.items.push({ desc: "", qty: 1, rate: 0, disc: 0 });
        renderItems();
        renderTotals();
        save();
      });

      itemsBody.appendChild(tr);
    });
  }

  function addItem() {
    state.items.push({ desc: "", qty: 1, rate: 0, disc: 0 });
    renderItems();
    renderTotals();
    save();
    const rows = itemsBody.querySelectorAll("tr");
    const last = rows[rows.length - 1];
    if (last) last.querySelector("input").focus();
  }

  // ---------- Optional field visibility (print/export) ----------
  function markEmptyOptionals(hide) {
    document.querySelectorAll("[data-optional]").forEach((el) => {
      const wrap = el.closest("[data-optional-wrap]") || el;
      if (hide && !String(el.value || "").trim()) wrap.classList.add("is-empty");
      else wrap.classList.remove("is-empty");
    });
  }

  // ---------- New ----------
  function newInvoice() {
    if (!window.confirm("Start a new blank invoice? This clears the current one.")) return;
    state = defaultState();
    save();
    applyStateToFields();
  }

  // ---------- Downloads ----------
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    downloadBlob(blob, filenameBase() + ".json");
  }

  function loadJSONFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        state = normalize(JSON.parse(reader.result));
        save();
        applyStateToFields();
      } catch (e) {
        window.alert("That file could not be read as a valid invoice JSON.");
      }
    };
    reader.readAsText(file);
  }

  // ---------- Standalone HTML export ----------
  function row(label, value) {
    if (!String(value || "").trim()) return "";
    return '<div class="prow"><span class="plabel">' + escapeHtml(label) + '</span><span>' + escapeHtml(value) + "</span></div>";
  }

  function buildStandaloneHTML() {
    const t = computeTotals();
    const items = state.items
      .filter((it) => it.desc || it.qty || it.rate)
      .map((it) => {
        const amount = it.qty * it.rate * (1 - (Number(it.disc) || 0) / 100);
        return (
          "<tr><td>" + escapeHtml(it.desc) + "</td>" +
          "<td class='r'>" + (Number(it.qty) || 0) + "</td>" +
          "<td class='r'>" + money(it.rate) + "</td>" +
          "<td class='r'>" + (Number(it.disc) ? it.disc + "%" : "—") + "</td>" +
          "<td class='r'>" + money(amount) + "</td></tr>"
        );
      })
      .join("");

    const fromBlock =
      "<div class='party'><div class='plabel'>From</div>" +
      "<div class='pname'>" + escapeHtml(state.fromName) + "</div>" +
      (state.fromDetails ? "<div class='pdet'>" + nl2br(state.fromDetails) + "</div>" : "") +
      row("VAT / Org. nr", state.fromOrg) +
      row("Email", state.fromEmail) +
      row("Phone", state.fromPhone) +
      "</div>";

    const toBlock =
      "<div class='party'><div class='plabel'>Bill to</div>" +
      "<div class='pname'>" + escapeHtml(state.toName) + "</div>" +
      (state.toDetails ? "<div class='pdet'>" + nl2br(state.toDetails) + "</div>" : "") +
      row("VAT / Org. nr", state.toOrg) +
      row("Email", state.toEmail) +
      row("Phone", state.toPhone) +
      "</div>";

    const paymentRows =
      row("Payment terms", state.paymentTerms) +
      row("OCR number", state.ocr) +
      row("Bank / Account name", state.bankName) +
      row("IBAN", state.iban) +
      row("BIC / SWIFT", state.bic) +
      row("Account number", state.accountNo);

    const paymentBlock = paymentRows
      ? "<section class='payment'><div class='plabel'>Payment details</div>" + paymentRows + "</section>"
      : "";

    const notesBlock = state.notes
      ? "<div class='notes'><div class='plabel'>Notes</div><div>" + nl2br(state.notes) + "</div></div>"
      : "";

    const discountRow = t.discount
      ? "<div class='trow'><span>Discount</span><span>-" + money(t.discount) + "</span></div>"
      : "";
    const taxRow =
      "<div class='trow'><span>Tax / VAT (" + (parseFloat(state.taxRate) || 0) + "%)</span><span>" + money(t.tax) + "</span></div>";

    const css =
      "*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1c1e;font-size:15px;line-height:1.45}" +
      ".sheet{max-width:820px;margin:0 auto;padding:48px 56px}" +
      "h1{font-size:34px;font-weight:600;letter-spacing:-.02em;margin:0;color:#2f6f4f}" +
      ".head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}" +
      ".meta{font-size:14px;text-align:right;color:#55555c}.meta b{color:#1c1c1e}" +
      "hr{border:none;border-top:1px solid #e6e6ea;margin:24px 0}" +
      ".parties{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:28px}" +
      ".plabel{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#9a9aa2;margin-bottom:2px}" +
      ".pname{font-weight:600;font-size:16px}.pdet{color:#55555c;font-size:14px;margin:2px 0}" +
      ".prow{display:flex;gap:8px;font-size:13px;color:#55555c}.prow .plabel{min-width:150px;margin:0}" +
      "table{width:100%;border-collapse:collapse;margin-top:8px}" +
      "th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9a9aa2;padding:0 8px 8px;border-bottom:1.5px solid #d3d3da}" +
      "th.r,td.r{text-align:right}td{padding:6px 8px;border-bottom:1px solid #e6e6ea;font-variant-numeric:tabular-nums}" +
      ".footer{display:grid;grid-template-columns:1fr 280px;gap:32px;margin-top:24px}" +
      ".totals{display:flex;flex-direction:column;gap:6px}" +
      ".trow{display:flex;justify-content:space-between;font-size:14px;color:#55555c}" +
      ".grand{margin-top:6px;padding-top:12px;border-top:1.5px solid #d3d3da;font-size:17px;font-weight:600;color:#1c1c1e}" +
      ".grand span:last-child{color:#2f6f4f}" +
      ".payment{margin-top:28px;padding-top:20px;border-top:1px solid #e6e6ea;display:flex;flex-direction:column;gap:4px}" +
      ".notes{font-size:14px;color:#55555c}@media print{@page{margin:18mm}}";

    return (
      "<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8' />" +
      "<meta name='viewport' content='width=device-width, initial-scale=1.0' />" +
      "<title>" + escapeHtml(state.docTitle || "Invoice") + " " + escapeHtml(state.invoiceNo) + "</title>" +
      "<style>" + css + "</style></head><body><div class='sheet'>" +
      "<div class='head'><h1>" + escapeHtml(state.docTitle || "Invoice") + "</h1>" +
      "<div class='meta'>" +
      "<div><b>" + escapeHtml(state.invoiceNo) + "</b></div>" +
      (state.date ? "<div>Date: " + escapeHtml(state.date) + "</div>" : "") +
      (state.dueDate ? "<div>Due: " + escapeHtml(state.dueDate) + "</div>" : "") +
      "</div></div><hr />" +
      "<div class='parties'>" + fromBlock + toBlock + "</div>" +
      "<table><thead><tr><th>Description</th><th class='r'>Qty</th><th class='r'>Rate</th><th class='r'>Disc</th><th class='r'>Amount</th></tr></thead>" +
      "<tbody>" + items + "</tbody></table>" +
      "<div class='footer'>" + (notesBlock || "<div></div>") +
      "<div class='totals'>" +
      "<div class='trow'><span>Subtotal</span><span>" + money(t.subtotal) + "</span></div>" +
      discountRow + taxRow +
      "<div class='trow grand'><span>Total due</span><span>" + money(t.total) + "</span></div>" +
      "</div></div>" +
      paymentBlock +
      "</div></body></html>"
    );
  }

  function exportHTML() {
    const blob = new Blob([buildStandaloneHTML()], { type: "text/html" });
    downloadBlob(blob, filenameBase() + ".html");
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    // Force reflow so the transition runs even on rapid successive calls.
    void el.offsetWidth;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove("is-visible");
      setTimeout(() => {
        el.hidden = true;
      }, 250);
    }, 3500);
  }

  // ---------- Send / Share ----------
  function shareSummaryText() {
    const t = computeTotals();
    const lines = [
      (state.docTitle || "Invoice") + " " + (state.invoiceNo || ""),
      state.toName ? "To: " + state.toName : "",
      state.date ? "Date: " + state.date : "",
      state.dueDate ? "Due: " + state.dueDate : "",
      "Total due: " + money(t.total),
      state.paymentTerms ? "Terms: " + state.paymentTerms : "",
      state.ocr ? "OCR: " + state.ocr : "",
      state.iban ? "IBAN: " + state.iban : "",
      state.bic ? "BIC/SWIFT: " + state.bic : "",
    ].filter(Boolean);
    return lines.join("\n");
  }

  function shareTitle() {
    const t = computeTotals();
    return "Invoice " + (state.invoiceNo || "") + " — " + money(t.total);
  }

  function buildMailto() {
    const subject = "Invoice " + (state.invoiceNo || "") + (state.fromName ? " from " + state.fromName : "");
    const body =
      shareSummaryText() + "\n\n" + "The invoice file is attached separately (downloaded to your device).";
    const to = state.toEmail ? encodeURIComponent(state.toEmail) : "";
    return (
      "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body)
    );
  }

  async function sendShare() {
    const title = shareTitle();
    const text = shareSummaryText();

    // (a) Native share WITH the invoice file (mobile / supported browsers).
    try {
      const file = new File([buildStandaloneHTML()], filenameBase() + ".html", { type: "text/html" });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        toast("Opening share sheet…");
        await navigator.share({ files: [file], title, text });
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return; // user cancelled — stay quiet
      // fall through to next strategy
    }

    // (b) Native share without file support — share a text summary.
    if (navigator.share) {
      try {
        toast("Opening share sheet…");
        await navigator.share({ title, text });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
        // fall through to mailto
      }
    }

    // (c) Desktop fallback — mailto draft + download the HTML to attach.
    exportHTML();
    window.location.href = buildMailto();
    toast("Email draft opened — invoice file downloaded to attach");
  }

  // ---------- Print (PDF) ----------
  window.addEventListener("beforeprint", () => markEmptyOptionals(true));
  window.addEventListener("afterprint", () => markEmptyOptionals(false));

  // ---------- Wire up ----------
  bindFields();
  renderItems();
  renderTotals();
  updateOcrHint();

  document.getElementById("btn-add-item").addEventListener("click", addItem);
  document.getElementById("btn-new").addEventListener("click", newInvoice);
  document.getElementById("btn-print").addEventListener("click", () => window.print());
  document.getElementById("btn-print-paper").addEventListener("click", () => window.print());
  document.getElementById("btn-save-json").addEventListener("click", exportJSON);
  document.getElementById("btn-export-html").addEventListener("click", exportHTML);
  document.getElementById("btn-send").addEventListener("click", sendShare);

  const fileLoad = document.getElementById("file-load");
  document.getElementById("btn-load").addEventListener("click", () => fileLoad.click());
  fileLoad.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) loadJSONFile(file);
    fileLoad.value = "";
  });

  // Expose checksum helper for quick console/testing use.
  window.__invoiceLuhnValid = luhnValid;
})();
