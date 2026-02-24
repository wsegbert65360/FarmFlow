#!/usr/bin/env node
/**
 * Script: clear_invalid_responses.js
 * Description: Given a JSON file containing cached OpenAI Responses ids (either
 * an array of ids or an object mapping id -> meta), this script checks each
 * id via the OpenAI Responses GET endpoint and removes any that return 404.
 *
 * Usage: OPENAI_API_KEY=sk-... node scripts/clear_invalid_responses.js path/to/cache.json
 */
const fs = require('fs').promises;
const fetch = globalThis.fetch || require('node-fetch');

async function existsOnServer(id, apiKey){
  const url = `https://api.openai.com/v1/responses/${id}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  return r.ok;
}

async function main(){
  const apiKey = process.env.OPENAI_API_KEY;
  if(!apiKey){
    console.error('OPENAI_API_KEY environment variable is required');
    process.exit(2);
  }

  const cachePath = process.argv[2] || './responses-cache.json';
  let data;
  try{
    const raw = await fs.readFile(cachePath, 'utf8');
    data = JSON.parse(raw);
  }catch(err){
    console.error('Failed to read/parse cache file:', cachePath, err.message);
    process.exit(1);
  }

  if(Array.isArray(data)){
    const keep = [];
    for(const id of data){
      try{
        const ok = await existsOnServer(id, apiKey);
        if(ok) keep.push(id);
        else console.log('Removed invalid id', id);
      }catch(err){
        console.warn('Error checking id', id, err.message);
      }
    }
    await fs.writeFile(cachePath, JSON.stringify(keep, null, 2));
    console.log('Done. Updated', cachePath);
    return;
  }

  if(data && typeof data === 'object'){
    const keys = Object.keys(data);
    for(const id of keys){
      try{
        const ok = await existsOnServer(id, apiKey);
        if(!ok){
          delete data[id];
          console.log('Removed invalid id', id);
        }
      }catch(err){
        console.warn('Error checking id', id, err.message);
      }
    }
    await fs.writeFile(cachePath, JSON.stringify(data, null, 2));
    console.log('Done. Updated', cachePath);
    return;
  }

  console.error('Unknown cache file structure. Expecting array or object.');
  process.exit(1);
}

main().catch(err=>{ console.error(err); process.exit(1); });
