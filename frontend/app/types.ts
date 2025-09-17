export type Slot = {
  slotId: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked';
};

export type UserSettings = {
  workingHours: {
    start: string;
    end: string;
  };
  slotDuration: number;
};
