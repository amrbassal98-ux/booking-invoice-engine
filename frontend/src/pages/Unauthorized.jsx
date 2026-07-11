/**
 * @fileoverview Unauthorized access page.
 *
 * Displayed when an authenticated user attempts to access a route
 * their role does not permit. Provides a link back to the dashboard.
 *
 * @module pages/Unauthorized
 */

import { Link } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';

export const Unauthorized = () => {
  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <ShieldX className="w-7 h-7 text-red-500" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Access denied</h1>
        <p className="text-slate-500 mt-2 text-sm">
          You don't have permission to access this resource with your current workspace role.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 mt-6 text-indigo-600 hover:text-indigo-700 font-semibold text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
};
