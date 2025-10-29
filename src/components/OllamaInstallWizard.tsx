/**
 * Ollama Installation Wizard
 * Guides users through downloading and installing Ollama
 */

import { useState, useEffect } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Download, CheckCircle, ExternalLink, Terminal, Loader2 } from 'lucide-react';

interface OllamaInstallWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

export function OllamaInstallWizard({ onClose, onComplete }: OllamaInstallWizardProps) {
  const [step, setStep] = useState<'detect' | 'download' | 'install' | 'models' | 'complete'>('detect');
  const [platform, setPlatform] = useState<'windows' | 'macos' | 'linux'>('windows');
  const [selectedModel, setSelectedModel] = useState('llama3.2:3b');
  const [installerInfo, setInstallerInfo] = useState<any>(null);
  const [recommendedModels, setRecommendedModels] = useState<any[]>([]);

  const getInstaller = useAction(api.ollamaInstaller.getInstallerInfo);
  const getModels = useAction(api.ollamaInstaller.getRecommendedModels);
  const checkStatus = useAction(api.ollamaStatus.checkOllamaStatus);

  useEffect(() => {
    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) setPlatform('windows');
    else if (userAgent.includes('mac')) setPlatform('macos');
    else setPlatform('linux');
  }, []);

  useEffect(() => {
    async function loadInfo() {
      const info = await getInstaller({ platform });
      setInstallerInfo(info);

      const models = await getModels({});
      setRecommendedModels(models);
    }
    loadInfo();
  }, [platform, getInstaller, getModels]);

  const handleDownload = () => {
    if (installerInfo?.url) {
      window.open(installerInfo.url, '_blank');
      setStep('install');
    }
  };

  const handleCheckInstallation = async () => {
    const status = await checkStatus({});
    if (status.running) {
      setStep('models');
    } else {
      alert('Ollama not detected yet. Please complete installation and try again.');
    }
  };

  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-green-900/30 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-green-900/30">
          <h2 className="text-2xl font-bold text-green-400">Install Ollama</h2>
          <p className="text-sm text-green-600 mt-1">
            Set up local AI models for free agent testing
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'detect' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
                <span className="text-green-300">Detecting your platform...</span>
              </div>
              <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-4">
                <p className="text-green-300 font-medium">Platform: {platform}</p>
              </div>
              <button
                onClick={() => setStep('download')}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'download' && installerInfo && (
            <div className="space-y-4">
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
                <h3 className="font-semibold text-blue-300 mb-2">Step 1: Download Ollama</h3>
                <p className="text-sm text-blue-400 mb-4">
                  We'll download the Ollama installer for {platform}
                </p>
                <div className="space-y-2 text-sm text-blue-300">
                  <p>• File: {installerInfo.filename}</p>
                  <p>• Size: {installerInfo.size}</p>
                </div>
              </div>

              <button
                onClick={handleDownload}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Ollama
              </button>

              <div className="text-center">
                <a
                  href="https://ollama.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-400 hover:text-green-300 inline-flex items-center gap-1"
                >
                  Visit ollama.com
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {step === 'install' && installerInfo && (
            <div className="space-y-4">
              <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-4">
                <h3 className="font-semibold text-purple-300 mb-3">Step 2: Install Ollama</h3>
                <ol className="space-y-2 text-sm text-purple-400 list-decimal ml-4">
                  {installerInfo.instructions.map((instruction: string, i: number) => (
                    <li key={i}>{instruction}</li>
                  ))}
                </ol>
              </div>

              {platform === 'linux' && installerInfo.command && (
                <div className="bg-black border border-green-900/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-green-400 font-mono">Terminal Command</span>
                    <button
                      onClick={() => handleCopyCommand(installerInfo.command)}
                      className="text-xs text-green-400 hover:text-green-300"
                    >
                      Copy
                    </button>
                  </div>
                  <code className="text-sm text-green-300 font-mono">
                    {installerInfo.command}
                  </code>
                </div>
              )}

              <button
                onClick={handleCheckInstallation}
                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                I've Installed Ollama - Check Status
              </button>
            </div>
          )}

          {step === 'models' && (
            <div className="space-y-4">
              <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-4">
                <h3 className="font-semibold text-green-300 mb-2">
                  <CheckCircle className="w-5 h-5 inline mr-2" />
                  Ollama Installed Successfully!
                </h3>
                <p className="text-sm text-green-400">
                  Now let's download a model to use for testing
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-green-300">Recommended Models:</h4>
                {recommendedModels.filter(m => m.recommended).map((model) => (
                  <div
                    key={model.name}
                    onClick={() => setSelectedModel(model.name)}
                    className={`cursor-pointer p-4 rounded-lg border transition-colors ${
                      selectedModel === model.name
                        ? 'bg-green-900/30 border-green-500'
                        : 'bg-gray-800 border-green-900/30 hover:border-green-700/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-green-300">{model.name}</span>
                      <span className="text-xs text-green-600">{model.size}</span>
                    </div>
                    <p className="text-xs text-green-400 mb-2">{model.description}</p>
                    <div className="flex gap-4 text-xs text-green-500">
                      <span>RAM: {model.ram}</span>
                      <span>Speed: {model.speed}</span>
                      <span>Quality: {model.quality}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-black border border-green-900/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-green-400 font-mono flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    Run this command:
                  </span>
                  <button
                    onClick={() => {
                      const model = recommendedModels.find(m => m.name === selectedModel);
                      if (model) handleCopyCommand(model.command);
                    }}
                    className="text-xs text-green-400 hover:text-green-300"
                  >
                    Copy
                  </button>
                </div>
                <code className="text-sm text-green-300 font-mono">
                  ollama pull {selectedModel}
                </code>
              </div>

              <button
                onClick={() => {
                  setStep('complete');
                  setTimeout(onComplete, 1000);
                }}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Complete Setup
              </button>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center space-y-4 py-8">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
              <h3 className="text-xl font-bold text-green-300">All Done!</h3>
              <p className="text-green-400">
                Ollama is ready to use for local agent testing
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Start Testing
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'complete' && (
          <div className="p-4 border-t border-green-900/30 flex justify-between">
            <button
              onClick={onClose}
              className="text-sm text-green-600 hover:text-green-400"
            >
              Cancel
            </button>
            <div className="text-xs text-green-600">
              Step {step === 'detect' ? 1 : step === 'download' ? 1 : step === 'install' ? 2 : 3} of 3
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
