export default function ConversationDetailLoading() {
  return (
    <div className="flex h-full flex-col animate-pulse">
      <div className="border-b border-line p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-sunken" />
        <div className="space-y-1.5">
          <div className="h-4 w-28 bg-sunken rounded" />
          <div className="h-3 w-20 bg-sunken rounded" />
        </div>
      </div>
      <div className="flex-1 p-6 space-y-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
            <div className={`h-10 rounded-2xl bg-gray-${i % 2 === 0 ? '200' : '100'} ${i % 2 === 0 ? 'w-48' : 'w-64'}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
