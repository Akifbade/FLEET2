import Parse from 'parse';

/**
 * Parse Server Configuration
 * Connected to self-hosted Parse Server on VPS
 */

const PARSE_APP_ID = 'QGO_FLEET_APP_ID';
const PARSE_JS_KEY = 'QGO_MASTER_KEY_SECURE_2025';
const PARSE_SERVER_URL = 'http://148.230.107.155:1337/parse';

// Initialize Parse
Parse.initialize(PARSE_APP_ID, PARSE_JS_KEY);
Parse.serverURL = PARSE_SERVER_URL;

export { Parse };

// Helper: Convert Parse Object to plain JSON
export const parseToJSON = (parseObject: Parse.Object) => {
  return {
    id: parseObject.id,
    ...parseObject.toJSON()
  };
};

// Helper: Subscribe to real-time updates (similar to Firebase onSnapshot)
export const subscribeToCollection = async (
  className: string,
  callback: (data: any[]) => void,
  queryConstraints?: (query: Parse.Query) => Parse.Query
) => {
  const query = new Parse.Query(className);
  
  // Apply custom query constraints if provided
  if (queryConstraints) {
    queryConstraints(query);
  }

  // Initial fetch
  const results = await query.find();
  callback(results.map(parseToJSON));

  // Subscribe to live updates
  const subscription = await query.subscribe();

  subscription.on('create', (object: Parse.Object) => {
    query.find().then(results => callback(results.map(parseToJSON)));
  });

  subscription.on('update', (object: Parse.Object) => {
    query.find().then(results => callback(results.map(parseToJSON)));
  });

  subscription.on('delete', (object: Parse.Object) => {
    query.find().then(results => callback(results.map(parseToJSON)));
  });

  // Return unsubscribe function
  return () => subscription.unsubscribe();
};

// Helper: Add a new document
export const addDocument = async (className: string, data: any) => {
  const ParseClass = Parse.Object.extend(className);
  const newObject = new ParseClass();
  
  Object.keys(data).forEach(key => {
    if (key !== 'id') {
      newObject.set(key, data[key]);
    }
  });

  await newObject.save();
  return parseToJSON(newObject);
};

// Helper: Update a document
export const updateDocument = async (className: string, id: string, data: any) => {
  const query = new Parse.Query(className);
  const object = await query.get(id);
  
  Object.keys(data).forEach(key => {
    if (key !== 'id') {
      object.set(key, data[key]);
    }
  });

  await object.save();
  return parseToJSON(object);
};

// Helper: Delete a document
export const deleteDocument = async (className: string, id: string) => {
  const query = new Parse.Query(className);
  const object = await query.get(id);
  await object.destroy();
};

// Helper: Get a single document
export const getDocument = async (className: string, id: string) => {
  const query = new Parse.Query(className);
  const object = await query.get(id);
  return parseToJSON(object);
};

// Helper: Convert file to Base64 (same as Firebase)
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const isParseConfigured = true;
