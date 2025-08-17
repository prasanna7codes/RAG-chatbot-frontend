import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import AuthPage from "./pages/AuthPage"; // New combined auth page
import Dashboard from "./pages/Dashboard";
import ChatbotWidget from "./pages/ChatbotWidget";



ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<AuthPage />} /> {/* Root now shows AuthPage */}
      <Route path="/dashboard" element={<Dashboard />} />
      
      <Route path="/chatbot" element={<ChatbotWidget />} />
    </Routes>
  </BrowserRouter>
);