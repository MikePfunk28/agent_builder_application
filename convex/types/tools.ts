/**
 * Type definitions for tool configurations
 * Provides type safety for tool management across the application
 */

export type ToolExtrasPip = 
  | "browser" 
  | "aws" 
  | "slack" 
  | "vision" 
  | "audio" 
  | "code_interpreter" 
  | "memory" 
  | "all";

export type ToolParameter = {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
};

export type ToolConfig = {
  name: string;
  type: string;
  config?: {
    description?: string;
    parameters?: ToolParameter[];
  };
  requiresPip?: boolean;
  pipPackages?: string[];
  extrasPip?: ToolExtrasPip;
  notSupportedOn?: string[];
};

/**
 * Validates if a string is a valid ToolExtrasPip value
 */
export function isValidExtrasPip(value: string): value is ToolExtrasPip {
  const validValues: ToolExtrasPip[] = [
    "browser", "aws", "slack", "vision", "audio", 
    "code_interpreter", "memory", "all"
  ];
  return validValues.includes(value as ToolExtrasPip);
}

/**
 * Validates tool configuration
 */
export function validateToolConfig(tool: any): tool is ToolConfig {
  if (!tool.name || typeof tool.name !== 'string') return false;
  if (!tool.type || typeof tool.type !== 'string') return false;
  
  if (tool.extrasPip && !isValidExtrasPip(tool.extrasPip)) {
    return false;
  }
  
  if (tool.pipPackages && !Array.isArray(tool.pipPackages)) {
    return false;
  }
  
  return true;
}
