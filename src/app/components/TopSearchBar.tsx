import { Search } from 'lucide-react';

export function TopSearchBar() {
  return (
    <div className="h-14 border-b border-gray-200 bg-white flex items-center px-6">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <input
            type="text"
            placeholder="Search ⌘+P"
            className="w-full px-4 py-2 pr-10 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>
  );
}
