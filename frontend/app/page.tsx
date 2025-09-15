'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

// --- Type Definitions ---
type Slot = {
  slotId: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked';
};

// --- Date & Time Utilities ---
const getWeekDates = (viewDate: Date): Date[] => {
  const startOfWeek = new Date(viewDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  startOfWeek.setDate(diff);

  return Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    return date;
  });
};

const generateTimeIntervals = (startHour: number, endHour: number, intervalMinutes: number): string[] => {
  const times: string[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      times.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
  }
  return times;
};

// --- Calendar Components ---
const CalendarView = ({ slots }: { slots: Slot[] }) => {
  const [viewDate, setViewDate] = useState(new Date());

  const weekDates = useMemo(() => getWeekDates(viewDate), [viewDate]);
  const timeIntervals = useMemo(() => generateTimeIntervals(9, 18, 30), []);

  const slotsMap = useMemo(() => {
    const map = new Map<string, Slot>();
    for (const slot of slots) {
      map.set(new Date(slot.startTime).toISOString(), slot);
    }
    return map;
  }, [slots]);

  const changeWeek = (direction: 'next' | 'prev') => {
    setViewDate(current => {
      const newDate = new Date(current);
      newDate.setDate(current.getDate() + (direction === 'next' ? 7 : -7));
      return newDate;
    });
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
      {/* Calendar Controls */}
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => changeWeek('prev')} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">‹ Prev</button>
        <h3 className="text-lg sm:text-xl font-semibold">
          {weekDates[0].toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} - {weekDates[6].toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
        </h3>
        <button onClick={() => changeWeek('next')} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Next ›</button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_repeat(7,1fr)] gap-1">
        {/* Time Gutter */}
        <div className="col-start-1"></div>
        {/* Day Headers */}
        {weekDates.map(date => (
          <div key={date.toISOString()} className="text-center font-semibold py-2">
            <div className="text-sm sm:text-base">{date.toLocaleDateString(undefined, { weekday: 'short' })}</div>
            <div className="text-lg sm:text-2xl">{date.getDate()}</div>
          </div>
        ))}

        {/* Time Slots */}
        {timeIntervals.map(time => (
          <div key={time} className="grid grid-cols-subgrid col-span-full -mt-px">
            <div className="text-right text-xs pr-2 text-gray-500 relative -top-2">{time}</div>
            {weekDates.map(day => {
              const slotDate = new Date(day);
              const [hour, minute] = time.split(':').map(Number);
              slotDate.setHours(hour, minute, 0, 0);
              const slotISO = slotDate.toISOString();
              const slot = slotsMap.get(slotISO);

              return (
                <div key={day.toISOString() + time} className="h-12 border-t border-gray-200 bg-gray-50">
                  {slot && (
                    <div className="bg-blue-500 text-white text-xs rounded-md p-1 m-1 h-full flex items-center justify-center cursor-pointer hover:bg-blue-600">
                      {time}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Main Page Component ---
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
      await fetchSlots();
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

        {isLoading ? (
          <div className="text-center"><p>Loading your schedule...</p></div>
        ) : error ? (
          <div className="text-center text-red-500"><p>{error}</p></div>
        ) : (
          <CalendarView slots={slots} />
        )}
      </div>
    </main>
  );
}
