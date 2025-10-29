/**
 * Ollama Status Banner
 * Shows warning when Ollama is not running
 */

import { useState, useEffect } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';

export function OllamaStatusBanner() {
  const [ollamaStatus, setOllamaStatus] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkOllama = useAction(api.ollamaStatus.checkOllamaStatus);

  useEffect(() => {
    async function checkStatus() {
      try {
        const status = await checkOllama({});
        setOllamaStatus(status);
      } catch (error) {
        setOllamaStatus({ running: false, available: false });
      } finally {
        setChecking(false);
      }
    }

    checkStatus();
    // Check every 30 seconds
    const interval = setInterval(checkStatus, 30000);

    return () => clearInterval(interval);
  }, [checkOllama]);

  if (checking || dismissed || ollamaStatus?.running) {
    return null;
  }

  return (
    <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />

        <div className="flex-1">
          <h3 className="text-sm font-semibold text-yellow-300 mb-1">
            Ollama Not Running
          </h3>
          <p className="text-xs text-yellow-400/80 mb-2">
            Ollama MCP is configured but the Ollama service is not accessible at{' '}
            <code className="bg-black/30 px-1 py-0.5 rounded">
              http://127.0.0.1:11434
            </code>
          </p>

          <div className="space-y-2">
            <p className="text-xs text-yellow-300 font-medium">To enable Ollama testing:</p>
            <ol className="text-xs text-yellow-400/80 space-y-1 ml-4 list-decimal">
              <li>
                Install Ollama:{' '}
                <a
                  href="https://ollama.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-300 hover:text-yellow-200 underline inline-flex items-center gap-1"
                >
                  ollama.com
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Start Ollama: <code className="bg-black/30 px-1 py-0.5 rounded">ollama serve</code>
              </li>
              <li>
                Pull a model: <code className="bg-black/30 px-1 py-0.5 rounded">ollama pull llama3.2:3b</code>
              </li>
            </ol>

            <p className="text-xs text-yellow-500 italic mt-2">
              Without Ollama running, agents with "ollama:" models will not work.
            </p>
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="text-yellow-400 hover:text-yellow-300 text-xs"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/**
 * Compact Ollama Status Indicator
 * Shows in header or sidebar
 */
export function OllamaStatusIndicator() {
  const [ollamaStatus, setOllamaStatus] = useState<any>(null);
  const checkOllama = useAction(api.ollamaStatus.checkOllamaStatus);

  useEffect(() => {
    async function checkStatus() {
      try {
        const status = await checkOllama({});
        setOllamaStatus(status);
      } catch (error) {
        setOllamaStatus({ running: false });
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [checkOllama]);

  if (!ollamaStatus) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      {ollamaStatus.running ? (
        <>
          <CheckCircle className="w-3 h-3 text-green-400" />
          <span className="text-green-400">
            Ollama ({ollamaStatus.modelCount || 0} models)
          </span>
        </>
      ) : (
        <>
          <AlertCircle className="w-3 h-3 text-yellow-400" />
          <span className="text-yellow-400">Ollama offline</span>
        </>
      )}
    </div>
  );
}
