import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import ChatWindow from "./ChatWindow";

export default function ChatbotWidgetUI() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {open && <ChatWindow onClose={() => setOpen(false)} />}
      <Button
        onClick={() => setOpen(true)}
        className="rounded-full w-14 h-14 shadow-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white flex items-center justify-center"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>
    </div>
  );
}
