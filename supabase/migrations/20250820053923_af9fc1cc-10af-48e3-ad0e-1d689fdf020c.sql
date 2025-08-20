-- Enable RLS on ai_profiles table if not already enabled
ALTER TABLE public.ai_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ai_profiles
CREATE POLICY "Users can view AI profiles from their organization" 
ON public.ai_profiles 
FOR SELECT 
USING (
  org_id IN (
    SELECT org_id FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create AI profiles for their organization" 
ON public.ai_profiles 
FOR INSERT 
WITH CHECK (
  org_id IN (
    SELECT org_id FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update AI profiles from their organization" 
ON public.ai_profiles 
FOR UPDATE 
USING (
  org_id IN (
    SELECT org_id FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete AI profiles from their organization" 
ON public.ai_profiles 
FOR DELETE 
USING (
  org_id IN (
    SELECT org_id FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

-- Insert sample AI profiles for testing
INSERT INTO public.ai_profiles (org_id, name, description, system_prompt, welcome_message, transfer_conditions, stop_ai_after_handoff, model, temperature) VALUES 
('00000000-0000-0000-0000-000000000001', 'Customer Support AI', 'AI agent specialized in customer support and FAQ', 'You are a helpful customer support agent. Always be polite and try to resolve customer issues efficiently.', 'Hello! How can I help you today?', 'Transfer to human agent if customer requests to speak with a human or if the issue requires specialized technical knowledge.', true, 'gpt-4o-mini', 0.3),
('00000000-0000-0000-0000-000000000001', 'Sales Assistant AI', 'AI agent focused on sales and lead qualification', 'You are a sales assistant. Help customers find the right products and guide them through the purchase process.', 'Welcome! I''m here to help you find exactly what you''re looking for.', 'Transfer to human sales rep when customer is ready to make a purchase or needs detailed pricing information.', true, 'gpt-4o-mini', 0.5),
('00000000-0000-0000-0000-000000000001', 'Technical Support AI', 'AI agent for technical support and troubleshooting', 'You are a technical support specialist. Help users troubleshoot technical issues step by step.', 'Hi there! I''m your technical support assistant. What technical issue can I help you with?', 'Transfer to human technical expert for complex hardware issues or advanced troubleshooting.', true, 'gpt-4o-mini', 0.2)
ON CONFLICT DO NOTHING;