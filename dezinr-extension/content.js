if (window.__DZN_LOADED__) {
  console.log("DZN content script already loaded");
} else {
  window.__DZN_LOADED__ = true;
  console.log("DZN content script loaded");

  const DZN = {
    reviewId: "",
    stagingUrl: window.location.href,
    comments: [],
    bubbleEl: null,
  };

  const MAX_Z = 2147483647;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("DZN received:", message?.type, message);
    if (message?.type === "ACTIVATE") {
      try {
        DZN.reviewId = message.reviewId || "";
        DZN.stagingUrl = message.stagingUrl || window.location.href;
        const comments = message.comments || [];
        DZN.comments = Array.isArray(comments) ? comments : [];
        createPins(DZN.comments);
        sendResponse({ status: "ok" });
      } catch (err) {
        console.error("DZN ACTIVATE error:", err);
        sendResponse({ status: "error", error: String(err) });
      }
      return true;
    }
    return true;
  });

  function severityBadge(priority) {
    if (priority === "must_fix") return "Must Fix";
    if (priority === "minor") return "Minor";
    return "Suggestion";
  }

  async function getTokenFromStorage() {
    const result = await chrome.storage.local.get(["authToken", "dznToken"]);
    return result.authToken || result.dznToken || "";
  }

  async function postTrainingData(payload) {
    const token = await getTokenFromStorage();
    await fetch("https://dezinr.vercel.app/api/extension/training-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  }

  function closeBubble() {
    if (DZN.bubbleEl) DZN.bubbleEl.remove();
    DZN.bubbleEl = null;
  }

  function showBubble(comment, pinEl, index) {
    console.log("DZN bubble shown", comment);
    closeBubble();
    const title = comment.title || comment.section || `Issue ${index + 1}`;
    const description = comment.description || comment.issue || "";
    const pinRect = pinEl.getBoundingClientRect();
    const bubbleWidth = 320;
    const desiredLeft = pinRect.right + 10;
    const maxLeft = Math.max(8, window.innerWidth - bubbleWidth - 8);
    const left = Math.min(desiredLeft, maxLeft);
    const top = Math.min(Math.max(8, pinRect.top), Math.max(8, window.innerHeight - 280));

    const bubble = document.createElement("div");
    bubble.className = "dzn-bubble";
    bubble.style.cssText = `
      position: fixed;
      top: ${top}px;
      left: ${left}px;
      width: ${bubbleWidth}px;
      background: #fff;
      color: #111;
      border: 1px solid #ddd;
      border-radius: 10px;
      box-shadow: 0 10px 20px rgba(0,0,0,.2);
      padding: 14px;
      z-index: ${MAX_Z};
      pointer-events: all;
    `;
    bubble.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-weight:700;font-size:14px;">#${index + 1} ${title}</div>
        <button id="dzn-close" style="border:none;background:#eee;border-radius:6px;cursor:pointer;padding:2px 8px;">✕</button>
      </div>
      <div style="font-size:12px;margin-top:8px;color:#444;">${description}</div>
      <div style="margin-top:8px;font-size:11px;background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:999px;display:inline-block;">
        ${severityBadge(comment.priority)}
      </div>
      <textarea id="dzn-edit-text" style="display:none;width:100%;margin-top:8px;box-sizing:border-box;">${description}</textarea>
      <div id="dzn-edit-actions" style="display:none;margin-top:8px;">
        <button id="dzn-save-edit" style="padding:6px 10px;border:none;border-radius:6px;background:#2563eb;color:#fff;cursor:pointer;">Save</button>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button id="dzn-edit" style="padding:6px 10px;border:none;border-radius:6px;background:#f59e0b;color:#fff;cursor:pointer;">Edit</button>
        <button id="dzn-delete" style="padding:6px 10px;border:none;border-radius:6px;background:#dc2626;color:#fff;cursor:pointer;">Delete</button>
      </div>
    `;

    document.body.appendChild(bubble);
    DZN.bubbleEl = bubble;

    bubble.querySelector("#dzn-close").onclick = closeBubble;
    bubble.querySelector("#dzn-edit").onclick = () => {
      bubble.querySelector("#dzn-edit-text").style.display = "block";
      bubble.querySelector("#dzn-edit-actions").style.display = "block";
    };
    bubble.querySelector("#dzn-save-edit").onclick = async () => {
      const editedText = bubble.querySelector("#dzn-edit-text").value.trim();
      if (!editedText) return;
      await postTrainingData({
        reviewId: DZN.reviewId,
        commentId: comment.id,
        action: "edited",
        originalText: description,
        editedText,
      });
      closeBubble();
    };
    bubble.querySelector("#dzn-delete").onclick = async () => {
      await postTrainingData({
        reviewId: DZN.reviewId,
        commentId: comment.id,
        action: "deleted",
        originalText: description,
      });
      pinEl.remove();
      closeBubble();
    };
  }

  function ensurePinsContainer() {
    let container = document.getElementById("dzn-pins-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "dzn-pins-container";
      container.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        pointer-events: none;
        z-index: ${MAX_Z};
      `;
      document.body.appendChild(container);
    }
    return container;
  }

  function createPins(comments) {
    const container = ensurePinsContainer();
    container.querySelectorAll(".dzn-pin").forEach((el) => el.remove());
    console.log("DZN: creating pins for comments:", comments.length, comments);

    const pageHeight = document.documentElement.scrollHeight;
    const pageWidth = document.documentElement.scrollWidth;

    comments.forEach((comment, index) => {
      const pin = document.createElement("div");
      pin.className = "dzn-pin";

      const xPercent = Number(comment.x_percent) || 50;
      const yPercent = Number(comment.y_percent) || 10;
      const topPx = (yPercent / 100) * pageHeight;
      const leftPx = (xPercent / 100) * pageWidth;

      pin.style.cssText = `
        position: absolute;
        top: ${topPx}px;
        left: ${leftPx}px;
        width: 28px;
        height: 28px;
        background: #e53935;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        pointer-events: all;
        cursor: pointer;
        z-index: ${MAX_Z};
        transform: translate(-50%, -50%);
        box-shadow: 0 2px 8px rgba(0,0,0,.35);
      `;
      pin.textContent = String(index + 1);
      pin.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showBubble(comment, pin, index);
      });
      container.appendChild(pin);
    });

    console.log("DZN: pins injected into DOM:", container.querySelectorAll(".dzn-pin").length);
  }
}