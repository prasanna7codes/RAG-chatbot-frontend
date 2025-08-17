// pages/Dashboard.jsx

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [urlToSubmit, setUrlToSubmit] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [iframeSnippet, setIframeSnippet] = useState("");
  const [publicApiKey, setPublicApiKey] = useState(""); // MODIFIED: Added state for key

  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const fetchUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        if (session) {
          setUser(session.user);
          fetchUserExtra(session.user.id);
        } else {
          navigate("/");
        }
      }
    };

    fetchUserData();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/");
      else {
        setUser(session.user);
        fetchUserExtra(session.user.id);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const fetchUserExtra = async (userId) => {
    const { data } = await supabase
      .from("users_extra")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      setCompanyName(data.company_name || "");
      setCompanyUrl(data.company_url || "");
      setStatus(data.status || "pending");
      setPublicApiKey(data.public_api_key || ""); // MODIFIED: Set the API key state

      // MODIFIED: Generate snippet if user is approved and has a key
      if (data.status === "approved" && data.public_api_key) {
        setIframeSnippet(
          `<iframe src="http://localhost:5173/chatbot?apiKey=${data.public_api_key}" width="400" height="600"></iframe>`
        );
      }
    }
  };

  const handleCompanySubmit = async () => {
    if (!companyName || !companyUrl) {
      setMessage("Please fill in both fields.");
      return;
    }
    setLoading(true);
    setMessage("");
    const { error } = await supabase
      .from("users_extra")
      .upsert([{ id: user.id, company_name: companyName, company_url: companyUrl, status: "pending" }]);
    setLoading(false);
    if (error) setMessage(error.message);
    else setMessage("Company info saved! Please wait for approval.");
  };

  const handleSubmission = async () => {
    if (!urlToSubmit && !pdfFile) {
      setSubmissionMessage("Please provide a URL or a PDF file.");
      return;
    }
    setLoading(true);
    setSubmissionMessage("");
    const formData = new FormData();
    formData.append("client_id", user.id); // Safe, as user is authenticated
    if (urlToSubmit) formData.append("url", urlToSubmit);
    if (pdfFile) formData.append("pdf", pdfFile);

    try {
      const res = await fetch("https://saas-backend-taqu.onrender.com/ingest/", { method: "POST", body: formData });
      const data = await res.json();
      setLoading(false);
      if (res.ok) {
        setSubmissionMessage(`Data ingested successfully! ${data.chunks_count} chunks stored.`);
      } else {
        setSubmissionMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setLoading(false);
      setSubmissionMessage(`Error: ${err.message}`);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!user) return <p>Loading your account...</p>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Welcome, {user.email}</h1>
        <Button onClick={handleSignOut}>Sign Out</Button>
      </div>

      <div className="p-4 border rounded-lg space-y-2">
        <h2 className="text-xl font-semibold">Company Information</h2>
        <Input placeholder="Company Name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={status !== "pending"} />
        <Input placeholder="Company URL" value={companyUrl} onChange={(e) => setCompanyUrl(e.target.value)} disabled={status !== "pending"} />
        <Button onClick={handleCompanySubmit} disabled={loading || status !== "pending"}>
          {loading ? "Saving..." : "Save Company Info"}
        </Button>
        <p className="text-sm text-gray-500">
          Status: <span className={status === "approved" ? "text-green-500 font-bold" : "text-yellow-500 font-bold"}>{status}</span>
        </p>
        {message && <p className="text-sm text-blue-600">{message}</p>}
      </div>

      {status === "approved" && (
        <div className="p-4 border rounded-lg space-y-2">
          <h2 className="text-xl font-semibold">Submit Your Data</h2>
          <Input placeholder="Website URL to crawl" value={urlToSubmit} onChange={(e) => setUrlToSubmit(e.target.value)} />
          <p>Or upload a PDF document:</p>
          <Input type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files[0])} />
          <Button onClick={handleSubmission} disabled={loading}>
            {loading ? "Submitting..." : "Submit Data"}
          </Button>
          {submissionMessage && <p className="text-sm text-green-600">{submissionMessage}</p>}
        </div>
      )}

      {/* MODIFIED: Show snippet section only if approved and key exists */}
      {status === "approved" && publicApiKey && (
        <div className="p-4 border rounded-lg space-y-2">
          <h2 className="text-xl font-semibold">Embed Your Chatbot</h2>
          <p className="text-sm text-gray-600">Copy this code and paste it into your website's HTML where you want the chatbot to appear.</p>
          <code className="block p-3 bg-gray-100 rounded text-sm break-all">{iframeSnippet}</code>
        </div>
      )}

      {status !== "approved" && (
        <p className="text-sm text-yellow-600 mt-4">
          Your company information is pending approval. Once approved, you can submit data and get your chatbot embed code.
        </p>
      )}
    </div>
  );
}