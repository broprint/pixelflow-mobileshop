import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { logout } from "../login/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
          <p className="mt-3 text-slate-400">This authenticated user does not have a PixelFlow profile yet.</p>
          <form action={logout} className="mt-6"><button className="rounded-xl bg-slate-700 px-4 py-2">Sign out</button></form>
        </div>
      </main>
    );
  }

  const { data: shopsData } = await supabase.from("shops").select("id,name,slug,status").order("created_at");
  const shops = shopsData ?? [];

  if (profile.role === "super_admin") {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white md:p-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold tracking-[0.25em] text-cyan-400">PIXELFLOW MOBILESHOP</p>
              <h1 className="mt-2 text-3xl font-bold">Super Admin Dashboard</h1>
              <p className="mt-2 text-slate-400">Platform-wide management view</p>
            </div>
            <form action={logout}><button className="rounded-xl border border-slate-700 px-4 py-2 hover:bg-slate-800">Sign out</button></form>
          </div>
          <section className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><p className="text-slate-400">Role</p><p className="mt-2 text-xl font-bold">super_admin</p></div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><p className="text-slate-400">Visible shops</p><p className="mt-2 text-xl font-bold">{shops.length}</p></div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><p className="text-slate-400">Tenant isolation</p><p className="mt-2 text-xl font-bold text-emerald-400">RLS enforced</p></div>
          </section>
          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <Link href="/dashboard/catalogue" className="rounded-3xl border border-cyan-900 bg-slate-900 p-6 transition hover:border-cyan-500"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Phase 2</p><h2 className="mt-2 text-xl font-bold">Master Catalogue</h2><p className="mt-2 text-sm text-slate-400">Shared phone models and variants used by every retailer.</p></Link>
            <Link href="/dashboard/catalogue/images" className="rounded-3xl border border-violet-900 bg-slate-900 p-6 transition hover:border-violet-500"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">Catalogue Media</p><h2 className="mt-2 text-xl font-bold">Product Images</h2><p className="mt-2 text-sm text-slate-400">Upload and replace approved master handset images stored in Supabase.</p></Link>
            <Link href="/dashboard/inventory" className="rounded-3xl border border-emerald-900 bg-slate-900 p-6 transition hover:border-emerald-500"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Phase 2</p><h2 className="mt-2 text-xl font-bold">All Shop Inventory</h2><p className="mt-2 text-sm text-slate-400">Review retailer-specific pricing, stock, warranty and offers.</p></Link>
          </section>
          <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">All Shops</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">{shops.map((shop) => <div key={shop.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">{shop.name}</h3><span className="rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-300">{shop.status}</span></div><p className="mt-2 text-sm text-slate-500">/{shop.slug}</p></div>)}</div>
          </section>
        </div>
      </main>
    );
  }

  const shop = shops[0];
  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-sky-50 text-slate-900">
      <div className="mx-auto flex max-w-[1500px] gap-6 p-4 md:p-7">
        <aside className="hidden w-64 shrink-0 rounded-3xl border border-violet-100 bg-white/90 p-5 shadow-sm lg:block">
          <div className="mb-8"><p className="text-xl font-black text-violet-700">PixelFlow</p><p className="text-xs font-medium text-slate-400">MobileShop</p></div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-violet-400">Shop Dashboard</p>
          <nav className="space-y-2 text-sm">
            <div className="rounded-xl bg-violet-100 px-3 py-2.5 font-bold text-violet-700">Dashboard</div>
            <Link href="/dashboard/inventory" className="block rounded-xl px-3 py-2.5 text-slate-600 hover:bg-violet-50">Inventory & Pricing</Link>
            <Link href="/dashboard/catalogue" className="block rounded-xl px-3 py-2.5 text-slate-600 hover:bg-violet-50">Master Catalogue</Link>
          </nav>
          <div className="mt-10 rounded-2xl bg-gradient-to-br from-violet-50 to-sky-50 p-4"><p className="font-bold text-violet-700">{shop?.name ?? "Your Shop"}</p><p className="mt-1 text-xs leading-5 text-slate-500">Your private retailer workspace, protected by tenant-level RLS.</p></div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-start justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-500">PixelFlow MobileShop</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">Welcome back, {profile.full_name || "Shop Admin"}</h1>
              <p className="mt-1 text-slate-500">Manage your shop catalogue, pricing and stock.</p>
            </div>
            <form action={logout}><button className="rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-bold text-violet-700 shadow-sm hover:bg-violet-50">Sign out</button></form>
          </header>

          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm"><p className="text-sm font-medium text-slate-500">Your Shop</p><p className="mt-2 text-xl font-black">{shop?.name ?? "—"}</p><p className="mt-1 text-xs text-slate-400">/{shop?.slug ?? ""}</p></div>
            <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm"><p className="text-sm font-medium text-slate-500">Visible shops</p><p className="mt-2 text-2xl font-black">{shops.length}</p><p className="mt-1 text-xs text-slate-400">RLS limits access to your tenant</p></div>
            <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm"><p className="text-sm font-medium text-slate-500">Shop Status</p><p className="mt-2 text-xl font-black capitalize text-emerald-600">{shop?.status ?? "—"}</p><p className="mt-1 text-xs text-slate-400">Store account state</p></div>
          </section>

          <section className="mt-6 grid gap-5 md:grid-cols-2">
            <Link href="/dashboard/inventory" className="group rounded-3xl border border-violet-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md">
              <div className="flex items-center justify-between"><span className="rounded-xl bg-violet-100 px-3 py-2 text-sm font-black text-violet-700">Inventory</span><span className="text-violet-500 transition group-hover:translate-x-1">→</span></div>
              <h2 className="mt-5 text-2xl font-black">Inventory & Pricing</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Update selling prices, stock quantities, warranty, freebies, offers and publication status.</p>
            </Link>
            <Link href="/dashboard/catalogue" className="group rounded-3xl border border-sky-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md">
              <div className="flex items-center justify-between"><span className="rounded-xl bg-sky-100 px-3 py-2 text-sm font-black text-sky-700">Catalogue</span><span className="text-sky-500 transition group-hover:translate-x-1">→</span></div>
              <h2 className="mt-5 text-2xl font-black">Add Products</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Choose devices from PixelFlow's shared catalogue and add the variants you want to sell.</p>
            </Link>
          </section>

          <section className="mt-6 rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-500">Tenant Security</p>
            <h2 className="mt-2 text-xl font-black">Your shop data stays isolated</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">The application requests data through Supabase while Row Level Security restricts shop-level records to your assigned tenant.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
