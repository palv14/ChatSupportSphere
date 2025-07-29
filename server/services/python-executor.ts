import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface PythonExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  executionTime: number;
}

export class PythonExecutor {
  private pythonPath: string;
  private scriptPath: string;
  private uploadsDir: string;

  constructor(scriptPath: string = 'python/python_script.py') {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.scriptPath = path.resolve(scriptPath);
    this.uploadsDir = path.resolve('uploads');
    
    // Debug logging
    console.log('[DEBUG] PythonExecutor initialized with:', {
      pythonPath: this.pythonPath,
      scriptPath: this.scriptPath,
      uploadsDir: this.uploadsDir,
      PYTHON_PATH_ENV: process.env.PYTHON_PATH
    });
  }

  // Validate and sanitize file paths
  private validateFilePath(filePath: string): boolean {
    const resolvedPath = path.resolve(filePath);
    return resolvedPath.startsWith(this.uploadsDir) && 
           !resolvedPath.includes('..') && 
           fs.existsSync(resolvedPath);
  }

  async executePythonScript(
    message: string,
    files: Array<{ path: string; originalName: string; mimetype: string }> = [],
    sessionId: string
  ): Promise<PythonExecutionResult> {
    const startTime = Date.now();

    console.log('[DEBUG] Starting Python script execution:', {
      message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      filesCount: files.length,
      sessionId,
      pythonPath: this.pythonPath,
      scriptPath: this.scriptPath
    });

    try {
      // Check if Python script exists
      if (!fs.existsSync(this.scriptPath)) {
        console.error('[ERROR] Python script not found at:', this.scriptPath);
        return {
          success: false,
          error: `Python script not found at ${this.scriptPath}`,
          executionTime: Date.now() - startTime
        };
      }

      // Validate all file paths
      for (const file of files) {
        if (!this.validateFilePath(file.path)) {
          return {
            success: false,
            error: `Invalid file path: ${file.path}`,
            executionTime: Date.now() - startTime
          };
        }
      }

      // Prepare input data for Python script
      const inputData = {
        message,
        files: files.map(file => ({
          path: file.path,
          originalName: file.originalName,
          mimetype: file.mimetype
        })),
        sessionId,
        timestamp: new Date().toISOString()
      };

      return new Promise((resolve) => {
        console.log('[DEBUG] Spawning Python process with command:', `${this.pythonPath} ${this.scriptPath}`);
        
        // Set up environment with PYTHONPATH for Azure
        const env = { ...process.env };
        if (process.env.NODE_ENV === 'production') {
          env.PYTHONPATH = '/home/site/wwwroot/.python_packages/lib/site-packages:' + (env.PYTHONPATH || '');
        }
        
        console.log('[DEBUG] Python environment:', {
          PYTHONPATH: env.PYTHONPATH,
          NODE_ENV: env.NODE_ENV
        });
        
        const pythonProcess = spawn(this.pythonPath, [this.scriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: env
        });

        let outputData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
          const dataStr = data.toString();
          console.log('[DEBUG] Python stdout:', dataStr);
          outputData += dataStr;
        });

        pythonProcess.stderr.on('data', (data) => {
          const dataStr = data.toString();
          console.log('[DEBUG] Python stderr:', dataStr);
          errorData += dataStr;
        });

        pythonProcess.on('close', (code) => {
          const executionTime = Date.now() - startTime;

          if (code !== 0) {
            resolve({
              success: false,
              error: errorData || `Python script exited with code ${code}`,
              executionTime
            });
            return;
          }

          try {
            // Try to parse JSON output
            const output = JSON.parse(outputData.trim());
            resolve({
              success: true,
              output,
              executionTime
            });
          } catch (parseError) {
            // If not JSON, return raw output
            resolve({
              success: true,
              output: { response: outputData.trim() },
              executionTime
            });
          }
        });

        pythonProcess.on('error', (error) => {
          resolve({
            success: false,
            error: `Failed to execute Python script: ${error.message}`,
            executionTime: Date.now() - startTime
          });
        });

        // Send input data to Python script
        pythonProcess.stdin.write(JSON.stringify(inputData));
        pythonProcess.stdin.end();

        // Set timeout
        setTimeout(() => {
          pythonProcess.kill('SIGTERM');
          resolve({
            success: false,
            error: 'Python script execution timeout (30s)',
            executionTime: Date.now() - startTime
          });
        }, 30000);
      });

    } catch (error) {
      return {
        success: false,
        error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime: Date.now() - startTime
      };
    }
  }
}

export const pythonExecutor = new PythonExecutor();
