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

  const navigate = useNavigate();

  // Check session and listen for auth changes (supports email/password & OAuth)
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted && data.session) {
        setUser(data.session.user);
        fetchUserExtra(data.session.user.id);
      } else if (mounted) {
        navigate("/"); // redirect to AuthPage if no session
      }
    };
    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/"); // redirect to AuthPage if logged out
      else {
        setUser(session.user);
        fetchUserExtra(session.user.id); // update user info after Google login
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
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
      .upsert([
        {
          id: user.id,
          company_name: companyName,
          company_url: companyUrl,
          status: "pending",
        },
      ]);

    setLoading(false);

    if (error) setMessage(error.message);
    else setMessage("Company info saved! Wait for approval.");
  };

  const handleSubmission = async () => {
    if (!urlToSubmit && !pdfFile) {
      setSubmissionMessage("Please provide URL or PDF.");
      return;
    }

    setLoading(true);
    setSubmissionMessage("");

    const formData = new FormData();
    formData.append("client_id", user.id);
    if (urlToSubmit) formData.append("url", urlToSubmit);
    if (pdfFile) formData.append("pdf", pdfFile);

    const res = await fetch("http://localhost:8000/ingest/", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok)
      setSubmissionMessage(
        `Data ingested successfully! ${data.chunks_count} chunks stored.`
      );
    else setSubmissionMessage(`Error: ${data.error}`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/"); // redirect to AuthPage
  };

  if (!user) return <p>Loading your account...</p>;

  return (
    <div className="p-6 max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Welcome, {user.email}</h1>
      <Button className="mb-4" onClick={handleSignOut}>
        Sign Out
      </Button>

      {/* Company info section */}
      <h2 className="text-xl font-semibold">Company Information</h2>
      <Input
        placeholder="Company Name"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
      />
      <Input
        placeholder="Company URL"
        value={companyUrl}
        onChange={(e) => setCompanyUrl(e.target.value)}
      />
      <Button onClick={handleCompanySubmit} disabled={loading}>
        {loading ? "Saving..." : "Save Company Info"}
      </Button>
      <p className="text-sm text-gray-500">
        Status:{" "}
        <span
          className={status === "approved" ? "text-green-500" : "text-red-500"}
        >
          {status}
        </span>
      </p>
      {message && <p className="text-sm text-yellow-600">{message}</p>}

      {/* URL/PDF submission */}
      {status === "approved" && (
        <div className="mt-6 space-y-2">
          <h2 className="text-xl font-semibold">Submit URL / PDF</h2>
          <Input
            placeholder="Website URL"
            value={urlToSubmit}
            onChange={(e) => setUrlToSubmit(e.target.value)}
          />
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setPdfFile(e.target.files[0])}
          />
          <Button onClick={handleSubmission} disabled={loading}>
            {loading ? "Submitting..." : "Submit"}
          </Button>
          {submissionMessage && (
            <p className="text-sm text-green-500">{submissionMessage}</p>
          )}
        </div>
      )}

      {status !== "approved" && (
        <p className="text-sm text-yellow-600 mt-4">
          Your company info is pending approval. You cannot submit URL/PDF yet.
        </p>
      )}
    </div>
  );
}
