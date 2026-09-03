"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

const BUCKET = "catalogue-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const COLORS = ["Cobalt Violet", "Sky Blue", "Black", "White", "Silver Shadow", "Pink Gold"] as const;
const MODELS = [
  { model: "Galaxy S26", asset: "Galaxy-S26" },
  { model: "Galaxy S26+", asset: "Galaxy-S26-Plus" },
  { model: "Galaxy S26 Ultra", asset: "Galaxy-S26-Ultra" },
] as const;

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function samsungImageUrl(asset: string, color: string) {
  const assetColor = color.replaceAll(" ", "-");
  return `https://images.samsung.com/is/image/samsung/assets/ae/s2602/specs/${asset}_${assetColor}_163x346.jpg`;
}

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") redirect("/dashboard");
  return supabase;
}

async function downloadImage(url: string) {
  const response = await fetch(url, { redirect: "follow", headers: { "User-Agent": "PixelFlow-MobileShop/1.0" } });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!contentType.startsWith("image/")) throw new Error("Source did not return an image");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_FILE_SIZE) throw new Error("Image is larger than 5MB");
  const extension = contentType.includes("webp") ? "webp" : contentType.includes("png") ? "png" : "jpg";
  return { bytes, contentType, extension };
}

export async function importSamsungS26ColourImages() {
  const supabase = await requireSuperAdmin();

  try {
    for (const modelSource of MODELS) {
      const { data: product, error: productError } = await supabase
        .from("master_products")
        .select("id,brand,model")
        .eq("brand", "Samsung")
        .eq("model", modelSource.model)
        .single();
      if (productError || !product) throw new Error(`${modelSource.model}: product not found`);

      const { data: variants, error: variantError } = await supabase
        .from("product_variants")
        .select("color")
        .eq("master_product_id", product.id)
        .eq("is_active", true);
      if (variantError) throw new Error(`${modelSource.model}: ${variantError.message}`);

      const activeColours = new Set((variants ?? []).map((variant) => variant.color).filter(Boolean));
      const coloursToImport = COLORS.filter((color) => activeColours.has(color));

      for (const color of coloursToImport) {
        const image = await downloadImage(samsungImageUrl(modelSource.asset, color));
        const path = `${product.id}/colors/${slugify(color)}-${Date.now()}.${image.extension}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, image.bytes, {
          contentType: image.contentType,
          cacheControl: "31536000",
          upsert: false,
        });
        if (uploadError) throw new Error(`${modelSource.model} ${color}: ${uploadError.message}`);

        const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        const { data: existing } = await supabase
          .from("product_images")
          .select("id,storage_path")
          .eq("master_product_id", product.id)
          .ilike("color", color)
          .is("variant_id", null)
          .eq("is_primary", true)
          .maybeSingle();

        const payload = {
          master_product_id: product.id,
          variant_id: null,
          color,
          image_url: publicUrl,
          storage_path: path,
          alt_text_en: `Samsung ${modelSource.model} ${color}`,
          is_primary: true,
          sort_order: 0,
        };
        const { error: saveError } = existing
          ? await supabase.from("product_images").update(payload).eq("id", existing.id)
          : await supabase.from("product_images").insert(payload);
        if (saveError) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw new Error(`${modelSource.model} ${color}: ${saveError.message}`);
        }
        if (existing?.storage_path && existing.storage_path !== path) {
          await supabase.storage.from(BUCKET).remove([existing.storage_path]);
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Samsung image import failed";
    redirect(`/dashboard/catalogue/images/samsung-s26?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/catalogue/images");
  revalidatePath("/dashboard/catalogue/images/samsung-s26");
  redirect("/dashboard/catalogue/images/samsung-s26?saved=1");
}
