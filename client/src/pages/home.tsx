import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [endpoint, setEndpoint] = useState("http://localhost:5000");
  const [position, setPosition] = useState("bottom-right");
  const [primaryColor, setPrimaryColor] = useState("#6366F1");
  const { toast } = useToast();

  const generateWidgetScript = () => {
    const params = new URLSearchParams({
      'data-endpoint': endpoint,
      'data-position': position,
      'data-primary-color': primaryColor
    });

    return `<script src="${endpoint}/widget.js" ${Array.from(params.entries()).map(([key, value]) => `${key}="${value}"`).join(' ')}></script>`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Widget script copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the script manually",
        variant: "destructive",
      });
    }
  };

  const openWidgetDemo = () => {
    const params = new URLSearchParams({
      endpoint,
      position,
      primaryColor
    });
    window.open(`/widget?${params.toString()}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Chat Support Widget
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Embeddable chat support widget with Python script integration. 
            Process messages through your custom AI or automation scripts.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Configuration Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Widget Configuration
                </CardTitle>
                <CardDescription>
                  Customize your chat widget settings and generate the embed code
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="endpoint">API Endpoint URL</Label>
                  <Input
                    id="endpoint"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="https://your-api.com"
                  />
                  <p className="text-sm text-gray-500">
                    The endpoint where your Python script will process messages
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="position">Widget Position</Label>
                  <Select value={position} onValueChange={setPosition}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      <SelectItem value="top-right">Top Right</SelectItem>
                      <SelectItem value="top-left">Top Left</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#6366F1"
                    />
                    <div
                      className="w-12 h-10 rounded border border-gray-300"
                      style={{ backgroundColor: primaryColor }}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={openWidgetDemo} className="flex-1">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Preview Widget
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Features */}
            <Card>
              <CardHeader>
                <CardTitle>Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Badge variant="secondary" className="justify-center">Text Messages</Badge>
                  <Badge variant="secondary" className="justify-center">File Uploads</Badge>
                  <Badge variant="secondary" className="justify-center">Python Integration</Badge>
                  <Badge variant="secondary" className="justify-center">JSON Responses</Badge>
                  <Badge variant="secondary" className="justify-center">Cross-domain</Badge>
                  <Badge variant="secondary" className="justify-center">Responsive</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Integration Instructions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Integration Code</CardTitle>
                <CardDescription>
                  Copy this script tag and paste it into your website's HTML
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-gray-900 rounded-lg p-4 text-green-400 font-mono text-sm overflow-x-auto">
                    <code>{generateWidgetScript()}</code>
                  </div>
                  <Button 
                    onClick={() => copyToClipboard(generateWidgetScript())}
                    className="w-full"
                    variant="outline"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Script Tag
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Python Script Setup</CardTitle>
                <CardDescription>
                  Your Python script receives message data and should return JSON
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-gray-900 rounded-lg p-4 text-green-400 font-mono text-sm overflow-x-auto">
                    <pre>{`import json
import sys

# Read input data
input_data = json.loads(sys.stdin.read())
message = input_data.get('message', '')
files = input_data.get('files', [])
session_id = input_data.get('sessionId', '')

# Process the message
response = {
    "response": "I received your message: " + message,
    "confidence": 0.95,
    "intent": "general_inquiry",
    "session_id": session_id
}

# Return JSON response
print(json.dumps(response))`}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Supported File Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <strong>Images:</strong> JPG, PNG, GIF
                  </div>
                  <div>
                    <strong>Documents:</strong> PDF, TXT, DOCX
                  </div>
                  <div>
                    <strong>Max file size:</strong> 10MB per file
                  </div>
                  <div>
                    <strong>Max files:</strong> 5 files per message
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
