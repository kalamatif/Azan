import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Sun, Moon, Sunrise, Sunset } from 'lucide-react';
import { format } from 'date-fns';

interface PrayerTimes {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export const PrayerSchedule = ({ city }: { city: string }) => {
  const [times, setTimes] = useState<PrayerTimes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimes = async () => {
      try {
        const res = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=Saudi Arabia&method=4`);
        const data = await res.json();
        setTimes(data.data.timings);
      } catch (err) {
        console.error("Failed to fetch prayer times", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTimes();
  }, [city]);

  if (loading) return <div className="h-48 animate-pulse bg-gray-50 rounded-3xl" />;
  if (!times) return null;

  const schedule = [
    { name: 'Fajr', time: times.Fajr, icon: Sunrise },
    { name: 'Dhuhr', time: times.Dhuhr, icon: Sun },
    { name: 'Asr', time: times.Asr, icon: Clock },
    { name: 'Maghrib', time: times.Maghrib, icon: Sunset },
    { name: 'Isha', time: times.Isha, icon: Moon },
  ];

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-black text-gray-900">Today's Schedule</h3>
        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
          {format(new Date(), 'MMM dd, yyyy')}
        </span>
      </div>
      <div className="space-y-3">
        {schedule.map((p) => (
          <div key={p.name} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-xl">
                <p.icon className="w-4 h-4 text-gray-500" />
              </div>
              <span className="font-bold text-gray-700">{p.name}</span>
            </div>
            <span className="font-mono font-black text-indigo-600">{p.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
