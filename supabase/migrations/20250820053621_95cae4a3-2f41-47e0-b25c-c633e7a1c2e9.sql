-- Create platforms table
CREATE TABLE public.platforms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  business_category TEXT,
  whatsapp_display_name TEXT,
  display_name TEXT,
  website_url TEXT,
  status TEXT,
  profile_photo_url TEXT,
  whatsapp_number TEXT,
  secret_token TEXT,
  ai_profile_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create platform_human_agents junction table
CREATE TABLE public.platform_human_agents (
  platform_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (platform_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_human_agents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for platforms
CREATE POLICY "Users can view platforms from their organization" 
ON public.platforms 
FOR SELECT 
USING (
  org_id IN (
    SELECT org_id FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create platforms for their organization" 
ON public.platforms 
FOR INSERT 
WITH CHECK (
  org_id IN (
    SELECT org_id FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update platforms from their organization" 
ON public.platforms 
FOR UPDATE 
USING (
  org_id IN (
    SELECT org_id FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete platforms from their organization" 
ON public.platforms 
FOR DELETE 
USING (
  org_id IN (
    SELECT org_id FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

-- Create RLS policies for platform_human_agents
CREATE POLICY "Users can view platform human agents from their organization" 
ON public.platform_human_agents 
FOR SELECT 
USING (
  platform_id IN (
    SELECT id FROM public.platforms 
    WHERE org_id IN (
      SELECT org_id FROM public.org_members 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage platform human agents for their organization" 
ON public.platform_human_agents 
FOR ALL 
USING (
  platform_id IN (
    SELECT id FROM public.platforms 
    WHERE org_id IN (
      SELECT org_id FROM public.org_members 
      WHERE user_id = auth.uid()
    )
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_platforms_updated_at
BEFORE UPDATE ON public.platforms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();