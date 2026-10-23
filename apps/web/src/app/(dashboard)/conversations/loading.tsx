export default function ConversationsLoading() {
  return (
    <div className="p-6 lg:p-8 space-y-4 max-w-7xl mx-auto animate-pulse">
      <div className="h-7 w-48 bg-sunken rounded-lg" />
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-sunken rounded-full" />
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-line shadow-sm divide-y divide-line">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-full bg-sunken shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 bg-sunken rounded" />
              <div className="h-3 w-56 bg-sunken rounded" />
            </div>
            <div className="h-5 w-16 bg-sunken rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
