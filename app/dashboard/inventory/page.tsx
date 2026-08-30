import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { updateInventory } from "./actions";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile) redirect("/login");

  // Intentionally no shop filter: RLS decides which rows this account can read.
  const { data: inventory } = await supabase
    .from("shop_products")
    .select("id,price_kwd,stock_quantity,warranty_text,freebie_text,offer_text,is_published,shops(name,slug),product_variants(sku,storage_gb,color,master_products(brand,model))")
    .order("created_at");

  const rows = inventory ?? [];
  const totalStock = rows.reduce((sum, item) => sum + (item.stock_quantity ?? 0), 0);
  const activeOffers = rows.filter((item) => Boolean(item.offer_text)).length;
  const inventoryValue = rows.reduce((sum, item) => sum + Number(item.price_kwd) * (item.stock_quantity ?? 0), 0);

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-sky-50 text-slate-900">
      <div className="mx-auto flex max-w-[1500px] gap-6 p-4 md:p-7">
        <aside className="hidden w-64 shrink-0 rounded-3xl border border-violet-100 bg-white/90 p-5 shadow-sm lg:block">
          <div className="mb-8">
            <p className="text-xl font-black text-violet-700">PixelFlow</p>
            <p className="text-xs font-medium text-slate-400">MobileShop</p>
          </div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-violet-400">Shop Dashboard</p>
          <nav className="space-y-2 text-sm">
            <Link href="/dashboard" className="block rounded-xl px-3 py-2.5 text-slate-600 hover:bg-violet-50">Dashboard</Link>
            <div className="rounded-xl bg-violet-100 px-3 py-2.5 font-bold text-violet-700">Inventory & Pricing</div>
            <Link href="/dashboard/catalogue" className="block rounded-xl px-3 py-2.5 text-slate-600 hover:bg-violet-50">Master Catalogue</Link>
          </nav>
          <div className="mt-10 rounded-2xl bg-gradient-to-br from-violet-50 to-sky-50 p-4">
            <p className="font-bold text-violet-700">PixelFlow MobileShop</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Simple inventory management for Kuwait mobile retailers.</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-start justify-between gap-4 py-3">
            <div>
              <Link href="/dashboard" className="text-sm font-semibold text-violet-600 hover:text-violet-800">← Dashboard</Link>
              <h1 className="mt-2 text-3xl font-black tracking-tight">Shop Inventory & Pricing</h1>
              <p className="mt-1 text-slate-500">Manage prices, stock, warranty, freebies and offers for your shop.</p>
            </div>
            <span className="rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 shadow-sm">
              {profile.role === "super_admin" ? "Super Admin View" : "Shop Admin"}
            </span>
          </header>

          {params.saved ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700">Inventory updated successfully.</div> : null}
          {params.error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700">{params.error}</div> : null}

          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Visible Inventory", rows.length.toString(), "Products you can manage"],
              ["Total Stock", totalStock.toString(), "Units currently available"],
              ["Active Offers", activeOffers.toString(), "Products with offers"],
              ["Inventory Value", `KD ${inventoryValue.toFixed(3)}`, "Price × current stock"],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
                <p className="mt-1 text-xs text-slate-400">{sub}</p>
              </div>
            ))}
          </section>

          <section className="mt-6 rounded-3xl border border-violet-100 bg-white p-4 shadow-sm md:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-black">Your Products</h2>
              <p className="mt-1 text-sm text-slate-500">Edit a product and press Save Changes. Supabase RLS still controls which rows you are allowed to update.</p>
            </div>

            <div className="space-y-5">
              {rows.map((item) => {
                const variant = item.product_variants;
                const product = variant?.master_products;
                const shop = item.shops;
                return (
                  <form action={updateInventory} key={item.id} className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-violet-50/40 p-5 shadow-sm">
                    <input type="hidden" name="id" value={item.id} />
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                      <div>
                        {profile.role === "super_admin" && shop ? <p className="text-xs font-bold uppercase tracking-wider text-violet-500">{shop.name}</p> : null}
                        <h3 className="mt-1 text-xl font-black">{product?.brand} {product?.model}</h3>
                        <p className="mt-1 text-sm text-slate-500">{variant?.storage_gb ? `${variant.storage_gb}GB` : "Standard"}{variant?.color ? ` • ${variant.color}` : ""} • SKU: {variant?.sku ?? "—"}</p>
                      </div>
                      <label className="flex items-center gap-2 rounded-full bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700">
                        <input type="checkbox" name="is_published" defaultChecked={item.is_published} className="h-4 w-4 accent-violet-600" /> Published
                      </label>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <label className="text-sm font-semibold text-slate-600">Selling Price (KD)
                        <input name="price_kwd" type="number" min="0" step="0.001" required defaultValue={Number(item.price_kwd).toFixed(3)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                      </label>
                      <label className="text-sm font-semibold text-slate-600">Stock Quantity
                        <input name="stock_quantity" type="number" min="0" step="1" required defaultValue={item.stock_quantity} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                      </label>
                      <label className="text-sm font-semibold text-slate-600">Warranty
                        <input name="warranty_text" defaultValue={item.warranty_text ?? ""} placeholder="e.g. 1 Year" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                      </label>
                      <label className="text-sm font-semibold text-slate-600">Freebie
                        <input name="freebie_text" defaultValue={item.freebie_text ?? ""} placeholder="e.g. Case + Screen Protector" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                      </label>
                      <label className="text-sm font-semibold text-slate-600 md:col-span-2">Offer
                        <input name="offer_text" defaultValue={item.offer_text ?? ""} placeholder="e.g. Weekend special" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                      </label>
                    </div>

                    <div className="mt-5 flex justify-end">
                      <button type="submit" className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700">Save Changes</button>
                    </div>
                  </form>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
