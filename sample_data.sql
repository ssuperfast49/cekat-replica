-- Sample data for conversations and messages
-- Run these commands in your Supabase SQL editor

-- First, let's create some additional contacts
INSERT INTO contacts (org_id, name, email, phone, notes, locale) VALUES 
('00000000-0000-0000-0000-000000000001', 'Dewi Sari', 'dewi.sari@example.com', '+6281234567890', 'VIP customer', 'id'),
('00000000-0000-0000-0000-000000000001', 'Budi Santoso', 'budi.santoso@example.com', '+6281234567891', 'Regular customer', 'id'),
('00000000-0000-0000-0000-000000000001', 'Sari Indah', 'sari.indah@example.com', '+6281234567892', 'New customer', 'id'),
('00000000-0000-0000-0000-000000000001', 'Andi Wijaya', 'andi.wijaya@example.com', '+6281234567893', 'Premium customer', 'id')
ON CONFLICT DO NOTHING;

-- Create some channels
INSERT INTO channels (org_id, type, provider, display_name, is_active) VALUES 
('00000000-0000-0000-0000-000000000001', 'whatsapp', 'meta', 'WhatsApp Business', true),
('00000000-0000-0000-0000-000000000001', 'web', 'web', 'Website Chat', true),
('00000000-0000-0000-0000-000000000001', 'whatsapp', 'meta', 'WhatsApp Support', true)
ON CONFLICT DO NOTHING;

-- Create threads/conversations
INSERT INTO threads (org_id, contact_id, channel_id, status, assignee_user_id, last_msg_at) VALUES 
-- Get the contact ID for Dewi Sari
('00000000-0000-0000-0000-000000000001', 
 (SELECT id FROM contacts WHERE name = 'Dewi Sari' AND org_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
 (SELECT id FROM channels WHERE display_name = 'WhatsApp Business' AND org_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
 'open', NULL, NOW() - INTERVAL '10 minutes'),

-- Get the contact ID for Budi Santoso
('00000000-0000-0000-0000-000000000001', 
 (SELECT id FROM contacts WHERE name = 'Budi Santoso' AND org_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
 (SELECT id FROM channels WHERE display_name = 'Website Chat' AND org_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
 'open', NULL, NOW() - INTERVAL '30 minutes'),

-- Get the contact ID for Sari Indah
('00000000-0000-0000-0000-000000000001', 
 (SELECT id FROM contacts WHERE name = 'Sari Indah' AND org_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
 (SELECT id FROM channels WHERE display_name = 'WhatsApp Support' AND org_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
 'pending', NULL, NOW() - INTERVAL '1 hour'),

-- Get the contact ID for Andi Wijaya
('00000000-0000-0000-0000-000000000001', 
 (SELECT id FROM contacts WHERE name = 'Andi Wijaya' AND org_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
 (SELECT id FROM channels WHERE display_name = 'WhatsApp Business' AND org_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
 'closed', NULL, NOW() - INTERVAL '2 hours')
ON CONFLICT DO NOTHING;

-- Create messages for the conversations
-- Messages for Dewi Sari's conversation
INSERT INTO messages (thread_id, direction, role, type, body, topic, extension, payload, event, private) VALUES 
-- Get the thread ID for Dewi Sari's conversation
((SELECT t.id FROM threads t 
  JOIN contacts c ON t.contact_id = c.id 
  WHERE c.name = 'Dewi Sari' AND t.org_id = '00000000-0000-0000-0000-000000000001' 
  LIMIT 1),
 'in', 'user', 'text', 'Halo, saya butuh bantuan pesanan.', 'chat', 'text', '{}', NULL, false),

((SELECT t.id FROM threads t 
  JOIN contacts c ON t.contact_id = c.id 
  WHERE c.name = 'Dewi Sari' AND t.org_id = '00000000-0000-0000-0000-000000000001' 
  LIMIT 1),
 'out', 'agent', 'text', 'Halo Dewi! Tentu, mohon tunggu sebentar ya, saya cek dulu.', 'chat', 'text', '{}', NULL, false),

((SELECT t.id FROM threads t 
  JOIN contacts c ON t.contact_id = c.id 
  WHERE c.name = 'Dewi Sari' AND t.org_id = '00000000-0000-0000-0000-000000000001' 
  LIMIT 1),
 'in', 'user', 'text', 'Baik, terima kasih.', 'chat', 'text', '{}', NULL, false);

-- Messages for Budi Santoso's conversation
INSERT INTO messages (thread_id, direction, role, type, body, topic, extension, payload, event, private) VALUES 
((SELECT t.id FROM threads t 
  JOIN contacts c ON t.contact_id = c.id 
  WHERE c.name = 'Budi Santoso' AND t.org_id = '00000000-0000-0000-0000-000000000001' 
  LIMIT 1),
 'in', 'user', 'text', 'Apakah stok masih ada?', 'chat', 'text', '{}', NULL, false),

((SELECT t.id FROM threads t 
  JOIN contacts c ON t.contact_id = c.id 
  WHERE c.name = 'Budi Santoso' AND t.org_id = '00000000-0000-0000-0000-000000000001' 
  LIMIT 1),
 'out', 'agent', 'text', 'Halo Budi! Ya, stok masih tersedia. Mau pesan berapa?', 'chat', 'text', '{}', NULL, false);

-- Messages for Sari Indah's conversation
INSERT INTO messages (thread_id, direction, role, type, body, topic, extension, payload, event, private) VALUES 
((SELECT t.id FROM threads t 
  JOIN contacts c ON t.contact_id = c.id 
  WHERE c.name = 'Sari Indah' AND t.org_id = '00000000-0000-0000-0000-000000000001' 
  LIMIT 1),
 'in', 'user', 'text', 'Terima kasih atas responnya!', 'chat', 'text', '{}', NULL, false),

((SELECT t.id FROM threads t 
  JOIN contacts c ON t.contact_id = c.id 
  WHERE c.name = 'Sari Indah' AND t.org_id = '00000000-0000-0000-0000-000000000001' 
  LIMIT 1),
 'out', 'agent', 'text', 'Sama-sama Sari! Senang bisa membantu.', 'chat', 'text', '{}', NULL, false);

-- Messages for Andi Wijaya's conversation
INSERT INTO messages (thread_id, direction, role, type, body, topic, extension, payload, event, private) VALUES 
((SELECT t.id FROM threads t 
  JOIN contacts c ON t.contact_id = c.id 
  WHERE c.name = 'Andi Wijaya' AND t.org_id = '00000000-0000-0000-0000-000000000001' 
  LIMIT 1),
 'in', 'user', 'text', 'Bisa kirim hari ini?', 'chat', 'text', '{}', NULL, false),

((SELECT t.id FROM threads t 
  JOIN contacts c ON t.contact_id = c.id 
  WHERE c.name = 'Andi Wijaya' AND t.org_id = '00000000-0000-0000-0000-000000000001' 
  LIMIT 1),
 'out', 'agent', 'text', 'Halo Andi! Ya, bisa dikirim hari ini. Pesanan sudah diproses.', 'chat', 'text', '{}', NULL, false);
