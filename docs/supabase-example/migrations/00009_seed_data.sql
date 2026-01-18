-- Migration: 00009_seed_data
-- Description: Seed data for garages and sample content
-- Created: 2026-01-16

-- Seed garages
INSERT INTO public.garages (id, name, description, brand_color, member_count) VALUES
  ('ford', 'Ford Garage', 'Built Ford Tough community for F-Series, Mustang, Bronco, and all Ford enthusiasts', '#003478', 0),
  ('dodge', 'Dodge Garage', 'Mopar or no car! Challenger, Charger, Ram, and all Dodge/Chrysler vehicles', '#C8102E', 0),
  ('chevy', 'Chevy Garage', 'Like a rock community for Silverado, Camaro, Corvette, and Chevrolet fans', '#F2A900', 0),
  ('jeep', 'Jeep Garage', 'Trail rated adventurers - Wrangler, Gladiator, Cherokee, and all Jeep models', '#006341', 0),
  ('general', 'General Garage', 'All makes and models welcome - the universal automotive community', '#757575', 0),
  ('swap-shop', 'Swap Shop', 'Buy, sell, and trade automotive parts and accessories', '#FF6B35', 0)
ON CONFLICT (id) DO NOTHING;

-- Note: Forum threads and chat messages require user_id references
-- These will be created dynamically when users sign up
-- Below is a sample thread structure for reference

-- Sample SQL to create a thread (run after admin user exists):
/*
-- First, get an admin user ID
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    -- Create sample welcome thread in Ford garage
    INSERT INTO public.forum_threads (garage_id, user_id, title, content, is_pinned)
    VALUES (
      'ford',
      admin_user_id,
      'Welcome to Ford Garage!',
      'Welcome to the Ford Garage community! This is the place to discuss all things Ford - from classic Mustangs to the latest F-150s, Broncos, and everything in between.

## Community Guidelines
1. Be respectful to fellow enthusiasts
2. Share your knowledge and help others
3. No spam or self-promotion without approval
4. Keep discussions on-topic

## Popular Topics
- Engine builds and modifications
- Suspension and lift kits
- Electrical troubleshooting
- Maintenance tips and tricks
- Part recommendations

Feel free to introduce yourself and share what you''re driving!',
      TRUE
    );
    
    -- Create sample discussion thread
    INSERT INTO public.forum_threads (garage_id, user_id, title, content)
    VALUES (
      'ford',
      admin_user_id,
      'Best cold air intake for 5.0 Coyote?',
      'Looking to add a cold air intake to my 2019 F-150 with the 5.0L Coyote. What are you all running? 

Considering:
- K&N 77 Series
- S&B Cold Air Intake
- aFe Momentum GT

Main priorities are sound improvement and maybe a few extra ponies. Not looking to tune, just bolt-on performance.

What has worked well for you?'
    );
  END IF;
END $$;
*/

-- Create sample approved products
INSERT INTO public.products (title, description, price, vendor_name, affiliate_url, category, status) VALUES
  ('K&N Cold Air Intake Kit', 'High-flow performance air intake for improved horsepower and throttle response. Washable and reusable filter.', '$349.99', 'K&N Engineering', 'https://www.knfilters.com', 'Performance', 'approved'),
  ('Bilstein 5100 Shock Kit', 'Premium monotube shocks for lifted trucks. Adjustable ride height settings for 0-2.5" lift.', '$599.99', 'Bilstein', 'https://www.bilstein.com', 'Suspension', 'approved'),
  ('Flowmaster Super 44 Muffler', 'Aggressive deep tone exhaust with improved flow. 409 stainless steel construction.', '$179.99', 'Flowmaster', 'https://www.flowmastermufflers.com', 'Exhaust', 'approved'),
  ('Rigid Industries LED Light Bar', '20-inch spot/flood combo LED bar, 20,000 lumens. IP68 waterproof rating.', '$449.99', 'Rigid Industries', 'https://www.rigidindustries.com', 'Lighting', 'approved'),
  ('WeatherTech Floor Liners', 'Custom-fit floor protection for all weather conditions. Laser measured for perfect fit.', '$189.99', 'WeatherTech', 'https://www.weathertech.com', 'Interior', 'approved'),
  ('Borla Cat-Back Exhaust System', 'T-304 stainless steel performance exhaust with deep aggressive tone.', '$899.99', 'Borla', 'https://www.borla.com', 'Exhaust', 'approved')
ON CONFLICT DO NOTHING;
