-- Migration: Add 'video' to message_type enum
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'video';
