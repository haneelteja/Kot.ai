export default function DashboardLoading() {
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-7 w-48 bg-sunken rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-line p-5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-sunken" />
            <div className="mt-4 space-y-2">
              <div className="h-8 w-24 bg-sunken rounded" />
              <div className="h-4 w-36 bg-sunken rounded" />
              <div className="h-3 w-28 bg-sunken rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-line p-6 shadow-sm">
        <div className="h-64 bg-sunken rounded-xl" />
      </div>
    </div>
  );
}
