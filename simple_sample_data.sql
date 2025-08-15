-- Simple sample data using existing contact
-- Run this in your Supabase SQL editor

-- Create a simple channel
INSERT INTO channels (org_id, type, provider, display_name, is_active) VALUES 
('00000000-0000-0000-0000-000000000001', 'whatsapp', 'meta', 'WhatsApp Business', true)
ON CONFLICT DO NOTHING;

-- Create a thread using the existing contact (Budi Bambang)
INSERT INTO threads (org_id, contact_id, channel_id, status, assignee_user_id, last_msg_at) VALUES 
('00000000-0000-0000-0000-000000000001', 
 (SELECT id FROM contacts WHERE name = 'Budi Bambang' AND org_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
 (SELECT id FROM channels WHERE display_name = 'WhatsApp Business' AND org_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
 'open', NULL, NOW() - INTERVAL '10 minutes')
ON CONFLICT DO NOTHING;

-- Create messages for the conversation
INSERT INTO messages (thread_id, direction, role, type, body, topic, extension, payload, event, private) VALUES 
((SELECT t.id FROM threads t 
  JOIN contacts c ON t.contact_id = c.id 
  WHERE c.name = 'Budi Bambang' AND t.org_id = '00000000-0000-0000-0000-000000000001' 
  LIMIT 1),
 'in', 'user', 'text', 'Halo, saya butuh bantuan pesanan.', 'chat', 'text', '{}', NULL, false),

((SELECT t.id FROM threads t 
  JOIN contacts c ON t.contact_id = c.id 
  WHERE c.name = 'Budi Bambang' AND t.org_id = '00000000-0000-0000-0000-000000000001' 
  LIMIT 1),
 'out', 'agent', 'text', 'Halo Budi! Tentu, mohon tunggu sebentar ya, saya cek dulu.', 'chat', 'text', '{}', NULL, false),

((SELECT t.id FROM threads t 
  JOIN contacts c ON t.contact_id = c.id 
  WHERE c.name = 'Budi Bambang' AND t.org_id = '00000000-0000-0000-0000-000000000001' 
  LIMIT 1),
 'in', 'user', 'text', 'Baik, terima kasih.', 'chat', 'text', '{}', NULL, false);
