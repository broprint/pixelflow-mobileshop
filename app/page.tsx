import { createClient } from "@/src/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { error } = await supabase.auth.getSession();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-16">
        <section className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 p-10 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">
            Phase 1
          </p>
          <h1 className="text-4xl font-bold tracking-tight">PixelFlow MobileShop</h1>
          <p className="mt-3 text-slate-400">
            Multi-tenant commerce platform for mobile retailers.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
            {error ? (
              <>
                <p className="font-semibold text-red-400">Supabase connection error</p>
                <p className="mt-2 text-sm text-slate-400">{error.message}</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-emerald-400">Supabase connection successful</p>
                <p className="mt-2 text-sm text-slate-400">
                  The Next.js application can reach the PixelFlow MobileShop backend.
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
