'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// --- Type Definitions ---
type Slot = {
  slotId: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked';
};

type GroupedSlots = {
  [date: string]: Slot[];
};

// --- Helper Functions ---
const groupSlotsByDate = (slots: Slot[]): GroupedSlots => {
  return slots.reduce((acc, slot) => {
    const date = new Date(slot.startTime).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(slot);
    return acc;
  }, {} as GroupedSlots);
};

const formatTime = (dateString: string): string => {
  return new Date(dateString).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

// --- Main Component ---
export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSlots = useCallback(async () => {
    setIsLoading(true);
    setError('');
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/user/me/slots`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSlots(response.data.slots || []);
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      setError('Failed to load available slots. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const tokenInUrl = new URLSearchParams(window.location.search).get('token');
    let currentToken = localStorage.getItem('jwt_token');

    if (tokenInUrl) {
      localStorage.setItem('jwt_token', tokenInUrl);
      currentToken = tokenInUrl;
      window.history.replaceState({}, document.title, "/");
    }

    if (currentToken) {
      setIsLoggedIn(true);
      fetchSlots();
    } else {
      setIsLoading(false);
    }
  }, [fetchSlots]);

  const handleLogin = async () => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/login`);
      window.location.href = response.data.authorization_url;
    } catch (error) {
      console.error('Error during login:', error);
      alert('Failed to initiate login.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    setIsLoggedIn(false);
    setSlots([]);
    setSyncStatus('');
    setError('');
  };

  const handleSync = async () => {
    setSyncStatus('Synchronizing, please wait...');
    setError('');
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      setSyncStatus('Authentication error. Please log in again.');
      return;
    }

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/user/me/slots/generate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSyncStatus(response.data.message || 'Synchronization completed successfully!');
      await fetchSlots(); // Refresh slots after syncing
    } catch (err) {
      console.error('Error during calendar sync:', err);
      const errorMsg = axios.isAxiosError(err) && err.response ? err.response.data.detail : 'An unexpected error occurred.';
      setSyncStatus(`Error: ${errorMsg}`);
    }
  };

  if (!isLoggedIn) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-100">
        <div className="text-center p-8 bg-white shadow-2xl rounded-lg max-w-md w-full">
          <h1 className="text-4xl font-bold mb-4 text-gray-800">Welcome to Schedule Sync</h1>
          <p className="text-lg mb-8 text-gray-600">Log in with Google to sync your calendar and create shareable booking links.</p>
          <button
            onClick={handleLogin}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-transform transform hover:-translate-y-1 duration-300 ease-in-out"
          >
            Login with Google
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 text-gray-800">
      <header className="bg-white shadow-md">
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">Schedule Sync Dashboard</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
          >
            Logout
          </button>
        </nav>
      </header>

      <div className="container mx-auto p-6">
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <h2 className="text-2xl font-bold mb-4">Actions</h2>
          <button
            onClick={handleSync}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition duration-300 w-full"
          >
            Re-Sync Calendar
          </button>
          {syncStatus && (
            <p className="mt-4 text-md text-gray-700 bg-gray-100 p-3 rounded-lg">
              {syncStatus}
            </p>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Your Available Slots</h2>
          {isLoading ? (
            <p>Loading your schedule...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : slots.length > 0 ? (
            <div className="space-y-6">
              {Object.entries(groupSlotsByDate(slots)).map(([date, dateSlots]) => (
                <div key={date}>
                  <h3 className="text-lg font-semibold text-gray-700 border-b-2 border-gray-200 pb-2 mb-3">{date}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {dateSlots.map((slot) => (
                      <div key={slot.slotId} className="bg-blue-100 text-blue-800 text-center p-3 rounded-lg shadow-sm">
                        {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No available slots found. Try syncing your calendar!</p>
          )}
        </div>
      </div>
    </main>
  );
}