import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { importSamsungS26ColourImages } from "./actions";

const MODELS = ["Galaxy S26", "Galaxy S26+", "Galaxy S26 Ultra"];

export default async function SamsungS26ImagesPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") redirect("/dashboard");

  const { data: products } = await supabase
    .from("master_products")
    .select("id,brand,model")
    .eq("brand", "Samsung")
    .in("model", MODELS);
  const productIds = (products ?? []).map((product) => product.id);
  const [{ data: variants }, { data: images }] = productIds.length
    ? await Promise.all([
        supabase.from("product_variants").select("master_product_id,color").in("master_product_id", productIds).eq("is_active", true),
        supabase.from("product_images").select("master_product_id,color,image_url").in("master_product_id", productIds).is("variant_id", null).eq("is_primary", true).not("color", "is", null),
      ])
    : [{ data: [] }, { data: [] }];

  const imageMap = new Map((images ?? []).map((image) => [`${image.master_product_id}::${String(image.color).toLowerCase()}`, image.image_url]));

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white md:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/catalogue/images" className="text-sm font-semibold text-cyan-400 hover:text-cyan-300">← Product Image Manager</Link>
        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">Samsung catalogue media</p>
          <h1 className="mt-2 text-3xl font-black">Galaxy S26 family colour images</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Imports Samsung-hosted colour artwork for the active catalogue colours of Galaxy S26, S26+ and S26 Ultra. Each colour image is shared across that model's storage capacities.</p>

          {params.saved ? <div className="mt-5 rounded-2xl border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm font-semibold text-emerald-300">Samsung S26 family colour images were imported into PixelFlow storage.</div> : null}
          {params.error ? <div className="mt-5 rounded-2xl border border-rose-800 bg-rose-950/50 px-4 py-3 text-sm font-semibold text-rose-300">{params.error}</div> : null}

          <div className="mt-7 grid gap-6">
            {MODELS.map((model) => {
              const product = (products ?? []).find((item) => item.model === model);
              const colours = product ? [...new Set((variants ?? []).filter((variant) => variant.master_product_id === product.id).map((variant) => variant.color).filter(Boolean))].sort() : [];
              return (
                <section key={model} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black">Samsung {model}</h2><span className="text-xs text-slate-500">{colours.length} catalogue colours</span></div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                    {colours.map((color) => {
                      const imageUrl = product ? imageMap.get(`${product.id}::${String(color).toLowerCase()}`) : undefined;
                      return (
                        <div key={String(color)} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                          <div className="flex h-36 items-center justify-center rounded-lg bg-slate-950 p-2">{imageUrl ? <img src={imageUrl} alt={`Samsung ${model} ${color}`} className="h-full w-full object-contain" /> : <span className="text-xs text-slate-600">Not imported</span>}</div>
                          <p className="mt-3 text-xs font-black">{color}</p>
                          <p className={`mt-1 text-[11px] ${imageUrl ? "text-emerald-400" : "text-slate-500"}`}>{imageUrl ? "Ready" : "Waiting"}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <form action={importSamsungS26ColourImages} className="mt-7">
            <button className="w-full rounded-2xl bg-cyan-500 px-5 py-4 text-sm font-black text-slate-950 hover:bg-cyan-400">Import Samsung S26 family colour images</button>
          </form>
          <p className="mt-3 text-center text-xs text-slate-500">PixelFlow downloads Samsung-hosted artwork and stores its own copy in the catalogue-images bucket.</p>
        </div>
      </div>
    </main>
  );
}
