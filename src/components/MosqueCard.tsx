import React from 'react';
import { MapPin, Radio, Users } from 'lucide-react';
import { Mosque } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface MosqueCardProps {
  key?: React.Key;
  mosque: Mosque;
  onSelect: (id: string) => void;
  isSelected?: boolean;
}

export const MosqueCard = ({ mosque, onSelect, isSelected }: MosqueCardProps) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(mosque.id)}
      className={cn(
        "p-4 rounded-2xl border-2 cursor-pointer transition-all",
        isSelected 
          ? "border-indigo-600 bg-indigo-50/50" 
          : "border-gray-100 bg-white hover:border-indigo-200"
      )}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="p-2 bg-indigo-100 rounded-xl">
          <Radio className={cn("w-6 h-6", mosque.isLive ? "text-red-500 animate-pulse" : "text-indigo-600")} />
        </div>
        {mosque.isLive && (
          <span className="px-2 py-1 bg-red-100 text-red-600 text-[10px] font-bold uppercase tracking-wider rounded-md">
            Live Now
          </span>
        )}
      </div>
      
      <h3 className="font-bold text-gray-900 mb-1">{mosque.name}</h3>
      <div className="flex items-center gap-1.5 text-gray-500 text-sm">
        <MapPin className="w-3.5 h-3.5" />
        <span className="truncate">{mosque.location}</span>
      </div>
    </motion.div>
  );
};
