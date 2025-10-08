import { Client, Databases } from "node-appwrite";
import { Parser } from "json2csv";
import fs from "fs";

// Appwrite Configuration
const APPWRITE_ENDPOINT = "https://cloud.appwrite.io/v1";
const PROJECT_ID = "68ddd7de00255d4f5c96";
const API_KEY = "standard_8188632fa04db969225e3e89d287ca3d97c7c07b396325548c73b75226654a94b6c45b18bb5772d89bb81e8d9dd9a3e5efacb2d7752ad045271b639f892f18d187661f9301ae3951fd994be34a43b38ff8e65bec9c5e68978a349dc910e84f059fd44ffab47d6559a50fb51bda0e87318fc794487fe878c8dc79854867d54b64";
const DATABASE_ID = "68ba8a9c001f17064e15";

// Collections to backup
const COLLECTIONS = {
  user: "68ba8c240002116fa647",
  requestList: "68db7c5d000007c7fd7e",
  referencesDetails: "68da1d5f002142be75df",
  PreEvalForm: "68c7ced6001bd14d08f4",
  EvalForm: "68bf9d5600257a20775a",
  PostEvalForm: "68bf9d62002b4f5f7f23",
  createForm: "68ba918c0022d2b9a429",
};

// Initialize Appwrite client
const client = new Client();
client.setEndpoint(APPWRITE_ENDPOINT);
client.setProject(PROJECT_ID);
client.setKey(API_KEY);

const databases = new Databases(client);

/**
 * Fetch all documents from a collection (handles pagination)
 */
async function fetchAllDocuments(collectionId) {
  let allDocuments = [];
  let offset = 0;
  const limit = 100;

  try {
    while (true) {
      const response = await databases.listDocuments(
        DATABASE_ID,
        collectionId,
        [],
        limit,
        offset
      );

      if (response.documents.length === 0) {
        break;
      }

      allDocuments = [...allDocuments, ...response.documents];

      if (response.documents.length < limit) {
        break;
      }

      offset += limit;
    }
  } catch (err) {
    console.error(`Error fetching documents from ${collectionId}:`, err.message);
    throw err;
  }

  return allDocuments;
}

/**
 * Create backup folder if it doesn't exist
 */
function ensureBackupFolder() {
  const backupDir = "backup";
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`📁 Created backup folder`);
  }
  return backupDir;
}

/**
 * Convert documents to CSV and save to file
 */
async function exportCollectionToCSV(name, collectionId, backupDir) {
  console.log(`📥 Fetching data from collection: ${name}`);

  try {
    const documents = await fetchAllDocuments(collectionId);

    if (documents.length === 0) {
      console.log(`   ⚠️  No documents found in ${name}`);
      return;
    }

    // Flatten nested objects for CSV compatibility
    const flattenedDocs = documents.map((doc) => flattenObject(doc));

    // Parse to CSV
    const parser = new Parser();
    const csv = parser.parse(flattenedDocs);

    // Save to file with timestamp in backup folder
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${name}_backup_${timestamp}.csv`;
    const filepath = `${backupDir}/${filename}`;

    fs.writeFileSync(filepath, csv);

    console.log(
      `✅ Saved ${filepath} (${documents.length} records)`
    );

    return { filename, filepath };
  } catch (err) {
    console.error(`❌ Error exporting ${name}:`, err.message);
  }
}

/**
 * Flatten nested objects for CSV export
 */
function flattenObject(obj, prefix = "") {
  const flattened = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}_${key}` : key;

      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(flattened, flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        flattened[newKey] = JSON.stringify(value);
      } else {
        flattened[newKey] = value;
      }
    }
  }

  return flattened;
}

/**
 * Backup all collections
 */
async function backupAllCollections() {
  console.log("\n🚀 Starting Appwrite Database Backup...\n");

  // Create backup folder
  const backupDir = ensureBackupFolder();

  const results = [];

  for (const [name, collectionId] of Object.entries(COLLECTIONS)) {
    const result = await exportCollectionToCSV(name, collectionId, backupDir);
    if (result) {
      results.push({ name, filepath: result.filepath });
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("🎉 All collections backed up successfully!");
  console.log("=".repeat(50));
  console.log("\n📊 Summary:");
  results.forEach((r) => {
    console.log(`   • ${r.name} → ${r.filepath}`);
  });
  console.log("\n📁 All files saved in: ./backup/");
  console.log("\n📝 You can now:");
  console.log("   • Open CSV files in Excel");
  console.log("   • Search and filter data");
  console.log("   • Print directly from Excel");
  console.log("=".repeat(50) + "\n");
}

// Run backup
backupAllCollections().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});