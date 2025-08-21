(function () {
  const scriptTag = document.currentScript;
  const apiKey = scriptTag.getAttribute("data-api-key");
  if (!apiKey) {
    console.error("Chatbot: Missing data-api-key attribute in script tag");
    return;
  }

  const clientDomain = window.location.hostname;

  // Floating button
  const button = document.createElement("button");
  button.innerHTML = "💬";
  button.style.position = "fixed";
  button.style.zIndex = "100000";
  button.style.borderRadius = "50%";
  button.style.width = "64px";
  button.style.height = "64px";
  button.style.background = "rgba(255, 255, 255, 0.15)";
  button.style.backdropFilter = "blur(10px)";
  button.style.border = "1px solid rgba(255,255,255,0.2)";
  button.style.color = "white";
  button.style.fontSize = "28px";
  button.style.cursor = "pointer";
  button.style.boxShadow = "0 6px 20px rgba(0,0,0,0.25)";
  button.style.transition = "all 0.3s ease";
  button.style.bottom = "20px";
  button.style.right = "20px";

  button.onmouseenter = () => {
    button.style.transform = "scale(1.05)";
    button.style.background = "rgba(255,255,255,0.25)";
  };
  button.onmouseleave = () => {
    button.style.transform = "scale(1)";
    button.style.background = "rgba(255,255,255,0.15)";
  };

  document.body.appendChild(button);

  // Chat iframe
  const iframe = document.createElement("iframe");
  iframe.src = `https://rag-cloud-embedding-frontend.vercel.app/chatbot?apiKey=${apiKey}&clientDomain=${encodeURIComponent(clientDomain)}`;
  iframe.style.position = "fixed";
  iframe.style.zIndex = "99999";
  iframe.style.width = "360px";
  iframe.style.height = "520px";
  iframe.style.border = "none";
  iframe.style.borderRadius = "20px";
  iframe.style.boxShadow = "0 8px 30px rgba(0,0,0,0.25)";
  iframe.style.backdropFilter = "blur(20px)";
  iframe.style.background = "rgba(255,255,255,0.05)";
  iframe.style.display = "none";

  // Align iframe above the button
  const iframeBottomGap = 100; // px between bottom and button
  iframe.style.bottom = `${iframeBottomGap}px`;
  iframe.style.right = "20px";

  document.body.appendChild(iframe);

  // Toggle iframe visibility
  button.onclick = () => {
    iframe.style.display = iframe.style.display === "none" ? "block" : "none";
  };

  // Responsive: mobile full-screen
  function updateResponsive() {
    if (window.innerWidth <= 600) {
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.bottom = "0";
      iframe.style.right = "0";
      iframe.style.borderRadius = "0";
    } else {
      iframe.style.width = "360px";
      iframe.style.height = "520px";
      iframe.style.bottom = `${iframeBottomGap}px`;
      iframe.style.right = "20px";
      iframe.style.borderRadius = "20px";
    }
  }

  window.addEventListener("resize", updateResponsive);
  updateResponsive();
})();
