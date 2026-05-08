const API_BASE = "https://dezinr.vercel.app";

const loginView = document.getElementById("login-view");
const userView = document.getElementById("user-view");
const loginError = document.getElementById("login-error");
const userEmailEl = document.getElementById("user-email");
const tabUrlInput = document.getElementById("tab-url");
const figmaUrlInput = document.getElementById("figma-url");
const analysisLoading = document.getElementById("analysis-loading");
const analysisError = document.getElementById("analysis-error");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

function setLoggedIn(email) {
  loginView.classList.add("hidden");
  userView.classList.remove("hidden");
  userEmailEl.textContent = email || "Unknown";
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    tabUrlInput.value = tabs[0]?.url || "";
  });
}

function setLoggedOut() {
  userView.classList.add("hidden");
  loginView.classList.remove("hidden");
}

chrome.runtime.sendMessage({ type: "dzn:get-auth" }, (resp) => {
  if (resp?.token) setLoggedIn(resp.email);
  else setLoggedOut();
});

document.getElementById("login-btn").addEventListener("click", async () => {
  loginError.textContent = "";
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    loginError.textContent = "Email and password are required.";
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/extension-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok || !data?.token) {
      loginError.textContent = data?.error || "Login failed.";
      return;
    }

    chrome.runtime.sendMessage(
      { type: "dzn:login-success", token: data.token, email: data.user?.email || email },
      () => {
        chrome.storage.local.set({ authToken: data.token }, () => setLoggedIn(data.user?.email || email));
      },
    );
  } catch (error) {
    loginError.textContent = String(error);
  }
});

document.getElementById("start-analysis-btn").addEventListener("click", async () => {
  analysisError.textContent = "";
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTabUrl = tabs[0]?.url?.trim() || tabUrlInput.value.trim();
    const figmaUrl = figmaUrlInput.value.trim();
    if (!currentTabUrl || !figmaUrl) {
      analysisError.textContent = "Current tab URL and Figma URL are required.";
      return;
    }

    chrome.storage.local.get(["authToken", "dznToken"], async (result) => {
      const token = result.authToken || result.dznToken;
      if (!token) {
        analysisError.textContent = "Please login again.";
        return;
      }

      analysisLoading.classList.remove("hidden");

      try {
        const response = await fetch(`${API_BASE}/api/qc/analyze-extension`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            stagingUrl: currentTabUrl,
            figmaUrl: figmaUrl,
            token: token,
          }),
        });
        const data = await response.json();
        if (!response.ok || !data?.reviewId) {
          analysisError.textContent = data?.error || "Analysis failed.";
          analysisLoading.classList.add("hidden");
          return;
        }

        chrome.storage.local.set({
          reviewId: data.reviewId,
          stagingUrl: currentTabUrl
        }, () => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0]?.id;
            if (!tabId) {
              analysisError.textContent = "No active tab found.";
              analysisLoading.classList.add("hidden");
              return;
            }
            chrome.runtime.sendMessage({
              type: "ACTIVATE_TAB",
              tabId: tabs[0].id,
              reviewId: data.reviewId,
              stagingUrl: currentTabUrl,
              comments: data.comments || []
            }, (response) => {
              console.log("Message sent to content script:", response);
              window.close();
            });
          });
        });
      } catch (error) {
        analysisError.textContent = String(error);
        analysisLoading.classList.add("hidden");
      }
    });
  });
});

document.getElementById("logout-btn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "dzn:logout" }, () => setLoggedOut());
});