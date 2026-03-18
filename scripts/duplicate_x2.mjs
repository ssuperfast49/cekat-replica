import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Setup DEV supabase client
const SUPABASE_URL = "https://bkynymyhbfrhvwxqqttk.supabase.co"; // DEV
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJreW55bXloYmZyaHZ3eHFxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5Mzk1NzIsImV4cCI6MjA3OTUxNTU3Mn0.4ELI9s6908SdW2jd1BM_ht8pTIyLAwPpsqGiGNCdcC0";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function extractJson(filePath) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const content = parsed.result;

    const lines = content.split('\n');
    const dataLines = [];
    let capturing = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('</untrusted-data')) {
            capturing = false;
        }
        if (capturing) {
            dataLines.push(lines[i]);
        }
        if (line.match(/^<untrusted-data-[a-f0-9-]+>$/)) {
            capturing = true;
        }
    }
    return JSON.parse(dataLines.join('\n'));
}

const DEV_COMBOS = [
    { contact: 'ae71278e-519d-406c-ae01-57cd94e89b2e', channel: '6a24d748-71f9-41b0-ade6-235bad2f3167', org: '00000000-0000-0000-0000-000000000001' },
    { contact: 'b9cf5d77-43fd-47cf-9349-862d064f172a', channel: '972bd13e-1f20-47b5-9812-a9aae77ff767', org: '00000000-0000-0000-0000-000000000001' },
    { contact: '3578b473-264f-44fd-aa0f-1ef68085a1dc', channel: '46cc1b3f-b7f0-42bd-a7e6-1e5be1eade62', org: '00000000-0000-0000-0000-000000000001' },
    { contact: '9c991452-064c-4072-a169-83ca3bf08c53', channel: '4157f696-35a3-4224-bdda-4ec1d3a12b05', org: '00000000-0000-0000-0000-000000000001' },
    { contact: '2b842827-a08b-4056-a4cd-14ef014d08b4', channel: '2aa46d7e-1990-4265-bddb-90695894fb39', org: '00000000-0000-0000-0000-000000000001' }
];

async function main() {
    console.log("Extracting JSON from local cache...");
    const prodThreads = extractJson('C:/Users/resha/.gemini/antigravity/brain/a0024b0b-10ee-4b1e-91b0-8cb649cdd6af/.system_generated/steps/2799/output.txt');
    const prodMessages = extractJson('C:/Users/resha/.gemini/antigravity/brain/a0024b0b-10ee-4b1e-91b0-8cb649cdd6af/.system_generated/steps/2732/output.txt');

    console.log(`Loaded ${prodThreads.length} threads and ${prodMessages.length} messages.`);

    // Group messages by thread_id for O(1) matching
    const messageGroups = {};
    for (const msg of prodMessages) {
        if (!messageGroups[msg.thread_id]) messageGroups[msg.thread_id] = [];
        messageGroups[msg.thread_id].push(msg);
    }

    const newThreads = [];
    const newMessages = [];

    let comboIdx = 0;

    for (const t of prodThreads) {
        // Create 2 duplicates
        for (let i = 0; i < 2; i++) {
            const newTId = crypto.randomUUID();
            const combo = DEV_COMBOS[comboIdx % DEV_COMBOS.length];
            comboIdx++;

            const newT = { ...t };
            newT.id = newTId;
            newT.account_id = crypto.randomUUID();
            newT.contact_id = combo.contact;
            newT.channel_id = combo.channel;
            newT.org_id = combo.org;
            // Clear any user allocations just from safe mock testing
            newT.assignee_user_id = null;
            newT.assigned_by_user_id = null;
            newT.resolved_by_user_id = null;
            newT.collaborator_user_id = null;

            newThreads.push(newT);

            const mGroup = messageGroups[t.id] || [];

            // Generate UUIDs for messages beforehand in case we want to map in_reply_to, but for now we nullify it.
            for (const m of mGroup) {
                const newM = { ...m };
                newM.id = crypto.randomUUID();
                newM.thread_id = newTId;
                delete newM.in_reply_to;
                // Nullify users too
                newM.actor_id = null;

                newMessages.push(newM);
            }
        }
    }

    console.log(`Prepared ${newThreads.length} duplicated threads and ${newMessages.length} duplicated messages.`);

    // Insert threads in batches
    console.log("Inserting threads in batches of 100...");
    for (let i = 0; i < newThreads.length; i += 100) {
        const batch = newThreads.slice(i, i + 100);
        const { error } = await supabase.from('threads').insert(batch);
        if (error) {
            console.error("Error inserting threads:", error.message);
            return;
        }
    }

    // Insert messages in batches
    console.log("Inserting messages in batches of 200...");
    for (let i = 0; i < newMessages.length; i += 200) {
        const batch = newMessages.slice(i, i + 200);
        const { error } = await supabase.from('messages').insert(batch);
        if (error) {
            console.error("Error inserting messages:", error.message);
            return;
        }
    }

    console.log("DONE! Data migration and multiplication completed successfully.");
}

main().catch(console.error);
