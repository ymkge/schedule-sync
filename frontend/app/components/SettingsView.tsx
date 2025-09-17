'use client';

import { useState, useEffect } from 'react';
import type { UserSettings } from '../types';
import Spinner from './Spinner';
import Alert from './Alert';

export const SettingsView = ({ onSave, initialSettings, isLoading, error, clearError }: { 
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
              {timeOptions.map(time => <option key={`end-${time}`} value={time}>{time}</option>)}
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
            {durationOptions.map(duration => <option key={duration} value={duration}>{duration} minutes</option>)}
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
