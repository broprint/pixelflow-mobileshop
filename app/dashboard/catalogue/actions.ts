"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

export async function addVariantToShop(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,shop_id")
    .eq("id", user.id)
    .single();

  if (!profile?.shop_id || profile.role !== "shop_admin") {
    redirect("/dashboard/catalogue?error=Only%20shop%20admins%20can%20add%20catalogue%20items%20to%20a%20shop");
  }

  const variantId = String(formData.get("variant_id") ?? "");
  const price = Number(formData.get("price_kwd"));
  const stock = Number(formData.get("stock_quantity"));
  const warranty = String(formData.get("warranty_text") ?? "").trim();

  if (!variantId || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
    redirect("/dashboard/catalogue?error=Please%20enter%20a%20valid%20price%20and%20stock%20quantity");
  }

  const { error } = await supabase.from("shop_products").insert({
    shop_id: profile.shop_id,
    variant_id: variantId,
    price_kwd: price,
    stock_quantity: stock,
    warranty_text: warranty || null,
    is_published: false,
  });

  if (error) {
    const message = error.code === "23505" ? "This variant is already in your shop inventory" : error.message;
    redirect(`/dashboard/catalogue?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/catalogue?added=1");
}
