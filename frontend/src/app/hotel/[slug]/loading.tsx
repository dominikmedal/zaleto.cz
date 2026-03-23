export default function HotelDetailLoading() {
  return (
    <div className="min-h-screen animate-pulse">

      {/* Header placeholder */}
      <div className="h-16 bg-white border-b border-gray-100" />

      <div className="max-w-[1680px] mx-auto px-6 sm:px-8 py-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4">
          <div className="h-3 w-16 bg-gray-200 rounded-full" />
          <div className="h-3 w-1 bg-gray-100 rounded-full" />
          <div className="h-3 w-20 bg-gray-200 rounded-full" />
          <div className="h-3 w-1 bg-gray-100 rounded-full" />
          <div className="h-3 w-32 bg-gray-200 rounded-full" />
        </div>

        {/* Title block */}
        <div className="mb-5 space-y-2">
          <div className="flex gap-0.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-4 h-4 bg-amber-200 rounded-sm" />
            ))}
          </div>
          <div className="h-8 w-2/3 sm:w-96 bg-gray-200 rounded-xl" />
          <div className="h-4 w-48 bg-gray-100 rounded-full" />
        </div>

        {/* Gallery — mobile: full-width strip */}
        <div className="sm:hidden w-full bg-gray-200 rounded-2xl mb-6" style={{ aspectRatio: '16/10' }} />

        {/* Gallery — desktop: 2+4 grid */}
        <div className="hidden sm:grid grid-cols-4 grid-rows-2 gap-2 h-[420px] sm:h-[520px] rounded-2xl overflow-hidden mb-8">
          <div className="col-span-2 row-span-2 bg-gray-200" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-100" />
          ))}
        </div>

        {/* Mobile price box */}
        <div className="lg:hidden bg-[#e1f2f3]/60 rounded-2xl p-4 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-3 w-28 bg-[#b8dfe1] rounded-full" />
              <div className="h-8 w-36 bg-[#b8dfe1] rounded-xl" />
            </div>
            <div className="h-11 w-32 bg-[#008afe]/30 rounded-xl" />
          </div>
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#b8dfe1]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-2 w-12 bg-[#b8dfe1] rounded-full" />
                <div className="h-5 w-8 bg-[#b8dfe1] rounded-md" />
              </div>
            ))}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start mt-6">

          {/* Left column */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3 pb-8 border-b border-gray-100 last:border-0">
                <div className="h-5 w-40 bg-gray-200 rounded-lg" />
                <div className="space-y-2">
                  <div className="h-3 w-full bg-gray-100 rounded-full" />
                  <div className="h-3 w-5/6 bg-gray-100 rounded-full" />
                  <div className="h-3 w-4/6 bg-gray-100 rounded-full" />
                </div>
              </div>
            ))}
          </div>

          {/* Right column */}
          <div className="lg:col-span-1 hidden lg:block">
            <div className="bg-[#e1f2f3]/60 rounded-2xl p-5 space-y-4">
              <div className="h-5 w-28 bg-[#b8dfe1] rounded-lg" />
              <div className="h-10 w-44 bg-[#b8dfe1] rounded-xl" />
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#b8dfe1]">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <div className="h-2 w-14 bg-[#b8dfe1] rounded-full" />
                    <div className="h-5 w-10 bg-[#b8dfe1] rounded-md" />
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-[#b8dfe1] space-y-2.5">
                <div className="h-11 w-full bg-[#008afe]/30 rounded-xl" />
                <div className="h-10 w-full bg-gray-200 rounded-xl" />
              </div>
            </div>
          </div>

        </div>

        {/* Tour dates */}
        <div className="mt-12 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-6 w-40 bg-gray-200 rounded-lg" />
            <div className="h-5 w-8 bg-gray-100 rounded-full" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 w-full bg-gray-100 rounded-xl" />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
