import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { app, db } from './firebase';

const auth = getAuth(app);
const AuthContext = createContext();

// This is the hook we use in other files (like WorkoutEngine) to get the user
export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null); // Stores their Firestore profile (role, points, etc.)
  const [loading, setLoading] = useState(true);

// 1. REGISTER FUNCTION
const register = async (email, password, firstName, lastName, course, section) => {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
  const user = userCredential.user;

  // Auto-assign admin role to you
  const assignedRole =
    email.toLowerCase() === 'scott.scalici@uticak12.org'
      ? 'admin'
      : 'student';

  const userProfile = {
    uid: user.uid,
    email: user.email,
    firstName: firstName,
    lastName: lastName,
    role: assignedRole,
    course: course || 's2',   // e.g., 's2' or 's4'
    section: section || 'NA', // e.g., '4A' or '3B'
    highest_pod_reached: 0,
    current_path_points: 0,
    created_at: new Date().toISOString(),
  };

  await setDoc(doc(db, 'users', user.uid), userProfile);
  setUserData(userProfile);
  return user;
};

  // 2. LOGIN FUNCTION
  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // 3. LOGOUT FUNCTION
  const logout = () => {
    return signOut(auth);
  };

  // 4. PASSWORD RESET
  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  // 5. MASTER LISTENER (Fires every time the app loads or user logs in/out)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        // Fetch their specific role and grade data from Firestore
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      } else {
        setUserData(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    login,
    register,
    logout,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
