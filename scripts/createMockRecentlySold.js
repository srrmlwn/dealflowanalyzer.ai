const fs = require('fs');
const path = require('path');

/**
 * Creates mock "recently sold" data based on current listings
 * This allows testing price comparison features without API calls
 */
async function createMockRecentlySold() {
  console.log('🏠 Creating Mock Recently Sold Data...\n');

  try {
    // Load current listings for both zip codes
    const zip1File = path.join(__dirname, '../data/properties/43211/2025-09-15/Columbus OH - Simplified Buybox.json');
    const zip2File = path.join(__dirname, '../data/properties/43224/2025-09-15/Columbus OH - Simplified Buybox.json');

    const zip1Data = JSON.parse(fs.readFileSync(zip1File, 'utf-8'));
    const zip2Data = JSON.parse(fs.readFileSync(zip2File, 'utf-8'));

    console.log(`📊 Loaded ${zip1Data.propertyCount} current listings from 43211`);
    console.log(`📊 Loaded ${zip2Data.propertyCount} current listings from 43224\n`);

    // Create recently sold versions (30% of current listings, with lower prices)
    const createRecentlySold = (properties, zipCode) => {
      // Select random 30% of properties
      const sampleSize = Math.floor(properties.length * 0.3);
      const shuffled = [...properties].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, sampleSize);

      // Transform to "recently sold" with price adjustments
      const recentlySold = selected.map((prop, index) => {
        // Sold price is 5-15% lower than current listing
        const priceReduction = 0.05 + Math.random() * 0.10;
        const soldPrice = Math.round(prop.price * (1 - priceReduction));

        // Sold 30-90 days ago
        const daysAgo = 30 + Math.floor(Math.random() * 60);
        const soldDate = new Date();
        soldDate.setDate(soldDate.getDate() - daysAgo);

        return {
          ...prop,
          listingStatus: 'RECENTLY_SOLD',
          price: soldPrice,
          originalListPrice: prop.price,
          soldDate: soldDate.toISOString(),
          daysOnMarket: 15 + Math.floor(Math.random() * 30), // 15-45 days
          priceChange: prop.price - soldPrice, // Negative = price reduction
          // Keep other fields the same
        };
      });

      return recentlySold;
    };

    const recentlySold43211 = createRecentlySold(zip1Data.properties, '43211');
    const recentlySold43224 = createRecentlySold(zip2Data.properties, '43224');

    console.log(`✅ Created ${recentlySold43211.length} mock sold properties for 43211`);
    console.log(`✅ Created ${recentlySold43224.length} mock sold properties for 43224\n`);

    // Save to recently-sold directory
    const recentlySoldDir = path.join(__dirname, '../data/recently-sold');

    // Create directories
    const zip1Dir = path.join(recentlySoldDir, '43211', '2025-12-01');
    const zip2Dir = path.join(recentlySoldDir, '43224', '2025-12-01');

    fs.mkdirSync(zip1Dir, { recursive: true });
    fs.mkdirSync(zip2Dir, { recursive: true });

    // Save data
    const save = (zipCode, properties, dir) => {
      const data = {
        timestamp: new Date().toISOString(),
        zipCode,
        buyboxName: 'Columbus OH - Simplified Buybox',
        propertyCount: properties.length,
        dataType: 'RECENTLY_SOLD',
        dateRange: {
          from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          to: new Date().toISOString().split('T')[0]
        },
        properties
      };

      const filePath = path.join(dir, 'Columbus OH - Simplified Buybox.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`💾 Saved to: ${filePath}`);

      // Calculate statistics
      const avgSoldPrice = properties.reduce((sum, p) => sum + p.price, 0) / properties.length;
      const avgOriginalPrice = properties.reduce((sum, p) => sum + p.originalListPrice, 0) / properties.length;
      const avgDiscount = ((avgOriginalPrice - avgSoldPrice) / avgOriginalPrice * 100).toFixed(1);
      const avgDaysOnMarket = properties.reduce((sum, p) => sum + p.daysOnMarket, 0) / properties.length;

      console.log(`\n📊 ${zipCode} Statistics:`);
      console.log(`   - Properties: ${properties.length}`);
      console.log(`   - Avg Sold Price: $${avgSoldPrice.toLocaleString()}`);
      console.log(`   - Avg List Price: $${avgOriginalPrice.toLocaleString()}`);
      console.log(`   - Avg Discount: ${avgDiscount}%`);
      console.log(`   - Avg Days on Market: ${Math.round(avgDaysOnMarket)} days\n`);
    };

    save('43211', recentlySold43211, zip1Dir);
    save('43224', recentlySold43224, zip2Dir);

    console.log('✅ Mock recently sold data created successfully!');
    console.log('📝 Note: This is test data to avoid API costs. Replace with real data when ready.\n');

  } catch (error) {
    console.error('❌ Error creating mock data:', error.message);
    process.exit(1);
  }
}

createMockRecentlySold().catch(console.error);
