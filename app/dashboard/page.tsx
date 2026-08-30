import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { logout } from "../login/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, shop_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-amber-900 bg-slate-900 p-8">
          <h1 className="text-2xl font-bold">Account setup incomplete</h1>
          <p className="mt-3 text-slate-400">
            This authenticated user does not have a PixelFlow profile yet.
          </p>
          <form action={logout} className="mt-6">
            <button className="rounded-xl bg-slate-700 px-4 py-2">Sign out</button>
          </form>
        </div>
      </main>
    );
  }

  // Intentionally request all shops and let Supabase RLS decide what this user may see.
  const { data: shopsData } = await supabase
    .from("shops")
    .select("id,name,slug,status")
    .order("created_at");

  const shops = shopsData ?? [];

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-[0.25em] text-cyan-400">
              PIXELFLOW MOBILESHOP
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              {profile.role === "super_admin" ? "Super Admin" : "Shop Admin"} Dashboard
            </h1>
            <p className="mt-2 text-slate-400">Signed in as {user.email}</p>
          </div>
          <form action={logout}>
            <button className="rounded-xl border border-slate-700 px-4 py-2 hover:bg-slate-800">
              Sign out
            </button>
          </form>
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-slate-400">Role</p>
            <p className="mt-2 text-xl font-bold">{profile.role}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-slate-400">Visible shops</p>
            <p className="mt-2 text-xl font-bold">{shops.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-slate-400">Tenant isolation</p>
            <p className="mt-2 text-xl font-bold text-emerald-400">RLS enforced</p>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <Link
            href="/dashboard/catalogue"
            className="rounded-3xl border border-cyan-900 bg-slate-900 p-6 transition hover:border-cyan-500"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Phase 2</p>
            <h2 className="mt-2 text-xl font-bold">Master Catalogue</h2>
            <p className="mt-2 text-sm text-slate-400">
              Shared phone models and variants used by every retailer.
            </p>
          </Link>

          <Link
            href="/dashboard/inventory"
            className="rounded-3xl border border-emerald-900 bg-slate-900 p-6 transition hover:border-emerald-500"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Phase 2</p>
            <h2 className="mt-2 text-xl font-bold">Shop Inventory & Pricing</h2>
            <p className="mt-2 text-sm text-slate-400">
              Retailer-specific price, stock, warranty, offers and freebies.
            </p>
          </Link>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-bold">
            {profile.role === "super_admin" ? "All Shops" : "Your Shop"}
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {shops.map((shop) => (
              <div key={shop.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold">{shop.name}</h3>
                  <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-300">
                    {shop.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">/{shop.slug}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
