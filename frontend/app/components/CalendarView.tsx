'use client';

import { useMemo, useState } from 'react';
import { getWeekDates, generateTimeIntervals } from '../utils/date';
import type { Slot } from '../types';

export const CalendarView = ({ slots }: { slots: Slot[] }) => {
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
