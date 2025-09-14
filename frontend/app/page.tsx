'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState(''); // Optional: to display user name

  useEffect(() => {
    // 1. Check for token in URL after redirect from Google login
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      // 2. If token is found, store it and update login state
      localStorage.setItem('jwt_token', token);
      setIsLoggedIn(true);
      // Optional: Clean the URL
      window.history.replaceState({}, document.title, "/");
    } else {
      // 3. If no token in URL, check if one already exists in storage
      const storedToken = localStorage.getItem('jwt_token');
      if (storedToken) {
        setIsLoggedIn(true);
      }
    }
  }, []); // The empty dependency array ensures this effect runs only once on mount

  const handleLogin = async () => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/login`);
      const { authorization_url } = response.data;
      if (authorization_url) {
        window.location.href = authorization_url;
      }
    } catch (error) {
      console.error('Error during login:', error);
      alert('Failed to initiate login. Check the console for details.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    setIsLoggedIn(false);
  };

  // Render different content based on login state
  if (isLoggedIn) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
        <div className="text-center p-8 bg-white shadow-lg rounded-xl">
          <h1 className="text-4xl font-bold mb-6 text-gray-800">Login Successful!</h1>
          <p className="text-lg mb-8 text-gray-600">Welcome to Schedule Sync.</p>
          {/* In a real app, you would have links to a dashboard or other pages here */}
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition duration-300 ease-in-out"
          >
            Logout
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="text-center p-8 bg-white shadow-lg rounded-xl">
        <h1 className="text-4xl font-bold mb-6 text-gray-800">Welcome to Schedule Sync</h1>
        <p className="text-lg mb-8 text-gray-600">Please log in with your Google account to continue.</p>
        <button
          onClick={handleLogin}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition duration-300 ease-in-out transform hover:-translate-y-1"
        >
          Login with Google
        </button>
      </div>
    </main>
  );
}
