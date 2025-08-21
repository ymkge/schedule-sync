'use client';

import axios from 'axios';

export default function Home() {

  const handleLogin = async () => {
    try {
      // Fetch the authorization URL from the backend
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/login`);
      const { authorization_url } = response.data;

      // Redirect the user to Google's authorization page
      if (authorization_url) {
        window.location.href = authorization_url;
      }
    } catch (error) {
      console.error('Error during login:', error);
      alert('Failed to initiate login. Check the console for details.');
    }
  };

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