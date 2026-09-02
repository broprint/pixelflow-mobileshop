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

function extensionFromContentType(contentType: string) {
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  return byType[normalized] ?? "jpg";
}

function storagePathFromPublicUrl(url?: string | null) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

function validateImage(image: FormDataEntryValue | null) {
  if (!(image instanceof File) || image.size === 0) {
    redirect("/dashboard/catalogue/images?error=Choose%20an%20image%20to%20upload");
  }
  if (!ALLOWED_TYPES.has(image.type)) {
    redirect("/dashboard/catalogue/images?error=Use%20JPEG%2C%20PNG%2C%20WebP%20or%20AVIF");
  }
  if (image.size > MAX_FILE_SIZE) {
    redirect("/dashboard/catalogue/images?error=Image%20must%20be%205MB%20or%20smaller");
  }
  return image;
}

function validateRemoteUrl(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    redirect("/dashboard/catalogue/images?error=Enter%20a%20valid%20image%20URL");
  }
  if (url.protocol !== "https:") {
    redirect("/dashboard/catalogue/images?error=Image%20URL%20must%20use%20HTTPS");
  }
  return url.toString();
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

async function uploadToBucket(supabase: Awaited<ReturnType<typeof createClient>>, path: string, image: File) {
  const bytes = await image.arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: image.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(error.message)}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function fetchRemoteImage(remoteUrl: string) {
  let response: Response;
  try {
    response = await fetch(remoteUrl, {
      redirect: "follow",
      headers: { "User-Agent": "PixelFlow-MobileShop/1.0" },
    });
  } catch {
    redirect("/dashboard/catalogue/images?error=Could%20not%20download%20that%20image%20URL");
  }

  if (!response.ok) {
    redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(`Image source returned HTTP ${response.status}`)}`);
  }

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) {
    redirect("/dashboard/catalogue/images?error=Remote%20URL%20must%20point%20directly%20to%20JPEG%2C%20PNG%2C%20WebP%20or%20AVIF");
  }

  const declaredSize = Number(response.headers.get("content-length") ?? "0");
  if (declaredSize > MAX_FILE_SIZE) {
    redirect("/dashboard/catalogue/images?error=Remote%20image%20must%20be%205MB%20or%20smaller");
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_FILE_SIZE) {
    redirect("/dashboard/catalogue/images?error=Remote%20image%20must%20be%205MB%20or%20smaller");
  }

  return { bytes, contentType, extension: extensionFromContentType(contentType) };
}

async function uploadRemoteToBucket(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
  remoteUrl: string,
) {
  const remote = await fetchRemoteImage(remoteUrl);
  const { error } = await supabase.storage.from(BUCKET).upload(path, remote.bytes, {
    contentType: remote.contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(error.message)}`);
  return { publicUrl: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, extension: remote.extension };
}

async function saveMasterImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  product: { id: string; brand: string; model: string; image_url: string | null },
  publicUrl: string,
  path: string,
) {
  const { error: productUpdateError } = await supabase
    .from("master_products")
    .update({ image_url: publicUrl })
    .eq("id", product.id);

  if (productUpdateError) {
    await supabase.storage.from(BUCKET).remove([path]);
    redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(productUpdateError.message)}`);
  }

  const { data: existingImage } = await supabase
    .from("product_images")
    .select("id,image_url,storage_path")
    .eq("master_product_id", product.id)
    .is("variant_id", null)
    .eq("is_primary", true)
    .maybeSingle();

  if (existingImage) {
    await supabase
      .from("product_images")
      .update({ image_url: publicUrl, storage_path: path, alt_text_en: `${product.brand} ${product.model}` })
      .eq("id", existingImage.id);
  } else {
    await supabase.from("product_images").insert({
      master_product_id: product.id,
      image_url: publicUrl,
      storage_path: path,
      alt_text_en: `${product.brand} ${product.model}`,
      is_primary: true,
    });
  }

  const previousPath = existingImage?.storage_path ?? storagePathFromPublicUrl(product.image_url);
  if (previousPath && previousPath !== path) await supabase.storage.from(BUCKET).remove([previousPath]);
}

async function saveVariantImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  variant: {
    id: string;
    master_product_id: string;
    color: string | null;
    storage_gb: number | null;
    master_products: { brand?: string; model?: string } | { brand?: string; model?: string }[] | null;
  },
  publicUrl: string,
  path: string,
) {
  const { data: existingImage } = await supabase
    .from("product_images")
    .select("id,storage_path")
    .eq("variant_id", variant.id)
    .eq("is_primary", true)
    .maybeSingle();

  const product = Array.isArray(variant.master_products) ? variant.master_products[0] : variant.master_products;
  const altText = `${product?.brand ?? ""} ${product?.model ?? ""} ${variant.color ?? ""}`.trim();

  const payload = {
    master_product_id: variant.master_product_id,
    variant_id: variant.id,
    image_url: publicUrl,
    storage_path: path,
    alt_text_en: altText,
    is_primary: true,
  };

  const { error } = existingImage
    ? await supabase.from("product_images").update(payload).eq("id", existingImage.id)
    : await supabase.from("product_images").insert(payload);

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(error.message)}`);
  }

  if (existingImage?.storage_path && existingImage.storage_path !== path) {
    await supabase.storage.from(BUCKET).remove([existingImage.storage_path]);
  }
}

