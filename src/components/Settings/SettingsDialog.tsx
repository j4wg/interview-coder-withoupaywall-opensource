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
import { CandidateProfileSection, CandidateProfile } from "./CandidateProfileSection";
import {
  APIProvider,
  AIModel,
  MODEL_CATEGORIES,
  DEFAULT_MODELS,
} from "../../../shared/aiModels";

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({ open: externalOpen, onOpenChange }: SettingsDialogProps) {
  const [open, setOpen] = useState(externalOpen || false);
  const [apiKey, setApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState<APIProvider>("openai");
  const [extractionModel, setExtractionModel] = useState(
    DEFAULT_MODELS.openai.extractionModel
  );
  const [solutionModel, setSolutionModel] = useState(
    DEFAULT_MODELS.openai.solutionModel
  );
  const [debuggingModel, setDebuggingModel] = useState(
    DEFAULT_MODELS.openai.debuggingModel
  );
  const [answerModel, setAnswerModel] = useState(
    DEFAULT_MODELS.openai.answerModel
  );
  const [speechRecognitionModel, setSpeechRecognitionModel] = useState("whisper-1");
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile>({
    name: "",
    resume: "",
    jobDescription: ""
  });
  const [isLoading, setIsLoading] = useState(false);
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
        answerModel?: string;
        speechRecognitionModel?: string;
        candidateProfile?: CandidateProfile;
      }

      window.electronAPI
        .getConfig()
        .then((config: Config) => {
          setApiKey(config.apiKey || "");
          const provider: APIProvider = config.apiProvider || "openai";
          setApiProvider(provider);
          const providerDefaults = DEFAULT_MODELS[provider];
          setExtractionModel(
            config.extractionModel || providerDefaults.extractionModel
          );
          setSolutionModel(
            config.solutionModel || providerDefaults.solutionModel
          );
          setDebuggingModel(
            config.debuggingModel || providerDefaults.debuggingModel
          );
          setAnswerModel(
            config.answerModel || providerDefaults.answerModel
          );
          setSpeechRecognitionModel(
            config.speechRecognitionModel ||
              providerDefaults.speechRecognitionModel ||
              (config.apiProvider === "gemini" ? "gemini-3-flash-preview" : "whisper-1")
          );
          setCandidateProfile(config.candidateProfile || {
            name: "",
            resume: "",
            jobDescription: ""
          });
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

  // Handle API provider change
  const handleProviderChange = (provider: APIProvider) => {
    setApiProvider(provider);
    
    // Reset models to defaults when changing provider
    const defaults = DEFAULT_MODELS[provider];
    setExtractionModel(defaults.extractionModel);
    setSolutionModel(defaults.solutionModel);
    setDebuggingModel(defaults.debuggingModel);
    setAnswerModel(defaults.answerModel);
    setSpeechRecognitionModel(
      defaults.speechRecognitionModel || 
      (provider === "gemini" ? "gemini-3-flash-preview" : "whisper-1")
    );
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.updateConfig({
        apiKey,
        apiProvider,
        extractionModel,
        solutionModel,
        debuggingModel,
        answerModel,
        speechRecognitionModel,
        candidateProfile,
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
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="text-white/70">
            Configure your API key, AI models, and optional candidate profile. You'll need your own API key to use this application.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* API Settings Section */}
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-white">API Settings</h2>
            <p className="text-xs text-white/60">
              Choose your provider and models. These control how screenshots and solutions are processed.
            </p>
          </div>
          
          {/* API Provider Selection */}
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
                    <p className="text-xs text-white/60">Gemini 3 models</p>
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
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "anthropic" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">Claude</p>
                    <p className="text-xs text-white/60">Claude 3 models</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
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
            {apiKey && (
              <p className="text-xs text-white/50">
                Current: {maskApiKey(apiKey)}
              </p>
            )}
            <p className="text-xs text-white/50">
              Your API key is stored locally and never sent to any server except {apiProvider === "openai" ? "OpenAI" : "Google"}
            </p>
            <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
              <p className="text-xs text-white/80 mb-1">Don't have an API key?</p>
              {apiProvider === "openai" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://platform.openai.com/signup')} 
                    className="text-blue-400 hover:underline cursor-pointer">OpenAI</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to <button 
                    onClick={() => openExternalLink('https://platform.openai.com/api-keys')} 
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new secret key and paste it here</p>
                </>
              ) : apiProvider === "gemini" ?  (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://aistudio.google.com/')} 
                    className="text-blue-400 hover:underline cursor-pointer">Google AI Studio</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to the <button 
                    onClick={() => openExternalLink('https://aistudio.google.com/app/apikey')} 
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://console.anthropic.com/signup')} 
                    className="text-blue-400 hover:underline cursor-pointer">Anthropic</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to the <button 
                    onClick={() => openExternalLink('https://console.anthropic.com/settings/keys')} 
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </>
              )}
            </div>
          </div>
          
          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-white mb-2 block">Keyboard Shortcuts</label>
            <div className="bg-black/30 border border-white/10 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="text-white/70">Toggle Visibility</div>
                <div className="text-white/90 font-mono">Ctrl+B / Cmd+B</div>
                
                <div className="text-white/70">Take Screenshot</div>
                <div className="text-white/90 font-mono">Ctrl+H / Cmd+H</div>
                
                <div className="text-white/70">Start/Stop Recording</div>
                <div className="text-white/90 font-mono">Ctrl+M / Cmd+M</div>
                
                <div className="text-white/70">Toggle Speaker Mode</div>
                <div className="text-white/90 font-mono">Ctrl+Shift+M / Cmd+Shift+M</div>
                
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
            
            {MODEL_CATEGORIES.map((category) => {
              // Get the appropriate model list based on selected provider
              const models: AIModel[] = category.modelsByProvider[apiProvider];
              
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
                        category.key === 'debuggingModel' ? debuggingModel :
                        answerModel;
                      
                      // Determine which setter function to use
                      const setValue = 
                        category.key === 'extractionModel' ? setExtractionModel :
                        category.key === 'solutionModel' ? setSolutionModel :
                        category.key === 'debuggingModel' ? setDebuggingModel :
                        setAnswerModel;
                        
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
          
          {/* Speech Recognition Model Selection */}
          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-white mb-1 block">
              Speech Recognition Model
            </label>
            <p className="text-xs text-white/60 mb-2">
              Model used for transcribing interview conversations
            </p>
            
            {apiProvider === "openai" ? (
              <div className="space-y-2">
                <div
                  className={`p-2 rounded-lg cursor-pointer transition-colors ${
                    speechRecognitionModel === "whisper-1"
                      ? "bg-white/10 border border-white/20"
                      : "bg-black/30 border border-white/5 hover:bg-white/5"
                  }`}
                  onClick={() => setSpeechRecognitionModel("whisper-1")}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        speechRecognitionModel === "whisper-1" ? "bg-white" : "bg-white/20"
                      }`}
                    />
                    <div>
                      <p className="font-medium text-white text-xs">Whisper-1</p>
                      <p className="text-xs text-white/60">OpenAI's speech-to-text model</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : apiProvider === "gemini" ? (
              <div className="space-y-2">
                <div
                  className={`p-2 rounded-lg cursor-pointer transition-colors ${
                    speechRecognitionModel === "gemini-1.5-flash"
                      ? "bg-white/10 border border-white/20"
                      : "bg-black/30 border border-white/5 hover:bg-white/5"
                  }`}
                  onClick={() => setSpeechRecognitionModel("gemini-1.5-flash")}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        speechRecognitionModel === "gemini-1.5-flash" ? "bg-white" : "bg-white/20"
                      }`}
                    />
                    <div>
                      <p className="font-medium text-white text-xs">Gemini 1.5 Flash</p>
                      <p className="text-xs text-white/60">Fast and efficient audio understanding</p>
                    </div>
                  </div>
                </div>
                <div
                  className={`p-2 rounded-lg cursor-pointer transition-colors ${
                    speechRecognitionModel === "gemini-1.5-pro"
                      ? "bg-white/10 border border-white/20"
                      : "bg-black/30 border border-white/5 hover:bg-white/5"
                  }`}
                  onClick={() => setSpeechRecognitionModel("gemini-1.5-pro")}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        speechRecognitionModel === "gemini-1.5-pro" ? "bg-white" : "bg-white/20"
                      }`}
                    />
                    <div>
                      <p className="font-medium text-white text-xs">Gemini 1.5 Pro</p>
                      <p className="text-xs text-white/60">Higher accuracy audio understanding</p>
                    </div>
                  </div>
                </div>
                <div
                  className={`p-2 rounded-lg cursor-pointer transition-colors ${
                    speechRecognitionModel === "gemini-3-flash-preview"
                      ? "bg-white/10 border border-white/20"
                      : "bg-black/30 border border-white/5 hover:bg-white/5"
                  }`}
                  onClick={() => setSpeechRecognitionModel("gemini-3-flash-preview")}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        speechRecognitionModel === "gemini-3-flash-preview" ? "bg-white" : "bg-white/20"
                      }`}
                    />
                    <div>
                      <p className="font-medium text-white text-xs">Gemini 3 Flash (Preview)</p>
                      <p className="text-xs text-white/60">Latest preview model with audio understanding</p>
                    </div>
                  </div>
                </div>
                <div
                  className={`p-2 rounded-lg cursor-pointer transition-colors ${
                    speechRecognitionModel === "gemini-3-pro-preview"
                      ? "bg-white/10 border border-white/20"
                      : "bg-black/30 border border-white/5 hover:bg-white/5"
                  }`}
                  onClick={() => setSpeechRecognitionModel("gemini-3-pro-preview")}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        speechRecognitionModel === "gemini-3-pro-preview" ? "bg-white" : "bg-white/20"
                      }`}
                    />
                    <div>
                      <p className="font-medium text-white text-xs">Gemini 3 Pro (Preview)</p>
                      <p className="text-xs text-white/60">Best accuracy with audio understanding</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-black/30 border border-white/10">
                <p className="text-sm text-white/70">
                  Speech recognition is only supported with OpenAI or Gemini. Please switch to one of these providers to use this feature.
                </p>
              </div>
            )}
          </div>
          
          {/* Candidate Profile Section */}
          <div className="space-y-4 mt-6 border-t border-white/10 pt-4">
            <div>
              <label className="text-sm font-medium text-white mb-1 block">
                Candidate Profile
              </label>
              <p className="text-xs text-white/60 mb-3">
                Add your resume and details to get more personalized AI answer suggestions during interviews.
              </p>
              <CandidateProfileSection
                profile={candidateProfile}
                onProfileChange={setCandidateProfile}
              />
            </div>
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
            disabled={isLoading || !apiKey}
          >
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
