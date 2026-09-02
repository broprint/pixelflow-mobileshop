import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import {
  importCatalogueImageFromUrl,
  importColourImageFromUrl,
  removeCatalogueImage,
  removeColourImage,
  uploadCatalogueImage,
  uploadColourImage,
} from "./actions";

export default async function CatalogueImagesPage({ searchParams }: { searchParams: Promise<{ saved?: string; removed?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") redirect("/dashboard");

  const [{ data: products }, { data: variants }, { data: colourImages }] = await Promise.all([
    supabase.from("master_products").select("id,brand,model,image_url,is_active").order("brand").order("model"),
    supabase.from("product_variants").select("id,master_product_id,color,is_active").order("color"),
    supabase.from("product_images").select("id,master_product_id,color,image_url,storage_path").is("variant_id", null).not("color", "is", null).eq("is_primary", true),
  ]);

  const catalogue = products ?? [];
  const allVariants = variants ?? [];
  const colourImageMap = new Map((colourImages ?? []).map((row) => [`${row.master_product_id}::${String(row.color).toLowerCase()}`, row]));
  const masterImageCount = catalogue.filter((product) => Boolean(product.image_url)).length;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm font-semibold text-cyan-400 hover:text-cyan-300">← Super Admin</Link>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-cyan-400">Catalogue Media</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Product Image Manager</h1>
            <p className="mt-2 max-w-3xl text-slate-400">Upload one image per model colour. PixelFlow automatically reuses it for every storage or RAM variant of that same colour.</p>
          </div>
          <Link href="/dashboard/catalogue" className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:border-cyan-500">Open Catalogue</Link>
        </div>

        {params.saved ? <div className="mt-6 rounded-2xl border border-emerald-800 bg-emerald-950/50 px-5 py-3 text-sm font-semibold text-emerald-300">Image saved successfully in PixelFlow storage.</div> : null}
        {params.removed ? <div className="mt-6 rounded-2xl border border-amber-800 bg-amber-950/50 px-5 py-3 text-sm font-semibold text-amber-300">Image removed.</div> : null}
        {params.error ? <div className="mt-6 rounded-2xl border border-rose-800 bg-rose-950/50 px-5 py-3 text-sm font-semibold text-rose-300">{params.error}</div> : null}

        <section className="mt-7 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">Master products</p><p className="mt-2 text-3xl font-black">{catalogue.length}</p></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">Master images</p><p className="mt-2 text-3xl font-black text-emerald-400">{masterImageCount}</p></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">Colour slots</p><p className="mt-2 text-3xl font-black">{new Set(allVariants.map((v) => `${v.master_product_id}::${v.color}`)).size}</p></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">Colour images</p><p className="mt-2 text-3xl font-black text-violet-300">{colourImageMap.size}</p></div>
        </section>

        <section className="mt-7 rounded-2xl border border-violet-900/60 bg-violet-950/20 p-4 text-sm text-violet-100">
          <p className="font-black">One colour image = all capacities</p>
          <p className="mt-1 text-violet-200/70">Example: an iPhone 17 Black image is automatically used for Black 256GB and Black 512GB. SKU, storage, RAM, price and stock still remain separate.</p>
        </section>

        <section className="mt-7 grid gap-6">
          {catalogue.map((product) => {
            const productVariants = allVariants.filter((variant) => variant.master_product_id === product.id);
            const colours = [...new Set(productVariants.map((variant) => variant.color || "Standard colour"))].sort();
            return (
              <article key={product.id} className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-lg shadow-black/10">
                <div className="grid gap-6 p-5 lg:grid-cols-[250px_1fr]">
                  <div>
                    <div className="flex h-56 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 p-5">
                      {product.image_url ? <img src={product.image_url} alt={`${product.brand} ${product.model}`} className="h-full w-full object-contain" /> : <div className="text-center text-slate-500">No master image</div>}
                    </div>
                    <p className="mt-4 text-xs font-bold uppercase tracking-wider text-cyan-400">{product.brand}</p>
                    <h2 className="mt-1 text-xl font-black">{product.model}</h2>
                    <p className="mt-1 text-xs text-slate-500">{colours.length} colours • {productVariants.length} variants</p>

                    <form action={importCatalogueImageFromUrl} className="mt-4 grid gap-2 border-t border-slate-800 pt-4">
                      <input type="hidden" name="product_id" value={product.id} />
                      <label className="text-[11px] font-bold text-cyan-300">Import master image from URL</label>
                      <input name="image_url" type="url" required placeholder="https://.../image.jpg" className="rounded-xl border border-cyan-900 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-500" />
                      <button className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-400">Import URL to PixelFlow</button>
                    </form>

                    <details className="mt-3 text-xs text-slate-500">
                      <summary className="cursor-pointer hover:text-slate-300">Upload master from local file</summary>
                      <form action={uploadCatalogueImage} encType="multipart/form-data" className="mt-2 grid gap-2">
                        <input type="hidden" name="product_id" value={product.id} />
                        <input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300" />
                        <button className="rounded-xl border border-cyan-800 px-4 py-2.5 text-sm font-black text-cyan-300">Upload local file</button>
                      </form>
                    </details>
                    {product.image_url ? <form action={removeCatalogueImage} className="mt-2"><input type="hidden" name="product_id" value={product.id} /><button className="w-full rounded-xl border border-rose-900 px-4 py-2 text-xs font-bold text-rose-300">Remove master image</button></form> : null}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black">Colour images</h3><span className="text-xs text-slate-500">Shared across capacities</span></div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {colours.map((colour) => {
                        const key = `${product.id}::${colour.toLowerCase()}`;
                        const colourImage = colourImageMap.get(key);
                        const variantCount = productVariants.filter((variant) => (variant.color || "Standard colour") === colour).length;
                        return (
                          <div key={colour} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                            <div className="flex gap-3">
                              <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-900 p-2">
                                {colourImage ? <img src={colourImage.image_url} alt={`${product.brand} ${product.model} ${colour}`} className="h-full w-full object-contain" /> : product.image_url ? <img src={product.image_url} alt={`${product.brand} ${product.model}`} className="h-full w-full object-contain opacity-40" /> : <span className="text-[10px] text-slate-600">No image</span>}
                              </div>
                              <div><p className="font-black">{colour}</p><p className="mt-1 text-xs text-slate-400">Used by {variantCount} variant{variantCount === 1 ? "" : "s"}</p><span className={`mt-2 inline-block rounded-full px-2 py-1 text-[10px] font-bold ${colourImage ? "bg-violet-950 text-violet-300" : "bg-slate-800 text-slate-500"}`}>{colourImage ? "Colour image" : "Using master"}</span></div>
                            </div>

                            <form action={importColourImageFromUrl} className="mt-3 grid gap-2">
                              <input type="hidden" name="product_id" value={product.id} />
                              <input type="hidden" name="color" value={colour} />
                              <input name="image_url" type="url" required placeholder="Paste direct image URL" className="rounded-lg border border-violet-900/70 bg-slate-950 px-2.5 py-2 text-[10px] text-slate-300 outline-none placeholder:text-slate-600 focus:border-violet-500" />
                              <button className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold hover:bg-violet-500">{colourImage ? "Replace from URL" : "Import colour image"}</button>
                            </form>

                            <details className="mt-2 text-[10px] text-slate-500">
                              <summary className="cursor-pointer hover:text-slate-300">Upload local file instead</summary>
                              <form action={uploadColourImage} encType="multipart/form-data" className="mt-2 grid gap-2">
                                <input type="hidden" name="product_id" value={product.id} />
                                <input type="hidden" name="color" value={colour} />
                                <input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-[10px] text-slate-400" />
                                <button className="rounded-lg border border-violet-800 px-3 py-2 text-xs font-bold text-violet-300">Upload local file</button>
                              </form>
                            </details>

                            {colourImage ? <form action={removeColourImage} className="mt-2"><input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="color" value={colour} /><button className="w-full text-[11px] font-semibold text-rose-400 hover:text-rose-300">Remove colour image</button></form> : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
