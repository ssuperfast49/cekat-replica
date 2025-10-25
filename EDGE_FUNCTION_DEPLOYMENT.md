# Edge Function Deployment Guide

## Deploy the Auth Check Edge Function

To prevent deactivated users from authenticating, you need to deploy the edge function to your Supabase project.

### Prerequisites

1. Supabase CLI installed
2. Your project linked to Supabase

### Deployment Steps

1. **Deploy the edge function:**
   ```bash
   supabase functions deploy auth-check
   ```

2. **Apply the database migration:**
   ```bash
   supabase db push
   ```

3. **Verify the deployment:**
   ```bash
   supabase functions list
   ```

### Edge Function Details

- **Function Name:** `auth-check`
- **Purpose:** Validates user authentication and checks account status
- **Input:** JWT token in Authorization header
- **Output:** Success/error response with user status

### Database Changes

The migration adds:
- RLS policies to prevent deactivated users from accessing data
- Helper functions for account status validation
- Updated policies on key tables (org_members, ai_profiles, etc.)

### Testing

1. Try logging in with a deactivated account (`is_active = false`)
2. The login should be blocked immediately
3. Active accounts should work normally

### Fallback Behavior

If the edge function fails, the system falls back to direct database checks to ensure reliability.
