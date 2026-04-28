export default function Loading() {
  return (
    <div className="px-4 md:px-9 py-7 space-y-6">
      {/* Row 1 */}
      <div className="flex gap-6">
        <div className="flex-1 h-[200px] bg-card rounded-2xl animate-pulse" />
        <div className="w-[280px] h-[200px] bg-card rounded-2xl animate-pulse" />
      </div>
      {/* Row 2 */}
      <div className="flex gap-6">
        <div className="flex-1 h-[280px] bg-card rounded-2xl animate-pulse" />
        <div className="w-[400px] h-[280px] bg-card rounded-2xl animate-pulse" />
      </div>
      {/* Row 3 */}
      <div className="flex gap-6">
        <div className="flex-1 h-[180px] bg-card rounded-2xl animate-pulse" />
        <div className="w-[300px] h-[180px] bg-card rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}
