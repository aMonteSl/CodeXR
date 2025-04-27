/**
 * Status of the Python environment
 */
export enum PythonEnvironmentStatus {
  NOT_FOUND = 'not_found',
  FOUND = 'found',
  CREATED = 'created',
  ERROR = 'error'
}

/**
 * Status of a package installation
 */
export enum PackageStatus {
  NOT_INSTALLED = 'not_installed',
  INSTALLED = 'installed',
  INSTALLED_NOW = 'installed_now',
  ERROR = 'error'
}

/**
 * Represents information about the Python environment
 */
export interface PythonEnvironmentInfo {
  /** Path to the Python environment */
  path: string;
  /** Status of the environment */
  status: PythonEnvironmentStatus;
  /** Error message if applicable */
  error?: string;
  /** Path to the Python executable */
  pythonExecutable?: string;
  /** Path to the pip executable */
  pipExecutable?: string;
}

/**
 * Represents information about an installed package
 */
export interface PackageInfo {
  /** Name of the package */
  name: string;
  /** Status of the package */
  status: PackageStatus;
  /** Error message if applicable */
  error?: string;
  /** Version of the package if available */
  version?: string;
}