import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { removeCatalogueImage, uploadCatalogueImage } from "./actions";

export default async function CatalogueImagesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; removed?: string; error?: string }>;
}) {
  const params = await searchParams;
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

  if (profile?.role !== "super_admin") redirect("/dashboard");

  const { data: products } = await supabase
    .from("master_products")
    .select("id,brand,model,image_url,is_active")
    .order("brand")
    .order("model");

  const catalogue = products ?? [];
  const withImages = catalogue.filter((product) => Boolean(product.image_url)).length;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm font-semibold text-cyan-400 hover:text-cyan-300">← Super Admin</Link>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-cyan-400">Catalogue Media</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Product Image Manager</h1>
            <p className="mt-2 max-w-3xl text-slate-400">
              Upload one approved master image per product. PixelFlow stores the file in Supabase and automatically connects the public image URL to the shared master catalogue.
            </p>
          </div>
          <Link href="/dashboard/catalogue" className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:border-cyan-500">Open Catalogue</Link>
        </div>

        {params.saved ? <div className="mt-6 rounded-2xl border border-emerald-800 bg-emerald-950/50 px-5 py-3 text-sm font-semibold text-emerald-300">Product image uploaded and connected to the master catalogue.</div> : null}
        {params.removed ? <div className="mt-6 rounded-2xl border border-amber-800 bg-amber-950/50 px-5 py-3 text-sm font-semibold text-amber-300">Product image removed.</div> : null}
        {params.error ? <div className="mt-6 rounded-2xl border border-rose-800 bg-rose-950/50 px-5 py-3 text-sm font-semibold text-rose-300">{params.error}</div> : null}

        <section className="mt-7 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">Master products</p><p className="mt-2 text-3xl font-black">{catalogue.length}</p></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">With image</p><p className="mt-2 text-3xl font-black text-emerald-400">{withImages}</p></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">Still needed</p><p className="mt-2 text-3xl font-black text-amber-300">{catalogue.length - withImages}</p></div>
        </section>

        <section className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {catalogue.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-lg shadow-black/10">
              <div className="flex h-56 items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 p-5">
                {product.image_url ? (
                  <img src={product.image_url} alt={`${product.brand} ${product.model}`} className="h-full w-full object-contain" />
                ) : (
                  <div className="text-center">
                    <div className="mx-auto flex h-32 w-24 items-center justify-center rounded-[1.5rem] border-4 border-slate-600 bg-slate-800 text-3xl font-black text-cyan-400">{product.brand.slice(0, 1)}</div>
                    <p className="mt-3 text-xs font-semibold text-slate-500">No product image yet</p>
                  </div>
                )}
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">{product.brand}</p>
                    <h2 className="mt-1 text-xl font-black">{product.model}</h2>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${product.image_url ? "bg-emerald-950 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>{product.image_url ? "Image ready" : "Missing"}</span>
                </div>

                <form action={uploadCatalogueImage} encType="multipart/form-data" className="mt-5 grid gap-3 border-t border-slate-800 pt-5">
                  <input type="hidden" name="product_id" value={product.id} />
                  <label className="text-xs font-bold text-slate-400">{product.image_url ? "Replace product image" : "Upload product image"}
                    <input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:text-xs file:font-bold file:text-slate-950" />
                  </label>
                  <p className="text-[11px] leading-5 text-slate-500">JPEG, PNG, WebP or AVIF. Maximum 5 MB. Use clean manufacturer-style product artwork where possible.</p>
                  <button type="submit" className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-300">{product.image_url ? "Replace Image" : "Upload Image"}</button>
                </form>

                {product.image_url ? (
                  <form action={removeCatalogueImage} className="mt-3">
                    <input type="hidden" name="product_id" value={product.id} />
                    <button type="submit" className="w-full rounded-xl border border-rose-900 px-4 py-2.5 text-sm font-bold text-rose-300 hover:bg-rose-950/40">Remove Image</button>
                  </form>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
