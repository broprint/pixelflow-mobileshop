import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { importIPhone17ProMaxColourImages } from "./actions";

const COLORS = ["Silver", "Cosmic Orange", "Deep Blue"];

export default async function IPhone17ProMaxImagesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") redirect("/dashboard");

  const { data: product } = await supabase
    .from("master_products")
    .select("id,brand,model")
    .eq("brand", "Apple")
    .eq("model", "iPhone 17 Pro Max")
    .single();

  const { data: images } = product
    ? await supabase
        .from("product_images")
        .select("color,image_url")
        .eq("master_product_id", product.id)
        .is("variant_id", null)
        .eq("is_primary", true)
        .not("color", "is", null)
    : { data: [] as { color: string | null; image_url: string }[] };

  const imageByColor = new Map((images ?? []).map((image) => [image.color, image.image_url]));

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white md:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard/catalogue/images" className="text-sm font-semibold text-cyan-400 hover:text-cyan-300">
          ← Product Image Manager
        </Link>

        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">Apple catalogue media</p>
          <h1 className="mt-2 text-3xl font-black">iPhone 17 Pro Max colour images</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            One image is stored for each finish and reused automatically across every storage capacity of the same colour.
          </p>

          {params.saved ? (
            <div className="mt-5 rounded-2xl border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm font-semibold text-emerald-300">
              All three iPhone 17 Pro Max colour images were imported into PixelFlow storage.
            </div>
          ) : null}

          {params.error ? (
            <div className="mt-5 rounded-2xl border border-rose-800 bg-rose-950/50 px-4 py-3 text-sm font-semibold text-rose-300">
              {params.error}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {COLORS.map((color) => {
              const imageUrl = imageByColor.get(color);
              return (
                <div key={color} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex h-52 items-center justify-center rounded-xl bg-slate-900 p-3">
                    {imageUrl ? (
                      <img src={imageUrl} alt={`Apple iPhone 17 Pro Max ${color}`} className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-xs text-slate-600">Not imported</span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-black">{color}</p>
                  <p className={`mt-1 text-xs ${imageUrl ? "text-emerald-400" : "text-slate-500"}`}>
                    {imageUrl ? "Ready" : "Waiting"}
                  </p>
                </div>
              );
            })}
          </div>

          <form action={importIPhone17ProMaxColourImages} className="mt-7">
            <button className="w-full rounded-2xl bg-cyan-500 px-5 py-4 text-sm font-black text-slate-950 hover:bg-cyan-400">
              Import all 3 iPhone 17 Pro Max colour images
            </button>
          </form>

          <p className="mt-3 text-center text-xs text-slate-500">
            PixelFlow downloads the source artwork and stores its own copy in the catalogue-images bucket.
          </p>
        </div>
      </div>
    </main>
  );
}
