# Chat Integration Setup Guide

## Overview
The ChatMock component has been integrated with Supabase to use real conversation and message data from the database.

## Database Tables Used
- `contacts` - Contact information
- `channels` - Communication channels (WhatsApp, Web, etc.)
- `threads` - Conversation threads
- `messages` - Individual messages within threads

## Setup Instructions

### 1. Insert Sample Data
Run the SQL commands in `sample_data.sql` in your Supabase SQL editor to create sample conversations and messages.

### 2. Database Schema
The integration expects the following table structure:

#### contacts
- `id` (uuid, primary key)
- `org_id` (uuid)
- `name` (text)
- `email` (text)
- `phone` (text)
- `notes` (text)
- `locale` (text)
- `created_at` (timestamp)

#### channels
- `id` (uuid, primary key)
- `org_id` (uuid)
- `type` (text) - 'whatsapp', 'web', etc.
- `provider` (text) - 'meta', 'web', etc.
- `display_name` (text)
- `is_active` (boolean)

#### threads
- `id` (uuid, primary key)
- `org_id` (uuid)
- `contact_id` (uuid, foreign key to contacts)
- `channel_id` (uuid, foreign key to channels)
- `status` (enum) - 'open', 'pending', 'closed'
- `assignee_user_id` (uuid, nullable)
- `last_msg_at` (timestamp)
- `created_at` (timestamp)

#### messages
- `id` (uuid, primary key)
- `thread_id` (uuid, foreign key to threads)
- `direction` (enum) - 'in', 'out'
- `role` (enum) - 'user', 'assistant', 'agent', 'system'
- `type` (enum) - 'text', 'image', 'video', 'audio', 'file', 'sticker', 'location'
- `body` (text, nullable)
- `topic` (text)
- `extension` (text)
- `payload` (jsonb)
- `event` (text, nullable)
- `private` (boolean)
- `created_at` (timestamp)

## Features Implemented

### 1. Real-time Data Loading
- Conversations are loaded from the `threads` table with contact and channel details
- Messages are loaded from the `messages` table when a conversation is selected

### 2. Message Sending
- New messages are saved to the database
- Real-time updates when messages are sent

### 3. Search and Filtering
- Search conversations by contact name or message content
- Filter by assignment status

### 4. UI Enhancements
- Loading states for data fetching
- Error handling and display
- Auto-scroll to latest messages
- Refresh button for conversations
- Keyboard shortcuts (Enter to send)

### 5. Contact Details
- Display contact information in the sidebar
- Show assignment status
- Channel information

## Usage

1. **View Conversations**: The left panel shows all conversations with contact names and last message previews
2. **Select Conversation**: Click on any conversation to load its messages
3. **Send Messages**: Type in the input field and press Enter or click Send
4. **Search**: Use the search bar to filter conversations
5. **Refresh**: Click the refresh button to reload conversations

## Customization

### Adding New Message Types
To support new message types (images, files, etc.), update the `Message` interface and `Bubble` component.

### Custom Channels
Add new channels to the `channels` table and update the channel display logic in the component.

### Assignment Logic
Implement user assignment by updating the `assignThread` function in the `useConversations` hook.

## Troubleshooting

### No Conversations Showing
1. Check if sample data has been inserted
2. Verify the `org_id` matches your organization
3. Check browser console for errors

### Messages Not Loading
1. Verify thread_id relationships in the messages table
2. Check if the selected conversation has a valid thread_id

### Send Message Failing
1. Check if the thread_id is valid
2. Verify database permissions for INSERT operations
3. Check browser console for error details
