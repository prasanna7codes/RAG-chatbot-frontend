(function() {
  // This script runs on the client's website.
  const scriptTag = document.currentScript;
  const apiKey = scriptTag.getAttribute("data-api-key");

  if (!apiKey) {
    console.error("Chatbot: Missing data-api-key attribute in script tag");
    return;
  }

  // *** CHANGE #1: Get the actual client's domain ***
  const clientDomain = window.location.hostname;

  // Create iframe
  const iframe = document.createElement("iframe");
  // *** CHANGE #2: Pass the client's domain in the iframe's URL ***
  iframe.src = `https://rag-cloud-embedding-frontend.vercel.app/chatbot?apiKey=${apiKey}&clientDomain=${encodeURIComponent(clientDomain)}`;
  
  // --- The rest of your styles are perfect, no changes needed ---
  iframe.style.position = "fixed";
  iframe.style.bottom = "80px";
  iframe.style.right = "20px";
  iframe.style.width = "400px";
  iframe.style.height = "600px";
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
