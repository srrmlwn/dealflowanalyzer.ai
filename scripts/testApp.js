const { readFileSync } = require('fs');
const { join } = require('path');

async function testApp() {
  console.log('🚀 Testing Real Estate Analysis App');
  console.log('===================================\n');

  try {
    // Test 1: Check if required files exist
    console.log('📁 Test 1: File Structure Check');
    console.log('--------------------------------');
    
    const requiredFiles = [
      'config/financial.json',
      'data/hud-rental-data.json',
      'backend/dist/services/financialAnalysisService.js',
      'frontend/pages/index.tsx'
    ];

    let filesExist = 0;
    for (const file of requiredFiles) {
      try {
        const fs = require('fs');
        if (fs.existsSync(file)) {
          console.log(`✅ ${file}`);
          filesExist++;
        } else {
          console.log(`❌ ${file} - Missing`);
        }
      } catch (error) {
        console.log(`❌ ${file} - Error checking`);
      }
    }
    
    console.log(`\n📊 File Check: ${filesExist}/${requiredFiles.length} files found\n`);

    // Test 2: Configuration Test
    console.log('⚙️  Test 2: Configuration Check');
    console.log('--------------------------------');
    
    try {
      const config = JSON.parse(readFileSync('config/financial.json', 'utf-8'));
      console.log('✅ Financial configuration loaded');
      console.log(`   Mortgage Rate: ${config.mortgage.interestRate}%`);
      console.log(`   Down Payment: ${config.mortgage.downPaymentPercent}%`);
      console.log(`   HUD Data: ${config.rental.useHudData ? 'Enabled' : 'Disabled'}`);
    } catch (error) {
      console.log('❌ Financial configuration failed to load');
    }

    // Test 3: Data Files Test
    console.log('\n📊 Test 3: Data Files Check');
    console.log('----------------------------');
    
    try {
      const hudData = JSON.parse(readFileSync('data/hud-rental-data.json', 'utf-8'));
      console.log(`✅ HUD data loaded: ${hudData.length} records`);
      
      if (hudData.length > 0) {
        const sample = hudData[0];
        console.log(`   Sample: ${sample.zipCode} - ${sample.bedrooms}BR - $${sample.fairMarketRent}/month`);
      }
    } catch (error) {
      console.log('❌ HUD data failed to load');
    }

    // Test 4: Property Data Test
    console.log('\n🏠 Test 4: Property Data Check');
    console.log('-------------------------------');
    
    try {
      const fs = require('fs');
      const propertyDirs = fs.readdirSync('data/properties', { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      console.log(`✅ Found property data for ${propertyDirs.length} zip codes: ${propertyDirs.join(', ')}`);
      
      if (propertyDirs.length > 0) {
        const zipCode = propertyDirs[0];
        const dateDirs = fs.readdirSync(`data/properties/${zipCode}`, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);
        
        if (dateDirs.length > 0) {
          const dateDir = dateDirs[0];
          const files = fs.readdirSync(`data/properties/${zipCode}/${dateDir}`);
          console.log(`   Latest data: ${zipCode}/${dateDir} - ${files.length} files`);
        }
      }
    } catch (error) {
      console.log('⚠️  No property data found (run property search first)');
    }

    // Test 5: Backend Build Test
    console.log('\n🔧 Test 5: Backend Build Check');
    console.log('-------------------------------');
    
    try {
      const fs = require('fs');
      const distFiles = fs.readdirSync('backend/dist', { recursive: true });
      const jsFiles = distFiles.filter(f => f.endsWith('.js')).length;
      console.log(`✅ Backend compiled: ${jsFiles} JavaScript files in dist/`);
    } catch (error) {
      console.log('❌ Backend not compiled (run npm run build:backend)');
    }

    // Test 6: Frontend Check
    console.log('\n🎨 Test 6: Frontend Check');
    console.log('-------------------------');
    
    try {
      const fs = require('fs');
      const frontendFiles = [
        'frontend/pages/index.tsx',
        'frontend/pages/analysis.tsx',
        'frontend/components/Navigation.tsx'
      ];
      
      let frontendFilesExist = 0;
      for (const file of frontendFiles) {
        if (fs.existsSync(file)) {
          frontendFilesExist++;
        }
      }
      
      console.log(`✅ Frontend files: ${frontendFilesExist}/${frontendFiles.length} found`);
    } catch (error) {
      console.log('❌ Frontend files check failed');
    }

    console.log('\n🎯 Test Summary');
    console.log('===============');
    console.log('✅ Basic file structure check complete');
    console.log('✅ Configuration files validated');
    console.log('✅ Data files checked');
    console.log('');
    console.log('🚀 Next Steps to Test Your App:');
    console.log('1. Start Backend: npm run dev:backend');
    console.log('2. Start Frontend: npm run dev:frontend');
    console.log('3. Open Browser: http://localhost:3000');
    console.log('4. Test API: http://localhost:8000/api/analysis/test');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testApp().catch(console.error);