import { Client, Databases } from "appwrite";
import { Parser } from "json2csv";
import fs from "fs";

const APPWRITE_ENDPOINT = "https://cloud.appwrite.io/v1";
const PROJECT_ID = "68ddd7de00255d4f5c96";
const API_KEY = "standard_8188632fa04db969225e3e89d287ca3d97c7c07b396325548c73b75226654a94b6c45b18bb5772d89bb81e8d9dd9a3e5efacb2d7752ad045271b639f892f18d187661f9301ae3951fd994be34a43b38ff8e65bec9c5e68978a349dc910e84f059fd44ffab47d6559a50fb51bda0e87318fc794487fe878c8dc79854867d54b64";
const DATABASE_ID = "68ba8a9c001f17064e15";
const COLLECTIONS = {
    "user": "68ba8c240002116fa647", 
    "requestList": "68db7c5d000007c7fd7e",
    "referencesDetails": "68da1d5f002142be75df",
    "PreEvalForm": "68c7ced6001bd14d08f4",
    "EvalForm": "68bf9d5600257a20775a",
    "PostEvalForm": "68bf9d62002b4f5f7f23",
    "createForm": "68ba918c0022d2b9a429"
};

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

async function backupData() {
for (const [name, collectionId] of Object.entries(COLLECTIONS)) {
  console.log(`Fetching data from collection: ${name}`);

    try {
      const response = await databases.listDocuments(DATABASE_ID, collectionId);

      if (response.documents.length === 0) {
        console.log(`No documents found in ${collectionId}`);
        continue;
      }

      const parser = new Parser();
      const csv = parser.parse(response.documents.map(d => d));

      const filename = `${name}_backup.csv`;
      fs.writeFileSync(filename, csv);
      console.log(`✅ Saved ${filename} (${response.documents.length} records)`);
        
    } catch (err) {
      console.error(`❌ Error fetching ${collectionId}:`, err.message);
    }
  }

  console.log("\n🎉 All collections backed up successfully!");
  console.log("You can now open the CSV files in Excel or print them.");
}

backupData();
