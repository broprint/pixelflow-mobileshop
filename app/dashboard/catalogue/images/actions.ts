"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

const BUCKET = "catalogue-images";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function extensionFromType(type: string) {
  const normalized = type.split(";")[0].trim().toLowerCase();
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" } as Record<string, string>)[normalized] ?? "jpg";
}

function safeColourSlug(colour: string) {
  return colour.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "standard";
}

function storagePathFromPublicUrl(url?: string | null) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length));
}

function validateLocalImage(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) redirect("/dashboard/catalogue/images?error=Choose%20an%20image%20to%20upload");
  if (!ALLOWED_TYPES.has(value.type)) redirect("/dashboard/catalogue/images?error=Use%20JPEG%2C%20PNG%2C%20WebP%20or%20AVIF");
  if (value.size > MAX_FILE_SIZE) redirect("/dashboard/catalogue/images?error=Image%20must%20be%205MB%20or%20smaller");
  return value;
}

function validateRemoteUrl(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  let url: URL;
  try { url = new URL(raw); } catch { redirect("/dashboard/catalogue/images?error=Enter%20a%20valid%20image%20URL"); }
  if (url.protocol !== "https:") redirect("/dashboard/catalogue/images?error=Image%20URL%20must%20use%20HTTPS");
  return url.toString();
}

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") redirect("/dashboard?error=Super%20Admin%20access%20required");
  return supabase;
}

async function uploadBytes(supabase: Awaited<ReturnType<typeof createClient>>, path: string, bytes: ArrayBuffer, contentType: string) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, cacheControl: "31536000", upsert: false });
  if (error) redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(error.message)}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function fetchRemoteImage(remoteUrl: string) {
  let response: Response;
  try { response = await fetch(remoteUrl, { redirect: "follow", headers: { "User-Agent": "PixelFlow-MobileShop/1.0" } }); }
  catch { redirect("/dashboard/catalogue/images?error=Could%20not%20download%20that%20image%20URL"); }
  if (!response.ok) redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(`Image source returned HTTP ${response.status}`)}`);
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) redirect("/dashboard/catalogue/images?error=Remote%20URL%20must%20point%20directly%20to%20JPEG%2C%20PNG%2C%20WebP%20or%20AVIF");
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_FILE_SIZE) redirect("/dashboard/catalogue/images?error=Remote%20image%20must%20be%205MB%20or%20smaller");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_FILE_SIZE) redirect("/dashboard/catalogue/images?error=Remote%20image%20must%20be%205MB%20or%20smaller");
  return { bytes, contentType };
}

async function getProduct(supabase: Awaited<ReturnType<typeof createClient>>, productId: string) {
  const { data: product } = await supabase.from("master_products").select("id,brand,model,image_url").eq("id", productId).single();
  if (!product) redirect("/dashboard/catalogue/images?error=Product%20not%20found");
  return product;
}

async function saveMasterImage(supabase: Awaited<ReturnType<typeof createClient>>, product: { id: string; brand: string; model: string; image_url: string | null }, publicUrl: string, path: string) {
  const { data: existing } = await supabase.from("product_images").select("id,storage_path").eq("master_product_id", product.id).is("variant_id", null).is("color", null).eq("is_primary", true).maybeSingle();
  const { error: productError } = await supabase.from("master_products").update({ image_url: publicUrl }).eq("id", product.id);
  if (productError) { await supabase.storage.from(BUCKET).remove([path]); redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(productError.message)}`); }
  const payload = { master_product_id: product.id, variant_id: null, color: null, image_url: publicUrl, storage_path: path, alt_text_en: `${product.brand} ${product.model}`, is_primary: true };
  const { error } = existing ? await supabase.from("product_images").update(payload).eq("id", existing.id) : await supabase.from("product_images").insert(payload);
  if (error) { await supabase.storage.from(BUCKET).remove([path]); redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(error.message)}`); }
  const previousPath = existing?.storage_path ?? storagePathFromPublicUrl(product.image_url);
  if (previousPath && previousPath !== path) await supabase.storage.from(BUCKET).remove([previousPath]);
}

async function saveColourImage(supabase: Awaited<ReturnType<typeof createClient>>, product: { id: string; brand: string; model: string }, colour: string, publicUrl: string, path: string) {
  const { data: existing } = await supabase.from("product_images").select("id,storage_path").eq("master_product_id", product.id).is("variant_id", null).ilike("color", colour).eq("is_primary", true).maybeSingle();
  const payload = { master_product_id: product.id, variant_id: null, color: colour, image_url: publicUrl, storage_path: path, alt_text_en: `${product.brand} ${product.model} ${colour}`, is_primary: true };
  const { error } = existing ? await supabase.from("product_images").update(payload).eq("id", existing.id) : await supabase.from("product_images").insert(payload);
  if (error) { await supabase.storage.from(BUCKET).remove([path]); redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(error.message)}`); }
  if (existing?.storage_path && existing.storage_path !== path) await supabase.storage.from(BUCKET).remove([existing.storage_path]);
}

