import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { addVariantToShop } from "./actions";

function formatStorage(storage?: number | null) {
  if (!storage) return "Standard";
  if (storage >= 1024) return `${storage / 1024}TB`;
  return `${storage}GB`;
}

function DeviceVisual({ brand, model, imageUrl }: { brand: string; model: string; imageUrl?: string | null }) {
  if (imageUrl) return <img src={imageUrl} alt={`${brand} ${model}`} className="h-32 w-24 rounded-2xl object-contain" />;
  return <div className="relative flex h-32 w-24 items-center justify-center rounded-[1.5rem] border-[5px] border-slate-800 bg-gradient-to-br from-slate-100 via-white to-violet-100 shadow-inner"><div className="absolute left-1/2 top-2 h-1.5 w-9 -translate-x-1/2 rounded-full bg-slate-800" /><div className="text-center"><p className="text-xl font-black text-violet-600">{brand.slice(0, 1)}</p><p className="mt-1 px-1 text-[9px] font-semibold leading-tight text-slate-500">{model}</p></div></div>;
}

export default async function CataloguePage({ searchParams }: { searchParams: Promise<{ added?: string; error?: string; q?: string; brand?: string; storage?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role,shop_id").eq("id", user.id).single();
  if (!profile) redirect("/login");

  const [{ data: products }, { data: colourImages }, { data: legacyVariantImages }] = await Promise.all([
    supabase.from("master_products").select("id,brand,model,category,image_url,is_active,product_variants(id,sku,storage_gb,ram_gb,color,network,region,is_active,market_price_references(retailer_name,price_kwd,product_url,observed_at))").order("brand").order("model"),
    supabase.from("product_images").select("master_product_id,color,image_url").is("variant_id", null).not("color", "is", null).eq("is_primary", true),
    supabase.from("product_images").select("variant_id,image_url").not("variant_id", "is", null).eq("is_primary", true),
  ]);

  const imageByColour = new Map((colourImages ?? []).map((image) => [`${image.master_product_id}::${String(image.color).toLowerCase()}`, image.image_url]));
  const legacyImageByVariant = new Map((legacyVariantImages ?? []).map((image) => [image.variant_id, image.image_url]));
  let existingVariantIds = new Set<string>();
  if (profile.role === "shop_admin") {
    const { data: existing } = await supabase.from("shop_products").select("variant_id");
    existingVariantIds = new Set((existing ?? []).map((row) => row.variant_id));
  }

  const query = (params.q ?? "").trim().toLowerCase();
  const brandFilter = params.brand ?? "all";
  const storageFilter = params.storage ?? "all";
  const allProducts = products ?? [];
  const brands = [...new Set(allProducts.map((product) => product.brand))].sort();
  const storages = [...new Set(allProducts.flatMap((product) => (product.product_variants ?? []).map((variant) => variant.storage_gb).filter(Boolean)))].sort((a, b) => Number(a) - Number(b));

  const filteredProducts = allProducts.map((product) => {
    if (brandFilter !== "all" && product.brand !== brandFilter) return null;
    if (query && !`${product.brand} ${product.model}`.toLowerCase().includes(query)) return null;
    const variants = (product.product_variants ?? []).filter((variant) => storageFilter === "all" || String(variant.storage_gb) === storageFilter);
    if (!variants.length) return null;
    return { ...product, product_variants: variants };
  }).filter(Boolean);

  const visibleVariantCount = filteredProducts.reduce((sum, product) => sum + (product?.product_variants.length ?? 0), 0);

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-sky-50 text-slate-900">
      <div className="mx-auto max-w-7xl p-5 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><Link href="/dashboard" className="text-sm font-semibold text-violet-600 hover:text-violet-800">← Dashboard</Link><p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-violet-500">Master Catalogue</p><h1 className="mt-2 text-3xl font-black tracking-tight">Choose products for your shop</h1><p className="mt-2 max-w-3xl text-slate-500">PixelFlow maintains the device catalogue once. Your shop chooses the exact storage and colour variants it wants to sell, then controls its own price, stock and warranty.</p></div>
          <Link href="/dashboard/inventory" className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-violet-700">Open My Inventory</Link>
        </div>

        {params.added ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700">Product added to your shop as a draft. Finish the offer and publish it from Inventory & Pricing.</div> : null}
        {params.error ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700">{params.error}</div> : null}

        <section className="mt-7 rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
          <form method="get" className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
            <input name="q" defaultValue={params.q ?? ""} placeholder="Search Apple, Samsung, HONOR, model..." className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
            <select name="brand" defaultValue={brandFilter} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="all">All brands</option>{brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select>
            <select name="storage" defaultValue={storageFilter} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="all">All storage</option>{storages.map((storage) => <option key={String(storage)} value={String(storage)}>{formatStorage(Number(storage))}</option>)}</select>
            <button className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">Filter</button>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500"><span>{filteredProducts.length} models • {visibleVariantCount} variants shown</span>{(query || brandFilter !== "all" || storageFilter !== "all") ? <Link href="/dashboard/catalogue" className="font-semibold text-violet-600">Clear filters</Link> : null}</div>
        </section>

        <section className="mt-6 grid gap-6">
          {filteredProducts.map((product) => product ? (
            <article key={product.id} className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-5 border-b border-slate-100 p-6">
                <div className="flex items-center gap-5"><DeviceVisual brand={product.brand} model={product.model} imageUrl={product.image_url} /><div><p className="text-sm font-bold text-violet-600">{product.brand}</p><h2 className="mt-1 text-2xl font-black">{product.model}</h2><p className="mt-2 text-sm capitalize text-slate-500">{product.category} • {product.product_variants.length} variants</p></div></div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${product.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{product.is_active ? "Active" : "Inactive"}</span>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                {product.product_variants.map((variant) => {
                  const alreadyAdded = existingVariantIds.has(variant.id);
                  const marketRefs = [...(variant.market_price_references ?? [])].sort((a, b) => new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime());
                  const latestMarket = marketRefs[0];
                  const colourKey = `${product.id}::${String(variant.color || "Standard colour").toLowerCase()}`;
                  const sharedColourImage = imageByColour.get(colourKey);
                  const variantImage = sharedColourImage ?? legacyImageByVariant.get(variant.id) ?? product.image_url;
                  const hasColourImage = Boolean(sharedColourImage ?? legacyImageByVariant.get(variant.id));

                  return (
                    <div key={variant.id} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-violet-50/50 p-5">
                      <div className="mb-4 flex h-36 items-center justify-center rounded-2xl border border-slate-100 bg-white p-3">{variantImage ? <img src={variantImage} alt={`${product.brand} ${product.model} ${variant.color ?? ""}`} className="h-full w-full object-contain" /> : <span className="text-xs text-slate-400">No product image</span>}</div>
                      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-lg font-black">{formatStorage(variant.storage_gb)}</p><p className="mt-1 font-semibold text-slate-700">{variant.color || "Standard colour"}</p><p className="mt-1 text-[11px] font-medium text-slate-400">SKU: {variant.sku}</p></div><div className="flex flex-col items-end gap-1">{alreadyAdded ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">In inventory</span> : null}{hasColourImage ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-600">Colour image</span> : null}</div></div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">{variant.ram_gb ? <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">{variant.ram_gb}GB RAM</span> : null}{variant.network ? <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">{variant.network}</span> : null}{variant.region ? <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">{variant.region}</span> : null}</div>
                      {latestMarket ? <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 px-3 py-3"><p className="text-[11px] font-bold uppercase tracking-wider text-sky-600">Kuwait market reference</p><div className="mt-1 flex items-end justify-between gap-3"><div><p className="text-lg font-black text-slate-900">KD {Number(latestMarket.price_kwd).toFixed(3)}</p><p className="text-xs text-slate-500">{latestMarket.retailer_name}</p></div>{latestMarket.product_url ? <a href={latestMarket.product_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-sky-700">View source ↗</a> : null}</div></div> : <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white/70 px-3 py-3 text-xs text-slate-400">Market price not captured yet</div>}
                      {profile.role === "shop_admin" && !alreadyAdded && variant.is_active ? <form action={addVariantToShop} className="mt-5 grid gap-3 border-t border-slate-100 pt-5"><input type="hidden" name="variant_id" value={variant.id} /><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-500">Selling Price (KD)<input name="price_kwd" type="number" min="0" step="0.001" required placeholder={latestMarket ? Number(latestMarket.price_kwd).toFixed(3) : "0.000"} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold" /></label><label className="text-xs font-bold text-slate-500">Stock<input name="stock_quantity" type="number" min="0" step="1" required defaultValue="0" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold" /></label></div><label className="text-xs font-bold text-slate-500">Warranty<input name="warranty_text" placeholder="e.g. 1 Year" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" /></label><button type="submit" className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white">Add to My Shop</button></form> : null}
                      {profile.role === "super_admin" ? <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">Shared catalogue variant. Retailer prices remain separate.</p> : null}
                    </div>
                  );
                })}
              </div>
            </article>
          ) : null)}
          {!filteredProducts.length ? <div className="rounded-3xl border border-dashed border-violet-200 bg-white p-10 text-center"><h2 className="text-xl font-black">No catalogue matches</h2><p className="mt-2 text-slate-500">Try a different brand, storage size or search term.</p><Link href="/dashboard/catalogue" className="mt-4 inline-block font-bold text-violet-600">Show all products</Link></div> : null}
        </section>
      </div>
    </main>
  );
}
