"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

export async function updateInventory(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  const price = Number(formData.get("price_kwd"));
  const stock = Number(formData.get("stock_quantity"));
  const warranty = String(formData.get("warranty_text") ?? "").trim();
  const freebie = String(formData.get("freebie_text") ?? "").trim();
  const offer = String(formData.get("offer_text") ?? "").trim();
  const published = formData.get("is_published") === "on";

  if (!id || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
    redirect("/dashboard/inventory?error=Invalid%20price%20or%20stock");
  }

  // No shop_id is accepted from the browser. RLS decides whether this user may update this row.
  const { data, error } = await supabase
    .from("shop_products")
    .update({
      price_kwd: price,
      stock_quantity: stock,
      warranty_text: warranty || null,
      freebie_text: freebie || null,
      offer_text: offer || null,
      is_published: published,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  if (error || !data?.length) {
    redirect(`/dashboard/inventory?error=${encodeURIComponent(error?.message ?? "Update not permitted")}`);
  }

  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory?saved=1");
}
