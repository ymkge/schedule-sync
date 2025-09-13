'use client';

import { useState, Fragment } from 'react';
import axios from 'axios';

// This function can remain a server-side utility, but we call it from the client-side wrapper
async function getSlots(token: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/slots/public/${token}`,
      { cache: 'no-store' } 
    );
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

function groupSlotsByDay(slots: any[]) {
  const grouped: { [key: string]: any[] } = {};
  slots.forEach(slot => {
    if (slot.status !== 'available') return;
    const date = new Date(slot.startTime).toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(slot);
  });
  return grouped;
}

export default function BookingPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [bookerName, setBookerName] = useState('');
  const [bookerEmail, setBookerEmail] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<string | null>(null);

  useState(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const result = await getSlots(token);
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
      setIsLoading(false);
    };
    fetchData();
  }, [token]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !bookerName || !bookerEmail) {
      alert('Please select a slot and fill in your details.');
      return;
    }
    setIsBooking(true);
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/bookings`, {
        publicUrlToken: token,
        slotId: selectedSlot.slotId,
        bookerName,
        bookerEmail,
      });
      setBookingResult(`Booking confirmed for ${new Date(selectedSlot.startTime).toLocaleString()}! A calendar invitation has been sent to your email.`);
      setSelectedSlot(null); // Reset form
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.response?.data?.detail || 'An unknown error occurred.';
      setBookingResult(`Error: ${errorMessage}`);
    }
    setIsBooking(false);
  };

  if (isLoading) {
    return <div className="text-center p-24">Loading...</div>;
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
        <div className="text-center p-8 bg-white shadow-lg rounded-xl">
          <h1 className="text-2xl font-bold text-red-600">Error</h1>
          <p className="mt-4 text-gray-700">{error}</p>
        </div>
      </main>
    );
  }

  if (bookingResult && !bookingResult.startsWith('Error')) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
        <div className="text-center p-8 bg-white shadow-lg rounded-xl">
          <h1 className="text-2xl font-bold text-green-600">Booking Confirmed!</h1>
          <p className="mt-4 text-gray-700">{bookingResult}</p>
        </div>
      </main>
    );
  }

  const groupedSlots = groupSlotsByDay(data?.slots || []);

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center text-gray-900">Book a meeting with {data.userName}</h1>
        <p className="mt-2 text-center text-sm text-gray-600">Select an available time slot below.</p>
        
        <div className="mt-10 space-y-8">
          {Object.keys(groupedSlots).length > 0 ? (
            Object.entries(groupedSlots).map(([day, slots]) => (
              <div key={day}>
                <h2 className="font-semibold text-lg text-gray-800 border-b pb-2">{day}</h2>
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {slots.map(slot => (
                    <button 
                      key={slot.slotId}
                      onClick={() => setSelectedSlot(slot)}
                      className={`w-full font-semibold py-2 px-2 border rounded-lg transition duration-300 ease-in-out text-sm ${selectedSlot?.slotId === slot.slotId ? 'bg-blue-600 text-white' : 'bg-white hover:bg-blue-100 text-blue-600 border-blue-500'}`}>
                      {new Date(slot.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 px-4 bg-white rounded-lg shadow">
              <p className="text-gray-600">No available slots at this time.</p>
            </div>
          )}
        </div>

        {selectedSlot && (
          <div className="mt-10 pt-6 border-t">
            <h3 className="text-xl font-semibold text-center">Confirm your booking for <br/> {new Date(selectedSlot.startTime).toLocaleString()}</h3>
            <form onSubmit={handleBookingSubmit} className="mt-6 max-w-sm mx-auto">
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">Your Name</label>
                  <input type="text" id="name" value={bookerName} onChange={e => setBookerName(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">Your Email</label>
                  <input type="email" id="email" value={bookerEmail} onChange={e => setBookerEmail(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              {bookingResult && bookingResult.startsWith('Error') && (
                  <p className="mt-4 text-sm text-center text-red-600">{bookingResult}</p>
              )}
              <div className="mt-6">
                <button type="submit" disabled={isBooking} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400">
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