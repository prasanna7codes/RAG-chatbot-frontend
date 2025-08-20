(function() {
  // This script runs on the client's website.
  const scriptTag = document.currentScript;
  const apiKey = scriptTag.getAttribute("data-api-key");

  if (!apiKey) {
    console.error("Chatbot: Missing data-api-key attribute in script tag");
    return;
  }

  const clientDomain = window.location.hostname;

  // Create iframe
  const iframe = document.createElement("iframe");
  iframe.src = `https://rag-cloud-embedding-frontend.vercel.app/chatbot?apiKey=${apiKey}&clientDomain=${encodeURIComponent(clientDomain)}`;
  
  // --- STYLE CHANGES ARE HERE ---
  iframe.style.position = "fixed";
  iframe.style.bottom = "80px"; // Distance from bottom of screen
  iframe.style.right = "20px";  // Distance from right of screen
  
  // *** ADJUST THESE VALUES TO CHANGE THE CHATBOT SIZE ***
  iframe.style.width = "350px";  // Smaller width (was 400px)
  iframe.style.height = "500px"; // Smaller height (was 600px)
  
  iframe.style.border = "none";
  iframe.style.zIndex = "99999";
  iframe.style.borderRadius = "12px";
  iframe.style.boxShadow = "0 4px 20px rgba(0,0,0,0.2)";
  iframe.style.display = "none"; // start hidden

  document.body.appendChild(iframe);

  // Floating button (no changes needed here)
  const button = document.createElement("button");
  button.innerHTML = "💬";
  button.style.position = "fixed";
  button.style.bottom = "20px";
  button.style.right = "20px";
  button.style.zIndex = "100000";
  button.style.borderRadius = "50%";
  button.style.width = "60px";
  button.style.height = "60px";
  button.style.background = "linear-gradient(90deg,#3b82f6,#9333ea)";
  button.style.color = "white";
  button.style.fontSize = "24px";
  button.style.cursor = "pointer";
  button.style.border = "none";
  button.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";

  button.onclick = () => {
    iframe.style.display = iframe.style.display === "none" ? "block" : "none";
  };

  document.body.appendChild(button);
})();
