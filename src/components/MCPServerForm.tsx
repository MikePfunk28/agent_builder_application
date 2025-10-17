import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { X, Plus, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface MCPServerFormProps {
  server?: {
    _id: Id<"mcpServers">;
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    disabled: boolean;
    timeout?: number;
  } | null;
  onClose: () => void;
}

interface EnvVar {
  key: string;
  value: string;
}

export function MCPServerForm({ server, onClose }: MCPServerFormProps) {
  const [name, setName] = useState(server?.name || '');
  const [command, setCommand] = useState(server?.command || '');
  const [argsText, setArgsText] = useState(server?.args.join(' ') || '');
  const [envVars, setEnvVars] = useState<EnvVar[]>(() => {
    if (server?.env) {
      return Object.entries(server.env).map(([key, value]) => ({ key, value }));
    }
    return [];
  });
  const [disabled, setDisabled] = useState(server?.disabled || false);
  const [timeout, setTimeout] = useState(server?.timeout?.toString() || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addServer = useMutation(api.mcpConfig.addMCPServer);
  const updateServer = useMutation(api.mcpConfig.updateMCPServer);

  const isEditMode = !!server;

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVars];
    updated[index][field] = value;
    setEnvVars(updated);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate name
    if (!name.trim()) {
      newErrors.name = 'Server name is required';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      newErrors.name = 'Name must contain only alphanumeric characters, hyphens, and underscores';
    }

    // Validate command
    if (!command.trim()) {
      newErrors.command = 'Command is required';
    }

    // Validate timeout
    if (timeout && (isNaN(Number(timeout)) || Number(timeout) <= 0)) {
      newErrors.timeout = 'Timeout must be a positive number';
    }

    // Validate env vars
    const envKeys = new Set<string>();
    envVars.forEach((envVar, index) => {
      if (envVar.key.trim()) {
        if (envKeys.has(envVar.key)) {
          newErrors[`env_${index}`] = 'Duplicate environment variable key';
        }
        envKeys.add(envVar.key);
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    void (async () => {
      try {
        // Parse args
        const args = argsText
          .trim()
          .split(/\s+/)
          .filter(arg => arg.length > 0);

        // Build env object
        const env: Record<string, string> = {};
        envVars.forEach(({ key, value }) => {
          if (key.trim()) {
            env[key.trim()] = value;
          }
        });

        if (isEditMode) {
          // Update existing server
          await updateServer({
            serverId: server._id,
            updates: {
              name: name.trim(),
              command: command.trim(),
              args,
              env: Object.keys(env).length > 0 ? env : undefined,
              disabled,
              timeout: timeout ? Number(timeout) : undefined,
            },
          });
          toast.success('MCP server updated successfully');
        } else {
          // Add new server
          await addServer({
            name: name.trim(),
            command: command.trim(),
            args,
            env: Object.keys(env).length > 0 ? env : undefined,
            disabled,
            timeout: timeout ? Number(timeout) : undefined,
          });
          toast.success('MCP server added successfully');
        }

        onClose();
      } catch (error: any) {
        toast.error(error.message || 'Failed to save MCP server');
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-green-400">
          {isEditMode ? 'Edit MCP Server' : 'Add MCP Server'}
        </h3>
        <button
          onClick={onClose}
          className="p-2 text-green-600 hover:text-green-400 hover:bg-green-900/20 rounded-md transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Server Name */}
        <div>
          <label className="block text-sm font-medium text-green-400 mb-2">
            Server Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="aws-diagram-mcp-server"
            className={`w-full px-4 py-2 bg-black border rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors ${
              errors.name ? 'border-red-500' : 'border-green-900/30'
            }`}
          />
          {errors.name && (
            <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
              <AlertCircle className="w-3 h-3" />
              {errors.name}
            </div>
          )}
          <p className="text-xs text-green-600 mt-1">
            Alphanumeric characters, hyphens, and underscores only
          </p>
        </div>

        {/* Command */}
        <div>
          <label className="block text-sm font-medium text-green-400 mb-2">
            Command *
          </label>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="uvx"
            className={`w-full px-4 py-2 bg-black border rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors ${
              errors.command ? 'border-red-500' : 'border-green-900/30'
            }`}
          />
          {errors.command && (
            <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
              <AlertCircle className="w-3 h-3" />
              {errors.command}
            </div>
          )}
          <p className="text-xs text-green-600 mt-1">
            The executable command to run the MCP server
          </p>
        </div>

        {/* Arguments */}
        <div>
          <label className="block text-sm font-medium text-green-400 mb-2">
            Arguments
          </label>
          <input
            type="text"
            value={argsText}
            onChange={(e) => setArgsText(e.target.value)}
            placeholder="awslabs.aws-diagram-mcp-server@latest"
            className="w-full px-4 py-2 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors"
          />
          <p className="text-xs text-green-600 mt-1">
            Space-separated command arguments
          </p>
        </div>

        {/* Environment Variables */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-green-400">
              Environment Variables
            </label>
            <button
              type="button"
              onClick={addEnvVar}
              className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add Variable
            </button>
          </div>

          {envVars.length === 0 ? (
            <div className="text-sm text-green-600 italic">
              No environment variables configured
            </div>
          ) : (
            <div className="space-y-2">
              {envVars.map((envVar, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={envVar.key}
                    onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                    placeholder="KEY"
                    className={`flex-1 px-3 py-2 bg-black border rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors text-sm ${
                      errors[`env_${index}`] ? 'border-red-500' : 'border-green-900/30'
                    }`}
                  />
                  <input
                    type="text"
                    value={envVar.value}
                    onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                    placeholder="value"
                    className="flex-1 px-3 py-2 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeEnvVar(index)}
                    className="p-2 text-red-600 hover:text-red-400 hover:bg-red-900/20 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeout */}
        <div>
          <label className="block text-sm font-medium text-green-400 mb-2">
            Timeout (ms)
          </label>
          <input
            type="number"
            value={timeout}
            onChange={(e) => setTimeout(e.target.value)}
            placeholder="30000"
            min="0"
            className={`w-full px-4 py-2 bg-black border rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors ${
              errors.timeout ? 'border-red-500' : 'border-green-900/30'
            }`}
          />
          {errors.timeout && (
            <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
              <AlertCircle className="w-3 h-3" />
              {errors.timeout}
            </div>
          )}
          <p className="text-xs text-green-600 mt-1">
            Maximum time to wait for server responses (optional)
          </p>
        </div>

        {/* Disabled Checkbox */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={disabled}
              onChange={(e) => setDisabled(e.target.checked)}
              className="w-4 h-4 rounded border-green-900/30 text-green-600 focus:ring-green-500 focus:ring-offset-0 bg-black"
            />
            <span className="text-sm text-green-400">
              Disable this server (keep configuration but don't connect)
            </span>
          </label>
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 pt-4 border-t border-green-900/30">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </span>
            ) : (
              <span>{isEditMode ? 'Update Server' : 'Add Server'}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
