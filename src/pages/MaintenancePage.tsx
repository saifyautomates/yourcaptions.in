export function MaintenancePage() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-center max-w-md">
        {/* CAP-E mascot animation */}
        <div className="text-8xl mb-8 animate-pulse">🤖</div>
        <h1 className="text-4xl font-bold text-white mb-4">
          We'll be right back.
        </h1>
        <p className="text-[#888] text-lg mb-8">
          Yourcaptions.in is undergoing maintenance.
          We'll be back shortly. Thank you for your patience.
        </p>
        <div className="text-[#E60000] text-sm">
          Follow @Yourcaptions for updates
        </div>
      </div>
    </div>
  );
}

export default MaintenancePage;
