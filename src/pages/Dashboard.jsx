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
  
  // State for embed options
  const [embedSnippet, setEmbedSnippet] = useState("");
  const [embedType, setEmbedType] = useState("widget"); // 'widget' or 'inline'

  const [publicApiKey, setPublicApiKey] = useState("");
  const [allowedOrigins, setAllowedOrigins] = useState([]);
  const [newOrigin, setNewOrigin] = useState("");
  const [domainsLocked, setDomainsLocked] = useState(false);
  const navigate = useNavigate();

  // --- No changes to this useEffect ---
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

  // This function now just fetches and sets data
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
      setPublicApiKey(data.public_api_key || "");
      setAllowedOrigins(data.allowed_origins || []);
    }
  };

  // *** NEW useEffect to generate the correct embed snippet ***
  useEffect(() => {
    if (status === "approved" && publicApiKey) {
      if (embedType === "widget") {
        setEmbedSnippet(
          `<script src="https://rag-cloud-embedding-frontend.vercel.app/widget.js" data-api-key="${publicApiKey}"></script>`
        );
      } else { // embedType is 'inline'
        // Use the primary company URL as the domain for the inline snippet
        const clientDomain = normalizeDomain(companyUrl) || 'YOUR_DOMAIN.com';
        setEmbedSnippet(
          `<iframe
  src="https://rag-cloud-embedding-frontend.vercel.app/chatbot?apiKey=${publicApiKey}&clientDomain=${clientDomain}"
  style="width: 100%; height: 600px; border: none; border-radius: 12px;"
  title="AI Assistant"
></iframe>`
        );
      }
    }
  }, [status, publicApiKey, companyUrl, embedType]); // Re-run when any of these change

  const normalizeDomain = (url) => {
    if (!url) return "";
    try {
      const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
      let hostname = parsed.hostname.toLowerCase();
      return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
    } catch {
      return url.toLowerCase();
    }
  };

  // --- No changes to handler functions below ---
  const handleCompanySubmit = async () => {
    if (!companyName || !companyUrl) {
      setMessage("Please fill in both fields.");
      return;
    }
    setLoading(true);
    setMessage("");
    const normalizedUrl = normalizeDomain(companyUrl);
    const { error } = await supabase
      .from("users_extra")
      .upsert([{ id: user.id, company_name: companyName, company_url: normalizedUrl, status: "pending" }]);
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
    formData.append("client_id", user.id);
    if (urlToSubmit) formData.append("url", urlToSubmit);
    if (pdfFile) formData.append("pdf", pdfFile);
    try {
      const res = await fetch("https://trying-cloud-embedding-again.onrender.com/ingest/", { method: "POST", body: formData });
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

  const addOrigin = () => {
    if (!newOrigin) return;
    const normalized = normalizeDomain(newOrigin);
    if (!allowedOrigins.includes(normalized)) setAllowedOrigins([...allowedOrigins, normalized]);
    setNewOrigin("");
  };

  const removeOrigin = (domain) => setAllowedOrigins(allowedOrigins.filter((d) => d !== domain));

  const saveOrigins = async () => {
    const { error } = await supabase
      .from("users_extra")
      .update({ allowed_origins: allowedOrigins })
      .eq("id", user.id);
    if (error) {
        // Replace alert with a less intrusive message
        setMessage("Error saving domains: " + error.message);
    } else {
        setMessage("Allowed domains updated successfully!");
        setDomainsLocked(true);
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

      {/* Company info */}
      <div className="p-4 border rounded-lg space-y-2">
        <h2 className="text-xl font-semibold">Company Information</h2>
        <Input placeholder="Company Name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={status !== "pending"} />
        <Input placeholder="Company URL (e.g., your-website.com)" value={companyUrl} onChange={(e) => setCompanyUrl(e.target.value)} disabled={status !== "pending"} />
        <Button onClick={handleCompanySubmit} disabled={loading || status !== "pending"}>
          {loading ? "Saving..." : "Save Company Info"}
        </Button>
        <p className="text-sm text-gray-500">
          Status: <span className={status === "approved" ? "text-green-500 font-bold" : "text-yellow-500 font-bold"}>{status}</span>
        </p>
        {message && <p className="text-sm text-blue-600">{message}</p>}
      </div>

      {/* Data Submission & Domain Management (only if approved) */}
      {status === "approved" && (
        <>
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

          <div className="p-4 border rounded-lg space-y-2">
            <h2 className="text-xl font-semibold">Allowed Domains</h2>
            <div className="flex gap-2 mb-2">
              <Input placeholder="Add domain (example.com)" value={newOrigin} onChange={(e) => setNewOrigin(e.target.value)} />
              <Button onClick={addOrigin}>Add</Button>
            </div>
            <ul className="list-disc ml-5 mb-2">
              {allowedOrigins.map((d, i) => (
                <li key={i} className="flex justify-between items-center">
                  {d} <Button onClick={() => removeOrigin(d)} variant="destructive" size="sm">Remove</Button>
                </li>
              ))}
            </ul>
            <Button onClick={saveOrigins}>Save Allowed Domains</Button>
          </div>
        </>
      )}
      
      {/* Embed chatbot */}
      {status === "approved" && publicApiKey && (
        <div className="p-4 border rounded-lg space-y-2">
          <h2 className="text-xl font-semibold">Embed Your Chatbot</h2>
          
          {/* *** NEW: TABS FOR EMBED TYPE *** */}
          <div className="flex gap-2 border-b mb-2">
            <button 
              className={`py-2 px-4 ${embedType === 'widget' ? 'border-b-2 border-blue-500 font-semibold' : 'text-gray-500'}`}
              onClick={() => setEmbedType('widget')}
            >
              Floating Widget
            </button>
            <button 
              className={`py-2 px-4 ${embedType === 'inline' ? 'border-b-2 border-blue-500 font-semibold' : 'text-gray-500'}`}
              onClick={() => setEmbedType('inline')}
            >
              Inline Embed
            </button>
          </div>

          {/* *** NEW: DYNAMIC INSTRUCTIONS *** */}
          {embedType === 'widget' ? (
            <p className="text-sm text-gray-600">For a chat bubble in the corner of every page, paste this code before the closing `&lt;/body&gt;` tag in your website's HTML.</p>
          ) : (
            <p className="text-sm text-gray-600">To embed the chatbot inside a specific page or container, paste this code where you want it to appear.</p>
          )}

          <code className="block p-3 bg-gray-100 rounded text-sm break-all whitespace-pre-wrap">{embedSnippet}</code>
        </div>
      )}

      {status !== "approved" && (
        <p className="text-sm text-yellow-600 mt-4">
          Your company information is pending approval. Once approved, you can submit data, manage domains, and get your chatbot embed code.
        </p>
      )}
    </div>
  );
}
