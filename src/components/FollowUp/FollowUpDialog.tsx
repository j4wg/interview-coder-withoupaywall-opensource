import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Search, Loader2, X } from "lucide-react";
import { useToast } from "../../contexts/toast";

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solutionContext?: string;
}

export function FollowUpDialog({ open, onOpenChange, solutionContext }: FollowUpDialogProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Clear response when dialog closes
  useEffect(() => {
    if (!open) {
      setResponse("");
      setQuery("");
    }
  }, [open]);

  const handleSearch = async () => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setResponse("");

    try {
      const result = await window.electronAPI.sendFollowUpQuery(query.trim(), solutionContext || "");
      setResponse(result);
    } catch (error) {
      console.error("Error sending follow-up query:", error);
      showToast("Error", "Failed to process follow-up query. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const clearResponse = () => {
    setResponse("");
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="followup-dialog w-[90vw] max-w-3xl h-[70vh] flex flex-col bg-transparent border-0 shadow-none">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-white">Follow-up Search</DialogTitle>
              <DialogDescription className="text-gray-300">
                Ask questions about the current solution or search for related information.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearResponse}
                disabled={!response && !query}
                className="text-xs bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                Clear
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="p-1 bg-transparent hover:bg-gray-800 text-gray-300"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Search Input */}
        <div className="flex-shrink-0 flex gap-2 mb-4">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a follow-up question about the solution..."
            disabled={isLoading}
            className="flex-1 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
          />
          <Button
            onClick={handleSearch}
            disabled={!query.trim() || isLoading}
            className="px-4 bg-blue-600 hover:bg-blue-700 text-white border-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Response Area */}
        <div className="flex-1 overflow-y-auto border border-gray-600 rounded-lg p-4 bg-transparent">
          {!response && !isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p className="text-lg font-medium mb-2 text-white">Search for follow-up information</p>
                <p className="text-sm text-gray-400">Ask questions about the current solution or search for related topics</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    <span className="text-gray-400">Searching...</span>
                  </div>
                </div>
              )}
              
              {response && (
                <div className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-3">
                  <div className="whitespace-pre-wrap text-white">{response}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
