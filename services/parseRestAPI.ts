/**
 * Parse Server REST API Client
 * Direct REST calls without Parse SDK (avoids Vite bundling issues)
 */

const PARSE_APP_ID = 'QGO_FLEET_APP_ID';
const PARSE_MASTER_KEY = 'QGO_MASTER_KEY_SECURE_2025';
const PARSE_SERVER_URL = import.meta.env.VITE_PARSE_SERVER_URL || 'https://qgocargo.cloud/parse';

const headers = {
  'X-Parse-Application-Id': PARSE_APP_ID,
  'X-Parse-Master-Key': PARSE_MASTER_KEY,
  'Content-Type': 'application/json'
};

export const isParseConfigured = true;

// Helper: Subscribe to collection (polling-based)
export const subscribeToCollection = (
  className: string,
  callback: (data: any[]) => void
) => {
  let isActive = true;
  
  const poll = async () => {
    if (!isActive) return;
    
    try {
      const response = await fetch(`${PARSE_SERVER_URL}/classes/${className}`, {
        method: 'GET',
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        callback(data.results.map((item: any) => ({
          id: item.objectId,
          ...item
        })));
      }
    } catch (error) {
      console.error('Parse REST API error:', error);
    }
    
    setTimeout(poll, 3000); // Poll every 3 seconds
  };
  
  poll();
  
  // Return unsubscribe function
  return () => { isActive = false; };
};

// Add document
export const addDocument = async (className: string, data: any) => {
  const response = await fetch(`${PARSE_SERVER_URL}/classes/${className}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to add document: ${response.statusText}`);
  }
  
  const result = await response.json();
  return { id: result.objectId, ...data };
};

// Update document
export const updateDocument = async (className: string, id: string, data: any) => {
  const response = await fetch(`${PARSE_SERVER_URL}/classes/${className}/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update document: ${response.statusText}`);
  }
  
  return { id, ...data };
};

// Delete document
export const deleteDocument = async (className: string, id: string) => {
  const response = await fetch(`${PARSE_SERVER_URL}/classes/${className}/${id}`, {
    method: 'DELETE',
    headers
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete document: ${response.statusText}`);
  }
};

// Get document
export const getDocument = async (className: string, id: string) => {
  const response = await fetch(`${PARSE_SERVER_URL}/classes/${className}/${id}`, {
    method: 'GET',
    headers
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get document: ${response.statusText}`);
  }
  
  const result = await response.json();
  return { id: result.objectId, ...result };
};

// Helper: Convert file to Base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

console.log('✅ Parse REST API configured:', PARSE_SERVER_URL);
