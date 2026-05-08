const API_BASE = "https://dezinr.vercel.app";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.type === "dzn:login-success") {
    chrome.storage.local.set({
      dznToken: message.token,
      dznUserEmail: message.email ?? null,
    }, () => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "dzn:logout") {
    chrome.storage.local.remove(["dznToken", "dznUserEmail"], () => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "dzn:get-auth") {
    chrome.storage.local.get(["dznToken", "dznUserEmail"], (data) => {
      sendResponse({
        token: data.dznToken ?? null,
        email: data.dznUserEmail ?? null,
      });
    });
    return true;
  }

  if (message.type === "dzn:activate") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      (async () => {
        try {
          const activeTab = tabs[0];
          const tabId = activeTab?.id;
          if (!tabId) {
            sendResponse({ ok: false, error: "No active tab" });
            return;
          }

          const stagingUrl = message.stagingUrl || activeTab.url || "";
          if (!stagingUrl) {
            sendResponse({ ok: false, error: "No tab URL available" });
            return;
          }

          const { dznToken: token } = await chrome.storage.local.get(["dznToken"]);
          const response = await fetch(
            `${API_BASE}/api/extension/reviews?url=${encodeURIComponent(stagingUrl)}`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            sendResponse({
              ok: false,
              status: response.status,
              error: errorText || "Failed to fetch reviews",
            });
            return;
          }

          const data = await response.json();
          const reviewId = message.reviewId ?? "";

          await chrome.scripting.executeScript({
            target: { tabId },
            files: ["content.js"],
          });

          chrome.tabs.sendMessage(
            tabId,
            {
              type: "ACTIVATE",
              reviewId,
              stagingUrl,
              comments: data.comments,
            },
            (resp) => {
              if (chrome.runtime.lastError) {
                sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                return;
              }
              sendResponse(resp ?? { ok: true });
            },
          );
        } catch (error) {
          sendResponse({ ok: false, error: String(error) });
        }
      })();
    });
    return true;
  }

  if (message.type === "dzn:api-request") {
    chrome.storage.local.get(["dznToken"], async (data) => {
      try {
        const token = data.dznToken;
        const response = await fetch(`${API_BASE}${message.path}`, {
          method: message.method ?? "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(message.headers ?? {}),
          },
          body: message.body ? JSON.stringify(message.body) : undefined,
        });

        const text = await response.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }

        sendResponse({
          ok: response.ok,
          status: response.status,
          data: json ?? text,
        });
      } catch (error) {
        sendResponse({
          ok: false,
          status: 0,
          error: String(error),
        });
      }
    });
    return true;
  }

  if (message.type === "dzn:save-training-data") {
    chrome.runtime.sendMessage(
      {
        type: "dzn:api-request",
        method: "POST",
        path: "/api/extension/training-data",
        body: message.payload,
      },
      sendResponse,
    );
    return true;
  }

  if (message.type === "ACTIVATE_TAB") {
    (async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: message.tabId },
          files: ["content.js"],
        });

        await sleep(1000);

        chrome.tabs.sendMessage(
          message.tabId,
          {
            type: "ACTIVATE",
            reviewId: message.reviewId,
            stagingUrl: message.stagingUrl,
            comments: Array.isArray(message.comments) ? message.comments : [],
          },
          (resp) => {
            if (chrome.runtime.lastError) {
              sendResponse({ ok: false, error: chrome.runtime.lastError.message });
              return;
            }
            sendResponse({ ok: true, response: resp ?? null });
          },
        );
      } catch (error) {
        console.error("[DZN background] ACTIVATE_TAB failed:", error);
        sendResponse({ ok: false, error: String(error) });
      }
    })();
    return true;
  }
});
