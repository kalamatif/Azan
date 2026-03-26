import React from 'react';
import { LogIn, LogOut, User } from 'lucide-react';
import { signIn, logOut, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

export const Auth = () => {
  const [user, loading] = useAuthState(auth);

  if (loading) return <div className="animate-pulse h-10 w-24 bg-gray-200 rounded-full" />;

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
          <User className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium truncate max-w-[120px]">{user.displayName}</span>
        </div>
        <button
          onClick={logOut}
          className="p-2 text-gray-500 hover:text-red-500 transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={signIn}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-all shadow-sm font-medium"
    >
      <LogIn className="w-4 h-4" />
      Sign In
    </button>
  );
};
