(function () {
  const scriptTag = document.currentScript;
  const apiKey = scriptTag.getAttribute("data-api-key");
  if (!apiKey) {
    console.error("Chatbot: Missing data-api-key attribute in script tag");
    return;
  }

  const clientDomain = window.location.hostname;

  // Customization options
  const themeColor = scriptTag.getAttribute("data-theme-color") || "#4f46e5";
  const botName = scriptTag.getAttribute("data-bot-name") || "InsightBot";
  const buttonEmoji = scriptTag.getAttribute("data-button-emoji") || "💬";
  const buttonBg = scriptTag.getAttribute("data-button-bg") || "rgba(255, 255, 255, 0.15)";
  const iframeWidth = scriptTag.getAttribute("data-iframe-width") || "360px";
  const iframeHeight = scriptTag.getAttribute("data-iframe-height") || "520px";
  const iframeBottom = scriptTag.getAttribute("data-iframe-bottom") || "90px";
  const iframeRight = scriptTag.getAttribute("data-iframe-right") || "20px";

  // Create iframe
  const iframe = document.createElement("iframe");
  iframe.src = `https://rag-cloud-embedding-frontend.vercel.app/chatbot?apiKey=${apiKey}&clientDomain=${encodeURIComponent(clientDomain)}&themeColor=${encodeURIComponent(themeColor)}&botName=${encodeURIComponent(botName)}`;
  iframe.style.position = "fixed";
  iframe.style.bottom = iframeBottom;
  iframe.style.right = iframeRight;
  iframe.style.width = iframeWidth;
  iframe.style.height = iframeHeight;
  iframe.style.border = "none";
  iframe.style.zIndex = "99999";
  iframe.style.borderRadius = "20px";
  iframe.style.boxShadow = "0 8px 30px rgba(0,0,0,0.25)";
  iframe.style.backdropFilter = "blur(20px)";
  iframe.style.background = "rgba(255,255,255,0.05)";
  iframe.style.display = "none"; // hidden by default
  document.body.appendChild(iframe);

  // Floating button
  const button = document.createElement("button");
  button.innerHTML = buttonEmoji;
  button.style.position = "fixed";
  button.style.bottom = "20px";
  button.style.right = "20px";
  button.style.zIndex = "100000";
  button.style.borderRadius = "50%";
  button.style.width = "64px";
  button.style.height = "64px";
  button.style.background = buttonBg;
  button.style.backdropFilter = "blur(10px)";
  button.style.border = "1px solid rgba(255,255,255,0.2)";
  button.style.color = "white";
  button.style.fontSize = "28px";
  button.style.cursor = "pointer";
  button.style.boxShadow = "0 6px 20px rgba(0,0,0,0.25)";
  button.style.transition = "all 0.3s ease";

  button.onmouseenter = () => {
    button.style.transform = "scale(1.05)";
    button.style.background = "rgba(255,255,255,0.25)";
  };
  button.onmouseleave = () => {
    button.style.transform = "scale(1)";
    button.style.background = buttonBg;
  };

  button.onclick = () => {
    iframe.style.display = iframe.style.display === "none" ? "block" : "none";
  };

  document.body.appendChild(button);
})();
