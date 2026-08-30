"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

const BUCKET = "catalogue-images";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function fileExtension(file: File) {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  return byType[file.type] ?? "jpg";
}

function storagePathFromPublicUrl(url?: string | null) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

async function requireSuperAdmin() {
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

  if (profile?.role !== "super_admin") {
    redirect("/dashboard?error=Super%20Admin%20access%20required");
  }

  return supabase;
}

export async function uploadCatalogueImage(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const productId = String(formData.get("product_id") ?? "").trim();
  const image = formData.get("image");

  if (!productId || !(image instanceof File) || image.size === 0) {
    redirect("/dashboard/catalogue/images?error=Choose%20a%20product%20and%20image");
  }

  if (!ALLOWED_TYPES.has(image.type)) {
    redirect("/dashboard/catalogue/images?error=Use%20JPEG%2C%20PNG%2C%20WebP%20or%20AVIF");
  }

  if (image.size > MAX_FILE_SIZE) {
    redirect("/dashboard/catalogue/images?error=Image%20must%20be%205MB%20or%20smaller");
  }

  const { data: product, error: productError } = await supabase
    .from("master_products")
    .select("id,image_url")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    redirect("/dashboard/catalogue/images?error=Product%20not%20found");
  }

  const path = `${productId}/${Date.now()}.${fileExtension(image)}`;
  const bytes = await image.arrayBuffer();
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: image.type,
    cacheControl: "31536000",
    upsert: false,
  });

  if (uploadError) {
    redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(uploadError.message)}`);
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error: updateError } = await supabase
    .from("master_products")
    .update({ image_url: publicUrlData.publicUrl })
    .eq("id", productId);

  if (updateError) {
    await supabase.storage.from(BUCKET).remove([path]);
    redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(updateError.message)}`);
  }

  const previousPath = storagePathFromPublicUrl(product.image_url);
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(BUCKET).remove([previousPath]);
  }

  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/catalogue/images");
  redirect("/dashboard/catalogue/images?saved=1");
}

export async function removeCatalogueImage(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const productId = String(formData.get("product_id") ?? "").trim();

  const { data: product } = await supabase
    .from("master_products")
    .select("image_url")
    .eq("id", productId)
    .single();

  if (!product) {
    redirect("/dashboard/catalogue/images?error=Product%20not%20found");
  }

  const { error } = await supabase
    .from("master_products")
    .update({ image_url: null })
    .eq("id", productId);

  if (error) {
    redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(error.message)}`);
  }

  const previousPath = storagePathFromPublicUrl(product.image_url);
  if (previousPath) {
    await supabase.storage.from(BUCKET).remove([previousPath]);
  }

  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/catalogue/images");
  redirect("/dashboard/catalogue/images?removed=1");
}
