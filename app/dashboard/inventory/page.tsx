import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

export default async function InventoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  // No shop filter here: RLS determines which shop inventory rows the user may read.
  const { data: inventory } = await supabase
    .from("shop_products")
    .select(
      "id,price_kwd,compare_at_price_kwd,stock_quantity,warranty_text,freebie_text,offer_text,is_published,shops(name,slug),product_variants(sku,storage_gb,color,master_products(brand,model))"
    )
    .order("created_at");

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white md:p-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="text-sm text-emerald-400 hover:text-emerald-300">
          ← Back to dashboard
        </Link>

        <div className="mt-6">
          <p className="text-sm font-bold tracking-[0.25em] text-emerald-400">PHASE 2</p>
          <h1 className="mt-2 text-3xl font-bold">Shop Inventory & Pricing</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            {profile.role === "super_admin"
              ? "Super Admin can see inventory across all shops."
              : "This page intentionally requests inventory without a shop filter; Supabase RLS returns only your shop's rows."}
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Visible inventory rows</p>
          <p className="mt-1 text-2xl font-bold">{inventory?.length ?? 0}</p>
        </div>

        <section className="mt-6 grid gap-5">
          {(inventory ?? []).map((item) => {
            const variant = item.product_variants;
            const product = variant?.master_products;
            const shop = item.shops;

            return (
              <article key={item.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    {profile.role === "super_admin" && shop ? (
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">{shop.name}</p>
                    ) : null}
                    <h2 className="mt-1 text-xl font-bold">
                      {product?.brand} {product?.model}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {variant?.storage_gb ? `${variant.storage_gb}GB` : "Standard"}
                      {variant?.color ? ` • ${variant.color}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-emerald-400">KD {Number(item.price_kwd).toFixed(3)}</p>
                    <p className="mt-1 text-sm text-slate-400">Stock: {item.stock_quantity}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
                  <div className="rounded-xl bg-slate-950 p-4">
                    <p className="text-slate-500">Warranty</p>
                    <p className="mt-1">{item.warranty_text || "—"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-950 p-4">
                    <p className="text-slate-500">Freebie</p>
                    <p className="mt-1">{item.freebie_text || "—"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-950 p-4">
                    <p className="text-slate-500">Offer</p>
                    <p className="mt-1">{item.offer_text || "—"}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>SKU: {variant?.sku ?? "—"}</span>
                  <span>•</span>
                  <span>{item.is_published ? "Published" : "Draft"}</span>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
