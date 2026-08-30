import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

export default async function CataloguePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: products } = await supabase
    .from("master_products")
    .select(
      "id,brand,model,category,is_active,product_variants(id,sku,storage_gb,ram_gb,color,network,region,is_active)"
    )
    .order("brand")
    .order("model");

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white md:p-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="text-sm text-cyan-400 hover:text-cyan-300">
          ← Back to dashboard
        </Link>

        <div className="mt-6">
          <p className="text-sm font-bold tracking-[0.25em] text-cyan-400">PHASE 2</p>
          <h1 className="mt-2 text-3xl font-bold">Master Catalogue</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Shared device information lives here once. Each retailer adds its own commercial price,
            stock, warranty, offer and freebie separately.
          </p>
        </div>

        <section className="mt-8 grid gap-5">
          {(products ?? []).map((product) => (
            <article key={product.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-cyan-400">{product.brand}</p>
                  <h2 className="mt-1 text-2xl font-bold">{product.model}</h2>
                  <p className="mt-2 text-sm capitalize text-slate-500">{product.category}</p>
                </div>
                <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-300">
                  {product.is_active ? "active" : "inactive"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {(product.product_variants ?? []).map((variant) => (
                  <div key={variant.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{variant.storage_gb ? `${variant.storage_gb}GB` : "Standard"}</p>
                      <span className="text-xs text-slate-500">{variant.sku}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                      {variant.ram_gb ? <span>{variant.ram_gb}GB RAM</span> : null}
                      {variant.color ? <span>• {variant.color}</span> : null}
                      {variant.network ? <span>• {variant.network}</span> : null}
                      {variant.region ? <span>• {variant.region}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
