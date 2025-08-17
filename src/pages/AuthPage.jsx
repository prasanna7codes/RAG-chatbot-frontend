import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

export default function AuthPage() {
  const [mode, setMode] = useState("signin"); // "signin" or "signup"
  const [method, setMethod] = useState("choose"); // "choose", "email", "google"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  // Redirect if already signed in
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate("/dashboard");
    };
    checkSession();
  }, [navigate]);

  // Email signup/signin handlers
  const handleEmailSignup = async () => {
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) setMessage(error.message);
    else {
      setMessage("Signup successful! Redirecting...");
      navigate("/dashboard"); // auto redirect after signup
    }
  };

  const handleEmailSignin = async () => {
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) setMessage(error.message);
    else navigate("/dashboard");
  };

  // Google OAuth
  const handleGoogleAuth = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" }, // redirect after login
    });
    setLoading(false);
    if (error) setMessage(error.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center">{mode === "signin" ? "Sign In" : "Sign Up"}</h1>

        {/* Choose login/signup method */}
        {method === "choose" && (
          <div className="space-y-2">
            <Button onClick={() => setMethod("email")}>Use Email & Password</Button>
            <Button onClick={handleGoogleAuth}>Continue with Google</Button>
          </div>
        )}

        {/* Email form */}
        {method === "email" && (
          <>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              onClick={mode === "signin" ? handleEmailSignin : handleEmailSignup}
              disabled={loading}
            >
              {loading ? (mode === "signin" ? "Signing in..." : "Signing up...") : mode === "signin" ? "Sign In" : "Sign Up"}
            </Button>
            <Button variant="link" onClick={() => setMethod("choose")}>Back</Button>
          </>
        )}

        {message && <p className="text-sm text-red-500">{message}</p>}

        {/* Toggle between signup/signin */}
        {method === "choose" && (
          <p className="text-center text-sm">
            {mode === "signin" ? (
              <>
                New here?{" "}
                <Button variant="link" onClick={() => setMode("signup")}>Sign Up</Button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Button variant="link" onClick={() => setMode("signin")}>Sign In</Button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}