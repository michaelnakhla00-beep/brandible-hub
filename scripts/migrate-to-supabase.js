// scripts/migrate-to-supabase.js
// Run this script to migrate data from clients.json to Supabase
// Usage: node scripts/migrate-to-supabase.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateData() {
  try {
    // Read clients.json
    const clientsPath = path.join(__dirname, '../data/clients.json');
    const clientsData = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
    
    console.log(`📊 Found ${clientsData.clients.length} clients to migrate`);
    
    // Clear existing data (optional - comment out if you want to keep existing)
    // const { error: deleteError } = await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // if (deleteError) {
    //   console.error('Delete error:', deleteError);
    // }
    
    // Insert clients
    for (const client of clientsData.clients) {
      console.log(`Migrating client: ${client.name} (${client.email})`);
      
      const { data, error } = await supabase
        .from('clients')
        .upsert({
          email: client.email,
          name: client.name,
          kpis: client.kpis || {},
          projects: client.projects || [],
          files: client.files || [],
          invoices: client.invoices || [],
          activity: client.activity || [],
          updates: client.updates || []
        }, {
          onConflict: 'email'
        });
      
      if (error) {
        console.error(`❌ Error migrating ${client.email}:`, error.message);
      } else {
        console.log(`✅ Migrated ${client.email}`);
      }
    }
    
    console.log('\n✨ Migration complete!');
    
    // Verify data
    const { data: clients, error: verifyError } = await supabase
      .from('clients')
      .select('email, name');
    
    if (!verifyError) {
      console.log(`\n📊 Total clients in database: ${clients.length}`);
      clients.forEach(c => console.log(`  - ${c.name} (${c.email})`));
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateData();

