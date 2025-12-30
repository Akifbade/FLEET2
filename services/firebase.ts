
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, doc, setDoc, query, orderBy } from "firebase/firestore";

/**
 * PRODUCTION SETUP:
 * Connected to project: driverapp-b28b3
 */
const firebaseConfig = {
  apiKey: "AIzaSyAJPjdV7cbXlycEboCs2BkE05_pVWs1ksQ",
  authDomain: "driverapp-b28b3.firebaseapp.com",
  projectId: "driverapp-b28b3",
  storageBucket: "driverapp-b28b3.firebasestorage.app",
  messagingSenderId: "843088510264",
  appId: "1:843088510264:web:342a52142697f8fb75d5cd",
  measurementId: "G-9DX0CK1TEW"
};

// Check if project has been configured by the user
export const isConfigured = firebaseConfig.projectId !== "YOUR_PROJECT_ID";

let app;
let db: any = null;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (err) {
  console.error("Firebase Initialization Error:", err);
}

export { db };

// Helper to convert File to Base64 for database storage ("code base image")
// This saves the invoice image directly as a string in your Firestore document
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
