#!/usr/bin/env ts-node

import { chartService } from '../services/chartService';

async function main() {
  console.log('🚀 Starting chart generation for all tokens...');
  
  try {
    await chartService.generateAllTokenCharts();
    console.log('✅ Chart generation complete!');
  } catch (error) {
    console.error('❌ Error generating charts:', error);
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));