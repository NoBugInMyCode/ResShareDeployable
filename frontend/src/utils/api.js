// Use environment variable if available, otherwise fallback to localhost for development
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// Helper function to handle API responses
const handleResponse = async (response) => {
  const data = await response.json();
  
  if (!response.ok) {
    console.log("Response not ok", data);
    throw new Error(data.message || data.result || 'API request failed');
  }
  
  return data;
};

// Authentication APIs
export const authAPI = {
  login: async (username, password) => {
    console.log("Sending login request to", `${API_BASE_URL}/login`);
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    
    return handleResponse(response);
  },

  signup: async (username, password) => {
    const response = await fetch(`${API_BASE_URL}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    console.log("Signup response", response);
    return handleResponse(response);
  },

  logout: async () => {
    const response = await fetch(`${API_BASE_URL}/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    
    return handleResponse(response);
  },

  deleteUser: async (password) => {
    const response = await fetch(`${API_BASE_URL}/delete-user`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });
    
    return handleResponse(response);
  },
};

// File and Folder APIs
export const fileAPI = {
  createFolder: async (folderPath) => {
    const response = await fetch(`${API_BASE_URL}/create-folder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ folder_path: folderPath }),
    });
    
    return handleResponse(response);
  },

  uploadFile: async (file, path, skipAiProcessing = false) => {
    console.log('[API] uploadFile called with:', { path, skipAiProcessing, filename: file?.name, size: file?.size });
    const sizeValidation = utils.validateFileSize(file, 1); // 1 MB limit
    if (!sizeValidation.isValid) {
      throw new Error(sizeValidation.error);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path || '');
    formData.append('skip_ai_processing', skipAiProcessing.toString());
    console.log('[API] FormData prepared skip_ai_processing=', skipAiProcessing.toString());

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const data = await handleResponse(response);
    console.log('[API] Upload response received:', data);
    return data;
  },

  downloadFile: async (path, isShared = false) => {
    const response = await fetch(`${API_BASE_URL}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ path, is_shared: isShared }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Download failed');
    }
    
    return response;
  },

  deleteItem: async (nodePath, deleteInRoot) => {
    const response = await fetch(`${API_BASE_URL}/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ node_path: nodePath, delete_in_root: deleteInRoot }),
    });
    
    return handleResponse(response);
  },

  shareItem: async (targetUsername, node) => {
    const response = await fetch(`${API_BASE_URL}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        target: targetUsername,
        node: typeof node === 'string' ? node : JSON.stringify(node),
      }),
    });
    
    return handleResponse(response);
  },
};

export const chatAPI = {
  sendMessage: async (query) => {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ query }),
    });
    
    return handleResponse(response);
  },

  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/chat/stats`, {
      method: 'GET',
      credentials: 'include',
    });
    
    return handleResponse(response);
  },
};

export const utils = {
  formatFileSize: (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  getFileExtension: (filename) => {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  },

  validateFileSize: (file, maxSizeMB = 1) => {
    return { isValid: true, error: null };
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        isValid: false,
        error: `File size (${utils.formatFileSize(file.size)}) exceeds the maximum limit of ${maxSizeMB} MB`
      };
    }
    return { isValid: true, error: null };
  },

  getFileIcon: (filename, isFolder) => {
    if (isFolder) return 'folder';
    
    const extension = utils.getFileExtension(filename).toLowerCase();
    
    const iconMap = {
      // Images
      jpg: 'image',
      jpeg: 'image',
      png: 'image',
      gif: 'image',
      bmp: 'image',
      svg: 'image',
      webp: 'image',
      
      // Documents
      pdf: 'pdf',
      doc: 'document',
      docx: 'document',
      txt: 'text',
      rtf: 'document',
      
      // Spreadsheets
      xls: 'spreadsheet',
      xlsx: 'spreadsheet',
      csv: 'spreadsheet',
      
      // Presentations
      ppt: 'presentation',
      pptx: 'presentation',
      
      // Archives
      zip: 'archive',
      rar: 'archive',
      '7z': 'archive',
      tar: 'archive',
      gz: 'archive',
      
      // Code
      js: 'code',
      jsx: 'code',
      ts: 'code',
      tsx: 'code',
      html: 'code',
      css: 'code',
      scss: 'code',
      py: 'code',
      java: 'code',
      cpp: 'code',
      c: 'code',
      php: 'code',
      rb: 'code',
      go: 'code',
      rs: 'code',
      
      // Audio
      mp3: 'audio',
      wav: 'audio',
      flac: 'audio',
      aac: 'audio',
      ogg: 'audio',
      
      // Video
      mp4: 'video',
      avi: 'video',
      mkv: 'video',
      mov: 'video',
      wmv: 'video',
      flv: 'video',
      webm: 'video',
    };
    
    return iconMap[extension] || 'file';
  },

  downloadBlob: (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  validateFileName: (name) => {
    const invalidChars = /[<>:"/\\|?*]/g;
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    
    if (!name || name.trim() === '') {
      return 'Name cannot be empty';
    }
    
    if (name.length > 255) {
      return 'Name is too long (max 255 characters)';
    }
    
    if (invalidChars.test(name)) {
      return 'Name contains invalid characters';
    }
    
    if (reservedNames.test(name)) {
      return 'Name is reserved by the system';
    }
    
    if (name.startsWith('.') || name.endsWith('.')) {
      return 'Name cannot start or end with a dot';
    }
    
    return null; // Valid name
  },

  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  throttle: (func, limit) => {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },
};

export default {
  authAPI,
  fileAPI,
  utils,
}; 