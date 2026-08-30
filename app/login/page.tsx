import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <p className="text-cyan-400 text-sm font-bold tracking-[0.3em]">PIXELFLOW</p>
        <h1 className="mt-3 text-3xl font-bold">MobileShop Login</h1>
        <p className="mt-2 text-slate-400">Super Admin and Shop Admin access.</p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form action={login} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
          </div>
          <button type="submit" className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-bold text-slate-950 hover:bg-cyan-300">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
