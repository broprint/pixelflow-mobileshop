import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { addVariantToShop } from "./actions";

export default async function CataloguePage({ searchParams }: { searchParams: Promise<{ added?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,shop_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const { data: products } = await supabase
    .from("master_products")
    .select("id,brand,model,category,is_active,product_variants(id,sku,storage_gb,ram_gb,color,network,region,is_active)")
    .order("brand")
    .order("model");

  let existingVariantIds = new Set<string>();
  if (profile.role === "shop_admin") {
    const { data: existing } = await supabase.from("shop_products").select("variant_id");
    existingVariantIds = new Set((existing ?? []).map((row) => row.variant_id));
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-sky-50 text-slate-900">
      <div className="mx-auto max-w-7xl p-5 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm font-semibold text-violet-600 hover:text-violet-800">← Dashboard</Link>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-violet-500">Master Catalogue</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Choose products for your shop</h1>
            <p className="mt-2 max-w-3xl text-slate-500">
              PixelFlow maintains the shared phone model and variant catalogue. Your shop adds only the variants it wants to sell and controls its own price, stock and warranty.
            </p>
          </div>
          <Link href="/dashboard/inventory" className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-violet-700">Open My Inventory</Link>
        </div>

        {params.added ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700">Product added to your shop as a draft. You can finish the offer and publish it from Inventory & Pricing.</div> : null}
        {params.error ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700">{params.error}</div> : null}

        <section className="mt-7 grid gap-5">
          {(products ?? []).map((product) => (
            <article key={product.id} className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-6">
                <div>
                  <p className="text-sm font-bold text-violet-600">{product.brand}</p>
                  <h2 className="mt-1 text-2xl font-black">{product.model}</h2>
                  <p className="mt-2 text-sm capitalize text-slate-500">{product.category}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${product.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {product.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="grid gap-4 p-5 lg:grid-cols-2">
                {(product.product_variants ?? []).map((variant) => {
                  const alreadyAdded = existingVariantIds.has(variant.id);
                  return (
                    <div key={variant.id} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-violet-50/50 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black">{variant.storage_gb ? `${variant.storage_gb}GB` : "Standard"}{variant.color ? ` • ${variant.color}` : ""}</p>
                          <p className="mt-1 text-xs font-medium text-slate-400">SKU: {variant.sku}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                            {variant.ram_gb ? <span className="rounded-full bg-white px-2.5 py-1">{variant.ram_gb}GB RAM</span> : null}
                            {variant.network ? <span className="rounded-full bg-white px-2.5 py-1">{variant.network}</span> : null}
                            {variant.region ? <span className="rounded-full bg-white px-2.5 py-1">{variant.region}</span> : null}
                          </div>
                        </div>
                        {alreadyAdded ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">In your inventory</span> : null}
                      </div>

                      {profile.role === "shop_admin" && !alreadyAdded && variant.is_active ? (
                        <form action={addVariantToShop} className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
                          <input type="hidden" name="variant_id" value={variant.id} />
                          <label className="text-xs font-bold text-slate-500">Selling Price (KD)
                            <input name="price_kwd" type="number" min="0" step="0.001" required placeholder="0.000" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                          </label>
                          <label className="text-xs font-bold text-slate-500">Stock
                            <input name="stock_quantity" type="number" min="0" step="1" required defaultValue="0" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                          </label>
                          <label className="text-xs font-bold text-slate-500">Warranty
                            <input name="warranty_text" placeholder="1 Year" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                          </label>
                          <button type="submit" className="sm:col-span-3 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700">Add to My Shop</button>
                        </form>
                      ) : null}

                      {profile.role === "super_admin" ? <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">Super Admin manages the shared catalogue. Shop-specific selling details are handled in retailer inventory.</p> : null}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
