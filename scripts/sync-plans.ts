import { db } from '../lib/db';
import { plans } from '../lib/db/schema';
import { lemonSqueezySetup, listProducts, listVariants } from '@lemonsqueezy/lemonsqueezy.js';

async function main() {
  console.log('Syncing plans from Lemon Squeezy...\n');

  // Configure Lemon Squeezy
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error('LEMONSQUEEZY_API_KEY is not defined');
  }

  lemonSqueezySetup({
    apiKey,
    onError: (error) => console.error('Lemon Squeezy Error:', error),
  });

  // Fetch products
  const productsResponse = await listProducts({
    filter: { storeId: process.env.LEMONSQUEEZY_STORE_ID },
    include: ['variants'],
  });

  if (productsResponse.error) {
    throw new Error(`Failed to fetch products: ${productsResponse.error.message}`);
  }

  const allProducts = productsResponse.data?.data ?? [];
  console.log(`Found ${allProducts.length} products`);

  // Fetch variants
  const variantsResponse = await listVariants({
    filter: { productId: allProducts.map((p) => p.id).join(',') },
  });

  if (variantsResponse.error) {
    throw new Error(`Failed to fetch variants: ${variantsResponse.error.message}`);
  }

  const allVariants = variantsResponse.data?.data ?? [];
  console.log(`Found ${allVariants.length} variants\n`);

  // Create product map
  const productMap = new Map(
    allProducts.map((product) => [
      product.id,
      {
        id: parseInt(product.id, 10),
        name: product.attributes.name,
        description: product.attributes.description,
      },
    ])
  );

  // Process variants
  let syncedCount = 0;
  for (const variant of allVariants) {
    const productId = variant.attributes.product_id;
    const product = productMap.get(productId.toString());

    if (!product) {
      console.warn(`Product not found for variant ${variant.id}`);
      continue;
    }

    if (variant.attributes.status === 'draft') {
      console.log(`Skipping draft variant: ${variant.attributes.name}`);
      continue;
    }

    const attrs = variant.attributes as Record<string, unknown>;
    const planData = {
      productId: product.id,
      productName: product.name,
      variantId: parseInt(variant.id, 10),
      name: variant.attributes.name,
      description: variant.attributes.description || product.description,
      price: variant.attributes.price.toString(),
      isUsageBased: (attrs.is_usage_based as boolean) ?? false,
      interval: variant.attributes.interval ?? null,
      intervalCount: variant.attributes.interval_count ?? null,
      trialInterval: (attrs.trial_interval as string) ?? null,
      trialIntervalCount: (attrs.trial_interval_count as number) ?? null,
      sort: variant.attributes.sort,
      updatedAt: new Date(),
    };

    await db
      .insert(plans)
      .values(planData)
      .onConflictDoUpdate({
        target: plans.variantId,
        set: planData,
      });

    console.log(`Synced: ${planData.name} (Variant: ${planData.variantId}) - $${parseInt(planData.price) / 100}/${planData.interval || 'one-time'}`);
    syncedCount++;
  }

  console.log(`\nSync completed! ${syncedCount} plans synced.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});