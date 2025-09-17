'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import Spinner from './components/Spinner';
import Alert from './components/Alert';

// --- Type Definitions ---
type Slot = {
  slotId: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked';
};

type UserSettings = {
  workingHours: {
    start: string;
    end: string;
  };
  slotDuration: number;
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
        <button onClick={() => changeWeek('prev')} className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">‹ Prev</button>
        <h3 className="text-base sm:text-xl font-semibold text-center mx-2 flex-grow">
          {weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </h3>
        <button onClick={() => changeWeek('next')} className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Next ›</button>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-1 min-w-[48rem]">
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
                      <div className={`text-white text-xs rounded-md p-1 m-1 h-full flex items-center justify-center ${slot.status === 'booked' ? 'bg-red-400' : 'bg-blue-500'}`}>
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
    </div>
  );
};

// --- Settings Component ---
const SettingsView = ({ onSave, initialSettings, isLoading, error, clearError }: { 
  onSave: (settings: UserSettings) => Promise<void>;
  initialSettings: UserSettings | null;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}) => {
  const [settings, setSettings] = useState<UserSettings | null>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const timeOptions = Array.from({ length: 24 * 2 }, (_, i) => {
    const hour = String(Math.floor(i / 2)).padStart(2, '0');
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour}:${minute}`;
  });

  const durationOptions = [15, 30, 45, 60];

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    await onSave(settings);
    setIsSaving(false);
  };

  if (isLoading) {
    return <div className="bg-white p-6 rounded-lg shadow-lg mb-6"><Spinner text="Loading settings..." /></div>;
  }

  if (!settings) {
    // This can happen if there was an error or still loading, handled above
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      
      {error && <Alert message={error} type="error" onClose={clearError} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Working Hours */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Working Hours</label>
          <div className="flex items-center gap-2">
            <select
              value={settings.workingHours.start}
              onChange={e => setSettings(s => ({ ...s!, workingHours: { ...s!.workingHours, start: e.target.value } }))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {timeOptions.map(time => <option key={`start-${time}`} value={time}>{time}</option>)}
            </select>
            <span className="text-gray-500">to</span>
            <select
              value={settings.workingHours.end}
              onChange={e => setSettings(s => ({ ...s!, workingHours: { ...s!.workingHours, end: e.target.value } }))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {timeOptions.map(time => <option key={`end-${time}`} value={time}>{time}</option>)}>
            </select>
          </div>
        </div>
        {/* Slot Duration */}
        <div>
          <label htmlFor="slotDuration" className="block text-sm font-medium text-gray-700 mb-2">Slot Duration</label>
          <select
            id="slotDuration"
            value={settings.slotDuration}
            onChange={e => setSettings(s => ({ ...s!, slotDuration: Number(e.target.value) }))}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {durationOptions.map(duration => <option key={duration} value={duration}>{duration} minutes</option>)}>
          </select>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition duration-300 disabled:bg-gray-400"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};


// --- Main Page Component ---
export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    setIsLoading(true);
    setError(null);
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

  const fetchSettings = useCallback(async () => {
    setIsSettingsLoading(true);
    setSettingsError(null);
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      setIsSettingsLoading(false);
      return;
    }
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/user/me/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSettings(response.data);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      setSettingsError('Failed to load your settings. Default values will be used.');
    } finally {
      setIsSettingsLoading(false);
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
      fetchSettings();
    } else {
      setIsLoading(false);
      setIsSettingsLoading(false);
    }
  }, [fetchSlots, fetchSettings]);

  const handleLogin = async () => {
    setLoginError(null);
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/login`);
      window.location.href = response.data.authorization_url;
    } catch (error) {
      console.error('Error during login:', error);
      setLoginError('Failed to initiate login. Please try again later.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    setIsLoggedIn(false);
    setSlots([]);
    setSyncStatus(null);
    setError(null);
    setSettings(null);
    setSettingsError(null);
  };

  const handleSaveSettings = async (newSettings: UserSettings) => {
    setSettingsError(null);
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      setSettingsError('Authentication error. Please log in again.');
      return;
    }
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/user/me/settings`, newSettings, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSettings(newSettings);
      setSyncStatus({ message: 'Settings saved successfully! You may need to re-sync to apply changes.', type: 'success' });
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSettingsError('Failed to save settings. Please try again.');
    }
  };

  const handleSync = async () => {
    setSyncStatus({ message: 'Synchronizing, please wait...', type: 'info' });
    setError(null);
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      setSyncStatus({ message: 'Authentication error. Please log in again.', type: 'error' });
      return;
    }
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/user/me/slots/generate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSyncStatus({ message: response.data.message || 'Synchronization completed successfully!', type: 'success' });
      await fetchSlots();
    } catch (err) {
      console.error('Error during calendar sync:', err);
      const errorMsg = axios.isAxiosError(err) && err.response ? err.response.data.detail : 'An unexpected error occurred.';
      setSyncStatus({ message: errorMsg, type: 'error' });
    }
  };

  if (isLoading && !isLoggedIn) {
      return <Spinner text="Loading login page..." />
  }

  if (!isLoggedIn) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-100">
        <div className="text-center p-8 bg-white shadow-2xl rounded-lg max-w-md w-full">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-800">Welcome to Schedule Sync</h1>
          <p className="text-lg mb-6 text-gray-600">Log in with Google to sync your calendar and create shareable booking links.</p>
          
          {loginError && <Alert message={loginError} type="error" onClose={() => setLoginError(null)} />}

          <button
            onClick={handleLogin}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-transform transform hover:-translate-y-1 duration-300 ease-in-out mt-4"
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
        <nav className="container mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-xl font-bold text-blue-600">Schedule Sync Dashboard</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300 w-full sm:w-auto"
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
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition duration-300 w-full sm:w-auto"
          >
            Re-Sync Calendar
          </button>
          
          {syncStatus && (
            <Alert message={syncStatus.message} type={syncStatus.type} onClose={() => setSyncStatus(null)} />
          )}
        </div>

        <SettingsView 
          onSave={handleSaveSettings}
          initialSettings={settings}
          isLoading={isSettingsLoading}
          error={settingsError}
          clearError={() => setSettingsError(null)}
        />

        {isLoading ? (
          <Spinner text="Loading your schedule..." />
        ) : error ? (
          <Alert message={error} type="error" onClose={() => setError(null)} />
        ) : (
          <CalendarView slots={slots} />
        )}
      </div>
    </main>
  );
}
