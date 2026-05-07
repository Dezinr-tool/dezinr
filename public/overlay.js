(function () {
  const ROOT_ID = "__qc_overlay_root__";
  const DEFAULT_COLORS = {
    must_fix: "#dc2626",
    minor: "#d97706",
    suggestion: "#2563eb",
  };

  function getRoot() {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      root.style.position = "fixed";
      root.style.inset = "0";
      root.style.pointerEvents = "none";
      root.style.zIndex = "2147483647";
      document.body.appendChild(root);
    }
    return root;
  }

  function getPosition(comment, index, total) {
    const section = String(comment.section || "").toLowerCase();
    if (section.includes("navigation") || section.includes("nav")) {
      return { top: "4%", left: "50%" };
    }
    if (section.includes("hero")) {
      return { top: "20%", left: "50%" };
    }
    if (section.includes("footer")) {
      return { top: "90%", left: "50%" };
    }
    if (section.includes("cards") || section.includes("card")) {
      return { top: "50%", left: "50%" };
    }
    if (section.includes("cta")) {
      return { top: "40%", left: "50%" };
    }

    const step = 70 / Math.max(1, total);
    const top = 15 + step * index;
    return { top: `${Math.min(88, top)}%`, left: `${20 + ((index * 17) % 60)}%` };
  }

  function renderPins(comments, highlightedId) {
    const root = getRoot();
    root.innerHTML = "";

    comments.forEach(function (comment, index) {
      const color = DEFAULT_COLORS[comment.priority] || DEFAULT_COLORS.suggestion;
      const pos = getPosition(comment, index, comments.length);

      const wrap = document.createElement("div");
      wrap.style.position = "absolute";
      wrap.style.top = pos.top;
      wrap.style.left = pos.left;
      wrap.style.transform = "translate(-50%, -50%)";
      wrap.style.pointerEvents = "auto";

      const pin = document.createElement("div");
      pin.style.width = "30px";
      pin.style.height = "30px";
      pin.style.borderRadius = "9999px";
      pin.style.background = color;
      pin.style.color = "#fff";
      pin.style.fontWeight = "700";
      pin.style.fontFamily = "system-ui, sans-serif";
      pin.style.display = "flex";
      pin.style.alignItems = "center";
      pin.style.justifyContent = "center";
      pin.style.boxShadow = "0 2px 10px rgba(0,0,0,0.25)";
      pin.style.cursor = "default";
      pin.style.outline = comment.id === highlightedId ? "3px solid #111827" : "none";
      pin.textContent = String(index + 1);

      const tooltip = document.createElement("div");
      tooltip.style.position = "absolute";
      tooltip.style.top = "36px";
      tooltip.style.left = "50%";
      tooltip.style.transform = "translateX(-50%)";
      tooltip.style.minWidth = "220px";
      tooltip.style.maxWidth = "300px";
      tooltip.style.padding = "8px 10px";
      tooltip.style.borderRadius = "8px";
      tooltip.style.background = "rgba(17,24,39,0.95)";
      tooltip.style.color = "white";
      tooltip.style.fontSize = "12px";
      tooltip.style.lineHeight = "1.4";
      tooltip.style.fontFamily = "system-ui, sans-serif";
      tooltip.style.display = "none";
      tooltip.style.whiteSpace = "normal";
      tooltip.textContent = `Issue: ${comment.issue}\nFix: ${comment.fix}`;

      wrap.addEventListener("mouseenter", function () {
        tooltip.style.display = "block";
      });
      wrap.addEventListener("mouseleave", function () {
        tooltip.style.display = "none";
      });

      wrap.appendChild(pin);
      wrap.appendChild(tooltip);
      root.appendChild(wrap);
    });
  }

  var state = { comments: [], highlightedId: null };

  window.addEventListener("message", function (event) {
    if (!event || !event.data || typeof event.data !== "object") return;
    const data = event.data;
    if (data.type === "qc-comments" && Array.isArray(data.comments)) {
      state.comments = data.comments;
      state.highlightedId = null;
      renderPins(state.comments, state.highlightedId);
    }
    if (data.type === "qc-highlight") {
      state.highlightedId = typeof data.commentId === "number" ? data.commentId : null;
      renderPins(state.comments, state.highlightedId);
    }
  });
})();
