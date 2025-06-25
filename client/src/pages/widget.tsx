import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChatWidget } from "@/components/chat-widget";

interface WidgetConfig {
  endpoint: string;
  position: string;
  primaryColor: string;
}

export default function Widget() {
  const [location] = useLocation();
  const [config, setConfig] = useState<WidgetConfig>({
    endpoint: "http://localhost:5000",
    position: "bottom-right",
    primaryColor: "#6366F1"
  });

  useEffect(() => {
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const newConfig: WidgetConfig = {
      endpoint: urlParams.get('endpoint') || config.endpoint,
      position: urlParams.get('position') || config.position,
      primaryColor: urlParams.get('primaryColor') || config.primaryColor
    };
    setConfig(newConfig);
  }, [location]);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <ChatWidget config={config} />
    </div>
  );
}
