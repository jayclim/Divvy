
import {
    lemonSqueezySetup,
    listProducts,
    listVariants,
    listStores,
} from '@lemonsqueezy/lemonsqueezy.js';
import dotenv from 'dotenv';

// Load environment variables from .env.test.local
dotenv.config({ path: '.env.test.local' });

async function main() {
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;

    if (!apiKey) {
        console.error('❌ LEMONSQUEEZY_API_KEY not found in .env.test.local');
        process.exit(1);
    }

    lemonSqueezySetup({ apiKey });

    console.log('🔄 Fetching Lemon Squeezy data...');

    try {
        // 1. Get Stores
        const stores = await listStores();
        if (stores.error) throw stores.error;

        console.log('\n🏪 Stores:');
        for (const store of stores.data?.data || []) {
            console.log(`   - Name: ${store.attributes.name}`);
            console.log(`     ID: ${store.id}`);
            console.log(`     URL: ${store.attributes.url}`);
        }

        // 2. Get Products
        const products = await listProducts();
        if (products.error) throw products.error;

        console.log('\n📦 Products:');
        for (const product of products.data?.data || []) {
            console.log(`   - Name: ${product.attributes.name}`);
            console.log(`     ID: ${product.id}`);
            console.log(`     Store ID: ${product.attributes.store_id}`);

            // 3. Get Variants for this Product
            const variants = await listVariants({ filter: { productId: product.id } });
            if (variants.error) {
                console.error(`     ❌ Error fetching variants: ${variants.error.message}`);
                continue;
            }

            console.log('     🏷️  Variants:');
            for (const variant of variants.data?.data || []) {
                console.log(`        - Name: ${variant.attributes.name}`);
                console.log(`          ID: ${variant.id}  <-- USE THIS ID`);
                console.log(`          Status: ${variant.attributes.status}`);
                console.log(`          Sort Order: ${variant.attributes.sort}`);
            }
        }

        console.log('\n✅ Done.');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

main();