function refresh() {
  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/catalogue/images");
}

export async function uploadCatalogueImage(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const productId = String(formData.get("product_id") ?? "").trim();
  const image = validateLocalImage(formData.get("image"));
  const product = await getProduct(supabase, productId);
  const path = `${productId}/master-${Date.now()}.${extensionFromType(image.type)}`;
  const publicUrl = await uploadBytes(supabase, path, await image.arrayBuffer(), image.type);
  await saveMasterImage(supabase, product, publicUrl, path);
  refresh(); redirect("/dashboard/catalogue/images?saved=master");
}

export async function importCatalogueImageFromUrl(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const productId = String(formData.get("product_id") ?? "").trim();
  const remoteUrl = validateRemoteUrl(formData.get("image_url"));
  const product = await getProduct(supabase, productId);
  const remote = await fetchRemoteImage(remoteUrl);
  const path = `${productId}/master-${Date.now()}.${extensionFromType(remote.contentType)}`;
  const publicUrl = await uploadBytes(supabase, path, remote.bytes, remote.contentType);
  await saveMasterImage(supabase, product, publicUrl, path);
  refresh(); redirect("/dashboard/catalogue/images?saved=master-url");
}

export async function uploadColourImage(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const productId = String(formData.get("product_id") ?? "").trim();
  const colour = String(formData.get("color") ?? "").trim();
  if (!colour) redirect("/dashboard/catalogue/images?error=Colour%20is%20required");
  const image = validateLocalImage(formData.get("image"));
  const product = await getProduct(supabase, productId);
  const path = `${productId}/colours/${safeColourSlug(colour)}/${Date.now()}.${extensionFromType(image.type)}`;
  const publicUrl = await uploadBytes(supabase, path, await image.arrayBuffer(), image.type);
  await saveColourImage(supabase, product, colour, publicUrl, path);
  refresh(); redirect("/dashboard/catalogue/images?saved=colour");
}

export async function importColourImageFromUrl(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const productId = String(formData.get("product_id") ?? "").trim();
  const colour = String(formData.get("color") ?? "").trim();
  if (!colour) redirect("/dashboard/catalogue/images?error=Colour%20is%20required");
  const remoteUrl = validateRemoteUrl(formData.get("image_url"));
  const product = await getProduct(supabase, productId);
  const remote = await fetchRemoteImage(remoteUrl);
  const path = `${productId}/colours/${safeColourSlug(colour)}/${Date.now()}.${extensionFromType(remote.contentType)}`;
  const publicUrl = await uploadBytes(supabase, path, remote.bytes, remote.contentType);
  await saveColourImage(supabase, product, colour, publicUrl, path);
  refresh(); redirect("/dashboard/catalogue/images?saved=colour-url");
}

export async function removeCatalogueImage(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const productId = String(formData.get("product_id") ?? "").trim();
  const product = await getProduct(supabase, productId);
  const { data: row } = await supabase.from("product_images").select("id,storage_path").eq("master_product_id", productId).is("variant_id", null).is("color", null).eq("is_primary", true).maybeSingle();
  const { error } = await supabase.from("master_products").update({ image_url: null }).eq("id", productId);
  if (error) redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(error.message)}`);
  if (row) await supabase.from("product_images").delete().eq("id", row.id);
  const path = row?.storage_path ?? storagePathFromPublicUrl(product.image_url);
  if (path) await supabase.storage.from(BUCKET).remove([path]);
  refresh(); redirect("/dashboard/catalogue/images?removed=master");
}

export async function removeColourImage(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const productId = String(formData.get("product_id") ?? "").trim();
  const colour = String(formData.get("color") ?? "").trim();
  const { data: row } = await supabase.from("product_images").select("id,storage_path").eq("master_product_id", productId).is("variant_id", null).ilike("color", colour).eq("is_primary", true).maybeSingle();
  if (row) {
    const { error } = await supabase.from("product_images").delete().eq("id", row.id);
    if (error) redirect(`/dashboard/catalogue/images?error=${encodeURIComponent(error.message)}`);
    if (row.storage_path) await supabase.storage.from(BUCKET).remove([row.storage_path]);
  }
  refresh(); redirect("/dashboard/catalogue/images?removed=colour");
}
