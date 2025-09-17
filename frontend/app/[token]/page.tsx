'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import axios from 'axios';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';
import { getWeekDates, generateTimeIntervals } from '../utils/date';

// --- Type Definitions ---
type Slot = {
  slotId: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked';
};

// --- Data Fetching ---
async function getPublicSlots(token: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/slots/public/${token}`, { cache: 'no-store' });
    if (!res.ok) {
      if (res.status === 404) return { error: 'This booking page does not exist.' };
      throw new Error('Failed to fetch slots');
    }
    return res.json();
  } catch (error) {
    console.error(error);
    return { error: 'Could not connect to the server.' };
  }
}



// --- Calendar Component for Booking ---
const BookingCalendarView = ({ slots, onSlotClick, selectedSlotId }: { slots: Slot[], onSlotClick: (slot: Slot) => void, selectedSlotId?: string }) => {
  const [viewDate, setViewDate] = useState(new Date());

  const weekDates = useMemo(() => getWeekDates(viewDate), [viewDate]);
  const timeIntervals = useMemo(() => generateTimeIntervals(9, 18, 30), []);

  const slotsMap = useMemo(() => {
    const map = new Map<string, Slot>();
    for (const slot of slots) {
      if (slot.status === 'available') {
        map.set(new Date(slot.startTime).toISOString(), slot);
      }
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

              if (slot) {
                const isSelected = slot.slotId === selectedSlotId;
                return (
                  <div key={slot.slotId} className="h-12 border-t border-gray-200 bg-gray-50 p-1">
                    <button
                      onClick={() => onSlotClick(slot)}
                      className={`w-full h-full text-xs rounded-md transition duration-300 ease-in-out ${
                        isSelected
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      {time}
                    </button>
                  </div>
                );
              }
              return <div key={day.toISOString() + time} className="h-12 border-t border-gray-200 bg-gray-50"></div>;
            })}
          </div>
        ))}
        </div>
      </div>
    </div>
  );
};


// --- Main Page Component ---
export default function BookingPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [userName, setUserName] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [bookerName, setBookerName] = useState('');
  const [bookerEmail, setBookerEmail] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const result = await getPublicSlots(token);
      if (result.error) {
        setError(result.error);
      } else {
        setUserName(result.userName);
        setSlots(result.slots || []);
      }
      setIsLoading(false);
    };
    fetchData();
  }, [token]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedSlot || !bookerName || !bookerEmail) {
      setFormError('Please select a time slot and fill in your name and email.');
      return;
    }
    setIsBooking(true);
    setBookingResult(null);
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/bookings`, {
        publicUrlToken: token,
        slotId: selectedSlot.slotId,
        bookerName,
        bookerEmail,
      });
      setBookingResult({
        message: `Booking confirmed for ${new Date(selectedSlot.startTime).toLocaleString()}! A calendar invitation has been sent to your email.`,
        type: 'success',
      });
      // Refetch slots to show updated availability
      const updatedSlotsResult = await getPublicSlots(token);
      if (!updatedSlotsResult.error) {
        setSlots(updatedSlotsResult.slots || []);
      }
      setSelectedSlot(null);
      setBookerName('');
      setBookerEmail('');
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.response?.data?.detail || 'An unknown error occurred during booking.';
      setBookingResult({ message: errorMessage, type: 'error' });
    }
    setIsBooking(false);
  };

  if (isLoading) {
    return <Spinner text="Loading booking page..." />;
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 sm:p-24 bg-gray-50">
        <div className="w-full max-w-md">
          <Alert message={error} type="error" />
        </div>
      </main>
    );
  }
  
  if (bookingResult && bookingResult.type === 'success') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 sm:p-24 bg-gray-50">
        <div className="text-center p-8 bg-white shadow-lg rounded-xl max-w-lg">
          <h1 className="text-2xl font-bold text-green-600">Booking Confirmed!</h1>
          <p className="mt-4 text-gray-700">{bookingResult.message}</p>
          <button onClick={() => setBookingResult(null)} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Book Another Meeting
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Book a meeting with {userName}</h1>
          <p className="mt-2 text-md text-gray-600">Select an available time slot from the calendar below.</p>
        </div>

        {slots.length > 0 ? (
          <BookingCalendarView 
            slots={slots} 
            onSlotClick={setSelectedSlot}
            selectedSlotId={selectedSlot?.slotId}
          />
        ) : (
          <div className="text-center py-10 px-4 bg-white rounded-lg shadow">
            <p className="text-gray-600">No available slots at this time.</p>
          </div>
        )}

        {selectedSlot && (
          <div className="mt-10 pt-8 border-t-2 border-gray-200">
            <h3 className="text-2xl font-semibold text-center text-gray-800">
              Confirm your booking
            </h3>
            <p className="text-center text-lg text-gray-600 mt-2">
              {new Date(selectedSlot.startTime).toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            
            <form onSubmit={handleBookingSubmit} className="mt-8 max-w-lg mx-auto">
              <div className="space-y-5">
                {formError && <Alert message={formError} type="error" onClose={() => setFormError(null)} />}
                {bookingResult && bookingResult.type === 'error' && (
                  <Alert message={bookingResult.message} type="error" onClose={() => setBookingResult(null)} />
                )}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">Your Name</label>
                  <input type="text" id="name" value={bookerName} onChange={e => setBookerName(e.target.value)} required className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">Your Email</label>
                  <input type="email" id="email" value={bookerEmail} onChange={e => setBookerEmail(e.target.value)} required className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              
              <div className="mt-8 flex justify-end gap-4">
                <button type="button" onClick={() => setSelectedSlot(null)} className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={isBooking} className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400">
                  {isBooking ? 'Booking...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

