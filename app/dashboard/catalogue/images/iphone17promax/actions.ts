"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

const BUCKET = "catalogue-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const IPHONE_17_PRO_MAX_IMAGES = [
  {
    color: "Silver",
    url: "https://t-mobile.scene7.com/is/image/Tmusprod/Apple-iPhone-17-Pro-Max-Silver-frontimage?fmt=png-alpha&qlt=85%2C0&resMode=sharp2&op_usm=1.75%2C0.3%2C2%2C0&dpr=off",
  },
  {
    color: "Cosmic Orange",
    url: "https://t-mobile.scene7.com/is/image/Tmusprod/Apple-iPhone-17-Pro-Max-Cosmic-Orange-frontimage?fmt=png-alpha&qlt=85%2C0&resMode=sharp2&op_usm=1.75%2C0.3%2C2%2C0&dpr=off",
  },
  {
    color: "Deep Blue",
    url: "https://t-mobile.scene7.com/is/image/Tmusprod/Apple-iPhone-17-Pro-Max-Deep-Blue-frontimage?fmt=png-alpha&qlt=85%2C0&resMode=sharp2&op_usm=1.75%2C0.3%2C2%2C0&dpr=off",
  },
] as const;

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") redirect("/dashboard");
  return supabase;
}

async function downloadImage(url: string) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "PixelFlow-MobileShop/1.0" },
  });

  if (!response.ok) throw new Error(`Image source returned HTTP ${response.status}`);

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!contentType.startsWith("image/")) throw new Error("Source did not return an image");

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_FILE_SIZE) throw new Error("Image is larger than 5MB");

  const extension = contentType.includes("webp") ? "webp" : contentType.includes("jpeg") ? "jpg" : "png";
  return { bytes, contentType, extension };
}

export async function importIPhone17ProMaxColourImages() {
  const supabase = await requireSuperAdmin();

  const { data: product, error: productError } = await supabase
    .from("master_products")
    .select("id,brand,model")
    .eq("brand", "Apple")
    .eq("model", "iPhone 17 Pro Max")
    .single();

  if (productError || !product) {
    redirect(`/dashboard/catalogue/images/iphone17promax?error=${encodeURIComponent(productError?.message ?? "iPhone 17 Pro Max not found")}`);
  }

  try {
    for (const source of IPHONE_17_PRO_MAX_IMAGES) {
      const image = await downloadImage(source.url);
      const path = `${product.id}/colors/${slugify(source.color)}-${Date.now()}.${image.extension}`;

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, image.bytes, {
        contentType: image.contentType,
        cacheControl: "31536000",
        upsert: false,
      });
      if (uploadError) throw new Error(`${source.color}: ${uploadError.message}`);

      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

      const { data: existing } = await supabase
        .from("product_images")
        .select("id,storage_path")
        .eq("master_product_id", product.id)
        .eq("color", source.color)
        .is("variant_id", null)
        .eq("is_primary", true)
        .maybeSingle();

      const payload = {
        master_product_id: product.id,
        variant_id: null,
        color: source.color,
        image_url: publicUrl,
        storage_path: path,
        alt_text_en: `${product.brand} ${product.model} ${source.color}`,
        is_primary: true,
        sort_order: 0,
      };

      const { error: saveError } = existing
        ? await supabase.from("product_images").update(payload).eq("id", existing.id)
        : await supabase.from("product_images").insert(payload);

      if (saveError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw new Error(`${source.color}: ${saveError.message}`);
      }

      if (existing?.storage_path && existing.storage_path !== path) {
        await supabase.storage.from(BUCKET).remove([existing.storage_path]);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image import failed";
    redirect(`/dashboard/catalogue/images/iphone17promax?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/catalogue/images");
  revalidatePath("/dashboard/catalogue/images/iphone17promax");
  redirect("/dashboard/catalogue/images/iphone17promax?saved=1");
}
