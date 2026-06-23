import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Settings } from "lucide-react";
import { useToast } from "../../contexts/toast";

type APIProvider = "openai" | "gemini" | "anthropic" | "claude-code";

type AIModel = {
  id: string;
  name: string;
  description: string;
};

type ModelCategory = {
  key: 'extractionModel' | 'solutionModel' | 'debuggingModel';
  title: string;
  description: string;
  openaiModels: AIModel[];
  geminiModels: AIModel[];
  anthropicModels: AIModel[];
  claudeCodeModels: AIModel[];
};

// Define available models for each category
const modelCategories: ModelCategory[] = [
  {
    key: 'extractionModel',
    title: 'Problem Extraction',
    description: 'Model used to analyze screenshots and extract problem details',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option"
      }
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Faster, more cost-effective option"
      }
    ],
    anthropicModels: [
      { id: "claude-opus-4-8", name: "Claude Opus 4", description: "Most capable model for complex problems" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4", description: "Best balance of speed and intelligence" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4", description: "Fastest model for quick extraction" },
      { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", description: "Previous generation flagship" },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Balanced performance and speed" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "Top-level intelligence and understanding" }
    ],
    claudeCodeModels: [
      { id: "claude-opus-4-8", name: "Claude Opus 4", description: "Most capable — best for hard problems" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4 (recommended)", description: "Best balance of speed and quality" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4", description: "Fastest — good for quick answers" }
    ]
  },
  {
    key: 'solutionModel',
    title: 'Solution Generation',
    description: 'Model used to generate coding solutions',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option"
      }
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Faster, more cost-effective option"
      }
    ],
    anthropicModels: [
      { id: "claude-opus-4-8", name: "Claude Opus 4", description: "Most capable model for complex solutions" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4", description: "Best balance of speed and intelligence" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4", description: "Fastest model for quick solutions" },
      { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", description: "Previous generation flagship" },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Balanced performance and speed" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "Top-level intelligence and understanding" }
    ],
    claudeCodeModels: [
      { id: "claude-opus-4-8", name: "Claude Opus 4", description: "Most capable — best for hard problems" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4 (recommended)", description: "Best balance of speed and quality" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4", description: "Fastest — good for quick answers" }
    ]
  },
  {
    key: 'debuggingModel',
    title: 'Debugging',
    description: 'Model used to debug and improve solutions',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Best for analyzing code and error messages"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option"
      }
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Best for analyzing code and error messages"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Faster, more cost-effective option"
      }
    ],
    anthropicModels: [
      { id: "claude-opus-4-8", name: "Claude Opus 4", description: "Most capable model for deep debugging" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4", description: "Best balance of speed and intelligence" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4", description: "Fastest model for quick debugging" },
      { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", description: "Previous generation flagship" },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Balanced performance and speed" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "Top-level intelligence and understanding" }
    ],
    claudeCodeModels: [
      { id: "claude-opus-4-8", name: "Claude Opus 4", description: "Most capable — best for hard problems" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4 (recommended)", description: "Best balance of speed and quality" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4", description: "Fastest — good for quick answers" }
    ]
  }
];

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({ open: externalOpen, onOpenChange }: SettingsDialogProps) {
  const [open, setOpen] = useState(externalOpen || false);
  const [apiKey, setApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState<APIProvider>("openai");
  const [extractionModel, setExtractionModel] = useState("gpt-4o");
  const [solutionModel, setSolutionModel] = useState("gpt-4o");
  const [debuggingModel, setDebuggingModel] = useState("gpt-4o");
  const [isLoading, setIsLoading] = useState(false);
  const [claudeCodeStatus, setClaudeCodeStatus] = useState<{
    installed: boolean; authenticated: boolean; email?: string; error?: string;
  } | null>(null);
  const [claudeCodeChecking, setClaudeCodeChecking] = useState(false);
  const { showToast } = useToast();

  // Sync with external open state
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
    }
  }, [externalOpen]);

  // Handle open state changes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    // Only call onOpenChange when there's actually a change
    if (onOpenChange && newOpen !== externalOpen) {
      onOpenChange(newOpen);
    }
  };
  
  // Load current config on dialog open
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      interface Config {
        apiKey?: string;
        apiProvider?: APIProvider;
        extractionModel?: string;
        solutionModel?: string;
        debuggingModel?: string;
      }

      window.electronAPI
        .getConfig()
        .then((config: Config) => {
          setApiKey(config.apiKey || "");
          setApiProvider(config.apiProvider || "openai");
          setExtractionModel(config.extractionModel || "gpt-4o");
          setSolutionModel(config.solutionModel || "gpt-4o");
          setDebuggingModel(config.debuggingModel || "gpt-4o");
        })
        .catch((error: unknown) => {
          console.error("Failed to load config:", error);
          showToast("Error", "Failed to load settings", "error");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, showToast]);

  // Check Claude Code status when that provider is selected
  const checkClaudeCodeStatus = async () => {
    setClaudeCodeChecking(true);
    try {
      const status = await window.electronAPI.checkClaudeCodeStatus();
      setClaudeCodeStatus(status);
    } catch {
      setClaudeCodeStatus({ installed: false, authenticated: false, error: "Failed to check status" });
    } finally {
      setClaudeCodeChecking(false);
    }
  };

  // Handle API provider change
  const handleProviderChange = (provider: APIProvider) => {
    setApiProvider(provider);
    if (provider === "openai") {
      setExtractionModel("gpt-4o");
      setSolutionModel("gpt-4o");
      setDebuggingModel("gpt-4o");
    } else if (provider === "gemini") {
      setExtractionModel("gemini-1.5-pro");
      setSolutionModel("gemini-1.5-pro");
      setDebuggingModel("gemini-1.5-pro");
    } else if (provider === "anthropic") {
      setExtractionModel("claude-sonnet-4-6");
      setSolutionModel("claude-sonnet-4-6");
      setDebuggingModel("claude-sonnet-4-6");
    } else if (provider === "claude-code") {
      setExtractionModel("claude-sonnet-4-6");
      setSolutionModel("claude-sonnet-4-6");
      setDebuggingModel("claude-sonnet-4-6");
      checkClaudeCodeStatus();
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.updateConfig({
        apiKey: apiProvider === "claude-code" ? "" : apiKey,
        apiProvider,
        extractionModel,
        solutionModel,
        debuggingModel,
      });
      
      if (result) {
        showToast("Success", "Settings saved successfully", "success");
        handleOpenChange(false);
        
        // Force reload the app to apply the API key
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      showToast("Error", "Failed to save settings", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Mask API key for display
  const maskApiKey = (key: string) => {
    if (!key || key.length < 10) return "";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  // Open external link handler
  const openExternalLink = (url: string) => {
    window.electronAPI.openLink(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-md bg-black border border-white/10 text-white settings-dialog"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(450px, 90vw)',
          height: 'auto',
          minHeight: '400px',
          maxHeight: '90vh',
          overflowY: 'auto',
          zIndex: 9999,
          margin: 0,
          padding: '20px',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          animation: 'fadeIn 0.25s ease forwards',
          opacity: 0.98
        }}
      >        
        <DialogHeader>
          <DialogTitle>API Settings</DialogTitle>
          <DialogDescription className="text-white/70">
            Configure your API key and model preferences. You'll need your own API key to use this application.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* API Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">API Provider</label>
            <div className="flex gap-2">
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "openai"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("openai")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "openai" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">OpenAI</p>
                    <p className="text-xs text-white/60">GPT-4o models</p>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "gemini"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("gemini")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "gemini" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">Gemini</p>
                    <p className="text-xs text-white/60">Gemini 1.5 models</p>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "anthropic"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("anthropic")}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${apiProvider === "anthropic" ? "bg-white" : "bg-white/20"}`} />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">Claude API</p>
                    <p className="text-xs text-white/60">API key required</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Claude Code row */}
            <div
              className={`w-full p-2 rounded-lg cursor-pointer transition-colors ${
                apiProvider === "claude-code"
                  ? "bg-white/10 border border-white/20"
                  : "bg-black/30 border border-white/5 hover:bg-white/5"
              }`}
              onClick={() => handleProviderChange("claude-code")}
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${apiProvider === "claude-code" ? "bg-white" : "bg-white/20"}`} />
                <div className="flex flex-col">
                  <p className="font-medium text-white text-sm">Claude Code (Pro subscription)</p>
                  <p className="text-xs text-white/60">Use your Claude Pro subscription via the Claude Code CLI — no API key needed</p>
                </div>
              </div>
            </div>
          </div>

          {/* API key input — hidden for claude-code */}
          {apiProvider !== "claude-code" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="apiKey">
              {apiProvider === "openai" ? "OpenAI API Key" :
               apiProvider === "gemini" ? "Gemini API Key" :
               "Anthropic API Key"}
            </label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                apiProvider === "openai" ? "sk-..." :
                apiProvider === "gemini" ? "Enter your Gemini API key" :
                "sk-ant-..."
              }
              className="bg-black/50 border-white/10 text-white"
            />
            {apiKey && <p className="text-xs text-white/50">Current: {maskApiKey(apiKey)}</p>}
            <p className="text-xs text-white/50">
              Your API key is stored locally and never sent to any server except {apiProvider === "openai" ? "OpenAI" : apiProvider === "gemini" ? "Google" : "Anthropic"}
            </p>
            <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
              <p className="text-xs text-white/80 mb-1">Don't have an API key?</p>
              {apiProvider === "openai" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button onClick={() => openExternalLink('https://platform.openai.com/signup')} className="text-blue-400 hover:underline cursor-pointer">OpenAI</button></p>
                  <p className="text-xs text-white/60 mb-1">2. Go to <button onClick={() => openExternalLink('https://platform.openai.com/api-keys')} className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section</p>
                  <p className="text-xs text-white/60">3. Create a new secret key and paste it here</p>
                </>
              ) : apiProvider === "gemini" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Go to <button onClick={() => openExternalLink('https://aistudio.google.com/')} className="text-blue-400 hover:underline cursor-pointer">Google AI Studio</button></p>
                  <p className="text-xs text-white/60 mb-1">2. Go to the <button onClick={() => openExternalLink('https://aistudio.google.com/app/apikey')} className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section</p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button onClick={() => openExternalLink('https://console.anthropic.com/signup')} className="text-blue-400 hover:underline cursor-pointer">Anthropic</button></p>
                  <p className="text-xs text-white/60 mb-1">2. Go to the <button onClick={() => openExternalLink('https://console.anthropic.com/settings/keys')} className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section</p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </>
              )}
            </div>
          </div>
          ) : (
          /* Claude Code auth status panel */
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Claude Code Status</label>
            <div className="p-3 rounded-md bg-white/5 border border-white/10 space-y-2">
              {claudeCodeChecking ? (
                <p className="text-xs text-white/60">Checking status...</p>
              ) : claudeCodeStatus ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${claudeCodeStatus.installed ? "bg-green-400" : "bg-red-400"}`} />
                    <p className="text-xs text-white/80">{claudeCodeStatus.installed ? "Claude Code CLI installed" : "Claude Code CLI not found"}</p>
                  </div>
                  {claudeCodeStatus.installed && (
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${claudeCodeStatus.authenticated ? "bg-green-400" : "bg-yellow-400"}`} />
                      <p className="text-xs text-white/80">
                        {claudeCodeStatus.authenticated
                          ? `Authenticated${claudeCodeStatus.email ? ` as ${claudeCodeStatus.email}` : ""}`
                          : "Not authenticated"}
                      </p>
                    </div>
                  )}
                  {claudeCodeStatus.error && <p className="text-xs text-red-400">{claudeCodeStatus.error}</p>}
                  {!claudeCodeStatus.installed && (
                    <p className="text-xs text-white/60 mt-1">
                      Install with: <code className="bg-white/10 px-1 rounded">npm install -g @anthropic-ai/claude-code</code>
                    </p>
                  )}
                  {claudeCodeStatus.installed && !claudeCodeStatus.authenticated && (
                    <p className="text-xs text-white/60 mt-1">
                      Authenticate with: <code className="bg-white/10 px-1 rounded">claude auth login</code>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-white/60">Select this provider to check status</p>
              )}
              <button
                onClick={checkClaudeCodeStatus}
                className="text-xs text-blue-400 hover:underline cursor-pointer mt-1"
                disabled={claudeCodeChecking}
              >
                {claudeCodeChecking ? "Checking..." : "Refresh status"}
              </button>
            </div>
          </div>
          )}
          
          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-white mb-2 block">Keyboard Shortcuts</label>
            <div className="bg-black/30 border border-white/10 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="text-white/70">Toggle Visibility</div>
                <div className="text-white/90 font-mono">Ctrl+B / Cmd+B</div>
                
                <div className="text-white/70">Take Screenshot</div>
                <div className="text-white/90 font-mono">Ctrl+H / Cmd+H</div>
                
                <div className="text-white/70">Process Screenshots</div>
                <div className="text-white/90 font-mono">Ctrl+Enter / Cmd+Enter</div>
                
                <div className="text-white/70">Delete Last Screenshot</div>
                <div className="text-white/90 font-mono">Ctrl+L / Cmd+L</div>
                
                <div className="text-white/70">Reset View</div>
                <div className="text-white/90 font-mono">Ctrl+R / Cmd+R</div>
                
                <div className="text-white/70">Quit Application</div>
                <div className="text-white/90 font-mono">Ctrl+Q / Cmd+Q</div>
                
                <div className="text-white/70">Move Window</div>
                <div className="text-white/90 font-mono">Ctrl+Arrow Keys</div>
                
                <div className="text-white/70">Decrease Opacity</div>
                <div className="text-white/90 font-mono">Ctrl+[ / Cmd+[</div>
                
                <div className="text-white/70">Increase Opacity</div>
                <div className="text-white/90 font-mono">Ctrl+] / Cmd+]</div>
                
                <div className="text-white/70">Zoom Out</div>
                <div className="text-white/90 font-mono">Ctrl+- / Cmd+-</div>
                
                <div className="text-white/70">Reset Zoom</div>
                <div className="text-white/90 font-mono">Ctrl+0 / Cmd+0</div>
                
                <div className="text-white/70">Zoom In</div>
                <div className="text-white/90 font-mono">Ctrl+= / Cmd+=</div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4 mt-4">
            <label className="text-sm font-medium text-white">AI Model Selection</label>
            <p className="text-xs text-white/60 -mt-3 mb-2">
              Select which models to use for each stage of the process
            </p>
            
            {modelCategories.map((category) => {
              // Get the appropriate model list based on selected provider
              const models =
                apiProvider === "openai" ? category.openaiModels :
                apiProvider === "gemini" ? category.geminiModels :
                apiProvider === "claude-code" ? category.claudeCodeModels :
                category.anthropicModels;
              
              return (
                <div key={category.key} className="mb-4">
                  <label className="text-sm font-medium text-white mb-1 block">
                    {category.title}
                  </label>
                  <p className="text-xs text-white/60 mb-2">{category.description}</p>
                  
                  <div className="space-y-2">
                    {models.map((m) => {
                      // Determine which state to use based on category key
                      const currentValue = 
                        category.key === 'extractionModel' ? extractionModel :
                        category.key === 'solutionModel' ? solutionModel :
                        debuggingModel;
                      
                      // Determine which setter function to use
                      const setValue = 
                        category.key === 'extractionModel' ? setExtractionModel :
                        category.key === 'solutionModel' ? setSolutionModel :
                        setDebuggingModel;
                        
                      return (
                        <div
                          key={m.id}
                          className={`p-2 rounded-lg cursor-pointer transition-colors ${
                            currentValue === m.id
                              ? "bg-white/10 border border-white/20"
                              : "bg-black/30 border border-white/5 hover:bg-white/5"
                          }`}
                          onClick={() => setValue(m.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                currentValue === m.id ? "bg-white" : "bg-white/20"
                              }`}
                            />
                            <div>
                              <p className="font-medium text-white text-xs">{m.name}</p>
                              <p className="text-xs text-white/60">{m.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-white/10 hover:bg-white/5 text-white"
          >
            Cancel
          </Button>
          <Button
            className="px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
            onClick={handleSave}
            disabled={isLoading || (apiProvider !== "claude-code" && !apiKey)}
          >
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