export async function uploadCatalogueImage(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const productId = String(formData.get("product_id") ?? "").trim();
  const image = validateImage(formData.get("image"));

  const { data: product } = await supabase
    .from("master_products")
    .select("id,brand,model,image_url")
    .eq("id", productId)
    .single();
  if (!product) redirect("/dashboard/catalogue/images?error=Product%20not%20found");

  const path = `${productId}/master-${Date.now()}.${fileExtension(image)}`;
  const publicUrl = await uploadToBucket(supabase, path, image);
  await saveMasterImage(supabase, product, publicUrl, path);

  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/catalogue/images");
  redirect("/dashboard/catalogue/images?saved=master");
}

export async function importCatalogueImageFromUrl(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const productId = String(formData.get("product_id") ?? "").trim();
  const remoteUrl = validateRemoteUrl(formData.get("image_url"));

  const { data: product } = await supabase
    .from("master_products")
    .select("id,brand,model,image_url")
    .eq("id", productId)
    .single();
  if (!product) redirect("/dashboard/catalogue/images?error=Product%20not%20found");

  const remote = await fetchRemoteImage(remoteUrl);
  const path = `${productId}/master-${Date.now()}.${remote.extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, remote.bytes, {
    contentType: remote.contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(error.message)}`);
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  await saveMasterImage(supabase, product, publicUrl, path);

  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/catalogue/images");
  redirect("/dashboard/catalogue/images?saved=master-url");
}

export async function uploadVariantImage(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const variantId = String(formData.get("variant_id") ?? "").trim();
  const image = validateImage(formData.get("image"));

  const { data: variant } = await supabase
    .from("product_variants")
    .select("id,master_product_id,color,storage_gb,master_products(brand,model)")
    .eq("id", variantId)
    .single();
  if (!variant) redirect("/dashboard/catalogue/images?error=Variant%20not%20found");

  const path = `${variant.master_product_id}/variants/${variant.id}/${Date.now()}.${fileExtension(image)}`;
  const publicUrl = await uploadToBucket(supabase, path, image);
  await saveVariantImage(supabase, variant, publicUrl, path);

  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/catalogue/images");
  redirect("/dashboard/catalogue/images?saved=variant");
}

export async function importVariantImageFromUrl(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const variantId = String(formData.get("variant_id") ?? "").trim();
  const remoteUrl = validateRemoteUrl(formData.get("image_url"));

  const { data: variant } = await supabase
    .from("product_variants")
    .select("id,master_product_id,color,storage_gb,master_products(brand,model)")
    .eq("id", variantId)
    .single();
  if (!variant) redirect("/dashboard/catalogue/images?error=Variant%20not%20found");

  const remote = await fetchRemoteImage(remoteUrl);
  const path = `${variant.master_product_id}/variants/${variant.id}/${Date.now()}.${remote.extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, remote.bytes, {
    contentType: remote.contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(error.message)}`);
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  await saveVariantImage(supabase, variant, publicUrl, path);

  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/catalogue/images");
  redirect("/dashboard/catalogue/images?saved=variant-url");
}

export async function removeCatalogueImage(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const productId = String(formData.get("product_id") ?? "").trim();

  const { data: product } = await supabase
    .from("master_products")
    .select("image_url")
    .eq("id", productId)
    .single();
  if (!product) redirect("/dashboard/catalogue/images?error=Product%20not%20found");

  const { data: imageRow } = await supabase
    .from("product_images")
    .select("id,storage_path")
    .eq("master_product_id", productId)
    .is("variant_id", null)
    .eq("is_primary", true)
    .maybeSingle();

  const { error } = await supabase.from("master_products").update({ image_url: null }).eq("id", productId);
  if (error) redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(error.message)}`);

  if (imageRow) await supabase.from("product_images").delete().eq("id", imageRow.id);
  const previousPath = imageRow?.storage_path ?? storagePathFromPublicUrl(product.image_url);
  if (previousPath) await supabase.storage.from(BUCKET).remove([previousPath]);

  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/catalogue/images");
  redirect("/dashboard/catalogue/images?removed=master");
}

export async function removeVariantImage(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const variantId = String(formData.get("variant_id") ?? "").trim();

  const { data: imageRow } = await supabase
    .from("product_images")
    .select("id,storage_path")
    .eq("variant_id", variantId)
    .eq("is_primary", true)
    .maybeSingle();

  if (imageRow) {
    const { error } = await supabase.from("product_images").delete().eq("id", imageRow.id);
    if (error) redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(error.message)}`);
    if (imageRow.storage_path) await supabase.storage.from(BUCKET).remove([imageRow.storage_path]);
  }

  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/catalogue/images");
  redirect("/dashboard/catalogue/images?removed=variant");
}
