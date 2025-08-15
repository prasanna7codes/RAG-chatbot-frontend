import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [signedUp, setSignedUp] = useState(false);

  const navigate = useNavigate();

  const handleSignup = async () => {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
    } else {
      setSignedUp(true);
      setMessage("Account created! Please sign in to continue.");
      // Optional: force sign out immediately so no session is active
      await supabase.auth.signOut();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Sign Up</h1>
        {!signedUp && (
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
            <Button onClick={handleSignup} disabled={loading}>
              {loading ? "Signing up..." : "Sign Up"}
            </Button>
          </>
        )}
        {message && <p className="text-sm text-green-500">{message}</p>}

        {/* Show Sign In button after signup */}
        {signedUp && (
          <Button onClick={() => navigate("/signin")}>Go to Sign In</Button>
        )}
      </div>
    </div>
  );
}
